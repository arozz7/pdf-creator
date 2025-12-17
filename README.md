# PDF Creator

A powerful local PDF management tool built with Electron, React, and Python. This application allows you to merge, extract, and compress PDF files, as well as organize your photo library with advanced local AI features.

## Features

### PDF Tools
- **Merge PDFs**: Combine multiple PDF files into a single document.
- **Extract Pages**: specific pages from a PDF to create a new file.
- **Compress PDFs**: Reduce the file size of your PDFs.

### Photo Library & AI
- **Smart Organization**: Automatically scans and organizes your photos.
- **Face Recognition**: Local AI identifies and groups faces in your photos.
- **Smart Tagging**: Automatically generates descriptive tags for your images using local AI models.
- **Privacy Focused**: All AI processing happens locally on your machine. No data is sent to the cloud.

## Tech Stack
- **Frontend**: React, TypeScript, TailwindCSS, Vite
- **Backend**: Electron (Node.js)
- **AI/Processing**: Python (OpenCV, PyTorch, etc.)

## Setup & Development

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/arozz7/pdf-creator.git
    cd pdf-creator
    ```

2.  **Install Frontend/Electron Dependencies**
    ```bash
    npm install
    ```

3.  **Setup Python Environment**
    It is recommended to use a virtual environment.
    ```bash
    # Windows
    python -m venv .venv
    .venv\Scripts\activate
    
    # Install Python dependencies
    pip install -r python/requirements.txt
    ```

### Running the Application

To start the application in development mode (with hot-reload):

```bash
npm run dev
```

This will concurrently start the Vite dev server for the frontend and the Electron main process.

## Build

To build the application for production:

```bash
npm run build
```
