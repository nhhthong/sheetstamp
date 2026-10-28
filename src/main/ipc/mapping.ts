// Handlers of the "mapping" channels declared in src/shared/ipc/mapping.ts.
import { labels, reconcile, suggest } from "../../shared/ipc/mapping";
import { matchFields, reconcile as reconcileProfile, suggestLabel } from "../mapping";
import { handle } from "./define";

export function register(): void {
  handle(suggest, ({ fields, columns }) => matchFields(fields, columns));
  handle(reconcile, ({ profile, fields, columns }) => reconcileProfile(profile, fields, columns));
  handle(labels, ({ keys }) => Object.fromEntries(keys.map((k) => [k, suggestLabel(k)])));
}
