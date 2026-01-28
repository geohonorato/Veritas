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
        if (this.pythonProcess) return;

        console.log('[Knowledge] Inicializando serviço Persistent Python RAG...');
        const scriptPath = path.join(__dirname, '../../../scripts/rag_manager.py');
        
        // Spawn persistent process
        this.pythonProcess = spawn('python', [scriptPath, 'serve']);

        // Data Handler
        this.pythonProcess.stdout.on('data', (data) => this.handleData(data));
        
        // Error/Log Handler
        this.pythonProcess.stderr.on('data', (data) => {
            // Log backend messages but don't treat all as errors (some are info)
            const msg = data.toString();
            if (msg.includes('Error')) console.error(`[RAG Server Log]: ${msg.trim()}`);
            // else console.log(`[RAG Server]: ${msg.trim()}`);
        });

        this.pythonProcess.on('exit', (code) => {
            console.warn(`[Knowledge] Python process died with code ${code}.`);
            this.pythonProcess = null;
            // Reject all pending
            while (this.requestQueue.length > 0) {
                const req = this.requestQueue.shift();
                req.resolve([]); // Resolve empty for safety
            }
        });
        
        console.log('[Knowledge] Serviço iniciado em background.');
    }

    handleData(data) {
        this.buffer += data.toString();
        
        // Process complete lines
        let boundary = this.buffer.indexOf('\n');
        while (boundary !== -1) {
            const line = this.buffer.substring(0, boundary).trim();
            this.buffer = this.buffer.substring(boundary + 1);
            boundary = this.buffer.indexOf('\n');

            if (!line) continue;

            try {
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
                }
            } catch (e) {
                console.error('[Knowledge] JSON Parse error:', e, "Raw Line:", line);
            }
        }
    }

    async search(query, limit = 5) {
        if (!this.pythonProcess) await this.initialize();

        return new Promise((resolve, reject) => {
            this.requestQueue.push({ resolve, reject });
            
            try {
                // Ensure query is safe
                const payload = JSON.stringify({ action: "search", query: query }) + "\n";
                this.pythonProcess.stdin.write(payload);
            } catch (err) {
                console.error("Write error:", err);
                const idx = this.requestQueue.indexOf({resolve, reject}); 
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
