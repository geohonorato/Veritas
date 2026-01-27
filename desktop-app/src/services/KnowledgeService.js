const lancedb = require('@lancedb/lancedb');
const { pipeline } = require('@xenova/transformers');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const XLSX = require('xlsx'); // Added XLSX for CSV parsing

class KnowledgeService {
    constructor() {
        this.db = null;
        this.table = null;
        this.embedder = null;
        this.tableName = 'documents';
        this.dbPath = path.join(__dirname, '../../data/knowledge.lance');
    }

    async initialize() {
        try {
            console.log('[Knowledge] Inicializando LanceDB e Embeddings...');

            // 1. Setup DB
            this.db = await lancedb.connect(this.dbPath);

            // Check if table exists
            const tableNames = await this.db.tableNames();
            if (tableNames.includes(this.tableName)) {
                this.table = await this.db.openTable(this.tableName);
            } else {
                // Create table with schema implicit from first add or explicit? 
                // LanceDB Node supports creating from data. We'll init lazily on first add if simpler,
                // or create empty. Since schema is needed for vector search, we create on first ingest.
                console.log('[Knowledge] Tabela não existe. Será criada na primeira ingestão.');
            }

            // 2. Setup Embedder (Lazy Load to save startup time?)
            // We initiate it here to warn if model missing
            // this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

            console.log('[Knowledge] Serviço Pronto.');
            return true;
        } catch (error) {
            console.error('[Knowledge] Erro ao inicializar:', error);
            return false;
        }
    }

    async getEmbedder() {
        if (!this.embedder) {
            console.log('[Knowledge] Carregando modelo de Embedding (Xenova/all-MiniLM-L6-v2)...');
            this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        }
        return this.embedder;
    }

    async generateEmbedding(text) {
        const embedder = await this.getEmbedder();
        const output = await embedder(text, { pooling: 'mean', normalize: true });
        return Array.from(output.data);
    }

    // --- Ingestion Flow ---

    async ingestAll(customPath = null) {
        const startTime = Date.now();
        let sourceDir = path.join(__dirname, '../../kp_source');

        if (customPath && typeof customPath === 'string' && customPath.trim() !== '') {
            if (fs.existsSync(customPath)) {
                console.log(`[Knowledge] Usando pasta customizada: ${customPath}`);
                sourceDir = customPath;
            } else {
                console.warn(`[Knowledge] Pasta customizada não encontrada: ${customPath}. Usando padrão.`);
                // Return error allows UI to show warning? Or fallback?
                // Let's fallback but warn.
            }
        }

        if (!fs.existsSync(sourceDir)) {
            fs.mkdirSync(sourceDir, { recursive: true });
            return { status: 'empty', message: `Pasta criada (${sourceDir}). Adicione arquivos lá.` };
        }

        const files = fs.readdirSync(sourceDir).filter(f => {
            const ext = path.extname(f).toLowerCase();
            return ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt',
                '.txt', '.md', '.csv', '.rtf', '.html', '.htm', '.xml',
                '.odt', '.ods', '.odp',
                '.png', '.jpg', '.jpeg'].includes(ext);
        });
        if (files.length === 0) return { status: 'empty', message: 'Nenhum arquivo suportado na pasta kp_source.' };

        console.log(`[Knowledge] Iniciando ingestão de ${files.length} arquivos...`);
        let processed = 0;

        for (const file of files) {
            const filePath = path.join(sourceDir, file);
            console.log(`[Knowledge] Processando: ${file}`);

            try {
                // 1. Convert
                let markdown = '';
                const ext = path.extname(file).toLowerCase();
                let chunks = [];

                // Special handling for CSV to match RAG best practices (Row-based)
                if (ext === '.csv' || ext === '.xlsx' || ext === '.xls') {
                    console.log(`[Knowledge] Processando estruturado (${ext}): ${file}`);
                    const workbook = XLSX.readFile(filePath);
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const json = XLSX.utils.sheet_to_json(sheet);

                    // Convert each row to a context string
                    // Format: "Info: key=value, key=value..." or just Q&A
                    chunks = json.map(row => {
                        return Object.entries(row)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join('\n');
                    });

                    console.log(`[Knowledge] Extraídos ${chunks.length} registros/linhas de ${file}`);

                    // Add filename to chunks for context
                    chunks = chunks.map(c => `Fonte: ${file}\n---\n${c}`);

                } else if (['.txt', '.md', '.json', '.html', '.xml'].includes(ext)) {
                    console.log(`[Knowledge] Lendo arquivo de texto diretamente: ${file}`);
                    markdown = fs.readFileSync(filePath, 'utf8');
                    if (ext === '.json') markdown = JSON.stringify(JSON.parse(markdown), null, 2);

                    if (markdown && markdown.trim().length > 0) {
                        chunks = this.chunkText(markdown, 1000);
                    }
                } else {
                    // Use Docling for PDFs/Images (New RAG Pipeline)
                    const docResult = await this.runDocling(filePath);
                    if (docResult.chunks && docResult.chunks.length > 0) {
                        chunks = docResult.chunks;
                    } else if (docResult.content && docResult.content.trim().length > 0) {
                        chunks = this.chunkText(docResult.content, 1000);
                    }
                }

                if (chunks.length === 0) {
                    console.warn(`[Knowledge] Arquivo vazio ou sem conteúdo extraível: ${file}`);
                    continue;
                }

                // 3. Embed & Save
                await this.addToVectorDB(file, chunks);

                processed++;
            } catch (err) {
                console.error(`[Knowledge] Falha ao processar ${file}:`, err);
            }
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        return { status: 'success', processed, total: files.length, duration };
    }

    runDocling(filePath) {
        return new Promise((resolve, reject) => {
            const scriptPath = path.join(__dirname, '../../scripts/rag_ingest.py');
            const pythonProcess = spawn('python', [scriptPath, filePath]);

            let dataBuffer = '';
            let errorBuffer = '';

            // Timeout to kill stuck processes (e.g. 300s per file - Docling is heavy)
            const timeout = setTimeout(() => {
                pythonProcess.kill();
                reject(new Error('Docling process timed out (300s limit).'));
            }, 300000);

            pythonProcess.stdout.on('data', (data) => {
                dataBuffer += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                errorBuffer += data.toString();
                // Docling logs to stderr usually, only show errors or critical info
                // console.log(`[Docling Log] ${data}`);
            });

            pythonProcess.on('close', (code) => {
                clearTimeout(timeout);
                if (code !== 0) {
                    return reject(new Error(`Python script exited with code ${code}: ${errorBuffer}`));
                }
                try {
                    const result = JSON.parse(dataBuffer);
                    if (result.status === 'success') {
                        resolve(result);
                    } else {
                        reject(new Error(result.message || 'Unknown error'));
                    }
                } catch (e) {
                    reject(new Error('Failed to parse Python output: ' + dataBuffer));
                }
            });
        });
    }

    chunkText(text, size = 500) {
        // Simple overlap chunking
        const chunks = [];
        for (let i = 0; i < text.length; i += size) {
            chunks.push(text.slice(i, i + size + 100)); // 100 overlap
        }
        return chunks;
    }

    async addToVectorDB(filename, chunks) {
        const data = [];
        console.log(`[Knowledge] Gerando embeddings para ${chunks.length} chunks de ${filename}...`);

        for (let i = 0; i < chunks.length; i++) {
            // Yield loop to keep server responsive and allow Ctrl+C to work cleanly if needed
            await new Promise(resolve => setImmediate(resolve));

            const chunk = chunks[i];

            // Detailed Progress Log (overwrite line)
            const percent = Math.round(((i + 1) / chunks.length) * 100);
            process.stdout.write(`\r[Knowledge] Embeddings: [${'='.repeat(Math.floor(percent / 5))}${' '.repeat(20 - Math.floor(percent / 5))}] ${percent}% (${i + 1}/${chunks.length})`);

            try {
                const vector = await this.generateEmbedding(chunk);
                data.push({
                    text: chunk,
                    vector: vector,
                    source: filename,
                    timestamp: Date.now()
                });
            } catch (e) {
                console.error(`\n[Knowledge] Erro no chunk ${i}:`, e.message);
            }
        }
        process.stdout.write('\n'); // Final newline

        if (!this.table) {
            // First time creation
            // LanceDB expects Array of objects. Schema is inferred.
            // Vector column must be explicit in some versions, but data inference usually works if vector is array of numbers.
            this.table = await this.db.createTable(this.tableName, data);
        } else {
            await this.table.add(data);
        }
        console.log(`[Knowledge] Salvo ${data.length} vetores.`);
    }

    // --- Search Flow ---

    async search(query, limit = 5, whereClause = null) {
        if (!this.table) {
            console.warn('[Knowledge] Tabela não inicializada. Tentando reabrir...');
            try {
                this.table = await this.db.openTable(this.tableName);
            } catch (e) {
                console.error('[Knowledge] Tabela não encontrada mesmo após tentativa de reabrir.');
                return [];
            }
        }

        const vector = await this.generateEmbedding(query);
        console.log(`[Knowledge] Buscando com vetor de dimensão ${vector.length}... (Filtro: ${whereClause})`);

        try {
            // Direct call to toArray(), supported in recent lancedb versions
            let safeResults = [];
            try {
                let queryBuilder = this.table.search(vector).limit(limit);
                if (whereClause) {
                    queryBuilder = queryBuilder.where(whereClause);
                }
                safeResults = await queryBuilder.toArray();
                
                console.log(`[Knowledge] Search retrieved ${safeResults.length} records.`);
            } catch (e) {
                console.error('[Knowledge] Error using toArray, attempting fallback execute:', e.message);
                const execResult = await this.table.search(vector).limit(limit).execute();
                safeResults = Array.from(execResult); // Fallback for iterator
            }

            // Logging for debug
            // console.log('[Knowledge] Processed Results Array:', JSON.stringify(safeResults, null, 2));

            return safeResults.map(r => ({
                text: r.text,
                source: r.source,
                score: r._distance // LanceDB uses _distance (lower is better)
            }));
        } catch (e) {
            console.error('[Knowledge] Erro na busca vetorial:', e);
            return [];
        }
    }
}

module.exports = new KnowledgeService();
