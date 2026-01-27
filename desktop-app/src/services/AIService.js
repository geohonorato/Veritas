const path = require('path');
const fs = require('fs');
const db = require('../database');
const XLSX = require('xlsx');
const KnowledgeService = require('./KnowledgeService');

class AIService {
    constructor() {
        this.assistedData = [];
        this.lastContext = { entity: null, intent: null, timestamp: 0 }; // Memória de curto prazo
    }

    async initialize() {
        console.log('[AI] Inicializando Serviço de IA (Groq Only)...');
        this.loadAssistedList();
    }

    loadAssistedList() {
        try {
            const filePath = path.join('e:\\Códigos\\PONTO', 'LISTA DE ASSISTIDOS.xlsx');

            if (!fs.existsSync(filePath)) {
                console.warn(`Arquivo LISTA DE ASSISTIDOS.xlsx não encontrado em: ${filePath}`);
                return;
            }

            const workbook = XLSX.readFile(filePath);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            if (!data || data.length === 0) return;

            let headerRowIndex = -1;
            let colStudent = -1;
            let colPatient = -1;

            for (let i = 0; i < Math.min(data.length, 20); i++) {
                const row = data[i].map(c => String(c).toUpperCase());
                const studentIdx = row.findIndex(c => c.includes('ALUNO') || c.includes('ESTAGI'));
                const patientIdx = row.findIndex(c => c.includes('ASSISTIDO') || c.includes('PACIENTE') || c.includes('NOME'));

                if (studentIdx !== -1 && patientIdx !== -1) {
                    headerRowIndex = i;
                    colStudent = studentIdx;
                    colPatient = patientIdx;
                    break;
                }
            }

            if (headerRowIndex === -1) {
                colPatient = 2; // Index 2
                colStudent = 3; // Index 3
                headerRowIndex = 0;
            }

            this.assistedData = [];
            for (let i = headerRowIndex + 1; i < data.length; i++) {
                const row = data[i];
                if (!row || row.length <= Math.max(colStudent, colPatient)) continue;

                let studentName = String(row[colStudent] || '').trim();
                const assistedName = String(row[colPatient] || '').trim();

                // Se não tiver aluno, define como não vinculado (mas carrega o assistido)
                if (!studentName || studentName.toUpperCase() === 'NULL') {
                    studentName = 'SEM ALUNO VINCULADO';
                }

                if (assistedName && assistedName.toUpperCase() !== 'NULL') {
                    this.assistedData.push({ studentName, assistedName });
                }
            }
            console.log(`Carregados ${this.assistedData.length} registros de assistidos do Excel.`);

        } catch (error) {
            console.error('Erro ao ler LISTA DE ASSISTIDOS.xlsx:', error);
        }
    }

    normalizeText(text) {
        if (!text) return '';
        return text.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    async processQuery(query) {
        if (this.normalizeText(query) === 'status sistema') {
            return this.getSystemStatus();
        }

        // 1. Tentativa: Groq AI (Cloud) - Única fonte de inteligência real
        try {
            // Chave Hardcoded conforme solicitado
            const GROQ_API_KEY = process.env.GROQ_API_KEY;

            if (GROQ_API_KEY) {
                const groqResult = await this.queryGroq(query, GROQ_API_KEY);
                if (groqResult) {
                    console.log('☁️ [Groq AI] Sucesso:', groqResult);
                    const response = await this.executeIntent(groqResult, query);
                    console.log('🤖 [RESPOSTA]:', response);
                    return response;
                }
            }
        } catch (e) {
            console.warn('⚠️ [Groq AI] Falha ou indisponível.', e.message);
            return "⚠️ Erro ao conectar com a IA (Groq). Verifique sua internet ou a chave API.";
        }

        // Se chegar aqui (sem key ou erro tratado), cai no fallback? 
        // A pedido do usuário, removemos "tudo de python". 
        // O fallback manual (regex simples) pode ser útil se a API falhar? 
        // O usuário disse "ficaremos SÓ com o groq". 
        // Vou manter o fallbackManualSearch apenas como "último recurso" de busca por nome exato,
        // mas a lógica "híbrida" complexa morre aqui.

        return this.fallbackManualSearch(query);
    }

    async queryGroq(query, apiKey) {
        const systemPrompt = `
        Você é o cérebro do sistema 'Veritas'. Sua função é classificar a intenção do usuário e extrair entidades.
        Retorne APENAS um JSON válido. Sem markdown.
        
        Intenções Possíveis:
        - student.info (Quem é X, Dados de X)
        - student.absences (Faltas de X)
        - student.patients (Quem o aluno X atende/cuida. Inclui: "Quantos assistidos X tem?", "Lista de pacientes de X")
        - student.schedule (Qual o dia do aluno X, Que dia X vem, Qual o horário de X, Quando X tem estágio)
        - patient.responsible (Quem atende o assistido Y, Quem é responsável por Y)
        - attendance.present_today (Quem está presente, Quem veio. NÃO CONFUNDIR com dia de estágio)
        - attendance.absent_today (Quem faltou hoje)
        - attendance.summary (Resumo do dia, Relatório)
        - student.least_patients (Qual aluno DE HOJE/PRESENTE tem menos assistidos/pacientes, Quem está mais livre)
        - student.best_attendance (Quem são os alunos com menos faltas, Quem nunca faltou, Alunos assíduos)
        - system.list_students (Liste todos os alunos, Quem são os alunos cadastrados)
        - system.total_stats (Resumo do sistema, Quantos alunos e assistidos temos, Estatísticas gerais)
        - knowledge.search (Perguntas gerais sobre o NPJ, regras, documentos, procedimentos, como funciona)
        - greetings.hello (Oi, Olá)

        Entidades:
        - entity: Nome da pessoa (Aluno ou Assistido). Se não tiver nome, null.
        
        Exemplos:
        "Quem atende o Carlos?" -> {"intent": "patient.responsible", "entities": [{"option": "Carlos"}]}
        "Quantos assistidos a Debora tem?" -> {"intent": "student.patients", "entities": [{"option": "Debora"}]}
        "Qual o dia da Bianca Marcal?" -> {"intent": "student.schedule", "entities": [{"option": "Bianca Marcal"}]}
        "Qual o horário do João?" -> {"intent": "student.schedule", "entities": [{"option": "João"}]}
        "Quem faltou hoje?" -> {"intent": "attendance.absent_today", "entities": []}
        "Quem é o aluno responsável pela Dona Maria?" -> {"intent": "patient.responsible", "entities": [{"option": "Dona Maria"}]}
        `;

        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    // model: "llama3-70b-8192",
                    model: "openai/gpt-oss-20b",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: query }
                    ],
                    temperature: 1
                })
            });

            if (!response.ok) throw new Error(`Groq API Error: ${response.statusText}`);

            const data = await response.json();
            const content = data.choices[0]?.message?.content;

            // Tenta limpar markdown se o modelo mandar ```json ... ```
            const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(jsonStr);

            return {
                intent: result.intent,
                entities: result.entities || [],
                score: 1.0 // Groq é confiante
            };

        } catch (error) {
            console.error('[Groq Error]', error);
            return null; // Fallback
        }
    }

    fallbackManualSearch(query) {
        console.log('⚠️ [AI] Usando busca manual (Fallback) para:', query);
        const normalizedQuery = this.normalizeText(query);

        // Função simples para Distância de Levenshtein (Token a Token)
        const getLevenshteinDistance = (a, b) => {
            const matrix = [];
            for (let i = 0; i <= b.length; i++) matrix[i] = [i];
            for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

            for (let i = 1; i <= b.length; i++) {
                for (let j = 1; j <= a.length; j++) {
                    if (b.charAt(i - 1) == a.charAt(j - 1)) {
                        matrix[i][j] = matrix[i - 1][j - 1];
                    } else {
                        matrix[i][j] = Math.min(
                            matrix[i - 1][j - 1] + 1, // substitution
                            Math.min(
                                matrix[i][j - 1] + 1, // insertion
                                matrix[i - 1][j] + 1  // deletion
                            )
                        );
                    }
                }
            }
            return matrix[b.length][a.length];
        };

        const checkMatch = (name, query) => {
            const normName = this.normalizeText(name);

            // Lista de Stop Words (Palavras comuns a serem ignoradas na busca de nome)
            const stopWords = [
                'quem', 'qual', 'quais', 'que', 'onde', 'como', 'quantos', 'quantas',
                'atende', 'atendimento', 'responsavel', 'paciente', 'aluno', 'assistido', 'assistidos',
                'o', 'a', 'os', 'as', 'do', 'da', 'dos', 'das', 'de', 'em', 'para', 'na', 'no', 'é', 'tem', 'resumo'
            ];

            // 1. Busca exata ou parcial direta (Rápida) - Funciona bem se o usuário digitou só o nome
            // Mas falha se digitou "quem atende jair", pois "jair" não tem "quem atende" dentro.
            // Então removemos isso ou deixamos apenas para query curta?
            // Vamos ignorar essa verificação direta se a query tiver stop words.

            // 2. Busca Fuzzy por Tokens (A mais robusta)
            const queryTokens = this.normalizeText(query).split(' ')
                .filter(t => t.length > 1 && !stopWords.includes(t));

            if (queryTokens.length === 0) return false;

            const nameTokens = normName.split(' ');

            // Para cada token RELEVANTE da query, deve existir um token similar no nome
            const allTokensFound = queryTokens.every(qToken => {
                return nameTokens.some(nToken => {
                    if (nToken.includes(qToken)) return true; // match parcial
                    const maxEdits = qToken.length > 4 ? 2 : 1;
                    const dist = getLevenshteinDistance(qToken, nToken);
                    return dist <= maxEdits;
                });
            });
            return allTokensFound;
        };

        const users = db.getUsers();
        const foundUsers = users.filter(u => checkMatch(u.nome, normalizedQuery));

        if (foundUsers.length > 1) {
            const names = foundUsers.slice(0, 5).map(u => `• ${u.nome}`).join('\n');
            return `Encontrei **${foundUsers.length}** alunos com esse nome. De qual deles você está falando?\n\n${names}`;
        }

        if (foundUsers.length === 1) {
            const u = foundUsers[0];
            return `Encontrei **${u.nome}** na base de dados como **ALUNO**.\n\n${this.formatStudentInfo(u)}`;
        }

        const foundAssisted = this.assistedData.filter(r => checkMatch(r.assistedName, normalizedQuery));

        if (foundAssisted.length > 1) {
            const names = foundAssisted.slice(0, 5).map(p => `• ${p.assistedName}`).join('\n');
            return `Encontrei **${foundAssisted.length}** assistidos com esse nome. De qual deles você está falando?\n\n${names}`;
        }

        if (foundAssisted.length === 1) {
            const p = foundAssisted[0];
            const resp = this.getAssistedResponsible(p.assistedName);
            return `Encontrei **${p.assistedName}** na base como **ASSISTIDO**.\n\n${resp}`;
        }

        // 4. Busca por ALUNO na lista do Excel (caso não esteja no SQLite)
        // Isso resolve "Quantos assistidos a Debora tem?" se ela só existir no Excel
        // assistedData = { studentName, assistedName }
        const distinctStudents = [...new Set(this.assistedData.map(r => r.studentName))];
        const foundStudentsExcel = distinctStudents.filter(name => checkMatch(name, normalizedQuery));

        if (foundStudentsExcel.length > 0) {
            const studentName = foundStudentsExcel[0]; // Pega o primeiro match melhor
            const patients = this.getStudentPatients(studentName);
            return `Encontrei **${studentName}** na lista de atendimentos.\n\n${patients}`;
        }

        return "Desculpe, não entendi sua pergunta. Tente digitar o nome completo.";

        return "Desculpe, não entendi sua pergunta. Tente digitar o nome completo.";
    }

    queryPython(query) {
        return new Promise((resolve, reject) => {
            if (!this.pythonProcess) return reject("Processo Python não iniciado");

            this.pendingRequests.push({ resolve, reject });

            const payload = JSON.stringify({ query: query });
            this.pythonProcess.stdin.write(payload + '\n');
        });
    }

    async executeIntent(groqResult, originalQuery) {
        let { intent, entities, score } = groqResult;

        let entityOption = null;
        if (entities && entities.length > 0) {
            entityOption = entities[0].option;
        }

        // --- CONTEXT MANAGER (Memória) ---
        // Alterado: Baseado em "Quantidade de Tokens" (Tamanho da frase)
        // Se a frase for curta (<= 5 palavras) e sem entidade nova, tenta usar o contexto anterior.
        // Isso permite fluxo contínuo sem depender de tempo.

        const now = Date.now();
        const words = originalQuery.trim().split(/\s+/);
        const tokenCount = words.length;
        const isShortQuery = tokenCount <= 5;
        const hasPronoun = /\b(ele|ela|dele|dela|do|da|o|a)\b/i.test(originalQuery);

        // Regra: Sem entidade nova identificada + (Frase Curta OU Tem Pronome)
        if (!entityOption && this.lastContext.entity && (isShortQuery || hasPronoun)) {
            console.log(`[AI Context] Reusando entidade anterior: "${this.lastContext.entity}" (Contexto: ${this.lastContext.intent})`);
            entityOption = this.lastContext.entity;
        }

        if (entityOption) {
            // Atualiza o contexto
            this.lastContext = {
                entity: entityOption,
                intent: intent,
                timestamp: now
            };
        }

        // --- SMART INTENT RE-ROUTING (Heurística) ---
        // Se a IA achar que é Student, mas o nome só existe na lista de Pacientes -> inverte para Patient
        // Se a IA achar que é Patient, mas o nome só existe na lista de Alunos -> inverte para Student

        if (entityOption) {
            const normEntity = this.normalizeText(entityOption);
            const isStudent = db.getUsers().some(u => this.normalizeText(u.nome).includes(normEntity));
            const isPatient = this.assistedData.some(r => this.normalizeText(r.assistedName).includes(normEntity));

            // Caso 1: IA diz que é Aluno (student.patients), mas é Assistido
            if (intent === 'student.patients' || intent === 'student.info') {
                if (!isStudent && isPatient) {
                    console.log(`[AI Logic] Invertendo intenção ${intent} -> patient.responsible (Motivo: "${entityOption}" é assistido)`);
                    intent = 'patient.responsible';
                }
            }

            // Caso 2: IA diz que é Assistido (patient.responsible), mas é Aluno (quem ele atende)
            if (intent === 'patient.responsible') {
                if (!isPatient && isStudent) {
                    console.log(`[AI Logic] Invertendo intenção ${intent} -> student.patients (Motivo: "${entityOption}" é aluno)`);
                    intent = 'student.patients';
                }
            }
        }

        if (!entityOption) {
            const normalizedQuery = this.normalizeText(originalQuery);

            if (intent.startsWith('patient')) {
                const found = this.assistedData.find(r => normalizedQuery.includes(this.normalizeText(r.assistedName)));
                if (found) entityOption = found.assistedName;
            } else {
                const users = db.getUsers();
                const found = users.find(u => normalizedQuery.includes(this.normalizeText(u.nome)));
                if (found) entityOption = found.nome;
            }
        }

        if (!entityOption && intent !== 'greetings.hello' && intent !== 'attendance.absent_today' && intent !== 'attendance.summary' && intent !== 'attendance.present_today' && intent !== 'knowledge.search') {
            return await this.handleKnowledgeSearch(originalQuery);
        }

        let response = '';

        switch (intent) {
            case 'greetings.hello':
                response = "Olá! Sou a IA Veritas. Posso ajudar com alunos, assistidos e faltas.";
                break;
            case 'student.info':
                response = this.getStudentInfo(entityOption);
                break;
            case 'student.absences':
                response = this.getStudentAbsences(entityOption);
                break;
            case 'patient.responsible':
                response = this.getAssistedResponsible(entityOption);
                break;
            case 'student.patients':
                response = this.getStudentPatients(entityOption);
                break;
            case 'attendance.absent_today':
                response = this.getAbsentsToday();
                break;
            case 'attendance.present_today':
                response = this.getPresentsToday();
                break;
            case 'attendance.summary':
                response = this.getDailySummary();
                break;
            case 'student.least_patients':
                response = this.getStudentWithFewestPatients();
                break;
            case 'student.best_attendance':
                response = this.getBestAttendance();
                break;
            case 'system.list_students':
                response = this.getListStudents();
                break;
            case 'system.total_stats':
                response = this.getSystemStats();
                break;
            case 'student.schedule':
                response = await this.getStudentSchedule(entityOption);
                break;
            case 'knowledge.search':
                return await this.handleKnowledgeSearch(originalQuery);
            default:
                response = "Entendi a intenção, mas ainda não sei responder isso especificamente.";
        }

        // FALLBACK RAG: Se a resposta estruturada falhou (não achou), tentamos os documentos.
        // Verificamos se a resposta contém indicadores de falha comuns
        const failureIndicators = [
            "não encontrei o aluno",
            "não encontrei o assistido",
            "não possui assistidos vinculados",
            "não identifiquei o nome",
            "ainda não sei responder"
        ];

        if (response && failureIndicators.some(ind => response.toLowerCase().includes(ind))) {
            console.log(`[AI Fallback] Resposta estruturada insuficiente ("${response}"). Tentando Knowledge Base...`);
            const ragResponse = await this.handleKnowledgeSearch(originalQuery);

            // Se o RAG também não souber, mantemos a resposta original (geralmente mais específica sobre o erro) ou retornamos o RAG se ele for melhor?
            // O RAG retorna "Não encontrei informações sobre isso..." se falhar.
            if (!ragResponse.includes("Não encontrei informações sobre isso")) {
                return ragResponse; // RAG achou algo util!
            }
        }

        return response;
    }

    getSystemStatus() {
        return `🤖 **Status do Sistema (Cloud Groq)**:
        - Modo: Online (Llama 3)
        - Assistidos Carregados: ${this.assistedData.length}`;
    }

    getAssistedResponsible(assistedName) {
        const normSearch = this.normalizeText(assistedName);

        // Estratégia 1: Busca Exata ou Parcial Simples
        let records = this.assistedData.filter(r => {
            const normRecord = this.normalizeText(r.assistedName);
            return normRecord.includes(normSearch) || (normSearch.length > 4 && normSearch.includes(normRecord));
        });

        // Estratégia 2: Busca por Palavras (Token Match)
        // Se não achou nada, tenta ver se as palavras importantes batem (ex: "Isis" e "Carvalho")
        if (records.length === 0) {
            const searchTokens = normSearch.split(' ').filter(t => t.length > 2 && !['dos', 'das', 'de'].includes(t));
            if (searchTokens.length > 0) {
                records = this.assistedData.filter(r => {
                    const normRecord = this.normalizeText(r.assistedName);
                    // Conta quantos tokens do termo de busca estão no nome do registro
                    const matches = searchTokens.filter(token => normRecord.includes(token));
                    // Considera match se acertar todas as palavras relevantes ou pelo menos 2 (para nomes longos)
                    return matches.length === searchTokens.length || (searchTokens.length > 2 && matches.length >= 2);

                });
            }
        }

        if (records.length === 0) return `Não encontrei o assistido "${assistedName}" na lista. Tente usar menos sobrenomes.`;

        const uniqueStudents = [...new Set(records.map(r => r.studentName))];
        const studentsStr = uniqueStudents.join(', ');
        return `O assistido **${records[0].assistedName}** é atendido por: **${studentsStr}**.`;
    }

    getStudentPatients(studentName) {
        const normSearch = this.normalizeText(studentName);
        const records = this.assistedData.filter(r => this.normalizeText(r.studentName).includes(normSearch));

        if (records.length === 0) return `O aluno **${studentName}** não possui assistidos vinculados na lista.`;
        const displayList = records.slice(0, 10);
        const remaining = records.length - displayList.length;
        let response = `O aluno **${records[0].studentName}** é responsável por:\n- ` + displayList.map(r => r.assistedName).join('\n- ');
        if (remaining > 0) response += `\n... e mais ${remaining}.`;
        return response;
    }

    getStudentInfo(studentName) {
        const users = db.getUsers();
        const user = users.find(u => this.normalizeText(u.nome).includes(this.normalizeText(studentName)));
        if (!user) return `Não encontrei o aluno "${studentName}".`;
        return `
      📋 **Dados do Aluno**: ${user.nome}
      - **Matrícula**: ${user.matricula}
      - **Turma**: ${user.turma || 'N/A'}
      - **Turno**: ${user.turno || 'N/A'}
      - **Cabine**: ${user.cabine || 'N/A'}
      - **Responsável/Email**: ${user.email || 'N/A'}
    `;
    }

    getStudentAbsences(studentName) {
        const users = db.getUsers();
        const user = users.find(u => this.normalizeText(u.nome).includes(this.normalizeText(studentName)));
        if (!user) return `Não encontrei o aluno "${studentName}".`;
        const activities = db.getActivities();
        const userActivities = activities.filter(a => a.userId === user.id && a.type === 'Entrada');
        return `O aluno **${user.nome}** possui ${userActivities.length} presenças registradas.`;
    }

    async getStudentSchedule(studentName) {
        const users = db.getUsers();
        const user = users.find(u => this.normalizeText(u.nome).includes(this.normalizeText(studentName)));

        if (!user) {
            console.log(`[Schedule] Aluno "${studentName}" não encontrado no SQL. Buscando no RAG...`);
            return await this.handleKnowledgeSearch(`Quando é o horário ou estágio de ${studentName}?`, "source LIKE '%horario%'", 15);
        }

        if (!user.diasSemana) {
            console.log(`[Schedule] Aluno "${studentName}" sem dias no SQL. Buscando no RAG...`);
            return await this.handleKnowledgeSearch(`Quando é o horário ou estágio de ${studentName}?`, "source LIKE '%horario%'", 15);
        }

        try {
            const diasIds = JSON.parse(user.diasSemana);
            if (!Array.isArray(diasIds) || diasIds.length === 0) {
                return await this.handleKnowledgeSearch(`Quando é o horário ou estágio de ${studentName}?`, "source LIKE '%horario%'", 15);
            }

            const mapDias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
            const diasStr = diasIds.map(id => mapDias[id]).join(', ');

            return `📅 **Horário de ${user.nome}**:\n- **Dias**: ${diasStr}\n- **Turno**: ${user.turno || 'Não informado'}`;
        } catch (e) {
            return await this.handleKnowledgeSearch(`Quando é o horário ou estágio de ${studentName}?`, "source LIKE '%horario%'", 15);
        }
    }

    getAbsentsToday() {
        const users = db.getUsers();
        const activities = db.getActivities();
        const today = new Date().toLocaleDateString('pt-BR');
        const dayOfWeek = new Date().getDay();
        const presentIds = new Set(activities
            .filter(a => new Date(a.timestamp).toLocaleDateString('pt-BR') === today && a.type === 'Entrada')
            .map(a => a.userId)
        );
        const absents = users.filter(u => {
            if (!u.diasSemana) return false;
            try {
                const dias = JSON.parse(u.diasSemana);
                if (!Array.isArray(dias)) return false;
                return dias.includes(dayOfWeek) && !presentIds.has(u.id);
            } catch (e) {
                return false;
            }
        });
        if (absents.length === 0) return "Todos os alunos esperados para hoje estão presentes! 🎉";
        const names = absents.map(u => u.nome).slice(0, 15).join(', ');
        const extra = absents.length > 15 ? ` e mais ${absents.length - 15}` : '';
        return `📅 **Faltaram hoje (${absents.length})**: ${names}${extra}.`;
    }

    getPresentsToday() {
        const activities = db.getActivities();
        const today = new Date().toLocaleDateString('pt-BR');
        const presentIds = new Set(activities
            .filter(a => new Date(a.timestamp).toLocaleDateString('pt-BR') === today && a.type === 'Entrada')
            .map(a => a.userId)
        );
        return `Hoje registramos **${presentIds.size}** alunos presentes.`;
    }

    getDailySummary() {
        const presents = this.getPresentsToday();
        const absents = this.getAbsentsToday();
        return `${presents}\n\n${absents}`;
    }

    formatStudentInfo(user) {
        return `
      📋 **Dados do Aluno**: ${user.nome}
      - **Matrícula**: ${user.matricula}
      - **Turma**: ${user.turma || 'N/A'}
      - **Turno**: ${user.turno || 'N/A'}
      - **Cabine**: ${user.cabine || 'N/A'}
      - **Responsável/Email**: ${user.email || 'N/A'}
    `;
    }

    getStudentWithFewestPatients() {
        // 1. Identificar alunos presentes hoje
        const activities = db.getActivities();
        const now = new Date();
        const todayStr = now.toLocaleDateString('pt-BR');

        // Pega IDs de quem deu entrada HOJE
        const presentUserIds = new Set();
        activities.forEach(a => {
            try {
                const d = new Date(a.timestamp);
                if (d.toLocaleDateString('pt-BR') === todayStr && a.type === 'Entrada') {
                    presentUserIds.add(a.userId);
                }
            } catch (e) { }
        });

        if (presentUserIds.size === 0) {
            return "Nenhum aluno registrou presença hoje ainda.";
        }

        // 2. Determinar turno atual (Manhã < 12h <= Tarde)
        const currentHour = now.getHours();
        const isMorning = currentHour < 12;
        const currentTurnLabel = isMorning ? 'Manhã' : 'Tarde';

        // 3. Filtrar alunos pelo turno correto
        const users = db.getUsers();
        let presentStudents = users.filter(u => presentUserIds.has(u.id));

        const filteredStudents = presentStudents.filter(u => {
            const t = this.normalizeText(u.turno || '');
            if (isMorning) return t.includes('manh') || t.includes('matu') || t === ''; // Aceita vazio por padrão? Melhor não.
            else return t.includes('tard') || t.includes('vesp');
        });

        // Se o filtro de turno remover todos (ex: teste em horários loucos), avisa, mas fallback para todos presentes?
        // O usuário pediu especificamente para separar.
        if (filteredStudents.length > 0) {
            presentStudents = filteredStudents;
        } else {
            return `Há alunos presentes, mas nenhum cadastrado no turno da **${currentTurnLabel}**. Verifique os cadastros.`;
        }

        // 4. Contar assistidos para cada presente
        const stats = presentStudents.map(student => {
            const normName = this.normalizeText(student.nome);
            // Conta quantas vezes esse aluno aparece como responsável na lista de assistidos
            const count = this.assistedData.filter(r => this.normalizeText(r.studentName).includes(normName)).length;

            return {
                name: student.nome,
                count: count
            };
        });

        // 5. Ordenar por count (crescente)
        stats.sort((a, b) => a.count - b.count);

        if (stats.length === 0) return "Erro ao calcular estatísticas.";

        // 6. Formatar resposta
        const winner = stats[0];
        const others = stats.slice(1, 4).map(s => `${s.name} (${s.count})`).join(', ');

        return `Considerando o turno da **${currentTurnLabel}**:\n` +
            `O aluno presente com menos assistidos é **${winner.name}** com **${winner.count}** assistido(s).\n` +
            (others ? `Outros com poucos: ${others}.` : '');
    }

    getBestAttendance() {
        const users = db.getUsers();
        // Ordena por faltas (crescente)
        const sorted = [...users].sort((a, b) => (a.faltas || 0) - (b.faltas || 0));
        const top5 = sorted.slice(0, 5);

        if (top5.length === 0) return "Não há alunos cadastrados.";

        const list = top5.map(u => `- **${u.nome}** (${u.faltas || 0} faltas)`).join('\n');
        return `🏆 **Alunos mais assíduos (Top 5):**\n${list}`;
    }

    getListStudents() {
        const users = db.getUsers();
        const total = users.length;
        if (total === 0) return "Não há alunos cadastrados.";

        if (total > 20) {
            return `Temos **${total}** alunos cadastrados. É muita gente para listar! Tente perguntar sobre um específico.`;
        }

        const list = users.map(u => `- ${u.nome}`).join('\n');
        return `📋 **Lista de Alunos (${total}):**\n${list}`;
    }

    getSystemStats() {
        const users = db.getUsers();
        const registros = db.getRegistros();
        const assistedCount = this.assistedData.length;

        // Pega data do último registro
        const lastRecord = registros.length > 0 ? registros[registros.length - 1].data : 'Nunca';

        return `📊 **Resumo do Sistema Veritas:**
- **Alunos Cadastrados:** ${users.length}
- **Assistidos Vinculados:** ${assistedCount}
- **Vínculos Ativos:** ${this.assistedData.length}
- **Último Ponto:** ${lastRecord}

Estou operando com modelo **Groq Cloud (Llama 3)**.`;
    }

    async handleKnowledgeSearch(query, filter = null, limit = 5) {
        try {
            const docs = await KnowledgeService.search(query, limit, filter);
            if (!docs || docs.length === 0) {
                // Se falhar com filtro, tenta sem filtro (fallback)
                if (filter) {
                    console.log("[RAG] Busca filtrada falhou. Tentando busca geral...");
                    return this.handleKnowledgeSearch(query, null, limit);
                }
                return "Não encontrei informações sobre isso nos documentos do NPJ.";
            }

            const context = docs.map(d => d.text).join('\n---\n');
            console.log(`[RAG] Encontrados ${docs.length} trechos relevantes.`);

            return this.queryGroqRAG(query, context);
        } catch (e) {
            console.error('[RAG Error]', e);
            return "Erro ao consultar a base de conhecimento.";
        }
    }

    async queryGroqRAG(query, context) {
        try {
            const GROQ_API_KEY = process.env.GROQ_API_KEY;
            const systemPrompt = `
            Você é o Oráculo do NPJ (Núcleo de Prática Jurídica).
            Use APENAS o contexto abaixo para responder à pergunta do usuário.
            Se a resposta não estiver no contexto, diga que não sabe.
            Seja direto e profissional.
            
            CONTEXTO:
            ${context}
            `;

            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    // model: "llama-3.3-70b-versatile",
                    model: "openai/gpt-oss-20b",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: query }
                    ],
                    temperature: 0.3 // Baixa temperatura para fidelidade
                })
            });

            if (!response.ok) throw new Error(`Groq API Error: ${response.statusText}`);

            const data = await response.json();
            return data.choices[0]?.message?.content || "Sem resposta.";

        } catch (error) {
            console.error('[Groq RAG Error]', error);
            return "Erro ao gerar resposta com IA.";
        }
    }
}

module.exports = new AIService();
