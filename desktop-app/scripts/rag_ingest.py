import sys
import json
import os
import traceback

def main():
    # Force UTF-8 for stdin/stdout
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

    if len(sys.argv) < 2:
        print(json.dumps({"status": "error", "message": "No file path provided"}))
        return

    file_path = sys.argv[1]
    if not os.path.exists(file_path):
        print(json.dumps({"status": "error", "message": f"File not found: {file_path}"}))
        return

    try:
        from langchain_text_splitters import RecursiveCharacterTextSplitter
        
        # Determine strategy based on extension
        ext = os.path.splitext(file_path)[1].lower()
        full_text = ""
        used_method = "unknown"

        # --- Strategy 1: PyPDF (Fastest, for Native PDFs) ---
        if ext == '.pdf':
            try:
                from langchain_community.document_loaders import PyPDFLoader
                loader = PyPDFLoader(file_path)
                docs = loader.load()
                # Check for empty content (Scanned PDF?)
                extracted_text = "\n\n".join([d.page_content for d in docs])
                
                if extracted_text.strip():
                    full_text = extracted_text
                    used_method = "pypdf"
                else:
                    # Fallback to Docling if PyPDF returns empty
                    used_method = "docling_fallback"
            except Exception as e:
                # Fallback to Docling on error
                used_method = "docling_fallback_error"

        # --- Strategy 2: Docling (Robust, OCR, Universal) ---
        # Used for non-PDFs (docx, images) OR if PyPDF failed/was empty
        if not full_text:
            try:
                # Lazy import Docling (heavy)
                from docling.document_converter import DocumentConverter, PdfFormatOption
                from docling.datamodel.base_models import InputFormat
                from docling.datamodel.pipeline_options import PdfPipelineOptions

                # Configure Pipeline (Enable OCR for fallback/images)
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
                if used_method == "unknown":
                    raise e # No other method to try
                # If fallback failed, maybe just return error
                print(json.dumps({"status": "error", "message": f"Docling failed after fallback: {str(e)}"}))
                return

        if not full_text:
             print(json.dumps({"status": "error", "message": "No text extracted using any method."}))
             return

        # --- Splitting (LangChain) ---
        
        # CLEANING: Remove student IDs (8 digits) and excessive whitespace to improve embeddings
        import re
        # Remove patterns like "23060019"
        full_text = re.sub(r'\b\d{8}\b', '', full_text)
        # Collapse multiple spaces/newlines into single space, but keep paragraphs?
        # Actually, for table data, keeping newlines might help structure, but "  BRUNO  " is bad.
        # Let's just fix spaces.
        full_text = re.sub(r'  +', ' ', full_text)
        
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            separators=["\n\n", "\n", " ", ""]
        )
        chunks = text_splitter.split_text(full_text)

        # Output
        print(json.dumps({
            "status": "success", 
            "content": full_text, 
            "chunks": chunks,
            "method": used_method
        }, ensure_ascii=False))

    except Exception as e:
        err_msg = f"{str(e)}\n{traceback.format_exc()}"
        print(json.dumps({"status": "error", "message": err_msg}))

if __name__ == "__main__":
    main()
