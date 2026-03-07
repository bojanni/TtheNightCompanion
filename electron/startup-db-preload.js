const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('startupDb', {
    getData: () => ipcRenderer.invoke('startup-db:get-data'),
    openExisting: () => ipcRenderer.invoke('startup-db:open-existing'),
    useCurrent: (dontAskAgain) => ipcRenderer.send('startup-db:use-current', { dontAskAgain: Boolean(dontAskAgain) }),
    useDefaults: (dontAskAgain) => ipcRenderer.send('startup-db:use-defaults', { dontAskAgain: Boolean(dontAskAgain) }),
    confirmOpenExisting: (config, dontAskAgain) => ipcRenderer.send('startup-db:confirm-open-existing', {
        config,
        dontAskAgain: Boolean(dontAskAgain),
    }),
});
