const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = process.env.NODE_ENV === 'development';

// Disable dangling pointer detector which causes crashes in some Electron versions
if (app && app.commandLine) {
    app.commandLine.appendSwitch('disable-features', 'DanglingPointerDetector');
}

let mainWindow;
let serverProcess;

const DEFAULT_DB_CONFIG = {
    DB_USER: 'postgres',
    DB_HOST: 'localhost',
    DB_NAME: 'nightcafe_companion',
    DB_PASSWORD: 'postgres',
    DB_PORT: '5432',
};

const DEFAULT_STARTUP_SETTINGS = {
    askDbOnStartup: true,
};

function getLocalDataDir() {
    const localAppData = process.env.LOCALAPPDATA || path.join(app.getPath('home'), 'AppData', 'Local');
    return path.join(localAppData, 'NightCompanion');
}

function getPersistedDbConfigPath() {
    return path.join(getLocalDataDir(), 'database-config.json');
}

function getStartupSettingsPath() {
    return path.join(getLocalDataDir(), 'startup-settings.json');
}

function ensureLocalDataDir() {
    fs.mkdirSync(getLocalDataDir(), { recursive: true });
}

function sanitizeDbConfig(input) {
    const merged = { ...DEFAULT_DB_CONFIG, ...(input || {}) };
    return {
        DB_USER: String(merged.DB_USER || DEFAULT_DB_CONFIG.DB_USER),
        DB_HOST: String(merged.DB_HOST || DEFAULT_DB_CONFIG.DB_HOST),
        DB_NAME: String(merged.DB_NAME || DEFAULT_DB_CONFIG.DB_NAME),
        DB_PASSWORD: String(merged.DB_PASSWORD || DEFAULT_DB_CONFIG.DB_PASSWORD),
        DB_PORT: String(merged.DB_PORT || DEFAULT_DB_CONFIG.DB_PORT),
    };
}

function loadPersistedDbConfig() {
    const configPath = getPersistedDbConfigPath();
    if (!fs.existsSync(configPath)) {
        return null;
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return sanitizeDbConfig(parsed);
    } catch (error) {
        console.warn('Failed to read persisted database config. Falling back to defaults.', error);
        return null;
    }
}

function savePersistedDbConfig(config) {
    ensureLocalDataDir();
    fs.writeFileSync(getPersistedDbConfigPath(), JSON.stringify(sanitizeDbConfig(config), null, 2), 'utf8');
}

function sanitizeStartupSettings(input) {
    return {
        askDbOnStartup: typeof input?.askDbOnStartup === 'boolean'
            ? input.askDbOnStartup
            : DEFAULT_STARTUP_SETTINGS.askDbOnStartup,
    };
}

function loadStartupSettings() {
    const settingsPath = getStartupSettingsPath();
    if (!fs.existsSync(settingsPath)) {
        return { ...DEFAULT_STARTUP_SETTINGS };
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        return sanitizeStartupSettings(parsed);
    } catch (error) {
        console.warn('Failed to read startup settings. Falling back to defaults.', error);
        return { ...DEFAULT_STARTUP_SETTINGS };
    }
}

function saveStartupSettings(settings) {
    ensureLocalDataDir();
    fs.writeFileSync(getStartupSettingsPath(), JSON.stringify(sanitizeStartupSettings(settings), null, 2), 'utf8');
}

function getCurrentDbConfig() {
    const persisted = loadPersistedDbConfig();
    return sanitizeDbConfig(persisted || DEFAULT_DB_CONFIG);
}

function parseEnvFileContent(content) {
    const out = {};
    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) {
            continue;
        }

        const eqIndex = line.indexOf('=');
        if (eqIndex <= 0) {
            continue;
        }

        const key = line.slice(0, eqIndex).trim();
        let value = line.slice(eqIndex + 1).trim();

        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        out[key] = value;
    }
    return out;
}

function loadDbConfigFromFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.json') {
        const parsed = JSON.parse(content);
        return sanitizeDbConfig(parsed);
    }

    const parsedEnv = parseEnvFileContent(content);
    return sanitizeDbConfig(parsedEnv);
}

async function resolveStartupDbConfig() {
    ensureLocalDataDir();
    const startupSettings = loadStartupSettings();
    const persisted = loadPersistedDbConfig();

    if (!startupSettings.askDbOnStartup) {
        const current = getCurrentDbConfig();
        savePersistedDbConfig(current);
        return current;
    }

    const detailLines = [
        `Config location: ${getPersistedDbConfigPath()}`,
        persisted
            ? `Current: ${persisted.DB_USER}@${persisted.DB_HOST}:${persisted.DB_PORT}/${persisted.DB_NAME}`
            : `Current: ${DEFAULT_DB_CONFIG.DB_USER}@${DEFAULT_DB_CONFIG.DB_HOST}:${DEFAULT_DB_CONFIG.DB_PORT}/${DEFAULT_DB_CONFIG.DB_NAME}`,
    ];

    const response = await dialog.showMessageBox({
        type: 'question',
        buttons: ['Use Current', 'Open Existing DB Config...', 'Use Defaults'],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
        checkboxLabel: 'Do not ask again on startup',
        checkboxChecked: false,
        title: 'Database Startup',
        message: 'Choose database configuration for this startup',
        detail: detailLines.join('\n'),
    });

    if (response.checkboxChecked) {
        saveStartupSettings({ askDbOnStartup: false });
    }

    if (response.response === 1) {
        const pick = await dialog.showOpenDialog({
            title: 'Open Existing Database Config',
            properties: ['openFile'],
            filters: [
                { name: 'Config files', extensions: ['json', 'env'] },
                { name: 'All files', extensions: ['*'] },
            ],
        });

        if (!pick.canceled && pick.filePaths.length > 0) {
            try {
                const selectedConfig = loadDbConfigFromFile(pick.filePaths[0]);
                savePersistedDbConfig(selectedConfig);
                return selectedConfig;
            } catch (error) {
                await dialog.showMessageBox({
                    type: 'error',
                    title: 'Invalid Database Config',
                    message: 'Could not load the selected file as a DB config.',
                    detail: error && error.message ? error.message : String(error),
                });
            }
        }
    }

    if (response.response === 2) {
        savePersistedDbConfig(DEFAULT_DB_CONFIG);
        return { ...DEFAULT_DB_CONFIG };
    }

    const resolved = persisted || { ...DEFAULT_DB_CONFIG };
    savePersistedDbConfig(resolved);
    return resolved;
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        icon: path.join(__dirname, '../build/icon.png'),
        backgroundColor: '#020617',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: isDev ? false : true, // ✨ Disable in dev to allow local API calls
        },
    });

    // Clear cache on startup
    const { session } = require('electron');
    session.defaultSession.clearCache().catch(console.error);

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function startServer(dbConfig) {
    const { spawn } = require('child_process');
    const serverPath = path.join(__dirname, '../server/index.js');
    const serverDir = path.join(__dirname, '../server'); // ✨ Set server directory
    const resolvedDbConfig = sanitizeDbConfig(dbConfig);

    serverProcess = spawn('node', [serverPath], {
        cwd: serverDir, // ✨ This ensures dotenv finds the .env file
        env: {
            ...process.env,
            NODE_ENV: isDev ? 'development' : 'production',
            DB_USER: resolvedDbConfig.DB_USER,
            DB_HOST: resolvedDbConfig.DB_HOST,
            DB_NAME: resolvedDbConfig.DB_NAME,
            DB_PASSWORD: resolvedDbConfig.DB_PASSWORD,
            DB_PORT: resolvedDbConfig.DB_PORT,
        },
        stdio: 'inherit'
    });
}

ipcMain.handle('fetch-nightcafe', async (event, targetUrl) => {
    return new Promise((resolve, reject) => {
        let hiddenWindow = new BrowserWindow({
            width: 800,
            height: 600,
            show: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        let checking = false;

        const timeout = setTimeout(() => {
            if (hiddenWindow) {
                hiddenWindow.close();
                hiddenWindow = null;
            }
            reject(new Error('Timeout fetching NightCafe URL. The service might be protecting against bots too heavily right now.'));
        }, 30000);

        const checkContent = async () => {
            if (!hiddenWindow || checking) return;
            checking = true;
            try {
                const result = await hiddenWindow.webContents.executeJavaScript(`
                    (() => {
                        const script = document.getElementById('__NEXT_DATA__');
                        return script ? script.textContent : null;
                    })();
                `);

                if (result) {
                    const data = JSON.parse(result);
                    const job = data.props?.pageProps?.job;
                    if (job) {
                        clearTimeout(timeout);
                        resolve({
                            title: job.title || '',
                            prompt: job.prompt || '',
                            algorithm: job.algorithm || '',
                            imageUrl: job.result?.url || ''
                        });
                        hiddenWindow.close();
                        hiddenWindow = null;
                        return; // resolved
                    }
                }
            } catch (err) {
                // Ignore script errors during page load
            }
            checking = false;
        };

        hiddenWindow.webContents.on('did-finish-load', () => {
            checkContent();
        });

        // Also check periodically in case did-finish-load fired too early or late
        const interval = setInterval(() => {
            if (hiddenWindow) {
                checkContent();
            } else {
                clearInterval(interval);
            }
        }, 1000);

        hiddenWindow.loadURL(targetUrl, {
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }).catch(err => {
            clearTimeout(timeout);
            clearInterval(interval);
            if (hiddenWindow) {
                hiddenWindow.close();
                hiddenWindow = null;
            }
            reject(err);
        });
    });
});

app.whenReady().then(async () => {
    const dbConfig = await resolveStartupDbConfig();
    startServer(dbConfig);
    setTimeout(() => createWindow(), 1000);
});

app.on('window-all-closed', () => {
    if (serverProcess) serverProcess.kill();
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    if (serverProcess) serverProcess.kill();
});

ipcMain.handle('db-config:get-startup-preferences', async () => {
    const startupSettings = loadStartupSettings();
    return {
        askOnStartup: startupSettings.askDbOnStartup,
        configPath: getPersistedDbConfigPath(),
        currentConfig: getCurrentDbConfig(),
    };
});

ipcMain.handle('db-config:set-ask-on-startup', async (event, askOnStartup) => {
    const nextValue = Boolean(askOnStartup);
    saveStartupSettings({ askDbOnStartup: nextValue });
    return { askOnStartup: nextValue };
});

ipcMain.handle('db-config:save-current-as', async () => {
    const config = getCurrentDbConfig();
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    const saveResult = await dialog.showSaveDialog({
        title: 'Save Current Database Config',
        defaultPath: path.join(getLocalDataDir(), `database-config-${stamp}.json`),
        filters: [{ name: 'JSON', extensions: ['json'] }],
    });

    if (saveResult.canceled || !saveResult.filePath) {
        return { canceled: true };
    }

    fs.writeFileSync(saveResult.filePath, JSON.stringify(config, null, 2), 'utf8');
    return { canceled: false, filePath: saveResult.filePath };
});