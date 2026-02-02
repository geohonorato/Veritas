#!/usr/bin/env python3
"""
Veritas AI Agent - Powered by Agno Framework
Replaces LangChain-based AIService.js
"""
import sys
import os
import json
import sqlite3
from datetime import datetime

# Add portable libs if available
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
portable_lib_path = os.path.join(project_root, 'python_portable', 'Lib', 'site-packages')
if os.path.exists(portable_lib_path):
    sys.path.insert(0, portable_lib_path)

from agno.agent import Agent
from agno.models.groq import Groq
import warnings

# Suppress warnings from lancedb/pydantic
warnings.filterwarnings("ignore", category=DeprecationWarning)
warnings.filterwarnings("ignore", module="pydantic")

# Load environment from .env file
try:
    from dotenv import load_dotenv
    env_path = os.path.join(project_root, 'desktop-app', '.env')
    if os.path.exists(env_path):
        load_dotenv(env_path)
except ImportError:
    pass  # dotenv not available, assume env vars are set

# --- Database Connection ---
def get_db_path():
    return os.path.join(project_root, 'desktop-app', 'data', 'veritas.sqlite')

def get_db_connection():
    return sqlite3.connect(get_db_path())

# --- Tool Functions ---
def search_students(query: str) -> str:
    """
    Busca informações de alunos por nome ou termo.
    
    Args:
        query: Nome ou termo para buscar alunos
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    normalized = query.lower()
    cursor.execute("""
        SELECT id, nome, matricula, turma, email, turno, cabine, diasSemana 
        FROM users 
        WHERE LOWER(nome) LIKE ? OR LOWER(email) LIKE ?
        ORDER BY nome LIMIT 5
    """, (f'%{normalized}%', f'%{normalized}%'))
    
    rows = cursor.fetchall()
    conn.close()
    
    if not rows:
        return "Nenhum aluno encontrado com esse nome/termo."
    
    day_map = {'0': 'Domingo', '1': 'Segunda', '2': 'Terça', '3': 'Quarta', 
               '4': 'Quinta', '5': 'Sexta', '6': 'Sábado'}
    
    results = []
    for row in rows:
        dias = []
        try:
            dias_raw = json.loads(row[7] or '[]')
            dias = [day_map.get(str(d), str(d)) for d in dias_raw]
        except: pass
        
        results.append({
            "nome": row[1],
            "matricula": row[2],
            "turma": row[3],
            "email": row[4],
            "turno": row[5],
            "cabine": row[6],
            "dias": ", ".join(dias)
        })
    
    return json.dumps(results, ensure_ascii=False)


def check_attendance(date_filter: str) -> str:
    """
    Verifica presença ou faltas dos alunos HOJE.
    
    Args:
        date_filter: 'today' para presentes ou 'absent' para faltantes
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    today = datetime.now().strftime('%d/%m/%Y')
    
    if date_filter == 'absent':
        cursor.execute("""
            SELECT f.userName, f.userTurno FROM faltas f
            WHERE f.date = ?
        """, (today,))
        rows = cursor.fetchall()
        conn.close()
        
        if not rows:
            return f"Não há registros de faltas para hoje ({today})."
        
        formatted = ", ".join([f"{r[0]} (Turno: {r[1]})" for r in rows])
        return f"Total de {len(rows)} faltas hoje ({today}): {formatted}"
    
    # Present students
    cursor.execute("""
        SELECT DISTINCT a.userName FROM activities a
        WHERE date(a.timestamp) = date('now', 'localtime') AND a.type = 'Entrada'
    """)
    rows = cursor.fetchall()
    conn.close()
    
    names = [r[0] for r in rows]
    if not names:
        return f"Nenhum aluno entrou ainda hoje ({today})."
    return f"Alunos presentes hoje ({today}): {', '.join(names)}"


def search_assisted_relationship(query: str) -> str:
    """
    Busca na planilha de Assistidos/Pacientes. Use para perguntas como 
    'quem atende fulano' ou 'qual paciente de sicrano'.
    
    Args:
        query: Nome do aluno ou assistido para buscar vínculo
    """
    try:
        import openpyxl
        excel_path = os.path.join(project_root, 'data', 'LISTA DE ASSISTIDOS.xlsx')
        
        if not os.path.exists(excel_path):
            return "Lista de assistidos indisponível no momento."
        
        wb = openpyxl.load_workbook(excel_path, read_only=True)
        ws = wb.active
        
        results = []
        normalized = query.lower()
        
        for row in ws.iter_rows(min_row=2, values_only=True):
            if len(row) < 4:
                continue
            patient = str(row[2] or '').strip()
            student = str(row[3] or '').strip()
            
            if normalized in patient.lower() or normalized in student.lower():
                results.append({"assistedName": patient, "studentName": student})
                if len(results) >= 10:
                    break
        
        wb.close()
        
        if not results:
            return "Nenhum vínculo encontrado."
        return json.dumps(results, ensure_ascii=False)
    except Exception as e:
        return f"Erro ao buscar assistidos: {str(e)}"


def search_knowledge_base(query: str) -> str:
    """
    ESSENCIAL PARA PERGUNTAS SOBRE REGRAS, DOCUMENTOS OU PROCEDIMENTOS.
    Busca trechos relevantes nos PDFs/Documentos do NPJ usando busca semântica.
    
    Args:
        query: A pergunta específica ou tópicos para buscar nos documentos
    """
    try:
        import lancedb
        from sentence_transformers import SentenceTransformer
        
        db_path = os.path.join(project_root, 'desktop-app', 'data', 'knowledge.lance')
        model_cache = os.path.join(project_root, 'desktop-app', 'data', 'models_cache')
        
        if not os.path.exists(db_path):
            return "Base de conhecimento não encontrada. Execute o treinamento primeiro."
        
        db = lancedb.connect(db_path)
        # Use table_names() for safety (list_tables returns object)
        if 'documents' not in db.table_names():
            return "Nenhum documento na base de conhecimento."
        
        # Load model
        model = SentenceTransformer('all-MiniLM-L6-v2', cache_folder=model_cache, local_files_only=True)
        table = db.open_table('documents')
        
        query_vector = model.encode(query)
        # Debug
        # sys.stderr.write(f"Querying DB with: {query}\n")
        results = table.search(query_vector).limit(5).to_list()
        
        sys.stderr.write(f"[DEBUG] Found {len(results)} matches for '{query}'\n")

        if not results:
            return "Nenhum documento encontrado sobre este tópico."
        
        formatted = []
        for r in results:
            source = os.path.basename(r.get('source', 'unknown'))
            # Calculate score manually if needed or just trust results
            text = r.get('text', '')[:1500]
            # Debug
            # sys.stderr.write(f"Match: {source} - {text[:100]}...\n")
            formatted.append(f"[Fonte: {source}]\n{text}")
        
        return "\n---\n".join(formatted)
    except Exception as e:
        return f"Erro ao buscar documentos: {str(e)}"


def get_current_time() -> str:
    """
    Retorna a data e hora atual do sistema.
    """
    return datetime.now().strftime('%d/%m/%Y %H:%M:%S')


# --- Agent Setup ---
SYSTEM_PROMPT = """Você é o Veritas AI, a inteligência do Núcleo de Prática Jurídica (NPJ).
Responda sempre em Português do Brasil.

DIRETRIZES:
1. Para 'oi', 'olá', 'tudo bem': responda diretamente.
2. Para dados de alunos/chamada/assistidos: USE as ferramentas search_students, check_attendance, search_assisted_relationship.
3. Para dúvidas sobre REGRAS, DOCUMENTOS, PRAZOS, FUNCIONAMENTO, COORDENAÇÃO ou ESTRUTURA do NPJ: **VOCÊ DEVE USAR A FERRAMENTA `search_knowledge_base`**.
   - NÃO responda com "consulte a base". Consulte VOCÊ MESMO usando a ferramenta.
   - Se a ferramenta retornar informação, use-a para responder.

ESTILO:
- Use Markdown compacto.
- Seja direto e profissional."""


def create_agent():
    api_key = os.environ.get('GROQ_API_KEY')
    if not api_key:
        raise ValueError("GROQ_API_KEY não encontrada no ambiente")
    
    return Agent(
        model=Groq(
            id="llama-3.3-70b-versatile",
            api_key=api_key,
            temperature=0.1
        ),
        tools=[
            search_students,
            check_attendance,
            search_assisted_relationship,
            search_knowledge_base,
            get_current_time
        ],
        instructions=SYSTEM_PROMPT,
        markdown=True
    )


def cmd_serve():
    """Persistent server mode - reads queries from stdin, writes responses to stdout."""
    sys.stderr.write("[Agno Agent] Starting...\n")
    
    agent = create_agent()
    sys.stderr.write("[Agno Agent] Ready. Listening on stdin.\n")
    
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
            
            line = line.strip()
            if not line:
                continue
            
            req = json.loads(line)
            
            if req.get("action") == "query":
                query = req.get("query", "")
                sys.stderr.write(f"[Agno Agent] Query: {query[:50]}...\n")
                
                try:
                    response = agent.run(query)
                    content = response.content if hasattr(response, 'content') else str(response)
                    print(json.dumps({"status": "success", "data": content}, ensure_ascii=False))
                except Exception as e:
                    sys.stderr.write(f"[Agno Agent] Error: {e}\n")
                    print(json.dumps({"status": "error", "message": str(e)}))
                
                sys.stdout.flush()
                
            elif req.get("action") == "ping":
                print(json.dumps({"status": "pong"}))
                sys.stdout.flush()
                
        except Exception as e:
            sys.stderr.write(f"[Agno Agent] Parse Error: {e}\n")
            print(json.dumps({"status": "error", "message": str(e)}))
            sys.stdout.flush()


def cmd_query(query: str):
    """One-shot query mode for testing."""
    agent = create_agent()
    response = agent.run(query)
    print(response.content if hasattr(response, 'content') else str(response))


if __name__ == "__main__":
    sys.stdin.reconfigure(encoding='utf-8')
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    
    if len(sys.argv) < 2:
        print("Usage: python ai_agent.py [serve|query] <args>")
        sys.exit(1)
    
    cmd = sys.argv[1]
    
    if cmd == "serve":
        cmd_serve()
    elif cmd == "query":
        if len(sys.argv) < 3:
            print("Usage: python ai_agent.py query <question>")
            sys.exit(1)
        cmd_query(" ".join(sys.argv[2:]))
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)
