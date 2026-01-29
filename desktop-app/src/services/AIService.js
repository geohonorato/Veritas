
const { ChatGroq } = require("@langchain/groq");
const { HumanMessage, SystemMessage, ToolMessage } = require("@langchain/core/messages");
const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const db = require('../database');
const KnowledgeService = require('./KnowledgeService');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

class AIService {
    constructor() {
        this.model = null;
        this.tools = [];
        this.toolsMap = {};
        this.messages = []; // Simple in-memory history
    }

    async initialize() {
        console.log('[Veritas AI] Inicializando Cérebro LangChain 🧠...');
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            console.error('[Veritas AI] ERRO: GROQ_API_KEY não encontrada no .env');
            return;
        }

        // Initialize Model (User Selected)
        this.model = new ChatGroq({
            apiKey: apiKey,
            model: "openai/gpt-oss-20b", // MODELO DEFINIDO PELO USUÁRIO. NÃO ALTERAR.
            temperature: 0.1
        });
        
        // Define data tools first
        this.defineTools();

        // Bind tools to model
        this.modelWithTools = this.model.bindTools(this.tools);

        console.log('[Veritas AI] Pronto para servir (Model: openai/gpt-oss-20b) 🚀.');
    }

    defineTools() {
        // Initialize Data (Excel) for Assisted search
        this.loadAssistedList();

        // Pre-warm Knowledge (RAG) Service
        KnowledgeService.initialize();

        const searchStudentsTool = tool(async ({ query }) => {
            console.log(`[Tool] Buscando aluno: ${query}`);
            const users = db.getUsers();
            const normalizedQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            const convertDays = (daysArray) => {
                if (!Array.isArray(daysArray)) return "N/A";
                // Dias no banco costumam ser strings ou números. Mapear:
                // 0=Domingo, 1=Segunda, ..., 6=Sábado (padrão `getDay()`)
                // OU 1=Segunda...? Vamos assumir padrão JS getDay() (0=Dom) ou ISO (1=Seg).
                // No código do initializeTodaysFaltas, usamos getDay() que é 0=Dom.
                // Log anterior: sample diasSemana = ['1']. Hoje é Quarta (3).
                // Se '1' fosse Segunda, e 3 é Quarta, faz sentido.
                
                const map = {
                    '0': 'Domingo',
                    '1': 'Segunda-feira',
                    '2': 'Terça-feira',
                    '3': 'Quarta-feira',
                    '4': 'Quinta-feira',
                    '5': 'Sexta-feira',
                    '6': 'Sábado',
                    '7': 'Domingo' // Safety
                };
                
                return daysArray.map(d => map[String(d)] || d).join(', ');
            };

            const results = users.filter(u =>
                u.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(normalizedQuery) ||
                (u.email && u.email.includes(query))
            ).map(u => ({
                nome: u.nome,
                matricula: u.matricula,
                email: u.email,
                turma: u.turma,
                turno: u.turno,
                cabine: u.cabine,
                dias: convertDays(u.diasSemana),
                faltas: u.faltas
            })).slice(0, 5);

            if (results.length === 0) return "Nenhum aluno encontrado com esse nome/termo.";
            return JSON.stringify(results);
        }, {
            name: "search_students",
            description: "Busca informações de alunos (emails, turmas, matrículas, horários). Recebe nome ou termo.",
            schema: z.object({
                query: z.string()
            })
        });

        // --- Tool 2: Attendance Check ---
        const checkAttendanceTool = tool(async ({ date_filter }) => {
            console.log(`[Tool] Verificando presença. Filtro: ${date_filter}`);
            const activities = db.getActivities();
            const today = new Date().toLocaleDateString('pt-BR');
            // Mocking logic similar to old service
            const presents = activities
                .filter(a => new Date(a.timestamp).toLocaleDateString('pt-BR') === today && a.type === 'Entrada')
                .map(a => a.userName); // Assuming userName is stored or joined. Actually db.getActivities has userName?
            // db.js usually joins or stores names. Let's assume it has userId, need to map.

            // Fix: Map IDs to Names
            const users = db.getUsers();
            const presentNames = [...new Set(activities
                .filter(a => new Date(a.timestamp).toLocaleDateString('pt-BR') === today && a.type === 'Entrada')
                .map(a => {
                    const u = users.find(u => u.id === a.userId);
                    return u ? u.nome : 'Desconhecido';
                })
            )];

            if (date_filter === 'absent') {
                console.log(`[Tool] Buscando Faltas para ${today}`);
                const faltas = db.getFaltas({ date: today });
                
                if (!faltas || faltas.length === 0) {
                    return `Não há registros de faltas para hoje (${today}).`;
                }

                // Agrupar visualmente para a IA
                const formatted = faltas.map(f => `${f.userName} (Turno: ${f.userTurno})`).join(', ');
                return `Total de ${faltas.length} faltas hoje (${today}): ${formatted}`;
            }

            return `Alunos presentes hoje (${today}): ${presentNames.length > 0 ? presentNames.join(', ') : 'Ninguém entrou ainda.'}`;
        }, {
            name: "check_attendance",
            description: "Verifica presença dos alunos HOJE.",
            schema: z.object({
                date_filter: z.enum(['today', 'absent'])
            })
        });

        // --- Tool 3: Assisted/Patients Search (Excel) ---
        const searchAssistedTool = tool(async ({ query }) => {
            if (!query) return "Erro: Query vazia.";
            console.log(`[Tool] Buscando assistido/vínculo: ${query}`);
            const normalizedQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            // Search in assistedData logic
            if (!this.assistedData) {
                this.loadAssistedList(); // Tenta recarregar se estiver vazio
                if (!this.assistedData || this.assistedData.length === 0) return "Lista de assistidos indisponível no momento.";
            }

            const matches = this.assistedData.filter(d =>
                (d.assistedName && d.assistedName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(normalizedQuery)) ||
                (d.studentName && d.studentName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(normalizedQuery))
            ).slice(0, 10);

            if (matches.length === 0) return "Nenhum vínculo encontrado.";
            return JSON.stringify(matches);
        }, {
            name: "search_assisted_relationship",
            description: "Busca na planilha de Assistidos/Pacientes. Use para perguntas como 'quem atende fulano' ou 'qual paciente de sicrano'. Retorna par { Aluno, Assistido }.",
            schema: z.object({
                query: z.string()
            })
        });

        // --- Tool 4: Knowledge Base (RAG) ---
        const ragSearchTool = tool(async ({ query }) => {
            console.log(`[Tool] RAG Search: ${query}`);
            const results = await KnowledgeService.search(query, 5);
            if (!results || results.length === 0) return "Nenhum documento relevante encontrado.";

            // Format for LLM
            return results.map(r => `[Fonte: ${r.source}]\n${r.text}`).join('\n---\n');
        }, {
            name: "search_knowledge_base",
            description: "Busca documentos do NPJ (Regras, Prazos, Coordenadores, Horários).",
            schema: z.object({
                query: z.string()
            })
        });

        // --- Tool 5: Time Utility ---
        const timeTool = tool(async () => {
            return new Date().toLocaleString('pt-BR');
        }, {
            name: "get_current_time",
            description: "Retorna a data e hora atual do sistema.",
            schema: z.object({})
        });

        this.tools = [searchStudentsTool, checkAttendanceTool, searchAssistedTool, ragSearchTool, timeTool];

        // Map for easy execution
        this.toolsMap = {
            'search_students': searchStudentsTool,
            'check_attendance': checkAttendanceTool,
            'search_assisted_relationship': searchAssistedTool,
            'search_knowledge_base': ragSearchTool,
            'get_current_time': timeTool
        };
    }

    loadAssistedList() {
        try {
            // Caminho relativo à estrutura organizada: ../../../data/LISTA DE ASSISTIDOS.xlsx
            const filePath = path.join(__dirname, '../../../data/LISTA DE ASSISTIDOS.xlsx');
            
            if (!fs.existsSync(filePath)) {
                console.warn(`[Veritas AI] Aviso: Lista de assistidos não encontrada em ${filePath}`);
                this.assistedData = [];
                return;
            }
            const workbook = XLSX.readFile(filePath);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            // Simple Parsing Strategy (Same as before but simplified)
            this.assistedData = [];
            // Assuming simplified parsing for brevity - reuse robust logic if needed
            // For now, let's grab cols 2 (Patient) and 3 (Student) approx
            for (let i = 1; i < data.length; i++) {
                const row = data[i];
                if (row && row.length > 3) {
                    const p = row[2] ? String(row[2]).trim() : "";
                    const s = row[3] ? String(row[3]).trim() : "";
                    if (p && s) this.assistedData.push({ assistedName: p, studentName: s });
                }
            }
        } catch (e) {
            console.error("Erro loading Excel:", e);
            this.assistedData = [];
        }
    }

    async processQuery(userQuery) {
        if (!this.model) await this.initialize();
        if (!this.modelWithTools) return "Erro Crítico: O módulo de IA não foi inicializado corretamente (verifique a API KEY).";

        // Add user message via simple history management (resetting for now per robust request usually implies some memory, 
        // but let's keep it per-request context to avoid confusion unless ID provided)
        // We will just use a fresh messages array + system prompt for every request for simplicity/stability first.

        const systemPrompt = `Você é o Veritas AI, a inteligência do Núcleo de Prática Jurídica (NPJ).
        Responda sempre em Português do Brasil.
        
        DIRETRIZES:
        1. Para 'oi', 'olá', 'tudo bem' ou conversa fiada: responda diretamente SEM usar ferramentas.
        2. Para dados de alunos/chamada/assistidos: USE as ferramentas apropriadas.
        3. Para dúvidas sobre regras/documentos/prazos: USE a ferramenta de busca (RAG).
        
        ESTILO DE RESPOSTA (IMPORTANTE):
        - Use **Markdown** COMPACTO. Evite pular linhas desnecessárias.
        - **NÃO use tabelas**.
        - Para listas de documentos, use OBRIGATORIAMENTE este formato em UMA ÚNICA LINHA por item:
          * **Nome do Documento**: Descrição completa aqui.
        - NÃO quebre a descrição para a linha de baixo. Mantenha item e descrição na mesma linha.
        - Use títulos (###) apenas para grandes seções.
        - Mantenha tom profissional e direto.
        
        Não invente informações. Se a ferramenta retornar vazio, diga que não encontrou.`;

        const messages = [
            new SystemMessage(systemPrompt),
            new HumanMessage(userQuery)
        ];

        try {
            // First LLM Call: Decide Tool
            const aiMsg = await this.modelWithTools.invoke(messages);
            // console.log("[DEBUG AI MSG]", JSON.stringify(aiMsg, null, 2));
            messages.push(aiMsg);

            // Execute Tools if requested
            if (aiMsg.tool_calls && aiMsg.tool_calls.length > 0) {
                for (const toolCall of aiMsg.tool_calls) {
                    const selectedTool = this.toolsMap[toolCall.name];
                    if (!selectedTool) {
                        console.error("Tool not found:", toolCall.name);
                        continue;
                    }

                    let toolOutput = "Erro na execução da ferramenta.";
                    try {
                        const rawOutput = await selectedTool.invoke(toolCall.args);
                        toolOutput = typeof rawOutput === 'string' ? rawOutput : JSON.stringify(rawOutput);

                        // Safety Truncate
                        if (toolOutput.length > 5000) toolOutput = toolOutput.substring(0, 5000) + "... [Truncated]";
                    } catch (err) {
                        console.error(`Error tool ${toolCall.name}:`, err);
                        toolOutput = `Erro: ${err.message}`;
                    }

                    messages.push(new ToolMessage({
                        tool_call_id: toolCall.id,
                        content: toolOutput
                    }));
                }

                // Final Answer generation
                try {
                    const finalResponse = await this.modelWithTools.invoke(messages);
                    return finalResponse.content;
                } catch (finalErr) {
                    console.error("[Veritas Agent] Failed to generate final answer:", finalErr);
                    // FALLBACK: Return the tool outputs directly
                    const toolOutputs = messages
                        .filter(m => m instanceof ToolMessage)
                        .map(m => m.content)
                        .join('\n\n');

                    return `(Nota: Ocorreu um erro na geração da resposta final pela IA, mas aqui estão os dados encontrados):\n\n${toolOutputs}`;
                }
            }

            return aiMsg.content; // Direct response if no tool needed
        } catch (error) {
            console.error("[Veritas Agent Error]", error);
            // Even more robust fallback
            return "Desculpe, tive um erro técnico crítico ao processar sua solicitação.";
        }
    }
}

module.exports = new AIService();
