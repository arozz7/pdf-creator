/// <reference types="vite/client" />

interface ElectronAPI {
    ping: () => Promise<string>;
    openFile: () => Promise<string[]>;
    saveFile: () => Promise<string | null>;
    mergePdfs: (files: string[], outputPath: string) => Promise<{ status: string; data?: string; message?: string }>;
    extractPages: (file: string, pages: string, outputPath: string) => Promise<{ status: string; data?: string; message?: string }>;
    readPdf: (file: string) => Promise<{ status: string; data?: Uint8Array; message?: string }>;
    compressPdf: (file: string, outputPath: string) => Promise<{ status: string; data?: string; message?: string }>;
    getPathForFile: (file: File) => string;
}

interface Window {
    electronAPI: ElectronAPI;
}

// Electron adds a path property to File objects
interface File {
    path: string;
}
