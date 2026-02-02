
import lancedb
import os
import sys

# Go up one level from scripts/ to root
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
db_path = os.path.join(project_root, 'desktop-app', 'data', 'knowledge.lance')

print(f"Opening DB at: {db_path}")

try:
    db = lancedb.connect(db_path)
    print(f"Tables: {db.table_names()}")
    
    if 'documents' in db.table_names():
        tbl = db.open_table('documents')
        print(f"Rows: {len(tbl)}")
        print("Sample data (first 2 rows):")
        print(tbl.head(2))
    else:
        print("Table 'documents' NOT found.")

except Exception as e:
    print(f"Error: {e}")
