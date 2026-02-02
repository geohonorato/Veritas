const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

class KnowledgeService {
    constructor() {
        this._startupIngestRun = false;
    }

    async initialize() {
        // Auto-ingest on startup
        this.runStartupIngest();
        console.log('[Knowledge] Serviço de Ingestão (RAG) pronto.');
    }

    async runStartupIngest() {
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
        }, 5000); // 5s delay
    }

    async ingestAll(customPath = null) {
        let sourceDir = path.join(__dirname, '../../kp_source');

        if (customPath && typeof customPath === 'string' && customPath.trim() !== '') {
            if (fs.existsSync(customPath)) sourceDir = customPath;
        }

        if (!fs.existsSync(sourceDir)) {
            fs.mkdirSync(sourceDir, { recursive: true });
            return { status: 'empty', message: `Pasta criada (${sourceDir}).` };
        }

        console.log(`[Knowledge] Ingestão Solicitada de: ${sourceDir}`);
        console.log(`[Knowledge] Iniciando processo de ingestão (Heavy)...`);

        return new Promise((resolve, reject) => {
            const scriptPath = path.join(__dirname, '../../../scripts/rag_manager.py');
            // Check for portable python
            const projectRoot = path.join(__dirname, '../../../');
            const localPythonCmd = path.join(projectRoot, 'python_portable', 'python.exe');
            const pythonCommand = fs.existsSync(localPythonCmd) ? localPythonCmd : 'python';

            const ingestProc = spawn(pythonCommand, [scriptPath, 'ingest', sourceDir], {
                env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
            });

            let output = '';

            ingestProc.stdout.on('data', d => output += d);
            ingestProc.stderr.on('data', d => console.log(`[Ingest Script]: ${d}`));

            ingestProc.on('close', (code) => {
                if (code !== 0) {
                    resolve({ status: 'error', message: 'Ingest failed (Exit Code ' + code + ')' });
                } else {
                    try {
                        const res = JSON.parse(output.trim());
                        resolve(res);
                    } catch (e) {
                        resolve({ status: 'success', note: 'Done but parse error on output', raw: output });
                    }
                }
            });
        });
    }
}

module.exports = new KnowledgeService();
