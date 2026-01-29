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

def get_metadata_path(source_dir):
    # Metadata file INSIDE the source directory (portability)
    return os.path.join(source_dir, '.veritas_ingest_metadata.json')

def load_metadata(source_dir):
    path = get_metadata_path(source_dir)
    if os.path.exists(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_metadata(metadata, source_dir):
    path = get_metadata_path(source_dir)
    try:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
    except:
        pass

def cmd_ingest(source_dir):
    sys.stderr.write(f"--- Ingesting from {source_dir} ---\n")
    if not os.path.exists(source_dir):
        print(json.dumps({"status": "error", "message": "Source directory not found"}))
        return

    db_path = get_db_path()
    db = lancedb.connect(db_path)
    model = get_model()
    
    # Load previous ingestion state FROM source_dir
    metadata = load_metadata(source_dir)
    
    # Check for schema compatibility (Migration to schema with 'id')
    if TABLE_NAME in db.table_names():
        try:
            t = db.open_table(TABLE_NAME)
            if 'id' not in t.schema.names:
                sys.stderr.write("[System] Migrating database schema (adding IDs). Full re-ingest required.\n")
                db.drop_table(TABLE_NAME)
                metadata = {} # Clear metadata to force re-processing of all files
        except Exception as e:
            sys.stderr.write(f"[System] Warning checking schema: {e}\n")

    current_files = {} # To track what currently exists
    
    files = [f for f in os.listdir(source_dir) if os.path.isfile(os.path.join(source_dir, f)) and not f.startswith('.')]
    
    data_to_insert = []
    
    processed_count = 0
    skipped_count = 0
    errors = []

    # Identify files to process
    files_to_process = []
    for f in files:
        full_path = os.path.join(source_dir, f)
        mtime = os.path.getmtime(full_path)
        current_files[f] = mtime
        
        # Check if already ingested and unchanged
        if f in metadata and metadata[f] == mtime:
             skipped_count += 1
             sys.stderr.write(f"Skipping {f} (Unchanged)\n")
             continue
        
        files_to_process.append(f)

    # Clean up DB for deleted files or changed files
    # LanceDB doesn't support simple delete by filename efficiently without rewriting usually,
    # but we can try to delete where source = filename.
    # Note: If LanceDB version supports delete. If not, we might need to overwrite table mode.
    # For simplicity/robustness in this setup:
    # If there are changed/deleted files, we might need to rebuild or delete specific rows.
    # Assuming 'overwrite' mode for simplicity if we are re-ingesting EVERYTHING that changed?
    # Actually, if we use 'append', we duplicate. 
    # Best strategy for simple RAG: If many changes, overwrite. If incremental, we need 'delete' support.
    # Let's check if we can delete. If not, we rebuild metadata only for VALID files but we might have junk in DB.
    # Given the scale (NPJ docs), rebuilding provided we skip unchanged PARSING is hard because we need to clear DB.
    
    # REVISED STRATEGY:
    # 1. If we have any file to process (new or changed) OR any file deleted:
    #    We unfortunately usually need to clear the table to avoid duplicates if we can't delete by ID.
    #    LanceDB `delete` is available in newer versions.
    #    Let's try to be smart: If we re-ingest, we must re-ingest EVERYTHNG if we can't granularly delete.
    #    Result: "Persistencia no treinamento" = CACHE the parsing?
    #    Or: Does LanceDB support overwrite? Yes.
    #    To support "Skipping", we should:
    #    - Keep the old data for skipped files.
    #    - Add new data for new/changed files.
    #    - Remove data for deleted files.
    
    #    Implementation with overwrite (safest for consistency):
    #    We need to re-insert the embeddings for skipped files too? No, that's slow.
    #    We need valid text/vectors for them.
    #    
    #    Let's assume we can use `delete` where `source = filename`.
    #    Try: table.delete(f"source = '{filename}'")
    
    table = None
    if TABLE_NAME in db.table_names():
        table = db.open_table(TABLE_NAME)

    # Handle Deletions (Files in metadata but not in current folder)
    deleted_files = [f for f in metadata if f not in current_files]
    if table and deleted_files:
        sys.stderr.write(f"Removing {len(deleted_files)} deleted files from DB...\n")
        try:
             # Construct delete query
             # table.delete(where="source IN ...") might be complex. loop.
             for df in deleted_files:
                 table.delete(f"source = '{df}'")
                 del metadata[df]
        except Exception as e:
            sys.stderr.write(f"Warning: Could not delete from DB: {e}. Re-creating table might be needed eventually.\n")

    if not files_to_process and not deleted_files:
        print(json.dumps({"status": "success", "message": "No changes detected.", "count": 0, "skipped": skipped_count}))
        return

    # Process New/Changed
    for f in files_to_process:
        sys.stderr.write(f"Processing {f}...\n")
        full_path = os.path.join(source_dir, f)
        
        # Remove old version if it existed (update case)
        if table and f in metadata:
             try:
                table.delete(f"source = '{f}'")
             except: pass 

        try:
            text, method = extract_text(full_path)
            if not text:
                sys.stderr.write(f"  [Warn] Empty text context for {f}\n")
                errors.append(f"{f} (empty)")
                continue
            
            chunks = chunk_text(text)
            
            # Embed
            embeddings = model.encode(chunks)
            
            for i, chunk in enumerate(chunks):
                data_to_insert.append({
                    "vector": embeddings[i],
                    "text": chunk,
                    "source": f,
                    "id": f"{f}_{i}"
                })
            
            # Update metadata on success
            metadata[f] = current_files[f]
            processed_count += 1
            
        except Exception as e:
            sys.stderr.write(f"  [Error] Failed {f}: {e}\n")
            errors.append(f"{f} ({str(e)})")
            #traceback.print_exc()

    if data_to_insert:
        if TABLE_NAME in db.table_names():
            table = db.open_table(TABLE_NAME)
            table.add(data_to_insert)
        else:
            table = db.create_table(TABLE_NAME, data=data_to_insert)
        
        # Create FTS Index for Keyword Search support
        try:
            table.create_fts_index("text", replace=True)
            sys.stderr.write("[System] FTS Index created/updated.\n")
        except Exception as e:
            sys.stderr.write(f"[Warning] Could not create FTS index: {e}\n")

    # Save updated metadata TO source_dir
    save_metadata(metadata, source_dir)

    result = {
        "status": "success",
        "count": processed_count,
        "skipped": skipped_count,
        "errors": errors
    }
    print(json.dumps(result))

def cmd_serve():
    sys.stderr.write("[RAG Server] Starting...\n")
    # Pre-load model and DB
    sys.stderr.write("[RAG Server] Loading Model...\n")
    model = get_model() # This is slow
    
    sys.stderr.write("[RAG Server] Connecting DB...\n")
    db_path = get_db_path()
    db = lancedb.connect(db_path)
    
    sys.stderr.write("[RAG Server] Ready. Listening on stdin.\n")
    
    while True:
        try:
            line = sys.stdin.readline()
            if not line: break
            
            line = line.strip()
            if not line: continue
            
            req = json.loads(line)
            
            if req.get("action") == "search":
                sys.stderr.write(f"[DEBUG] Search requested: {req}\n")
                query = req.get("query", "")
                limit = req.get("limit", 5)
                
                # Check table existence
                if TABLE_NAME not in db.table_names():
                    sys.stderr.write(f"[DEBUG] Table {TABLE_NAME} not found.\n")
                    print(json.dumps({"status": "success", "data": []}))
                    sys.stdout.flush()
                    continue

                table = db.open_table(TABLE_NAME)
                
                # Search (Semantic/Vector)
                try:
                    sys.stderr.write(f"[DEBUG] Encoding query...\n")
                    query_vector = model.encode(query)
                    sys.stderr.write(f"[DEBUG] Searching LanceDB...\n")
                    results = table.search(query_vector).limit(limit).to_list()
                    sys.stderr.write(f"[DEBUG] Found {len(results)} results.\n")
                except Exception as e:
                    sys.stderr.write(f"[Search Error while searching] {e}\n")
                    results = []
                
                # Format output
                clean_results = []
                try:
                    for r in results:
                        clean_results.append({
                            "text": r.get("text", "")[:2000], # Slice to prevent huge payloads
                            "source": r.get("source", "unknown"),
                            "score": 0
                        })
                    
                    sys.stderr.write(f"[DEBUG] Serializing {len(clean_results)} results...\n")
                    json_output = json.dumps({"status": "success", "data": clean_results}, ensure_ascii=True)
                    
                    sys.stderr.write(f"[DEBUG] Printing to stdout...\n")
                    print(json_output)
                    sys.stdout.flush()
                    sys.stderr.write(f"[DEBUG] Flush complete.\n")
                except Exception as e:
                     sys.stderr.write(f"[Output Error] Failed to print/serialize: {e}\n")
                     print(json.dumps({"status": "error", "message": f"Serialization error: {str(e)}"}))
                     sys.stdout.flush()


            elif req.get("action") == "ping":
                print(json.dumps({"status": "pong"}))
                sys.stdout.flush()

        except Exception as e:
            # sys.stderr.write(f"[RAG Error] {e}\n")
            print(json.dumps({"status": "error", "message": str(e)}))
            sys.stdout.flush()

if __name__ == "__main__":
    sys.stdin.reconfigure(encoding='utf-8')
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    
    if len(sys.argv) < 2:
        print("Usage: python rag_manager.py [ingest|serve] <args>")
        sys.exit(1)
        
    cmd = sys.argv[1]
    
    if cmd == "ingest":
        if len(sys.argv) < 3:
            print("Usage: python rag_manager.py ingest <source_dir>")
            sys.exit(1)
        cmd_ingest(sys.argv[2])
        
    elif cmd == "serve":
        cmd_serve()
