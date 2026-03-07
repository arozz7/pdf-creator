/// <reference types="vite/client" />

interface TextBlock {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    text: string;
    block_no: number;
    font_size: number;
}

interface PageData {
    page_no: number;
    width: number;
    height: number;
    image: string;
    blocks: TextBlock[];
}

interface PdfEdit {
    page: number;
    bbox: [number, number, number, number];
    new_text: string;
    font_size: number;
    bold: boolean;
    italic: boolean;
    color: string;   // hex e.g. "#000000"
    align: number;   // 0=left 1=center 2=right
}

interface ThumbnailPage {
    page_no: number;
    width: number;
    height: number;
    image: string; // base64 PNG
}

interface ThumbnailData {
    pages: ThumbnailPage[];
    page_count: number;
}

interface ElectronAPI {
    ping: () => Promise<string>;
    openFile: () => Promise<string[]>;
    saveFile: () => Promise<string | null>;
    mergePdfs: (files: string[], outputPath: string) => Promise<{ status: string; data?: string; message?: string }>;
    extractPages: (file: string, pages: string, outputPath: string) => Promise<{ status: string; data?: string; message?: string }>;
    readPdf: (file: string) => Promise<{ status: string; data?: Uint8Array; message?: string }>;
    compressPdf: (file: string, outputPath: string) => Promise<{ status: string; data?: string; message?: string }>;
    getPages: (file: string) => Promise<{ status: string; data?: PageData[]; message?: string }>;
    getThumbnails: (file: string) => Promise<{ status: string; data?: ThumbnailData; message?: string }>;
    editPdf: (file: string, outputPath: string, edits: PdfEdit[]) => Promise<{ status: string; data?: string; message?: string }>;
    getPathForFile: (file: File) => string;
}

interface Window {
    electronAPI: ElectronAPI;
}

// Electron adds a path property to File objects
interface File {
    path: string;
}
