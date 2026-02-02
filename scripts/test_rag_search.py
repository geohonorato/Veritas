
import lancedb
from sentence_transformers import SentenceTransformer
import os
import sys

# Go up one level from scripts/ to root
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
db_path = os.path.join(project_root, 'desktop-app', 'data', 'knowledge.lance')
model_cache = os.path.join(project_root, 'desktop-app', 'data', 'models_cache')

print(f"DB Path: {db_path}")
print(f"Model Cache: {model_cache}")

try:
    db = lancedb.connect(db_path)
    if 'documents' not in db.list_tables():
         print("Table 'documents' not found.")
         sys.exit(1)
         
    table = db.open_table('documents')
    
    print("Loading model...")
    model = SentenceTransformer('all-MiniLM-L6-v2', cache_folder=model_cache) # Removing local_files_only to allow fetch if needed
    
    query = "quem é o coordenador do npj?"
    print(f"Searching for: {query}")
    
    query_vector = model.encode(query)
    results = table.search(query_vector).limit(5).to_list()
    
    print(f"Found {len(results)} results.")
    for r in results:
        print(f"--- Source: {r.get('source')} ---")
        print(r.get('text', '')[:200])
        print("-------------------------------")

except Exception as e:
    print(f"Error: {e}")
