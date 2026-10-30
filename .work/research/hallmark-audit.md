# Hallmark audit and restyle proposal (T-45, #38)

Scope: `src/renderer`, depth **restyle** (owner option 1: keep the layout, change the system). No app code was edited.

## How this was done
- Looked at the 17 screens in the real app (light and dark, English): home steps 1 to 4, done, templates (documents, images, new dialog), image editor, settings. Tokens read from `src/renderer/styles.css`.
- `sloplint --render` was **not** run: the renderer needs the Electron preload bridge (`window.sheetstamp`), so a dev-server URL shows an empty shell. Findings below come from the screenshots and the CSS, not from the linter. Say so if you want a bridge stub built so the linter can run.

## Read
- **For:** HR staff filling documents in bulk; one action per step.
- **Works, stays:** the four-step flow, plain language, big targets, the focus and contrast work (`styles.test.ts`), the layout.
- **Reads as generated or flat:** (1) every surface is a white page with 1px hairlines: no depth, so cards, the sidebar and dialogs look the same weight; (2) one saturated blue used for the active nav, every primary button and tabs at once; (3) pure `#ffffff` paper and zero-chroma greys in light; (4) system font only (`Segoe UI`, `system-ui`): the app has no typographic voice, and on Ubuntu it falls back to a different face than on Windows; (5) status boxes (warning yellow) are the loudest thing on the mapping screen; (6) the template list and the image editor leave large empty white or grey areas without any structure.
- **Broken:** nothing functional; the logo only shows now (PR #31).

## Gates that apply (from `gates.md`)
| Gate | Tier | Finding |
| --- | --- | --- |
| 7a/7b | Floor/Reflex | `--bg: #ffffff` as paper (light) |
| 22 | Reflex | `--panel`, `--line`, `--muted` are zero-chroma greys |
| 1 | Reflex | system face as the only face |
| 74 | Reflex | not hit: the blue is the brand colour of the logo, kept |
| 23 | Reflex | accent share on the mapping and export screens is high (active nav + buttons + tabs) |
| 58, 77, 79, 8, 9 | layout | notes only: the layout stays (restyle) |

## Proposal (restyle)
Keep: layout, content, wiring, the blue brand hue, English and Vietnamese strings, light and dark.

1. **Colour:** tint every neutral toward the brand hue (chroma about 0.006 to 0.012 in OKLCH): paper, panel, line, muted, text. Mix the accent in OKLCH from the logo blue, one hover and one pressed step. Dark mode keeps its own tokens and the contrast test.
2. **Depth:** three surface steps (page, panel, raised). Raised things (dialogs, selected template row, popovers) get a soft shadow with offset and blur (light) or a lighter surface (dark). Sidebar becomes the middle step with an inset active pill instead of a solid blue block. Lists get hairline plus a faint hover lift.
3. **Type:** keep the system stack for body and controls (fast, no network); add one bundled display face for the page title and step titles only, so the app has a voice. Needs a licence check before bundling; fallback is the current stack with tighter tracking and a heavier title.
4. **Accent budget:** solid blue only for the primary action of a screen and focus; nav active and tabs use a tinted fill; warnings keep the yellow but lose the heavy border.
5. **Motion:** 120 to 160 ms on `transform`/`opacity`/colour only, none on layout; `prefers-reduced-motion` honoured; focus ring shows instantly.
6. **Empty areas:** an empty state with the logo mark for the template list and the image editor canvas surround (no new content or actions, only the existing "no templates" text).

## Not changing
Layout and spacing grid, copy, icons, routes, the e2e selectors and test ids, the image editor canvas (always the real image).

## Cost and proof
- Files: `src/renderer/styles.css`, `src/renderer/components/ui/*`, `app/App.tsx` classes, a few page classes. No logic.
- Proof: `styles.test.ts` contrast, `npm test`, the full e2e at 1024x768, before and after screenshots of all 17 screens in light and dark, side by side.
- Size: one PR, about 300 changed lines, mostly classes.

## Decisions for the owner
1. Approve the restyle as written, or strike items (3 is the only one with a licence question).
2. Allow a bundled display face (yes/no).
3. Run the linter with a bridge stub first (small extra ticket) or skip it.

Nothing is built until the owner answers.
