
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

/**
 * AIService - Wrapper for Agno-based Python AI Agent
 * Replaces LangChain implementation with subprocess communication
 */
class AIService {
    constructor() {
        this.pythonProcess = null;
        this.requestQueue = [];
        this.buffer = '';
        this.initialized = false;
    }

    async initialize() {
        if (this.pythonProcess) return;

        console.log('[Veritas AI] Inicializando Agno Agent 🧠...');

        const scriptPath = path.join(__dirname, '../../../scripts/ai_agent.py');
        const projectRoot = path.join(__dirname, '../../../');
        const localPythonCmd = path.join(projectRoot, 'python_portable', 'python.exe');

        let pythonCommand = 'python';
        if (fs.existsSync(localPythonCmd)) {
            console.log('[Veritas AI] Usando Python Portátil detectado.');
            pythonCommand = localPythonCmd;
        }

        // Spawn persistent agent process
        this.pythonProcess = spawn(pythonCommand, [scriptPath, 'serve'], {
            env: {
                ...process.env,
                PYTHONIOENCODING: 'utf-8',
                PYTHONLEGACYWINDOWSSTDIO: 'utf-8'
            }
        });

        // Data handler
        this.pythonProcess.stdout.on('data', (data) => this.handleData(data));

        // Log handler
        this.pythonProcess.stderr.on('data', (data) => {
            console.log(`[Agno Agent]: ${data.toString().trim()}`);
        });

        this.pythonProcess.on('exit', (code) => {
            if (code === null) {
                console.log('[Veritas AI] Agno Agent parado.');
            } else {
                console.warn(`[Veritas AI] Agno Agent encerrou inesperadamente (código ${code}).`);
            }
            this.pythonProcess = null;
            this.initialized = false;
            // Reject pending requests
            while (this.requestQueue.length > 0) {
                const req = this.requestQueue.shift();
                req.resolve({ error: 'Agent process terminated' });
            }
        });

        this.initialized = true;
        console.log('[Veritas AI] Pronto para servir (Agno + Groq) 🚀.');
    }

    handleData(data) {
        this.buffer += data.toString();

        let boundary = this.buffer.indexOf('\n');
        while (boundary !== -1) {
            const line = this.buffer.substring(0, boundary).trim();
            this.buffer = this.buffer.substring(boundary + 1);
            boundary = this.buffer.indexOf('\n');

            if (!line) continue;

            try {
                const response = JSON.parse(line);
                const req = this.requestQueue.shift();

                if (req) {
                    if (response.status === 'success') {
                        req.resolve(response.data);
                    } else if (response.status === 'pong') {
                        req.resolve(response);
                    } else {
                        console.error('[Veritas AI] Agent Error:', response);
                        req.resolve(response.message || 'Erro no agente de IA.');
                    }
                }
            } catch (e) {
                console.error('[Veritas AI] JSON Parse error:', e, "Raw:", line);
            }
        }
    }

    async processQuery(userQuery) {
        if (!this.pythonProcess) await this.initialize();
        if (!this.pythonProcess) return "Erro Crítico: O agente de IA não foi inicializado corretamente.";

        return new Promise((resolve, reject) => {
            const req = { resolve, reject };
            this.requestQueue.push(req);

            // Timeout
            setTimeout(() => {
                const idx = this.requestQueue.indexOf(req);
                if (idx > -1) {
                    this.requestQueue.splice(idx, 1);
                    console.error("[Veritas AI] Query Timeout.");
                    resolve("Erro: Tempo limite excedido ao processar a consulta.");
                }
            }, 60000); // 60s timeout

            try {
                const payload = JSON.stringify({ action: "query", query: userQuery }) + "\n";
                this.pythonProcess.stdin.write(payload);
            } catch (err) {
                console.error("[Veritas AI] Write error:", err);
                const idx = this.requestQueue.indexOf(req);
                if (idx > -1) this.requestQueue.splice(idx, 1);
                resolve("Erro ao enviar consulta para o agente.");
            }
        });
    }
}

module.exports = new AIService();
