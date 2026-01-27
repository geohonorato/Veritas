const express = require('express');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const os = require('os');

const { google } = require('googleapis');
const open = require('open');

// Import services
const db = require('./src/database');
const AIService = require('./src/services/AIService');
const SerialService = require('./src/services/SerialService');
const EmailService = require('./src/services/EmailService');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = 3000;

function getServerIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

const SERVER_IP = getServerIp();

// Enable CORS
app.use(cors());
app.use(express.json()); // Enable JSON body parsing

app.get('/api/server-info', (req, res) => {
    res.json({
        ip: SERVER_IP,
        port: PORT,
        url: `http://${SERVER_IP}:${PORT}`
    });
});

// --- Test Email Route ---
app.post('/api/email/test', async (req, res) => {
    try {
        const targetEmail = req.body.targetEmail;
        if (!targetEmail) return res.status(400).json({ error: 'Email de destino não informado' });

        // User dummy for test
        const testUser = {
            id: 99999,
            nome: 'Teste de Sistema',
            email: targetEmail
        };

        // Activity dummy for test
        const testActivity = {
            type: 'TESTE DE ENVIO',
            timestamp: new Date().toISOString()
        };

        console.log(`[Email] Enviando teste para ${targetEmail}...`);
        const info = await EmailService.sendPointNotification(testUser, testActivity);

        if (info) {
            res.json({ success: true, messageId: info.messageId });
        } else {
            res.status(500).json({ error: 'Falha no envio (verifique logs do servidor)' });
        }
    } catch (e) {
        console.error('[Email Test] Error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Middleware de Autenticação (Simples) ---
// Em produção, usar JWT. Aqui usamos uma sessão simples via headers ou apenas login na UI.
// Como é rede local, vamos bloquear APIs de escrita sem "X-Auth-User" header.
const checkAuth = (req, res, next) => {
    // Para simplificar a migração rápida e uso em rede local,
    // vamos permitir leitura (GET) mas proteger escrita (POST/PUT/DELETE)
    // O frontend enviará o usuario logado.
    if (req.method === 'GET') return next();

    // Se for login, passa
    // Se for login, passa relative path (express strips mount point) or originalUrl check
    if (req.path === '/login' || req.originalUrl.includes('/api/login')) return next();

    // Validação básica
    const user = req.headers['x-auth-user'];
    if (!user) return res.status(401).json({ error: 'Não autorizado' });
    next();
};

app.use('/api', checkAuth);

// --- APIs ---

// Login
// Login
app.post('/api/login', (req, res) => {
    console.log('[LOGIN DEBUG] Request Body:', req.body);
    const { username, password } = req.body;
    try {
        const admin = db.checkLogin(username, password);
        console.log('[LOGIN DEBUG] DB Result:', admin);

        if (admin) {
            res.json({ success: true, username: admin.username });
        } else {
            console.log('[LOGIN DEBUG] Failed - Invalid Credentials');
            res.status(401).json({ success: false, message: 'Credenciais inválidas' });
        }
    } catch (err) {
        console.error('[LOGIN DEBUG] Error during checkLogin:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Users
app.get('/api/users', (req, res) => res.json(db.getUsers()));
app.post('/api/users', (req, res) => {
    try {
        const newUser = db.addUser(req.body);
        if (newUser.error) return res.status(400).json(newUser);
        io.emit('data-update', { type: 'users' });
        res.json(newUser);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.put('/api/users/:id', (req, res) => {
    const updated = db.updateUser(req.params.id, req.body);
    if (updated) {
        io.emit('data-update', { type: 'users' });
        res.json(updated);
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});
app.delete('/api/users/:id', (req, res) => {
    // Tenta remover do sensor também, se possível
    if (SerialService.isOpen()) {
        try {
            SerialService.deleteUser(req.params.id);
        } catch (e) {
            console.error("Erro ao remover do sensor:", e);
        }
    }

    if (db.deleteUser(req.params.id)) {
        io.emit('data-update', { type: 'users' });
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

// Activities
app.get('/api/activities', (req, res) => res.json(db.getActivities()));
app.delete('/api/activities', (req, res) => {
    db.clearAllActivities();
    io.emit('data-update', { type: 'activities' });
    io.emit('data-update', { type: 'activities' });
    res.json({ success: true });
});

// Settings API
app.get('/api/settings', (req, res) => {
    try {
        const settings = db.getSettings();
        res.json(settings);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/settings', (req, res) => {
    try {
        const updated = db.saveSettings(req.body);

        // Se a porta serial mudou, tenta reconectar?
        // Por enquanto, apenas salva. O Frontend pode pedir reconnect.
        // Se a API Key mudou, o AIService deve saber.

        io.emit('settings-update', updated);
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- OAuth Flow ---
app.post('/api/auth/google/url', (req, res) => {
    console.log('[Auth] Recebida solicitação de URL de login Google.');
    let { clientId, clientSecret } = req.body;

    // Se não vier no corpo, tenta pegar do banco (carregado via client_secret.json)
    if (!clientId || !clientSecret) {
        console.log('[Auth] Parâmetros vazios. Buscando no banco de dados...');
        const settings = db.getSettings();
        clientId = clientId || settings.oauth_client_id;
        clientSecret = clientSecret || settings.oauth_client_secret;
    }

    if (!clientId || !clientSecret) {
        console.error('[Auth] ERRO: Credenciais não encontradas.');
        return res.status(400).json({ error: 'ClientID e ClientSecret não encontrados (nem recebidos, nem no banco)' });
    }

    console.log('[Auth] Credenciais encontradas. Gerando URL...');

    try {
        const oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            `http://localhost:${PORT}/api/auth/google/callback`
        );

        const scopes = [
            'https://mail.google.com/',
            'https://www.googleapis.com/auth/userinfo.email'
        ];

        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline', // Crucial para receber refresh token
            scope: scopes,
            prompt: 'consent' // Força renovar consentimento para garantir refresh token
        });

        // Salva temporariamente clientID/Secret no banco (ou memória) para o callback usar?
        // Na verdade, o callback precisa saber o segredo para trocar o code.
        // Simplificação: Salvamos no Settings AGORA, antes mesmo de autenticar?
        // Ou passamos via state? Vamos salvar no Settings como "pending".
        db.saveSettings({
            temp_oauth_client_id: clientId,
            temp_oauth_client_secret: clientSecret
        });

        res.json({ url });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/auth/google/callback', async (req, res) => {
    const code = req.query.code;

    if (!code) return res.send('Erro: Nenhum código recebido.');

    try {
        const settings = db.getSettings();
        const clientId = settings.temp_oauth_client_id;
        const clientSecret = settings.temp_oauth_client_secret;

        if (!clientId || !clientSecret) {
            return res.send('Erro: Credenciais OAuth perdidas. Tente novamente.');
        }

        const oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            `http://localhost:${PORT}/api/auth/google/callback`
        );

        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Obter email do usuário logado
        const oauth2 = google.oauth2({
            auth: oauth2Client,
            version: 'v2'
        });
        const userInfo = await oauth2.userinfo.get();
        const userEmail = userInfo.data.email;

        // Salvar Tokens Definitivos
        db.saveSettings({
            email_mode: 'oauth2',
            oauth_client_id: clientId,
            oauth_client_secret: clientSecret,
            oauth_refresh_token: tokens.refresh_token,
            oauth_access_token: tokens.access_token,
            oauth_user: userEmail,
            // Limpa temps
            temp_oauth_client_id: '',
            temp_oauth_client_secret: ''
        });

        // Reinicializa o serviço
        await EmailService.initialize();

        res.send(`
            <div style="font-family: sans-serif; text-align: center; padding: 50px; background: #18181b; color: white; height: 100vh;">
                <h1 style="color: #818cf8;">Sucesso!</h1>
                <p>Conta <b>${userEmail}</b> conectada.</p>
                <div style="margin-top: 30px;">
                    <a href="/" style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; transition: background 0.2s;">
                        Voltar para o App
                    </a>
                </div>
                <script>
                    if (window.opener) {
                        setTimeout(() => window.close(), 2000);
                    } else {
                        setTimeout(() => window.location.href = '/', 3000);
                    }
                </script>
            </div>
        `);

        io.emit('settings-update', db.getSettings());

    } catch (e) {
        console.error(e);
        res.send(`Erro na autenticação: ${e.message}`);
    }
});

app.get('/api/stats/weekly', (req, res) => {
    try {
        const stats = db.getWeeklyStats();
        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// AI
app.post('/api/query-ai', async (req, res) => {
    try {
        const result = await AIService.processQuery(req.body.query);
        res.json({ text: result });
    } catch (e) {
        res.status(500).json({ error: e.toString() });
    }
});

// --- Serial / Hardware Events & Logic ---

let enrollmentHandler = null;

function processSerialData(line) {
    console.log('DADO BRUTO RECEBIDO DA SERIAL:', line);
    // Broadcast raw line to web clients for debugging/monitoring
    io.emit('serial-data', line);

    try {
        const data = JSON.parse(line);

        // Se um processo de cadastro está ativo, ele tem prioridade
        if (enrollmentHandler) {
            if (data.status === 'success' || data.status === 'error' || data.status === 'info') {
                // Emite status para o frontend via Socket.IO
                io.emit('biometria-status', data);

                if (data.status === 'success') {
                    clearTimeout(enrollmentHandler.timeout);
                    enrollmentHandler.resolve(data);
                    enrollmentHandler = null;
                } else if (data.status === 'error') {
                    clearTimeout(enrollmentHandler.timeout);
                    enrollmentHandler.reject(new Error(data.message));
                    enrollmentHandler = null;
                }
            }
            return;
        }

        // Lógica normal de operação
        if (data.command === 'GET_USER_DATA' && data.id) {
            const user = db.getUserById(data.id);
            if (user) {
                const type = db.getNextActivityType(user.id);
                const response = {
                    command: 'USER_DATA_RESPONSE',
                    id: user.id,
                    nome: user.nome,
                    genero: user.genero,
                    type: type
                };
                SerialService.write(JSON.stringify(response) + '\n');
            } else {
                SerialService.write(JSON.stringify({ command: 'USER_NOT_FOUND' }) + '\n');
            }
        } else if (data.status === 'activity' && data.id && data.timestamp) {
            // Note: Timestamp from ESP might need adjustments or just use server time
            const localDate = new Date(data.timestamp);
            const utcTimestamp = localDate.toISOString();

            const newActivity = db.addActivity({ userId: data.id, timestamp: utcTimestamp });
            if (newActivity) {
                io.emit('nova-atividade', newActivity);
                io.emit('data-update', { type: 'activities' });

                // Enviar email de notificação
                const user = db.getUserById(data.id);
                if (user) {
                    EmailService.sendPointNotification(user, newActivity);
                }
            }
        }
    } catch (e) {
        // Ignore invalid JSON
    }
}

try {
    // Inicializa o serviço serial (Removido initialize inexistente)
    // SerialService.initialize(null);

    // Repassa eventos do Serial para a função de processamento
    SerialService.on('data', processSerialData);

    SerialService.on('connected', () => {
        io.emit('serial-status', 'connected');
    });

} catch (e) {
    console.error("Serial Init Error:", e);
}

// --- API de Cadastro (Enrollment) ---
app.post('/api/users/enroll', (req, res) => {
    if (!SerialService.isOpen()) return res.status(500).json({ error: 'Porta serial fechada.' });
    if (enrollmentHandler) return res.status(409).json({ error: 'Cadastro já em andamento.' });

    const userData = req.body;
    const id = db.getNextUserId();
    const comando = JSON.stringify({ command: 'ENROLL', id: id });

    // Setup Promise para aguardar resposta do Serial
    new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            if (enrollmentHandler) {
                enrollmentHandler.reject(new Error('Timeout no cadastro.'));
                enrollmentHandler = null;
            }
        }, 30000);

        enrollmentHandler = { resolve, reject, timeout };

        SerialService.write(comando + '\n');

        io.emit('biometria-status', {
            status: 'info',
            message: `Iniciando cadastro para ID ${id}...`
        });
    })
        .then(successData => {
            const newUser = { id: successData.id, ...userData };
            const addUserResult = db.addUser(newUser);

            if (addUserResult.error) {
                SerialService.deleteUser(newUser.id); // Rollback no sensor? (API do SerialService tá lá?)
                // SerialService.write... DELETE_USER?
                // Simplificação: Apenas falha.
                throw new Error(addUserResult.error);
            }

            SerialService.write(JSON.stringify({ command: 'ENROLL_CONFIRMED' }) + '\n');
            res.json({ status: 'success', user: addUserResult });
            io.emit('data-update', { type: 'users' });
        })
        .catch(err => {
            res.status(500).json({ error: err.message });
        });
});


// --- API Serial Port Management ---
app.get('/api/serial/list', async (req, res) => {
    try {
        const ports = await SerialService.listPorts();
        res.json(ports);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/serial/connect', async (req, res) => {
    try {
        const { path } = req.body;
        const success = await SerialService.connect(path);
        res.json({ success });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Start Server
const KnowledgeService = require('./src/services/KnowledgeService');

// ... (existing imports)

// Start Server
AIService.initialize();
loadAutoCredentials();
EmailService.initialize();
KnowledgeService.initialize(); // Init LanceDB

// ...

// Knowledge API
app.post('/api/knowledge/ingest', async (req, res) => {
    try {
        const settings = db.getSettings();
        const customPath = settings.knowledge_path || null;
        const result = await KnowledgeService.ingestAll(customPath);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

function loadAutoCredentials() {
    const credPath = path.join(__dirname, 'data', 'client_secret.json');
    if (fs.existsSync(credPath)) {
        try {
            const content = fs.readFileSync(credPath, 'utf8');
            const fileData = JSON.parse(content);
            const creds = fileData.web || fileData.installed;

            if (creds && creds.client_id && creds.client_secret) {
                console.log('[AutoAuth] Encontrado client_secret.json. Atualizando configurações...');
                db.saveSettings({
                    oauth_client_id: creds.client_id,
                    oauth_client_secret: creds.client_secret
                });
            }
        } catch (e) {
            console.error('[AutoAuth] Erro ao carregar credenciais:', e);
        }
    }
}

server.listen(PORT, '0.0.0.0', () => {
    console.log(`
    =======================================================
    🚀SERVIDOR VERITAS WEB INICIADO!
    =======================================================
    Acesse nos computadores da rede via:
    http://[IP-DO-SERVIDOR]:${PORT}
    
    Login Padrão: admin / admin
    =======================================================
    `);
});
