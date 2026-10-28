import { useEffect, useState } from "react";
import { type StorageStatus, status } from "../../../shared/ipc/storage";
import { Status } from "../../components/ui/status";
import { call } from "../../lib/ipc";

const CLEAN: StorageStatus = { warnings: [], error: null };

/**
 * What opening the data folder found. `null` until main answers; a failed call counts as "nothing to report"
 * (the page's own load error then speaks for itself).
 */
export function useStorageStatus(): StorageStatus | null {
  const [value, setValue] = useState<StorageStatus | null>(null);
  useEffect(() => {
    let live = true;
    call(status).then(
      (next) => live && setValue(next),
      () => live && setValue(CLEAN),
    );
    return () => {
      live = false;
    };
  }, []);
  return value;
}

/** Warnings (corrupt file moved aside, records skipped) and the error of a folder that could not be opened. */
export function StorageBanner({ status: value }: { status: StorageStatus | null }) {
  if (!value || (!value.error && value.warnings.length === 0)) return null;
  return (
    <div className="flex flex-col gap-2" data-testid="storage-banner">
      {value.error ? <Status kind="danger">{value.error.message}</Status> : null}
      {value.warnings.map((w) => (
        <Status key={`${w.file}:${w.message}`} kind="warning">
          {w.message}
        </Status>
      ))}
    </div>
  );
}
