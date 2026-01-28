const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    send: (channel, data) => {
        // Whitelist channels if needed for better security
        let validChannels = ['set-csv-path'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    receive: (channel, func) => {
        let validChannels = [
            'biometria-status',
            'nova-atividade',
            'web-server-started',
            'serial-port-connected',
            'user-updated',
            'activities-cleared',
            'users-updated',
            'activity-updated',
            'user-deleted'
        ];
        if (validChannels.includes(channel)) {
            // Deliberately strip event as it includes `sender` 
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
    invoke: (channel, data) => {
        let validChannels = [
            // 'select-student-data-path', // Removed
            // 'search-student-data', // Removed
            'get-users',
            'get-activities',
            'add-manual-activity',
            'listar-portas',
            'setar-porta-serial',
            'update-user',
            'clear-all-activities',
            'remove-duplicates',
            'update-activity',
            'sync-time',
            'select-csv-path',
            'export-activities-excel',
            'delete-user',
            'set-buzzer-state',
            'add-user-and-enroll',
            'sync-from-sensor',
            'empty-sensor-database',
            'ai-query'
        ];
        if (validChannels.includes(channel)) {
            return ipcRenderer.invoke(channel, data);
        }
        return Promise.reject(new Error(`Invalid IPC channel: ${channel}`));
    },
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    }
});
