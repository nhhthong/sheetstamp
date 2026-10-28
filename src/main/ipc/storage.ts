// Handlers of the "storage" channels declared in src/shared/ipc/storage.ts.
import { status } from "../../shared/ipc/storage";
import { storageStatus } from "../templates/store";
import { handle } from "./define";

export function register(): void {
  handle(status, () => storageStatus());
}
