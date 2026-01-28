import sys
import json
import os
import lancedb
from sentence_transformers import SentenceTransformer
import warnings

# Suppress warnings
warnings.filterwarnings("ignore")

def main():
    # Force UTF-8
    sys.stdout.reconfigure(encoding='utf-8')
    
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No query provided"}))
        return

    query = sys.argv[1]
    
    try:
        # Resolve DB Path
        script_dir = os.path.dirname(os.path.abspath(__file__))
        db_path = os.path.join(script_dir, '../desktop-app/data/knowledge.lance')
        
        if not os.path.exists(db_path):
             print(json.dumps({"error": f"Database not found at {db_path}"}))
             return

        # Connect DB
        db = lancedb.connect(db_path)
        
        # Open Table
        table_name = "documents"
        try:
            tbl = db.open_table(table_name)
        except Exception:
             print(json.dumps([])) # Return empty if table doesn't exist yet
             return

        # Load Model & Embed
        # NOTE: first run might download model ~90MB
        model = SentenceTransformer('all-MiniLM-L6-v2')
        query_vec = model.encode(query, normalize_embeddings=True)
        
        # Search
        # limit=5 is standard
        results = tbl.search(query_vec).limit(5).to_list()
        
        # Format output
        output = []
        for r in results:
            output.append({
                "text": r.get("text", ""),
                "source": r.get("source", "unknown"),
                "score": r.get("_distance", 0) 
            })
            
        print(json.dumps(output, ensure_ascii=False))

    except Exception as e:
        # Wrap error in JSON so Node can parse it
        error_msg = str(e)
        print(json.dumps({"error": error_msg}))
        sys.exit(1)

if __name__ == "__main__":
    main()
