
# 🧪 Exemplos de Teste para IA Veritas

Use as perguntas abaixo para validar o funcionamento do sistema de Inteligência Artificial e RAG (Recuperação de Informação).

## 1. 📂 Conhecimento Geral (RAG - Documentos)
*Baseado nos arquivos na pasta `kp_source` (PDFs, TXT)*

- **Funcionamento:** "Qual o horário de funcionamento do NPJ?"
- **Coordenador:** "Quem é o coordenador atual?"
- **Triagem:** "Quais documentos o assistido precisa levar?"
- **Prazos:** "Qual o prazo para interpor recurso de apelação?" (Se houver documentos jurídicos)
- **Horário de Aula:** "Que horas começa a aula de segunda-feira de manhã?" (Teste do `horario_discente.pdf`)

## 2. 👥 Informações de Alunos (Banco de Dados SQL)
*Teste com nomes reais encontrados no banco:*

- **Dados Gerais:**
  - "Quem é Raissa Rendeiro?"
  - "Me fale sobre o Matheus Kallil."
  - "Qual a turma da Manuela Guimarães?"
- **Contato/Email:**
  - "Qual o email da Sara Saori?"
  - "Como entro em contato com o Raphael Campos?"

## 3. 📅 Horários e Presença (SQL + Lógica)
- **Faltas:** "Quantas faltas a Raissa tem?"
- **Presença Hoje:** "Quem está presente hoje?"
- **Faltosos:** "Quem faltou hoje?"
- **Horário Específico:** "Qual o dia de estágio da Manuela?" (Se os dias estiverem cadastrados)
- **Assiduidade:** "Quem são os alunos que mais vêm?" (Best Attendance)

## 4. 🤝 Relação Aluno x Assistido (Excel + IA)
*Baseado na planilha `LISTA DE ASSISTIDOS.xlsx` (Se houver vínculos)*

- **Buscar Responsável:** "Quem atende o assistido [Nome de um Assistido]?"
- **Listar Pacientes:** "Quais assistidos a Raissa atende?"
- **Contagem:** "Quantos pacientes o Matheus tem?"
- **Menos Sobrecarregado:** "Qual aluno presente hoje tem menos assistidos?" (Complexo: Requer alunos com check-in feito)

## 5. 🤖 Comandos do Sistema & Chat
- **Status:** "Status do sistema"
- **Resumo:** "Resumo do dia"
- **Saudação:** "Oi, tudo bem?"
- **Intenção Confusa:** "O aluno João veio?" (Testa busca fuzzy se João não existir exatamente)

---
**💡 Dica:** Se a IA não souber a resposta, ela deve consultar os documentos na pasta `kp_source`. Se mesmo assim não achar, ela informará que não encontrou a informação.
