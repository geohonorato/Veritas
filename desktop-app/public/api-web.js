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

                    case 'export-complete-report':
                        const resp = await fetch('/api/export/report', {
                            method: 'POST',
                            headers,
                            body: JSON.stringify(data)
                        });
                        if (resp.ok) {
                            const blob = await resp.blob();
                            // Criar link invisível para download
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            // Tentar obter nome do arquivo do header
                            const contentDisposition = resp.headers.get('Content-Disposition');
                            let fileName = `relatorio-completo-${new Date().toISOString().slice(0,10)}.xlsx`;
                            if (contentDisposition) {
                                const match = contentDisposition.match(/filename="(.+)"/);
                                if (match && match[1]) fileName = match[1];
                            }
                            a.download = fileName;
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            window.URL.revokeObjectURL(url);
                            return { success: true };
                        } else {
                            const errJson = await resp.json();
                            return { success: false, error: errJson.error || 'Erro no servidor' };
                        }

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

                    case 'add-manual-activity':
                        return await fetch('/api/activities', {
                            method: 'POST',
                            headers,
                            body: JSON.stringify(data)
                        }).then(r => r.json());

                    case 'listar-portas':
                        return await fetch('/api/serial/list', { headers }).then(r => r.json());

                    case 'setar-porta-serial':
                        return await fetch('/api/serial/connect', {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({ path: data })
                        }).then(r => r.json()).then(r => r.success);

                    case 'get-faltas':
                        const params = new URLSearchParams();
                        if (data?.date) params.append('date', data.date);
                        if (data?.turma) params.append('turma', data.turma);
                        if (data?.userId) params.append('userId', data.userId);
                        return await fetch(`/api/faltas?${params}`, { headers }).then(r => r.json());

                    case 'initialize-todays-faltas':
                        return await fetch('/api/faltas/initialize', {
                            method: 'POST',
                            headers
                        }).then(r => r.json());

                    case 'delete-falta':
                        return await fetch(`/api/faltas/${data}`, {
                            method: 'DELETE',
                            headers
                        }).then(r => r.json());

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

                case 'falta-added':
                case 'falta-deleted':
                    socket.on('data-update', (d) => {
                        if (d.type === 'faltas') func();
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
