import os

# Updated replacements list with remaining issues found in script.js
replacements = [
    # Previous (keeping them just in case)
    ("Gáªnero", "Gênero"),
    ("Frequáªncia", "Frequência"),
    ("Tendáªncia", "Tendência"),
    ("Eletrá´nico", "Eletrônico"),
    ("Relatá³rio", "Relatório"),
    ("Prá³ximo", "Próximo"),
    ("Matrá­cula", "Matrícula"),
    ("Saá­da", "Saída"),
    ("Fá­sico", "Físico"),
    ("Iná­cio", "Início"),
    ("Diá¡rio", "Diário"),
    ("Horá¡rio", "Horário"),
    ("Usuá¡rio", "Usuário"),
    ("Histá³rico", "Histórico"),
    ("Conteáºdo", "Conteúdo"),
    ("Atá©", "Até"),
    ("Máªs", "Mês"),
    ("Biomá©trico", "Biométrico"),
    ("Cá©rebro", "Cérebro"),
    ("Autenticaçáo", "Autenticação"),
    ("Manutençáo", "Manutenção"),
    ("Observaçáo", "Observação"),
    
    # New findings in script.js
    ("Usué¡rio", "Usuário"),
    ("usué¡rio", "usuário"),
    ("necessério", "necessário"),
    ("usuério", "usuário"),
    ("Comunicaçéo", "Comunicação"),
    ("Ediçéo", "Edição"),
    ("Adiçéo", "Adição"),
    ("Modificaçéo", "Modificação"),
    ("Configuraçéo", "Configuração"),
    ("têm", "têm"), # Just to be safe
    
    # Check for other patterns if needed
    ("é‡éƒO", "ÇÃO"), # Seen in EDIé‡éƒO -> EDIÇÃO ?
    ("ADIé‡éƒO", "ADIÇÃO"),
    
    # General patterns from before
    ("áª", "ê"),
    ("á´", "ô"),
    ("á­", "í"),
    ("á¡", "á"),
    ("á³", "ó"),
    ("áº", "ú"),
    ("á©", "é"),
    ("çáo", "ção"),
]

files_to_fix = [
    r"e:\Códigos\PONTO\desktop-app\public\index.html",
    r"e:\Códigos\PONTO\desktop-app\public\script.js"
]

def fix_file(filepath):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return

    print(f"Processing {filepath}...")
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        new_content = content
        for bad, good in replacements:
            if bad in new_content:
                print(f"  Replacing '{bad}' with '{good}'")
                new_content = new_content.replace(bad, good)

        if new_content != content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"  Saved changes to {filepath}")
        else:
            print(f"  No changes needed for {filepath}")

    except Exception as e:
        print(f"Error processing {filepath}: {e}")

if __name__ == "__main__":
    for f in files_to_fix:
        fix_file(f)
