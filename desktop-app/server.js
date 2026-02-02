require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const xlsx = require('xlsx');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const open = require('open');

// Internal Modules
const db = require('./src/database');
const knowledgeService = require('./src/services/KnowledgeService');
const aiService = require('./src/services/AIService');

// --- Configuration ---
const PORT = process.env.PORT || 3000;
const SERIAL_BAUD_RATE = 9600;

// --- App Setup ---
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Middlewares ---
const checkAuth = (req, res, next) => {
    // Basic header check, can be expanded
    const user = req.headers['x-auth-user'];
    // console.log(`[Auth] User: ${user}`);
    next();
};

app.use('/api', checkAuth);

// --- Serial Port Logic ---
let port = null;

async function listSerialPorts() {
    try {
        return await SerialPort.list();
    } catch (err) {
        console.error('Error listing ports:', err);
        return [];
    }
}

function connectToSerialPort(path) {
    if (port && port.isOpen) {
        if (port.path === path) return true; // Already connected
        port.close();
    }

    try {
        port = new SerialPort({ path, baudRate: SERIAL_BAUD_RATE });
        const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

        port.on('open', () => {
            console.log(`[Serial] Connected to ${path}`);
            io.emit('serial-status', 'connected');
        });

        port.on('error', (err) => {
            console.error('[Serial] Error:', err.message);
            io.emit('serial-status', 'error');
        });

        parser.on('data', (data) => {
            const cleanData = data.trim();
            console.log(`[Serial] Data: ${cleanData}`);
            io.emit('serial-data', cleanData); // Raw emit for UI debug

            // Process Attendance (ID received)
            const userId = parseInt(cleanData, 10);
            if (!isNaN(userId)) {
                handleBiometricEntry(userId);
            }
        });

        return true;
    } catch (err) {
        console.error(`[Serial] Failed to connect: ${err.message}`);
        return false;
    }
}

async function handleBiometricEntry(userId) {
    try {
        console.log(`[Logic] Biometric entry for ID: ${userId}`);
        const user = db.getUserById(userId);
        if (user) {
            const activity = db.addActivity({ userId: user.id });
            if (activity) {
                io.emit('data-update', { type: 'activities' });
                io.emit('data-update', { type: 'faltas' }); // Updated if entry removed fault
                // Optional: Emit specific "Access Granted" event for UI feedback
            }
        } else {
            console.warn(`[Logic] User ID ${userId} not found.`);
        }
    } catch (e) {
        console.error('[Logic] Error handling entry:', e);
    }
}


// --- API Endpoints ---

// 0. Auth / Login
app.post('/api/login', (req, res) => {
    try {
        const { username, password } = req.body;
        const admin = db.checkLogin(username, password);
        if (admin) {
            res.json({ success: true, username: admin.username });
        } else {
            res.json({ success: false, message: 'Credenciais inválidas' });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 1. Users
app.get('/api/users', (req, res) => {
    try {
        const users = db.getUsers();
        res.json(users);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users/enroll', (req, res) => {
    try {
        const user = db.addUser(req.body);
        if (user.error) return res.status(400).json(user);

        io.emit('data-update', { type: 'users' });
        // Trigger Serial Enrollment if needed (not implemented in simple version)
        res.json({ success: true, user });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/users/:id', (req, res) => {
    try {
        const user = db.updateUser(req.params.id, req.body);
        io.emit('data-update', { type: 'users' });
        res.json(user);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/users/:id', (req, res) => {
    try {
        db.deleteUser(req.params.id);
        io.emit('data-update', { type: 'users' });
        res.json({ success: true, message: 'Usuário excluído' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. Activities
app.get('/api/activities', (req, res) => {
    try {
        const activities = db.getActivities();
        res.json(activities);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/activities', (req, res) => {
    try {
        const act = db.addActivity(req.body);
        io.emit('data-update', { type: 'activities' });
        res.json(act);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. Faltas
app.get('/api/faltas', (req, res) => {
    try {
        const filters = {
            date: req.query.date,
            turma: req.query.turma,
            userId: req.query.userId
        };
        const faltas = db.getFaltas(filters);
        res.json(faltas);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/faltas/initialize', (req, res) => {
    try {
        const count = db.initializeTodaysFaltas();
        if (count > 0) io.emit('data-update', { type: 'faltas' });
        res.json({ success: true, count });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/faltas/:id', (req, res) => {
    try {
        db.deleteFalta(req.params.id);
        io.emit('data-update', { type: 'faltas' });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3.5 Stats
app.get('/api/stats/weekly', (req, res) => {
    try {
        const stats = db.getWeeklyStats();
        res.json(stats);
    } catch (e) { res.status(500).json({ error: e.message }); }
});


// 4. Settings
app.get('/api/settings', (req, res) => {
    try {
        res.json(db.getSettings());
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/settings', (req, res) => {
    try {
        const settings = db.saveSettings(req.body);
        res.json(settings);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 5. Serial API
app.get('/api/serial/list', async (req, res) => {
    const ports = await listSerialPorts();
    res.json(ports);
});

app.post('/api/serial/connect', (req, res) => {
    const success = connectToSerialPort(req.body.path);
    res.json({ success });
});

// 6. AI / Knowledge
app.post('/api/query-ai', async (req, res) => {
    try {
        const { query } = req.body;
        const answer = await aiService.processQuery(query);
        res.json({ response: answer });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/knowledge/ingest', async (req, res) => {
    try {
        const result = await knowledgeService.ingestAll();
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});


// 7. Email Test
app.post('/api/email/test', async (req, res) => {
    try {
        const settings = db.getSettings();
        const { targetEmail } = req.body;

        if (!settings.smtp_host) throw new Error('SMTP não configurado.');

        const transporter = nodemailer.createTransport({
            host: settings.smtp_host,
            port: parseInt(settings.smtp_port) || 587,
            secure: settings.smtp_secure === 'true',
            auth: {
                user: settings.smtp_user,
                pass: settings.smtp_pass
            }
        });

        await transporter.sendMail({
            from: settings.smtp_user,
            to: targetEmail,
            subject: 'Teste Veritas',
            text: 'Este é um email de teste do sistema Veritas.'
        });

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 8. OAuth URL (Stub)
app.post('/api/auth/google/url', (req, res) => {
    // Basic Stub - In real app would use googleapis to generate URL
    // Using Env vars
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId) {
        return res.status(400).json({ error: 'Google Client ID não configurado no .env' });
    }

    const oauth2Client = new google.auth.OAuth2(
        clientId,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectUri
    );

    const scopes = ['https://www.googleapis.com/auth/gmail.send'];

    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes
    });

    res.json({ url });
});


// 9. Export Report
app.post('/api/export/report', (req, res) => {
    try {
        const users = db.getUsers();
        const activities = db.getActivities();
        const faltas = db.getFaltas();

        const wb = xlsx.utils.book_new();

        const wsUsers = xlsx.utils.json_to_sheet(users);
        xlsx.utils.book_append_sheet(wb, wsUsers, "Usuários");

        const wsActivities = xlsx.utils.json_to_sheet(activities);
        xlsx.utils.book_append_sheet(wb, wsActivities, "Atividades");

        const wsFaltas = xlsx.utils.json_to_sheet(faltas);
        xlsx.utils.book_append_sheet(wb, wsFaltas, "Faltas");

        // Buffer return
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="relatorio-completo.xlsx"');
        res.send(buffer);

    } catch (e) { res.status(500).json({ error: e.message }); }
});


// --- Server Start ---
server.listen(PORT, () => {
    console.log(`[Server] Veritas Desktop running on port ${PORT}`);

    // Attempt auto-connect to saved serial port
    const settings = db.getSettings();
    if (settings.last_serial_port) {
        connectToSerialPort(settings.last_serial_port);
    }

    // Initialize Knowledge/RAG
    knowledgeService.initialize();
});
