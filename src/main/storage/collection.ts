import * as fsp from "node:fs/promises";
import path from "node:path";
import { t } from "../../shared/i18n";
import { freeBackupName, type RenameFn, writeFileAtomic } from "./atomic";
import { StorageError, type StorageWarning } from "./types";

/** Upgrades `data` from schema version `from` to `from + 1`. */
export type Migration = (data: unknown) => unknown;

interface Envelope {
  schemaVersion: number;
  data: unknown;
}

export interface CollectionOptions<T> {
  folder: string;
  /** File name inside the folder, e.g. `templates.json`. */
  file: string;
  /** Used when the file is missing or was moved aside. */
  empty: () => T;
  /**
   * For array collections: a record that fails this check is skipped instead of condemning the whole file.
   * The original file is copied aside first and a warning is added.
   */
  checkItem?: (item: unknown) => boolean;
  /** Returns true when `data` has the current shape. */
  isValid: (data: unknown) => data is T;
  migrations: Record<number, Migration>;
  rename: RenameFn;
  /** Version the app writes; tests raise it to exercise migrations. */
  version: number;
  warnings: StorageWarning[];
}

const CORRUPT_MESSAGE = (file: string, movedTo: string) =>
  t(
    `Không đọc được dữ liệu trong ${file}. File đã được đổi tên thành ${movedTo} và ứng dụng bắt đầu với dữ liệu trống.`,
    `Could not read the data in ${file}. The file was renamed to ${movedTo} and the app started with empty data.`,
  );

const SKIPPED_MESSAGE = (file: string, count: number, movedTo: string) =>
  t(
    `${count} mục trong ${file} không hợp lệ nên đã bị bỏ qua. Bản gốc được giữ lại thành ${movedTo}.`,
    `${count} items in ${file} were not valid and were skipped. The original was kept as ${movedTo}.`,
  );

/**
 * One JSON file holding one collection, kept in memory. All mutations go through a promise queue, so
 * two concurrent writes in this process never interleave. A mutation is committed in memory only after
 * the file was written.
 */
export class Collection<T> {
  private value: T;
  private queue: Promise<unknown> = Promise.resolve();

  private constructor(
    private readonly opts: CollectionOptions<T>,
    value: T,
  ) {
    this.value = value;
  }

  static async open<T>(opts: CollectionOptions<T>): Promise<Collection<T>> {
    const target = path.join(opts.folder, opts.file);
    let text: string;
    try {
      text = await fsp.readFile(target, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return new Collection(opts, opts.empty());
      }
      return Collection.moveAside(opts, target);
    }

    let envelope: Envelope;
    try {
      const parsed: unknown = JSON.parse(text);
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        !Number.isInteger((parsed as Envelope).schemaVersion) ||
        (parsed as Envelope).schemaVersion < 1 ||
        !("data" in parsed)
      ) {
        return Collection.moveAside(opts, target);
      }
      envelope = parsed as Envelope;
    } catch {
      return Collection.moveAside(opts, target);
    }

    if (envelope.schemaVersion > opts.version) {
      throw new StorageError(
        "newer-schema",
        t(
          `${opts.file} được tạo bởi phiên bản Sheetstamp mới hơn. Hãy cập nhật ứng dụng; dữ liệu chưa bị thay đổi.`,
          `${opts.file} was created by a newer version of Sheetstamp. Update the app; the data has not been changed.`,
        ),
        opts.file,
      );
    }

    let data = envelope.data;
    const migrated = envelope.schemaVersion < opts.version;
    try {
      for (let v = envelope.schemaVersion; v < opts.version; v++) {
        const step = opts.migrations[v];
        if (!step) throw new Error(`no migration from version ${v}`);
        data = step(data);
      }
    } catch {
      return Collection.moveAside(opts, target);
    }

    let skipped = 0;
    if (opts.checkItem && Array.isArray(data)) {
      const kept = data.filter(opts.checkItem);
      skipped = data.length - kept.length;
      data = kept;
    }
    if (!opts.isValid(data)) return Collection.moveAside(opts, target);

    const collection = new Collection(opts, data);
    if (migrated) {
      // Keep the pre-migration file once, then rewrite at the current version.
      const backup = await freeBackupName(opts.folder, `${opts.file}.v${envelope.schemaVersion}`);
      await fsp.copyFile(target, path.join(opts.folder, backup));
    }
    if (skipped > 0) {
      // Keep the original (with the bad records) aside, then rewrite without them so the next start is clean.
      const movedTo = await freeBackupName(opts.folder, opts.file);
      await fsp.copyFile(target, path.join(opts.folder, movedTo));
      opts.warnings.push({
        code: "invalid-record",
        file: opts.file,
        movedTo,
        message: SKIPPED_MESSAGE(opts.file, skipped, movedTo),
      });
    }
    if (migrated || skipped > 0) await collection.write(data);
    return collection;
  }

  private static async moveAside<T>(
    opts: CollectionOptions<T>,
    target: string,
  ): Promise<Collection<T>> {
    const movedTo = await freeBackupName(opts.folder, opts.file);
    try {
      await opts.rename(target, path.join(opts.folder, movedTo));
    } catch {
      throw new StorageError(
        "io",
        t(
          `Không đọc được ${opts.file} và không thể chuyển file sang chỗ khác.`,
          `Could not read ${opts.file} and could not move it aside.`,
        ),
        opts.file,
      );
    }
    opts.warnings.push({
      code: "corrupt-file",
      file: opts.file,
      movedTo,
      message: CORRUPT_MESSAGE(opts.file, movedTo),
    });
    return new Collection(opts, opts.empty());
  }

  /** Current value. Treat as read-only; change it through `mutate`. */
  get(): T {
    return this.value;
  }

  /** Waits for earlier writes, applies `fn` to a copy, writes it, then commits it. */
  mutate<R>(fn: (draft: T) => R): Promise<R> {
    const run = async () => {
      const draft = structuredClone(this.value);
      const result = fn(draft);
      await this.write(draft);
      this.value = draft;
      return result;
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => {});
    return next;
  }

  /** Runs `fn` after queued writes finish (for reads that must see them). */
  settled(): Promise<void> {
    return this.queue.then(() => {});
  }

  private write(data: T): Promise<void> {
    const envelope: Envelope = { schemaVersion: this.opts.version, data };
    return writeFileAtomic(
      path.join(this.opts.folder, this.opts.file),
      `${JSON.stringify(envelope, null, 2)}\n`,
      this.opts.rename,
    );
  }
}
