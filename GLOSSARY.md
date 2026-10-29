# Sheetstamp

Desktop app that fills Word or image templates with rows from a CSV/Excel file and exports the results as one ZIP.

## Language

**Template** (Vietnamese: mẫu):
A saved Word document or background image with tags, kept by the app with its labels, group and mapping.
_Avoid_: Mail merge file, form

**Tag**:
A marker such as `{{ten}}` in a template, replaced by data for each row.
_Avoid_: Placeholder, variable, biến

**Field** (Vietnamese: trường):
A tag as the user sees it, under its display label such as "Tên".
_Avoid_: Tag in user-facing text

**Column** (Vietnamese: cột):
A column of the imported CSV or Excel file.

**Mapping** (Vietnamese: ghép cột):
The link from each field to a column, a fixed text, or empty. Saved with the template. Word fields are matched to columns by name, image fields by position; one column serves one field.

**Batch** (Vietnamese: đợt):
One export of every row of the imported file through one template into one ZIP.
