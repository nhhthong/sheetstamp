# T-32: Home: image templates in steps 2 and 3

**Type:** feature
**Parent:** E-2
**Requirements:** R9.4, R2.1, R2.2, R2.3, R2.4, R4.6, R4.7, R8.5
**Blocked by:** T-30
**Status:** ready
**New infrastructure:** none
**Files:** src/renderer/pages/home, src/main/mapping, src/main/templates, src/shared/mapping, tests/e2e
**Proof:** `npm run test:e2e` loads a CSV, picks an image template in step 2 (shown with the image icon and "Khớp x/y trường"), fixes the one unmatched field in step 3 and sees the rendered image change with the pager "‹ Dòng 2/4 ›".
**Step:**
**Base:**
**Baseline:**

**What to build:** Home accepts image templates in steps 2 and 3. Step 2 lists them with the image icon and ranks them by column match like Word ones (fields come from the layout). Step 3 reuses the mapping list (matched fields collapsed, unmatched first, column / fixed text / empty) and the preview panel shows the real rendered image for the current row from `image:render`, updating as the mapping changes. A missing font is reported inline in the step with the fix next to it. The mapping profile is saved per template as for Word.

- [ ] Image and document templates appear together in step 2 with the right icon; the group chips and search work for both.
- [ ] Fields for matching come from the boxes of the layout; labels come from the dictionary or the user's name for the field.
- [ ] Step 3 shows the rendered image for the current row and re-renders when the mapping changes, with no more than one render in flight.
- [ ] Unresolved fields block "Tiếp tục" exactly as for Word; leaving a field empty counts as resolved.
- [ ] A template with no boxes cannot be continued and says why; a missing font is shown inline.
- [ ] The saved mapping profile is reused when the same image template is chosen again.

## Test plan (added by /dev:implement-ticket)

## Result
