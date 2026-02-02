
import lancedb
import os

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
db_path = os.path.join(project_root, 'desktop-app', 'data', 'knowledge.lance')

print(f"DB Path: {db_path}")
db = lancedb.connect(db_path)

print("--- table_names() ---")
try:
    print(db.table_names())
except Exception as e:
    print(f"Error: {e}")

print("--- list_tables() ---")
try:
    print(db.list_tables())
except Exception as e:
    print(f"Error: {e}")

if 'documents' in db.table_names():
    print("Found via table_names")
else:
    print("NOT found via table_names")

if 'documents' in db.list_tables():
    print("Found via list_tables")
else:
    print("NOT found via list_tables")
