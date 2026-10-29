# Handoff: simpler field matching (sheetstamp)

## Intent
Make templates easier for HR users: drop the HR dictionary, tutorial and dictionary screen. Word tags stay `{{any text}}` matched to columns by name; image fields are free-text names matched to CSV columns by position (left to right).

## Where it stopped
- Spec updated and pushed: branch `docs/simpler-field-matching` (commit "docs: drop the HR dictionary..."), no PR yet. Files: `docs/specification.md`, `GLOSSARY.md`, `docs/agents/workflow.md`, `docs/agents/domain.md`. Decisions are in the spec (section 5 Mapping, Image templates, Template library, Decisions list, "Not yet verified").
- No code changed for the feature. Tickets not planned yet (`/dev:plan-tickets` is typed by the user only).
- Plugin `dev@nhhthong-skills` 2.2.0 was installed in the cloud container from a local clone (`/home/user/skills`, ephemeral). `/reload-plugins` does not work remotely; the user runs it locally. `Mode` in `docs/agents/workflow.md` is `empowerment` (user's choice).

## On disk / only in conversation
- Full-width Word preview (`StepMapping.tsx`, `mapping-preview.tsx`): the user chose "bỏ" for the working tree, so it was reverted. The diff is kept below as an optional patch (`git apply`), not applied or committed anywhere.
- Not in any file: spec choices the user has not explicitly confirmed: deleting an image field renumbers the rest; the "one column serves one field" rule also applies to Word.
- Open owner items: recreate release v0.1.0 (user does it), mp3 licence, `buffers@0.1.1` licence, SignPath later.
- README line 41 still says "HR synonym list"; fix when code lands.
- `.claude/skills/memo-post`, `memo-callback`, `help` are stale (removed in plugin 2.2.0); deleting them awaits the user's word.

## First action on resume
Ask the user to run `/dev:plan-tickets` against `docs/specification.md`. Suggested split: (1) remove dictionary (`src/main/mapping/dictionary.ts`, `data/hr-dictionary.json`, ~15 files, tests `mapping.test.ts`, `fields.test.ts`) and derive labels from tag text; (2) mapping list: first-row value per field, one column per field with alert icon; (3) image editor: free-text field name, numbering, positional match (also pending task: typed field input, no select). Before (1), test that `easy-template-x` handles tags with spaces/diacritics/digits (spec "Not yet verified").

## Gotchas
- Only GitHub MCP tools (no `gh`); tag pushes and repo-settings writes are blocked by the proxy.
- Run Biome and check its exit code; an earlier misread broke CI formatting.
- Use `git rev-parse` for SHAs; a mistyped SHA caused a 409.
- One branch and PR per ticket; PRs merge only on the user's say-so.
- The user writes Vietnamese and wants few words, answer first.

## Suggested skills
- `/dev:plan-tickets` (user-typed), then `/dev:implement-ticket` (user-typed)
- `dev:test-tdd`, `dev:design-types`, `dev:review-pr`

## Optional patch: full-width Word preview (reverted, not applied)
Apply with `git apply` after saving the block to a file. Only if the user asks for it.

```diff
diff --git a/src/renderer/pages/home/StepMapping.tsx b/src/renderer/pages/home/StepMapping.tsx
index 580e252..e94f1e8 100644
--- a/src/renderer/pages/home/StepMapping.tsx
+++ b/src/renderer/pages/home/StepMapping.tsx
@@ -133,7 +133,8 @@ function Mapping({
 
   return (
     <div className="flex flex-col gap-4">
-      <div className="grid gap-6 min-[1000px]:grid-cols-2">
+      {/* A Word page is as wide as paper, so its preview takes the full width under the list; an image sits beside it. */}
+      <div className={body.kind === "word" ? "grid gap-6" : "grid gap-6 min-[1000px]:grid-cols-2"}>
         <div className="flex min-w-0 flex-col gap-4">
           {view.lost.length > 0 ? (
             <div role="status" data-testid="lost-fields" className="flex flex-col gap-1">
@@ -199,6 +200,7 @@ function Mapping({
           entries={entries}
           columns={view.columns}
           rowCount={view.rowCount}
+          wide={body.kind === "word"}
         />
       </div>
 
diff --git a/src/renderer/pages/home/mapping-preview.tsx b/src/renderer/pages/home/mapping-preview.tsx
index 04ca288..e62bcb1 100644
--- a/src/renderer/pages/home/mapping-preview.tsx
+++ b/src/renderer/pages/home/mapping-preview.tsx
@@ -14,6 +14,8 @@ export type MappingPreviewProps = {
   entries: Entries;
   columns: readonly string[];
   rowCount: number;
+  /** Full width under the list (a Word page): not sticky, and the height is limited so the page scrolls inside. */
+  wide?: boolean;
 };
 
 /**
@@ -21,7 +23,14 @@ export type MappingPreviewProps = {
  * cost the same as 2). The values come from that row through the mapping, so a change of mapping redraws
  * with the row already in hand.
  */
-export function MappingPreview({ draw, keys, entries, columns, rowCount }: MappingPreviewProps) {
+export function MappingPreview({
+  draw,
+  keys,
+  entries,
+  columns,
+  rowCount,
+  wide = false,
+}: MappingPreviewProps) {
   const [index, setIndex] = useState(0);
   const [cells, setCells] = useState<string[] | null>(null);
   const [failed, setFailed] = useState(false);
@@ -51,7 +60,7 @@ export function MappingPreview({ draw, keys, entries, columns, rowCount }: Mappi
   return (
     <section
       aria-label={t.previewLabel}
-      className="flex flex-col gap-3 min-[1000px]:sticky min-[1000px]:top-4"
+      className={`flex flex-col gap-3 ${wide ? "" : "min-[1000px]:sticky min-[1000px]:top-4"}`}
     >
       <div role="group" aria-label={t.pagerLabel} className="flex items-center gap-2">
         <Button
@@ -79,7 +88,7 @@ export function MappingPreview({ draw, keys, entries, columns, rowCount }: Mappi
       {failed ? <Status kind="danger">{t.rowFailed}</Status> : null}
       <div
         data-testid="mapping-preview"
-        className="max-h-[70vh] overflow-auto rounded-control border border-line"
+        className={`overflow-auto rounded-control border border-line ${wide ? "max-h-[min(60vh,560px)]" : "max-h-[70vh]"}`}
       >
         {cells ? draw({ values, unmapped }) : null}
       </div>
```
