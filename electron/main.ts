import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { spawn } from 'child_process';
import fs from 'fs';

// --- File logger (visible in packaged builds) ---
// Log path is resolved lazily after app is ready.
let _logPath: string | null = null;

function getLogPath(): string {
    if (!_logPath) {
        _logPath = path.join(app.getPath('userData'), 'pdf-creator.log');
    }
    return _logPath;
}

function log(level: 'INFO' | 'ERROR' | 'WARN', msg: string) {
    const line = `[${new Date().toISOString()}] [${level}] ${msg}\n`;
    process.stdout.write(line);
    try {
        fs.appendFileSync(getLogPath(), line);
    } catch {
        // ignore fs errors during logging
    }
}

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
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    const iconPath = isDev
        ? path.join(__dirname, '../public/logo.png')
        : path.join(__dirname, '../dist/logo.png');

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: iconPath,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

app.whenReady().then(() => {
    log('INFO', `App ready. isPackaged=${app.isPackaged}, userData=${app.getPath('userData')}`);
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

    let executablePath: string;
    let args: string[] = [];

    if (isDev) {
        executablePath = path.join(__dirname, '../.venv/Scripts/python.exe');
        args = [path.join(__dirname, '../python/main.py')];
    } else {
        executablePath = path.join(process.resourcesPath, 'python/pdf_backend.exe');
        args = [];
    }

    const exeExists = fs.existsSync(executablePath);
    log('INFO', `Python executable path: ${executablePath}`);
    log('INFO', `Python executable exists: ${exeExists}`);
    log('INFO', `args: ${JSON.stringify(args)}`);
    log('INFO', `resourcesPath: ${process.resourcesPath ?? 'N/A'}`);

    if (!exeExists) {
        log('ERROR', `Python executable NOT FOUND — all PDF operations will fail`);
        return;
    }

    pythonProcess = spawn(executablePath, args, {
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });

    pythonProcess.on('error', (err: Error) => {
        log('ERROR', `Failed to spawn Python process: ${err.message}`);
    });

    pythonProcess.stdout.on('data', (data: any) => {
        log('INFO', `Python stdout: ${data.toString().trimEnd()}`);
    });

    pythonProcess.stderr.on('data', (data: any) => {
        log('ERROR', `Python stderr: ${data.toString().trimEnd()}`);
    });

    pythonProcess.on('close', (code: any) => {
        log(code === 0 ? 'INFO' : 'ERROR', `Python process exited with code ${code}`);
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

// Sends a JSON command to the Python subprocess and buffers the response,
// handling cases where large payloads arrive in multiple chunks.
function sendPythonCommand(command: object): Promise<any> {
    return new Promise((resolve) => {
        if (!pythonProcess) {
            log('ERROR', `sendPythonCommand: no Python process — command dropped: ${JSON.stringify(command)}`);
            resolve({ status: 'error', message: 'Python process not running' });
            return;
        }

        log('INFO', `→ Python: ${JSON.stringify(command)}`);
        let buffer = '';
        const listener = (data: any) => {
            buffer += data.toString();
            try {
                const response = JSON.parse(buffer);
                pythonProcess.stdout.removeListener('data', listener);
                log('INFO', `← Python: ${JSON.stringify(response).substring(0, 200)}`);
                resolve(response);
            } catch {
                // Incomplete JSON — keep buffering
            }
        };

        pythonProcess.stdout.on('data', listener);
        pythonProcess.stdin.write(JSON.stringify(command) + '\n');
    });
}

// IPC Handlers
ipcMain.handle('ping', () => 'pong');

ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'PDFs', extensions: ['pdf'] }]
    });
    return canceled ? [] : filePaths;
});

ipcMain.handle('dialog:saveFile', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog({
        filters: [{ name: 'PDFs', extensions: ['pdf'] }]
    });
    return canceled ? null : filePath;
});

ipcMain.handle('pdf:merge', async (event, files: string[], outputPath: string) => {
    return sendPythonCommand({ type: 'merge', files, output: outputPath });
});

ipcMain.handle('pdf:extract', async (event, file: string, pages: string, outputPath: string) => {
    return sendPythonCommand({ type: 'extract', file, pages, output: outputPath });
});

ipcMain.handle('pdf:compress', async (event, file: string, outputPath: string) => {
    return sendPythonCommand({ type: 'compress', file, output: outputPath });
});

ipcMain.handle('pdf:getPages', async (event, file: string) => {
    return sendPythonCommand({ type: 'get_pages', file });
});

ipcMain.handle('pdf:getThumbnails', async (event, file: string) => {
    return sendPythonCommand({ type: 'get_thumbnails', file });
});

ipcMain.handle('pdf:edit', async (event, file: string, outputPath: string, edits: object[]) => {
    return sendPythonCommand({ type: 'edit_pdf', file, output: outputPath, edits });
});
