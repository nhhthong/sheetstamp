// Handlers of the "preview" channels declared in src/shared/ipc/preview.ts.
import { fill } from "../../shared/ipc/preview";
import { fillForPreview } from "../preview/fill";
import { handle } from "./define";

export function register(): void {
  handle(fill, (request) => fillForPreview(request));
}
