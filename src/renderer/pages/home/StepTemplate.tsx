import { FileText, ImageIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getGroupFilter,
  rankTemplates,
  setGroupFilter,
  useTemplate,
} from "../../../shared/ipc/mapping";
import {
  type GroupInfo,
  groupsList,
  list,
  type TemplateSummary,
} from "../../../shared/ipc/templates";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Status } from "../../components/ui/status";
import { cn } from "../../lib/cn";
import { formatDate } from "../../lib/date";
import { call } from "../../lib/ipc";
import { homeTemplate as t } from "../../strings/home-template";
import { NewTemplateDialog } from "../templates/NewTemplateDialog";
import { StorageBanner, useStorageStatus } from "../templates/StorageBanner";
import { flow, useFlow } from "./flow";
import { StepFooter } from "./Stepper";
import { type RankedTemplate, visibleTemplates } from "./template-search";

type Loaded = { templates: RankedTemplate[]; groups: GroupInfo[]; hasData: boolean };

const date = formatDate;

/**
 * Step 2, Mẫu: what opening the data folder found comes first. When the folder could not be opened nothing
 * below it is offered.
 */
export function StepTemplate() {
  const storage = useStorageStatus();
  if (storage === null) return <p className="text-muted">{t.loading}</p>;
  return (
    <div className="flex flex-col gap-4">
      <StorageBanner status={storage} />
      {storage.error ? null : <TemplateList />}
    </div>
  );
}

/** The search, group chips and the list of Word templates, best column match first. */
function TemplateList() {
  const { revision } = useFlow();
  const dataRevision = revision.data;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(
    () => flow.result<{ templateId: string }>("template")?.templateId ?? null,
  );
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Templates, groups and how well each fits the data now in main. Runs again when step 1 finished again.
  const load = useCallback(async () => {
    try {
      const [all, groups, fits] = await Promise.all([
        call(list),
        call(groupsList),
        call(rankTemplates),
      ]);
      const byId = new Map(fits.items.map((f) => [f.templateId, f]));
      const templates = all.map((x: TemplateSummary) => ({
        ...x,
        matched: byId.get(x.id)?.matched ?? 0,
        total: byId.get(x.id)?.total ?? x.tagCount,
      }));
      setLoaded({ templates, groups, hasData: fits.hasData });
      setFailed(false);
      setSelected((now) => (now && templates.some((x) => x.id === now) ? now : null));
    } catch {
      setFailed(true);
    }
  }, [dataRevision]);

  useEffect(() => {
    void load();
  }, [load]);

  // The chip chosen last time. A chip whose group is gone falls back to "Tất cả" (main checks it).
  useEffect(() => {
    void call(getGroupFilter).then(setGroupId, () => setGroupId(null));
  }, []);

  function chooseGroup(id: string | null) {
    setGroupId(id);
    void call(setGroupFilter, { groupId: id }).catch(() => undefined);
  }

  const shown = useMemo(
    () => (loaded ? visibleTemplates(loaded.templates, query, groupId) : []),
    [loaded, query, groupId],
  );

  // Chips: "Tất cả", each stored group, and "Chưa phân nhóm" only when a template is in it.
  const chips = useMemo(() => {
    if (!loaded) return [];
    const result: GroupInfo[] = [...loaded.groups];
    for (const x of loaded.templates) {
      if (!result.some((g) => g.id === x.groupId))
        result.push({ id: x.groupId, name: x.groupName });
    }
    return result;
  }, [loaded]);

  async function next() {
    if (!selected || !loaded) return;
    setBusy(true);
    setError("");
    try {
      const used = await call(useTemplate, { templateId: selected });
      if (!used.ok) {
        setError(used.message);
        return;
      }
      flow.complete("template", {
        summary: t.summary(used.name, used.groupName),
        result: { templateId: selected },
      });
    } catch {
      setError(t.useFailed);
    } finally {
      setBusy(false);
    }
  }

  if (failed) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Status kind="danger">{t.loadError}</Status>
        <Button variant="secondary" onClick={() => void load()}>
          {t.retry}
        </Button>
      </div>
    );
  }
  if (!loaded) return <p className="text-muted">{t.loading}</p>;

  const dialog = (
    <NewTemplateDialog
      open={creating}
      onOpenChange={setCreating}
      onCreated={(id) => {
        setSelected(id);
        void load();
      }}
    />
  );

  if (loaded.templates.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-muted">{t.empty}</p>
        <Button size="lg" onClick={() => setCreating(true)}>
          {t.createFirst}
        </Button>
        {dialog}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-64 flex-1">
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.search}
            aria-label={t.search}
          />
        </div>
        <Button variant="secondary" onClick={() => setCreating(true)}>
          {t.newTemplate}
        </Button>
      </div>

      <div role="group" aria-label={t.groupsLabel} className="flex flex-wrap gap-2">
        <Chip active={groupId === null} onClick={() => chooseGroup(null)}>
          {t.all}
        </Chip>
        {chips.map((g) => (
          <Chip key={g.id} active={groupId === g.id} onClick={() => chooseGroup(g.id)}>
            {g.name}
          </Chip>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-muted">{t.noResults}</p>
      ) : (
        <ul aria-label={t.listLabel} className="m-0 flex list-none flex-col gap-2 p-0">
          {shown.map((x) => (
            <li key={x.id}>
              <button
                type="button"
                aria-pressed={selected === x.id}
                data-testid="template-row"
                onClick={() => setSelected(x.id)}
                className={cn(
                  "flex w-full items-center gap-4 rounded-control border-2 px-4 py-3 text-left transition-colors hover:bg-panel",
                  selected === x.id
                    ? "border-accent bg-raised shadow-card"
                    : "border-line bg-raised",
                )}
              >
                {x.kind === "image" ? (
                  <ImageIcon
                    aria-hidden="true"
                    data-testid="template-icon-image"
                    className="size-6 shrink-0 text-muted"
                  />
                ) : (
                  <FileText aria-hidden="true" className="size-6 shrink-0 text-muted" />
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-lg font-bold">{x.name}</span>
                  <span className="text-sm text-muted" data-testid="template-hint">
                    {hint(x, loaded.hasData)}
                  </span>
                </span>
                {selected === x.id ? <span className="sr-only">{t.selected}</span> : null}
                <span className="shrink-0 rounded-control border border-line px-2 py-0.5 text-sm text-muted">
                  {x.groupName}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {error ? <Status kind="danger">{error}</Status> : null}
      <StepFooter>
        <Button disabled={!selected || busy} onClick={() => void next()}>
          {t.continue}
        </Button>
      </StepFooter>
      {dialog}
    </div>
  );
}

/** "Khớp x/y trường, dùng dd/mm/yyyy". Without data or without fields the match part says what it can. */
function hint(x: RankedTemplate, hasData: boolean): string {
  const used = x.lastUsedAt ? t.usedOn(date(x.lastUsedAt)) : t.neverUsed;
  const fit =
    x.total === 0 ? t.noFields : hasData ? t.fit(x.matched, x.total) : t.fieldsOnly(x.total);
  return `${fit}, ${used}`;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-1.5 font-semibold transition-colors",
        active ? "border-accent bg-accent text-on-accent" : "border-line hover:bg-panel",
      )}
    >
      {children}
    </button>
  );
}
