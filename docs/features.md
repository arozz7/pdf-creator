# Feature Specifications

Current features as of v0.2.0.

---

## Merge PDFs

**Route:** `/merge`
**Component:** `src/pages/Merge.tsx`
**IPC:** `pdf:merge` -> Python `merge` command (pypdf), `pdf:getThumbnails` -> Python `get_thumbnails` command (pymupdf)

### Behaviour

1. User adds PDF files via drag-and-drop onto the drop zone or the "Add Files" button (native file dialog, multi-select).
2. Files are displayed as a sortable list. Each row shows a grip handle, filename, page count (spinner while loading), and a remove button.
3. Files can be reordered by dragging rows by their grip handle. The preview grid updates immediately to reflect the new order.
4. Thumbnails for each file load asynchronously after the file is added. Requests are serialised to prevent concurrent Python IPC corruption.
5. A scrollable thumbnail grid below the file list shows every page of every file in merge order, at 0.5× scale.
6. "Save Merged PDF" is disabled until at least 2 files are queued.
7. On merge: a native save dialog opens. If confirmed, all files are merged in list order and saved to the chosen path.
8. On success the file list and preview are cleared and a success message is shown.
9. On error, the error message from the Python backend is shown.

### Constraints

- Input files must be `.pdf` (enforced by file dialog filter and drag-drop check).
- Merge order follows the displayed list order; drag-to-reorder controls final output order.
- No duplicate detection.
- Thumbnail requests are queued serially — adding many large files will load previews one file at a time.

---

## Extract Pages

**Route:** `/extract`
**Component:** `src/pages/Extract.tsx`
**IPC:** `pdf:extract` -> Python `extract` command (pypdf), `pdf:readBuffer` for preview

### Behaviour

1. User selects a single PDF via drag-and-drop or clicking the drop zone (opens file dialog).
2. A live PDF preview is rendered in an `<iframe>` using a Blob URL created from the file's raw bytes.
3. User types a page range string (e.g. `1, 3-5, 10`) into the text input.
4. "Extract" button is enabled when both a file and a non-empty page range are present.
5. On extract: a native save dialog opens. If confirmed, the selected pages are extracted and saved.
6. On success the file and page input are cleared.

### Page Range Format

Parsed by `python/main.py::parse_page_ranges`:

| Input | Pages extracted |
|---|---|
| `3` | Page 3 |
| `1-5` | Pages 1, 2, 3, 4, 5 |
| `1, 3-5, 8` | Pages 1, 3, 4, 5, 8 |

Page numbers are 1-based. Out-of-range pages are silently ignored. Invalid format returns an error.

### Constraints

- Single-file input only.
- Preview load errors show a "Failed to load preview" message; processing can still proceed.
- Blob URL for preview is revoked when a new file is loaded (prevents memory leaks).

---

## Compress PDF

**Route:** `/compress`
**Component:** `src/pages/Compress.tsx`
**IPC:** `pdf:compress` -> Python `compress` command (pikepdf)

### Behaviour

1. User selects a single PDF via drag-and-drop or clicking the drop zone.
2. "Compress PDF" button is enabled when a file is selected.
3. On compress: a native save dialog opens. If confirmed, the file is compressed and saved.
4. On success the file selection is cleared.

### Compression Method

Uses `pikepdf`:
- `pdf.remove_unreferenced_resources()` — removes orphaned objects
- `pdf.save(compress_streams=True, object_stream_mode=pikepdf.ObjectStreamMode.generate)` — compresses content streams and packs objects efficiently

No image resampling or quality reduction is applied.

### Constraints

- Single-file input only.
- No preview.
- Compression ratio varies widely depending on PDF content. Already-optimized PDFs may see minimal reduction.

---

## Home

**Route:** `/`
**Component:** `src/pages/Home.tsx`

Welcome screen with brief description of available tools. No user interaction.

---

## Sidebar

**Component:** `src/components/Sidebar.tsx`

Persistent navigation panel (fixed 256px width). Contains:
- App logo and "PDF Creator" branding
- NavLinks to Home, Merge PDF, Extract Pages, Compress PDF
- Active route is highlighted with the primary colour
- Version number displayed at the bottom
