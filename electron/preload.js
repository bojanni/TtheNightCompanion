const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    getAppPath: () => ipcRenderer.invoke('get-app-path'),
    platform: process.platform,
    fetchNightcafe: (url) => ipcRenderer.invoke('fetch-nightcafe', url),
    getDbStartupPreferences: () => ipcRenderer.invoke('db-config:get-startup-preferences'),
    setDbAskOnStartup: (askOnStartup) => ipcRenderer.invoke('db-config:set-ask-on-startup', askOnStartup),
    saveCurrentDbConfigAs: () => ipcRenderer.invoke('db-config:save-current-as'),
});

contextBridge.exposeInMainWorld('isElectron', true);