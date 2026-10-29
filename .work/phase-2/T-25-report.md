# T-25 report: license of buffers@0.1.1 (O-14)

Result: ISSUES-but-informative. The license could NOT be confirmed from a primary source. No guess was made;
`scripts/third-party-notices.mjs` and `THIRD-PARTY-NOTICES.md` are unchanged (buffers stays UNDECLARED).

## Facts (verified here)
- Tarball `npm pack buffers@0.1.1` contains: README.markdown, index.js, package.json, examples/, test/. No LICENSE
  file; no license/copyright/MIT/BSD text in README or index.js (grep). package.json has no `license`/`licenses` field
  (author "James Halliday <mail@substack.net>", repository http://github.com/substack/node-buffers.git).
- Registry (https://registry.npmjs.org/buffers): all six versions (0.0.1 to 0.1.1, last published 2011-10-12) have no
  license field. 0.1.1 is `latest`; no newer version exists, so upgrading does not help.
- Chain (from phase-0 report T-12): exceljs 4.4.0 -> unzipper ^0.10.11 -> binary -> buffers. In this worktree `npm ls buffers`
  shows it only as an extraneous symlink, so the chain is taken from the report, not re-run.
- Upstream repo not readable: github.com / api.github.com / cdn.jsdelivr.net return 403 (not allowed for the session);
  `add_repo substack/node-buffers` answered "not found or no access".
- Debian hosts (metadata.ftp-master.debian.org, lists.alioth.debian.org) do not resolve from this session.

## Secondary evidence (not verified by me)
A WebSearch summary says the Debian package `node-buffers` copyright file records MIT ("taken from package.json in the
upstream repo") and the 2015 Debian ITP bug lists upstream license MIT:
- https://metadata.ftp-master.debian.org/changelogs/main/n/node-buffers/oldoldstable_copyright
- https://lists.alioth.debian.org/pipermail/pkg-grass-devel/2015-March/027998.html
I could not open either page; this is a search-engine paraphrase. A Raynet doc page lists the license as "Unknown".
Inference: the 2015 upstream repo probably had a license in its package.json or LICENSE that was never published to npm
(the npm tarball predates it). Not proof, and not citable as a confirmed license.

## Options
1. Read upstream (recommended first, cheapest). Needs either (a) allowing github.com / raw.githubusercontent.com /
   metadata.ftp-master.debian.org in the session network settings so the LICENSE / package.json of
   substack/node-buffers and the Debian copyright can be read, or (b) the owner opens the repo in a browser. If a
   LICENSE or `"license"` is found, add a documented override (below) and regenerate.
2. Ask the maintainer: open an issue on substack/node-buffers asking for a license in the repo and a 0.1.2 on npm.
   Owner action; slow, maintainer inactive since 2011.
3. Replace the xlsx reader behind its interface (exceljs pulls unzipper -> binary -> buffers). Removes the dependency
   but is a large change for one small package; only if 1 and 2 fail before the first release.
4. Vendor a licensed replacement of `buffers`: not recommended (needs a fork or override, still no license on the original).

## Recommendation
Option 1 now (needs owner to allow the hosts, or paste the upstream LICENSE/package.json). If it shows MIT/X11, implement
the override: in `scripts/third-party-notices.mjs` add a `licenseOverrides` map `{ "buffers@0.1.1": { license: "MIT",
source: "<evidence URL>" } }`, used when the lock has no license, and print the source in the notices footer; then run
`node scripts/third-party-notices.mjs`. If not confirmed before the first release, take option 3 via `plan-ticket-change`.
O-14 stays open.

## Decision block (copy to notes.md)
- T-25 (O-14, buffers@0.1.1 license): NOT confirmed. npm tarball and all 6 registry versions carry no license; upstream
  GitHub unreachable (403) and unreadable via add_repo. Only secondary hint: Debian node-buffers copyright / ITP reportedly
  say MIT (unverified, hosts unreachable). Decision: keep UNDECLARED, do not guess. Next: owner allows github.com and
  metadata.ftp-master.debian.org (or pastes upstream LICENSE) to confirm and add a sourced override; else replace the xlsx
  reader. O-14 remains open (blocks first release, R11.4/R13.10).
