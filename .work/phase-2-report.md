# Phase 2 report

Tickets T-24 to T-36 on one integration branch (`claude/project-guidance-y63vpi`), sub-agents in worktrees, each ticket re-verified by the orchestrator (lint, typecheck, unit, ticket e2e) before merge. Per-ticket notes: `.work/phase-2/T-<n>-report.md`.

## Status

| Ticket | Status | Open item |
|---|---|---|
| T-24 image limits | done | agent was stopped before writing its report; decision written from its measured output |
| T-25 `buffers` license | informative | license not confirmed (O-14 open, owner) |
| T-26 fonts and render IPC | done | |
| T-27 packaging and icon | done | Windows/macOS packages and the dry run only on CI |
| T-28 to T-33 image templates | done | |
| T-34 theme | done | |
| T-35 About | done | |
| T-36 release readiness | partly | owner checklist below |

## Decisions taken (owner delegated analysed decisions)
- O-15 image fields: HR dictionary labels plus a typed new field (key = NFC slug).
- O-16 format: PNG/JPG in Step 4, default the background's format, remembered; JPG quality 90.
- T-24 limits: PNG/JPEG by signature, 20 MB, 25 MP, JPEG must end with FF D9, warn above 4 MP.
- T-34: theme in a separate `settings.json`.
- Missing font blocks export up-front with one inline message; unmapped image field draws nothing and is listed under the preview.

## Owner checklist before tagging `v0.1.0` (Claude never publishes)
1. O-14: paste the upstream `LICENSE` of `buffers@0.1.1` (or allow github.com for the session), then add a sourced override in `scripts/third-party-notices.mjs`; otherwise replace the xlsx reader. Until then `third-party-notices.mjs --check` warns.
2. Settings > Pages: Source = GitHub Actions; 2FA on the account (R0.1).
3. Run the `Release` workflow by hand ("Run workflow", no tag): all three builds and the packaged self-test must pass; read the `Check` steps for the exe and the `.deb`.
4. Clean-machine checks (R0.10): Windows 10/11 per-user install, Ubuntu 22.04/24.04 `.deb` and AppImage, VirusTotal scan of the exe, note any Defender/SmartScreen warning on the download page.
5. O-10: open a ZIP with diacritic and NFD names in Windows Explorer, Archive Utility and Ubuntu; run `zip-names.yml`.
6. Take screenshots from the installed app and add them to `site/index.html` (the page has the steps but no images yet).
7. Check Billing after the first CI run (O-13), tag `v0.1.0`, apply to SignPath afterwards (O-11).

## Known gaps
- Windows e2e is flaky-prone; `workers: 1` and one retry on CI. `security.spec.ts` (dropped file outside a zone) and `image-editor.spec.ts` flaked locally under load and passed on retry.
- The first-release download buttons stay 404 until the release exists.
