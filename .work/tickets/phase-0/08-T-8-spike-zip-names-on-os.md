# T-8: Spike zip names on os

**Type:** spike
**Parent:** E-0
**Requirements:** R0.6, R6.6
**Blocked by:** T-7
**Status:** ready
**New infrastructure:** none
**Files:** none
**Proof:** none
**Step:**
**Base:**
**Baseline:**

**What to build:** Question (open point O-10): do non-ASCII filenames, including an NFD name, display correctly when a ZIP from T-7 is opened in Windows 10 Explorer, Windows 11 Explorer, macOS Archive Utility and Ubuntu's archive manager? Prototype spike5 already showed that archiver 8 sets the UTF-8 flag. Record a screenshot or description for each, and the fix if one fails.

- [ ] A result for each of the four tools is recorded.
- [ ] A fix or a documented workaround exists for any failure.

## Test plan (added by /dev:implement-ticket)

## Result
