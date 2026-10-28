# Notes (format: see workflow.md)
2026-10-28 | decision | workflow, git | Default delivery is pr (one branch per ticket, auto-merge once ci passes). Pushing straight to main is an exception only when the repo owner asks for it explicitly in a session.
2026-10-28 | decision | storage | Local JSON with atomic writes behind a Storage interface; see docs/adr/0001-json-storage.md.
2026-10-28 | decision | hr-dictionary | Draft kept in data/hr-dictionary.json (about 40 entries), written by Claude, reviewed by the owner, extended after Phase 0 from real templates.
2026-10-28 | decision | roadmap | Phase 0: checks, repo, Electron shell. Phase 1: Word flow end to end (data, template library, mapping, filenames, ZIP). Phase 2: image templates and editor, theme, Settings, packaging, first release. Phase 3+: SignPath or Store, macOS, deferred items. The six-phase figure in the spec was unreadable; owner to correct if it differs.
2026-10-28 | decision | ui | Home steps are strictly sequential (Data, Template, Mapping, Export). Minimum window 720x560 for now, to be adjusted after testing on real machines.
2026-10-28 | glossary | terms | Template, Tag, Field, Column, Mapping, Batch; avoid Placeholder and variable. See GLOSSARY.md.
