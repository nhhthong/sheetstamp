import type { DataTable } from "../data";
import { DataSession } from "./session";

export { DataSession, suggestWidth } from "./session";

/** The one session of the app: the table lives in this process's memory and nowhere else. */
export const dataSession = new DataSession();

/** The table loaded on the Home page (after zero padding), or undefined when none is loaded. */
export function getCurrentTable(): DataTable | undefined {
  return dataSession.table;
}
