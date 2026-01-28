import sys
import json
import os
import lancedb
import warnings
import traceback
import re
from sentence_transformers import SentenceTransformer

# Suppress warnings
warnings.filterwarnings("ignore")

# Configuration
DB_REL_PATH = '../desktop-app/data/knowledge.lance'
TABLE_NAME = 'documents'
MODEL_NAME = 'all-MiniLM-L6-v2'
MODEL_CACHE_REL_PATH = '../desktop-app/data/models_cache'
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200

def get_db_path():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(script_dir, DB_REL_PATH)

def get_model():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(script_dir, MODEL_CACHE_REL_PATH)
    
    # Tenta carregar offline primeiro (mais rápido e sem erro de rede)
    try:
        # Verifica se parece ter algo lá antes de tentar carregar para evitar erro genérico
        if os.path.exists(model_path) and len(os.listdir(model_path)) > 0:
            return SentenceTransformer(MODEL_NAME, cache_folder=model_path, local_files_only=True)
    except Exception:
        pass # Fallback to online

    # Se falhar ou não existir, baixa (apenas na primeira vez)
    sys.stderr.write(f"[System] Baixando modelo IA para cache local (apenas 1x)...\n")
    return SentenceTransformer(MODEL_NAME, cache_folder=model_path)

def get_table(db, create_if_missing=False):
    if TABLE_NAME in db.table_names():
        return db.open_table(TABLE_NAME)
    
    if create_if_missing:
        # Define schema by creating with dummy data or Pydantic (if flexible)
        # Using a reliable method: empty list of dicts with schema check?
        # Better: Create on first insertion.
        return None
    return None

def extract_text(file_path):
    """
    Hybrid extraction strategy (PyPDF -> Docling)
    Copied/Adapted from rag_ingest.py
    """
    ext = os.path.splitext(file_path)[1].lower()
    full_text = ""
    used_method = "unknown"

    # Strategy 1: PyPDF
    if ext == '.pdf':
        try:
            from langchain_community.document_loaders import PyPDFLoader
            loader = PyPDFLoader(file_path)
            docs = loader.load()
            extracted = "\n\n".join([d.page_content for d in docs])
            if extracted.strip():
                full_text = extracted
                used_method = "pypdf"
            else:
                used_method = "docling_fallback"
        except Exception:
            used_method = "docling_fallback_error"

    # Strategy 1.5: Text Files
    if ext == '.txt':
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                full_text = f.read()
            used_method = "txt_simple"
        except Exception:
             used_method = "txt_error"

    # Strategy 2: Docling
    if not full_text:
        try:
            from docling.document_converter import DocumentConverter, PdfFormatOption
            from docling.datamodel.base_models import InputFormat
            from docling.datamodel.pipeline_options import PdfPipelineOptions

            pipeline_options = PdfPipelineOptions()
            pipeline_options.do_ocr = True 
            pipeline_options.do_table_structure = True

            converter = DocumentConverter(
                format_options={
                    InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
                } 
            )
            result = converter.convert(file_path)
            full_text = result.document.export_to_markdown()
            
            if used_method == "unknown":
                used_method = "docling_primary"
        except Exception as e:
            if used_method != "unknown": 
                pass # Failed fallback
            else:
                raise e

    if not full_text:
        return None, "no_text"
    
    # Cleaning
    # Remove IDs
    full_text = re.sub(r'\b\d{8}\b', '', full_text)
    # Fix spaces
    full_text = re.sub(r'  +', ' ', full_text)
    
    return full_text, used_method

def chunk_text(text):
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", " ", ""]
    )
    return text_splitter.split_text(text)

def cmd_ingest(source_dir):
    sys.stderr.write(f"--- Ingesting from {source_dir} ---\n")
    if not os.path.exists(source_dir):
        print(json.dumps({"status": "error", "message": "Source directory not found"}))
        return

    db_path = get_db_path()
    db = lancedb.connect(db_path)
    model = get_model()
    
    files = [f for f in os.listdir(source_dir) if os.path.isfile(os.path.join(source_dir, f)) and not f.startswith('.')]
    
    data_to_insert = []
    
    processed_count = 0
    errors = []

    for f in files:
        sys.stderr.write(f"Processing {f}...\n")
        file_path = os.path.join(source_dir, f)
        try:
            text, method = extract_text(file_path)
            if not text:
                sys.stderr.write(f"Skipping {f}: No text extracted.\n")
                continue
                
            chunks = chunk_text(text)
            sys.stderr.write(f"  Got {len(chunks)} chunks via {method}.\n")
            
            # Embed chunks
            vectors = model.encode(chunks, normalize_embeddings=True)
            
            for i, chunk in enumerate(chunks):
                data_to_insert.append({
                    "vector": vectors[i],
                    "text": chunk,
                    "source": f,
                    "model": MODEL_NAME
                })
            
            processed_count += 1
            
        except Exception as e:
            err_msg = f"Error processing {f}: {str(e)}"
            sys.stderr.write(err_msg + "\n")
            errors.append(err_msg)

    if not data_to_insert:
        print(json.dumps({"status": "success", "processed": 0, "message": "No data found to ingest"}))
        return

    # Write to DB
    sys.stderr.write(f"Writing {len(data_to_insert)} records to LanceDB...\n")
    try:
        # Always overwrite for "Reaprender" (Full Ingest) to ensure clean state and schema match
        db.create_table(TABLE_NAME, data=data_to_insert, mode="overwrite")
            
        print(json.dumps({
            "status": "success", 
            "processed": processed_count, 
            "chunks": len(data_to_insert),
            "errors": errors
        }))
    except Exception as e:
         print(json.dumps({"status": "error", "message": f"DB Write Failed: {str(e)}"}))


def cmd_search(query):
    db_path = get_db_path()
    if not os.path.exists(db_path):
         print(json.dumps({"error": "Database not exist"}))
         return

    db = lancedb.connect(db_path)
    if TABLE_NAME not in db.table_names():
        print(json.dumps([]))
        return

    tbl = db.open_table(TABLE_NAME)
    model = get_model()
    
    query_vec = model.encode(query, normalize_embeddings=True)
    results = tbl.search(query_vec).limit(5).to_list()
    
    output = []
    for r in results:
        output.append({
            "text": r.get("text", ""),
            "source": r.get("source", "unknown"),
            "score": r.get("_distance", 0) 
        })
    print(json.dumps(output, ensure_ascii=False))

def cmd_serve():
    """
    Persistent server mode for low-latency searches.
    Reads JSON lines from stdin: {"action": "search", "query": "..."}
    Writes JSON lines to stdout: {"status": "success", "data": [...]}
    """
    sys.stderr.write("[Server] Starting Persistent Mode...\n")
    
    # 1. Preload Model and DB
    try:
        sys.stderr.write("[Server] Loading Model...\n")
        model = get_model()
        sys.stderr.write("[Server] Connecting DB...\n")
        db_path = get_db_path()
        db = lancedb.connect(db_path)
        
        # Check table
        tbl = None
        if TABLE_NAME in db.table_names():
            tbl = db.open_table(TABLE_NAME)
        else:
            sys.stderr.write("[Server] Warning: Table not found. Searches will return empty.\n")
            
        sys.stderr.write("[Server] Ready to accept commands.\n")
        
    except Exception as e:
        sys.stderr.write(f"[Server] Critical Startup Error: {e}\n")
        return

    # 2. Loop
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break # EOF
            
            line = line.strip()
            if not line:
                continue
                
            req = json.loads(line)
            action = req.get("action")
            
            if action == 'search':
                query = req.get("query")
                if not tbl:
                    print(json.dumps({"status": "success", "data": []}))
                else:
                    try:
                        query_vec = model.encode(query, normalize_embeddings=True)
                        results = tbl.search(query_vec).limit(5).to_list()
                        safe_results = [{"text": r.get("text", ""), "source": r.get("source", "unknown"), "score": r.get("_distance")} for r in results]
                        print(json.dumps({"status": "success", "data": safe_results}))
                    except Exception as s_err:
                        print(json.dumps({"status": "error", "message": str(s_err)}))
                        
            elif action == 'ping':
                print(json.dumps({"status": "pong"}))
                
            elif action == 'reload':
                # Re-open table if ingestion happened externally
                sys.stderr.write("[Server] Reloading table...\n")
                if TABLE_NAME in db.table_names():
                    tbl = db.open_table(TABLE_NAME)
                print(json.dumps({"status": "reloaded"}))
            
            else:
                 print(json.dumps({"status": "error", "message": "Unknown action"}))
            
            sys.stdout.flush()
            
        except json.JSONDecodeError:
            print(json.dumps({"status": "error", "message": "Invalid JSON"}))
            sys.stdout.flush()
        except Exception as e:
            sys.stderr.write(f"[Server] Error loop: {e}\n")
            print(json.dumps({"status": "error", "message": str(e)}))
            sys.stdout.flush()

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: rag_manager.py <command> [args]"}));
        return

    command = sys.argv[1]
    
    try:
        if command == "ingest":
            if len(sys.argv) < 3:
                print(json.dumps({"error": "Ingest requires source directory argument"}))
                return
            cmd_ingest(sys.argv[2])
            
        elif command == "search":
             if len(sys.argv) < 3:
                print(json.dumps({"error": "Search requires query"}))
                return
             cmd_search(sys.argv[2])
        
        elif command == "serve":
            cmd_serve()

        else:
             print(json.dumps({"error": f"Unknown command: {command}"}))
             
    except Exception as e:
        err = f"Critical Error: {str(e)}\n{traceback.format_exc()}"
        print(json.dumps({"status": "error", "message": err, "error": err}))
        sys.exit(1)

if __name__ == "__main__":
    main()
