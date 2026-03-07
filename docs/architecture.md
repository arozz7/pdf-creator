# Architecture

PDF Creator is an Electron desktop application for Windows. It uses a React frontend for the UI and a long-running Python subprocess for all PDF processing.

## High-Level Diagram

```
+--------------------------------------------------+
|                 Electron Process                 |
|                                                  |
|  +----------------+      +--------------------+  |
|  |  Main Process  |<---->|  Python Subprocess |  |
|  |  (main.ts)     | JSON |  (main.py)         |  |
|  |                | stdio|                    |  |
|  +-------+--------+      +--------------------+  |
|          | IPC (contextBridge)                   |
|  +-------+--------+                             |
|  | Renderer Process|                             |
|  | (React + Vite)  |                             |
|  |                 |                             |
|  | Sidebar         |                             |
|  | Home            |                             |
|  | Merge           |                             |
|  | Extract         |                             |
|  | Compress        |                             |
|  +-----------------+                             |
+--------------------------------------------------+
```

## Layers

### 1. Electron Main Process (`electron/main.ts`)

Responsible for:
- Creating and managing the `BrowserWindow`
- Spawning the Python subprocess on app start and killing it on exit
- Registering all `ipcMain` handlers
- Reading PDF files as byte buffers (for the preview feature)
- Showing native open/save file dialogs

### 2. Electron Preload (`electron/preload.ts`)

Bridges the renderer and main process securely using `contextBridge`. Exposes the `electronAPI` object on `window`:

| API | IPC Channel | Description |
|---|---|---|
| `ping()` | `ping` | Health check |
| `openFile()` | `dialog:openFile` | Native multi-select PDF file dialog |
| `saveFile()` | `dialog:saveFile` | Native save-as PDF dialog |
| `mergePdfs(files, outputPath)` | `pdf:merge` | Merge N files into one |
| `extractPages(file, pages, outputPath)` | `pdf:extract` | Extract page ranges |
| `compressPdf(file, outputPath)` | `pdf:compress` | Compress a PDF |
| `readPdf(file)` | `pdf:readBuffer` | Read PDF bytes for inline preview |
| `getPages(file)` | `pdf:getPages` | Render all pages at 1.5× with text blocks (Edit feature) |
| `getThumbnails(file)` | `pdf:getThumbnails` | Render all pages at 0.5× as base64 PNGs (Merge preview) |
| `getPathForFile(file)` | (sync) | Get filesystem path from a drag-dropped `File` object |

### 3. React Renderer (`src/`)

A single-page application using `HashRouter` (required for Electron's `file://` protocol).

```
App (Router)
  Sidebar (NavLinks)
  main
    / -> Home
    /merge -> Merge
    /extract -> Extract
    /compress -> Compress
```

**UI stack:** React 19, TypeScript, Tailwind CSS v4, Radix UI primitives, Lucide icons.

### 4. Python Backend (`python/main.py`)

A long-running process that reads newline-delimited JSON commands from `stdin` and writes JSON responses to `stdout`.

**Command protocol:**
```json
// Request
{ "type": "merge" | "extract" | "compress" | "get_pages" | "get_thumbnails" | "edit_pdf" | "ping", ...args }

// Response
{ "status": "success" | "error", "data"?: "...", "message"?: "..." }
```

**Libraries:**
- `pypdf` — merge and page extraction
- `pikepdf` — compression (stream compression + unreferenced resource removal)
- `pymupdf` (`fitz`) — page rendering for `get_pages` (1.5× scale, with text blocks) and `get_thumbnails` (0.5× scale, images only)

In production the Python code is compiled to a single Windows executable (`pdf_backend.exe`) using PyInstaller.

## IPC Data Flow (Example: Merge)

```
User clicks "Merge Files"
  -> Renderer: window.electronAPI.saveFile()
     -> IPC: dialog:saveFile
        -> Main: shows native save dialog, returns path
  -> Renderer: window.electronAPI.mergePdfs(files, outputPath)
     -> IPC: pdf:merge
        -> Main: writes JSON command to pythonProcess.stdin
           -> Python: reads command, runs pypdf merge, writes JSON result to stdout
        -> Main: reads stdout, resolves promise
     -> IPC response back to renderer
  -> Renderer: updates status message
```

## Known Limitations

- **No request correlation on IPC/stdio:** The Python subprocess handles one command at a time. Concurrent `sendPythonCommand` calls corrupt responses because all pending stdout listeners receive the first response. The Merge page works around this by serialising thumbnail requests through a promise queue (`loadQueueRef`). Other features make only one IPC call at a time so this is not a problem in practice.
- **Compression quality:** The compress feature uses pikepdf's default stream compression and resource removal. No image downscaling is performed — results vary based on PDF content.
