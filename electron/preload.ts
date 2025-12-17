import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    ping: () => ipcRenderer.invoke('ping'),
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
    saveFile: () => ipcRenderer.invoke('dialog:saveFile'),
    mergePdfs: (files: string[], outputPath: string) => ipcRenderer.invoke('pdf:merge', files, outputPath),
    extractPages: (file: string, pages: string, outputPath: string) => ipcRenderer.invoke('pdf:extract', file, pages, outputPath),
    readPdf: (file: string) => ipcRenderer.invoke('pdf:readBuffer', file),
    compressPdf: (file: string, outputPath: string) => ipcRenderer.invoke('pdf:compress', file, outputPath),
    getPathForFile: (file: File) => webUtils.getPathForFile(file),
});
