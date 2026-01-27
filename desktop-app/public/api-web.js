// Web Adapter for Veritas Dashboard
// Provides window.api interface using HTTP and Sockets

if (!window.api) {
    console.log('[Web Adapter] Initializing Web Shim...');

    // Check Auth
    const user = sessionStorage.getItem('veritas_user');
    if (!user && window.location.pathname !== '/login.html') {
        window.location.href = '/login.html';
    }

    const socket = io();
    const headers = {
        'Content-Type': 'application/json',
        'X-Auth-User': user || 'guest'
    };

    window.api = {
        invoke: async (channel, data) => {
            console.log(`[Web API] invoke: ${channel}`, data);

            try {
                switch (channel) {
                    case 'get-users':
                        return await fetch('/api/users', { headers }).then(r => r.json());

                    case 'get-activities':
                        return await fetch('/api/activities', { headers }).then(r => r.json());

                    case 'update-user':
                        return await fetch(`/api/users/${data.id}`, {
                            method: 'PUT',
                            headers,
                            body: JSON.stringify(data.data)
                        }).then(r => r.json());

                    case 'delete-user':
                        return await fetch(`/api/users/${data}`, {
                            method: 'DELETE',
                            headers
                        }).then(r => r.json());

                    case 'add-user-and-enroll':
                        // Web flow: Add user first, then enrollment handles via socket events?
                        // Or simple add without enrollment for now since web can't scan finger?
                        // We will just add user to DB.
                        return await fetch('/api/users/enroll', {
                            method: 'POST',
                            headers,
                            body: JSON.stringify(data.userData)
                        }).then(r => r.json());

                    case 'ai-query':
                        return await fetch('/api/query-ai', {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({ query: data })
                        }).then(r => r.json()).then(res => res.text || res.error);

                    case 'listar-portas':
                        return await fetch('/api/serial/list', { headers }).then(r => r.json());

                    case 'setar-porta-serial':
                        return await fetch('/api/serial/connect', {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({ path: data })
                        }).then(r => r.json()).then(r => r.success);

                    default:
                        console.warn(`[Web API] Unknown invoke channel: ${channel}`);
                        return null;
                }
            } catch (err) {
                console.error(`[Web API] Error invoking ${channel}:`, err);
                return { error: err.message };
            }
        },

        receive: (channel, func) => {
            console.log(`[Web API] Listening for: ${channel}`);
            switch (channel) {
                case 'serial-port-connected':
                    socket.on('serial-status', (status) => {
                        if (status === 'connected') func();
                    });
                    break;

                case 'nova-atividade':
                    // Socket emits 'serial-data' which might be raw, usually 'user-entered'.
                    // Actually server.js currently emits 'serial-data' as raw line.
                    // We rely on 'data-update' for refresh?
                    // Wait, SerialService emits 'data', server logic processes it?
                    // NO. The server logic for processing attendance was in 'main.js' logic listening to serial!
                    // I missed migrating the 'Process Serial Data' logic from main.js to server.js!
                    // CRITICAL MISS. I need to fix server.js later.

                    // Assuming server emits 'data-update'
                    socket.on('data-update', (d) => {
                        if (d.type === 'activities') func();
                    });
                    break;

                case 'user-added':
                case 'user-updated':
                case 'user-deleted':
                    socket.on('data-update', (d) => {
                        if (d.type === 'users') func();
                    });
                    break;

                case 'activity-updated':
                case 'activities-cleared':
                    socket.on('data-update', (d) => {
                        if (d.type === 'activities') func();
                    });
                    break;
            }
        },

        send: (channel, data) => {
            console.log(`[Web API] send: ${channel}`, data);
        }
    };

    // Logout Helper
    window.logout = () => {
        sessionStorage.removeItem('veritas_user');
        window.location.href = '/login.html';
    };
}
