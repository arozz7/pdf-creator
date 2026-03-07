# PDF Creator

A desktop application for working with PDF files. Built with Electron, React, and a Python backend.

## Features

- **Merge PDFs** — Combine multiple PDFs with drag-to-reorder and a full page-by-page thumbnail preview
- **Extract Pages** — Extract specific pages or ranges from a PDF, with live preview
- **Compress PDF** — Optimize file size using stream compression and resource cleanup

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron |
| Frontend | React 19, TypeScript, Tailwind CSS v4 |
| Routing | React Router v7 |
| UI Components | Radix UI, shadcn/ui |
| PDF processing | Python (pypdf, pikepdf) |
| IPC | Electron IPC + stdin/stdout JSON |
| Packaging | electron-builder (NSIS installer + portable) |

## Development

### Prerequisites

- Node.js (v18+)
- Python 3.10+

### Installation

```powershell
# Clone and install frontend dependencies
git clone https://github.com/arozz7/pdf-creator.git
cd pdf-creator
npm install

# Set up Python virtual environment
python -m venv .venv
.venv\Scripts\activate
pip install -r python/requirements.txt
```

### Running

```powershell
npm run dev
```

Starts the Vite dev server and Electron process concurrently. The Python backend runs from the local `.venv`.

## Building

```powershell
# Compile Python backend first
cd python
pyinstaller pdf_backend.spec

# Build and package the Electron app
cd ..
npm run dist
```

Output is placed in `release/`. Produces both an NSIS installer and a portable executable.

## Project Structure

```
PDF-Creator/
  electron/         # Electron main process and preload
  src/              # React frontend
    components/     # Shared UI components (Sidebar, shadcn/ui)
    pages/          # Route-level page components
    lib/            # Utilities
  python/           # Python PDF backend (pypdf, pikepdf)
  docs/             # Architecture and feature specifications
  public/           # Static assets (logo, icons)
```

## Documentation

- [Architecture](docs/architecture.md)
- [Features](docs/features.md)
