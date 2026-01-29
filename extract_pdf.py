import pypdf
import sys
import io

# Force stdout to utf-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

pdf_path = "b11cf3f6-fca4-42f7-aaa1-80dc8ed11ae9_Veritas_-_Sistema_de_Ponto_Eletrnico_com_Biometria.pdf"

try:
    reader = pypdf.PdfReader(pdf_path)
    with open("pdf_content_utf8.txt", "w", encoding="utf-8") as f:
        for i, page in enumerate(reader.pages):
            f.write(f"--- Page {i+1} ---\n")
            f.write(page.extract_text())
            f.write("\n\n")
except Exception as e:
    print(f"Error: {e}")
