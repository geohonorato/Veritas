const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

class KnowledgeService {
    constructor() {
        this.pythonProcess = null;
        this.requestQueue = []; // Queue of { resolve, reject } pending requests
        this.buffer = '';       // Stdout accumulation buffer
    }

    async initialize() {
        // Auto-ingest on startup? 
        // User asked: "o aprendizado e rag iniciam junto com o resto do servidor?"
        // Let's implement a checked startup ingest.
        this.runStartupIngest(); 

        if (this.pythonProcess) return;

        console.log('[Knowledge] Inicializando serviço Persistent Python RAG...');
        const scriptPath = path.join(__dirname, '../../../scripts/rag_manager.py');
        
        // Spawn persistent process with UTF-8 env
        this.pythonProcess = spawn('python', [scriptPath, 'serve'], {
            env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONLEGACYWINDOWSSTDIO: 'utf-8' }
        });

        // Data Handler
        this.pythonProcess.stdout.on('data', (data) => this.handleData(data));
        
        // Error/Log Handler
        this.pythonProcess.stderr.on('data', (data) => {
            // Log ALL backend messages for debugging
            const msg = data.toString();
            console.log(`[RAG Server Log]: ${msg.trim()}`);
        });

        this.pythonProcess.on('exit', (code) => {
            // Se foi kill intencional (code null), é apenas reinicialização
            if (code === null) {
                console.log(`[Knowledge] Serviço Python parado para atualização.`);
            } else {
                console.warn(`[Knowledge] Processo Python encerrou inesperadamente (código ${code}).`);
            }
            this.pythonProcess = null;
            // Reject all pending
            while (this.requestQueue.length > 0) {
                const req = this.requestQueue.shift();
                req.resolve([]); // Resolve empty for safety
            }
        });
        
        console.log('[Knowledge] Serviço iniciado em background.');
    }

    async runStartupIngest() {
        // Prevent double run
        if (this._startupIngestRun) return;
        this._startupIngestRun = true;

        setTimeout(async () => {
             console.log('[Knowledge] Verificando novos documentos para treinamento (Background)...');
             try {
                 const res = await this.ingestAll();
                 if (res.skipped > 0) console.log(`[Knowledge] Treinamento Inteligente: ${res.skipped} arquivos ignorados (já conhecidos).`);
                 if (res.count > 0) console.log(`[Knowledge] Treinamento Concluído: ${res.count} novos arquivos aprendidos.`);
             } catch (e) {
                 console.error("[Knowledge] Falha na verificação de startup:", e);
             }
        }, 5000); // 5s delay to let server boot
    }

    handleData(data) {
        this.buffer += data.toString();
        
        // Log raw data size for debugging
        // console.log(`[Knowledge Debug] Received ${data.length} bytes from Python.`);

        // Process complete lines
        let boundary = this.buffer.indexOf('\n');
        while (boundary !== -1) {
            const line = this.buffer.substring(0, boundary).trim();
            this.buffer = this.buffer.substring(boundary + 1);
            boundary = this.buffer.indexOf('\n');

            if (!line) continue;

            try {
                // console.log(`[Knowledge Debug] Parsing line: ${line.substring(0, 50)}...`);
                const response = JSON.parse(line);
                
                // Matches the oldest request in queue
                const req = this.requestQueue.shift();
                
                if (req) {
                    if (response.status === 'success') {
                        req.resolve(response.data);
                    } else if (response.status === 'pong' || response.status === 'reloaded') {
                        req.resolve(response);
                    } else {
                        console.error('[Knowledge] Search Error form Backend:', response);
                        req.resolve([]); // Fallback
                    }
                } else {
                    // console.warn("[Knowledge] Received response but no pending request:", response);
                }
            } catch (e) {
                console.error('[Knowledge] JSON Parse error:', e, "Raw Line:", line);
            }
        }
    }

    async search(query, limit = 5) {
        if (!this.pythonProcess) await this.initialize();

        return new Promise((resolve, reject) => {
            const req = { resolve, reject };
            this.requestQueue.push(req);
            
            // Timeout to prevent hanging forever
            setTimeout(() => {
                const idx = this.requestQueue.indexOf(req);
                if (idx > -1) {
                    this.requestQueue.splice(idx, 1);
                    console.error("[Knowledge] Search Timeout (Python script stuck).");
                    resolve([]); // Return empty to avoid crashing flow
                }
            }, 10000); // 10s timeout

            try {
                // Ensure query is safe
                const payload = JSON.stringify({ action: "search", query: query }) + "\n";
                this.pythonProcess.stdin.write(payload);
            } catch (err) {
                console.error("Write error:", err);
                const idx = this.requestQueue.indexOf(req); 
                if (idx > -1) this.requestQueue.splice(idx, 1);
                resolve([]);
            }
        });
    }

    async ingestAll(customPath = null) {
        const startTime = Date.now();
        let sourceDir = path.join(__dirname, '../../kp_source');

        if (customPath && typeof customPath === 'string' && customPath.trim() !== '') {
            if (fs.existsSync(customPath)) sourceDir = customPath;
        }

        if (!fs.existsSync(sourceDir)) {
            fs.mkdirSync(sourceDir, { recursive: true });
            return { status: 'empty', message: `Pasta criada (${sourceDir}).` };
        }

        console.log(`[Knowledge] Ingestão Solicitada.`);

        // 1. Stop persistent server to avoid File Locks on Windows during overwrite
        if (this.pythonProcess) {
            console.log("[Knowledge] Parando servidor RAG para atualização segura...");
            this.pythonProcess.kill(); 
            this.pythonProcess = null;
            // Clear queue
            this.requestQueue.forEach(r => r.resolve([]));
            this.requestQueue = [];
            this.buffer = '';
        }

        console.log(`[Knowledge] Iniciando processo de ingestão (Heavy)...`);

        return new Promise((resolve, reject) => {
            const scriptPath = path.join(__dirname, '../../../scripts/rag_manager.py');
            const ingestProc = spawn('python', [scriptPath, 'ingest', sourceDir]);

            let output = '';
            
            ingestProc.stdout.on('data', d => output += d);
            ingestProc.stderr.on('data', d => console.log(`[Ingest]: ${d}`));

            ingestProc.on('close', async (code) => {
                // 2. Restart persistent server immediately after
                console.log("[Knowledge] Ingestão terminada. Reiniciando servidor RAG...");
                await this.initialize();

                if (code !== 0) {
                    resolve({ status: 'error', message: 'Ingest failed' });
                } else {
                    try {
                        const res = JSON.parse(output.trim());
                        resolve(res);
                    } catch (e) {
                        resolve({ status: 'success', note: 'Done but parse error' });
                    }
                }
            });
        });
    }

    async notifyReload() {
        if (!this.pythonProcess) return;
        // Don't await strictly, just fire
        new Promise((resolve, reject) => {
            this.requestQueue.push({ resolve, reject });
            this.pythonProcess.stdin.write(JSON.stringify({ action: "reload" }) + "\n");
        }).then(() => console.log("Table reloaded in server.")).catch(e => {});
    }
}

module.exports = new KnowledgeService();
