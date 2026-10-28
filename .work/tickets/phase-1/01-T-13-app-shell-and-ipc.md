# T-13: App shell and ipc

**Type:** task
**Parent:** E-1
**Requirements:** R7.1, R7.2, R7.3, R7.4, R12.1, R12.3, R12.4, R14.4
**Blocked by:** None (can start immediately)
**Status:** ready
**New infrastructure:** Tailwind CSS v4, shadcn/ui components (Base UI), typed IPC layer
**Files:** src/renderer (shell, components, strings), src/shared/ipc.ts, src/preload/index.ts, src/main/ipc.ts, tests/e2e
**Proof:** `npm run test:e2e` opens the built app, tabs through Tạo file, Mẫu and Cài đặt, switches page, and narrows the window until the sidebar becomes a top bar.
**Step:**
**Base:**
**Baseline:**

**What to build:** The app looks like the product: a left sidebar with Tạo file, Mẫu and Cài đặt, each opening an empty page with the right Vietnamese title and subtitle. Colour tokens (background, panel, text, muted, line, accent, success, warning, danger) are CSS variables with light and dark values, a visible 2 px focus ring, reduced-motion support and a toast. All user-visible strings live in one Vietnamese strings module. The IPC layer gets one typed, validated entry per command, so later tickets only add commands.

- [ ] Sidebar has exactly three destinations, the current one highlighted, all reachable by keyboard with a visible focus ring.
- [ ] Below about 820 px width the sidebar becomes a top bar and two-column layouts stack.
- [ ] A toast appears for about 2.5 s and is announced to screen readers.
- [ ] Colour tokens exist for light and dark; status is never shown by colour alone (marker plus text).
- [ ] Every IPC command validates its argument in main and rejects bad input (test).
- [ ] Shadcn-style Button, Input, Select, Dialog and Toast components exist and are used by the pages.

## Test plan (added by /dev:implement-ticket)

## Result
