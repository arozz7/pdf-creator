import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { spawn } from 'child_process';
import fs from 'fs';

ipcMain.handle('pdf:readBuffer', async (event, filePath: string) => {
    try {
        const buffer = await fs.promises.readFile(filePath);
        return {
            status: 'success',
            data: buffer
        };
    } catch (e: any) {
        return { status: 'error', message: e.message };
    }
});

let mainWindow: BrowserWindow | null = null;
let pythonProcess: any = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, '../public/logo.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    // Start Python Backend
    startPythonSubprocess();
});

function startPythonSubprocess() {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    // In dev, use the venv python.
    const pythonPath = isDev
        ? path.join(__dirname, '../.venv/Scripts/python.exe')
        : 'path/to/bundled/python';

    const scriptPath = isDev
        ? path.join(__dirname, '../python/main.py')
        : path.join(process.resourcesPath, 'python/main.py');

    console.log(`Starting python process from: ${pythonPath}`);

    pythonProcess = spawn(pythonPath, [scriptPath], {
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });

    pythonProcess.stdout.on('data', (data: any) => {
        console.log(`Python stdout: ${data}`);
    });

    pythonProcess.stderr.on('data', (data: any) => {
        console.error(`Python stderr: ${data}`);
    });

    pythonProcess.on('close', (code: any) => {
        console.log(`Python process exited with code ${code}`);
    });
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
    if (pythonProcess) {
        pythonProcess.kill();
    }
});

import { dialog } from 'electron';

// IPC Handlers
ipcMain.handle('ping', () => 'pong');

ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'PDFs', extensions: ['pdf'] }]
    });
    if (canceled) {
        return [];
    } else {
        return filePaths;
    }
});

ipcMain.handle('dialog:saveFile', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog({
        filters: [{ name: 'PDFs', extensions: ['pdf'] }]
    });
    if (canceled) {
        return null;
    } else {
        return filePath;
    }
});

ipcMain.handle('pdf:merge', async (event, files: string[], outputPath: string) => {
    return new Promise((resolve) => {
        if (!pythonProcess) {
            resolve({ status: 'error', message: 'Python process not running' });
            return;
        }

        const command = {
            type: 'merge',
            files: files,
            output: outputPath
        };

        // Simple request/response via stdio for now. 
        // NOTE: In a real app we need a way to correlate responses to requests (e.g. IDs).
        // For this single-threaded demo, we'll just listen for the next data event.
        // A better approach below.

        const listener = (data: any) => {
            try {
                const response = JSON.parse(data.toString());
                resolve(response);
            } catch (e) {
                resolve({ status: 'error', message: 'Invalid response from Python' });
            }
            pythonProcess.stdout.removeListener('data', listener);
        };

        pythonProcess.stdout.on('data', listener);
        pythonProcess.stdin.write(JSON.stringify(command) + '\n');
    });
});

ipcMain.handle('pdf:extract', async (event, file: string, pages: string, outputPath: string) => {
    return new Promise((resolve) => {
        if (!pythonProcess) {
            resolve({ status: 'error', message: 'Python process not running' });
            return;
        }

        const command = {
            type: 'extract',
            file: file,
            pages: pages,
            output: outputPath
        };

        const listener = (data: any) => {
            try {
                const response = JSON.parse(data.toString());
                resolve(response);
            } catch (e) {
                resolve({ status: 'error', message: 'Invalid response from Python' });
            }
            pythonProcess.stdout.removeListener('data', listener);
        };

        pythonProcess.stdout.on('data', listener);
        pythonProcess.stdin.write(JSON.stringify(command) + '\n');
    });
});

ipcMain.handle('pdf:compress', async (event, file: string, outputPath: string) => {
    return new Promise((resolve) => {
        if (!pythonProcess) {
            resolve({ status: 'error', message: 'Python process not running' });
            return;
        }

        const command = {
            type: 'compress',
            file: file,
            output: outputPath
        };

        const listener = (data: any) => {
            try {
                const response = JSON.parse(data.toString());
                resolve(response);
            } catch (e) {
                resolve({ status: 'error', message: 'Invalid response from Python' });
            }
            pythonProcess.stdout.removeListener('data', listener);
        };

        pythonProcess.stdout.on('data', listener);
        pythonProcess.stdin.write(JSON.stringify(command) + '\n');
    });
});
