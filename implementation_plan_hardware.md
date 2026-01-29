# Implementation Plan - Hardware Section Enrichment

The goal is to expand "Section 3. Engenharia de Hardware" in `RELATORIO_TECNICO_VERITAS.md` using insights from the V1.0 documentation PDF and standard technical knowledge of the ESP8266/R307 architecture. I will also add placeholders for the images contained in that PDF.

## User Review Required
> [!NOTE]
> I will assume standard connections for the V1.0 prototype based on the code analysis (Serial at 57600 implies R307, I2C implies DS3231/LCD).

## Proposed Changes

### [RELATORIO_TECNICO_VERITAS.md](file:///e:/Códigos/PONTO/RELATORIO_TECNICO_VERITAS.md)

I will replace `Section 3. Engenharia de Hardware` with a more detailed version including:

1.  **Microcontrolador (NodeMCU ESP8266)**:
    *   Detalhes de processamento (80MHz), tensão de operação (3.3V).
    *   Pinout utilizado (D1/D2 para I2C, TX/RX para Sensor).

2.  **Sensores e Atuadores**:
    *   **R307/R305**: Detalhes do sensor óptico.
    *   **DS3231**: Explicação da bateria de backup (CR2032).
    *   **LCD 20x4**: Endereçamento I2C (0x27 ou 0x3F).

3.  **Image Placeholders (From PDF)**:
    *   `> **📸 [Espaço para Print PDF: Diagrama Esquemático/Circuito]**`
    *   `> **📸 [Espaço para Print PDF: Pinout do ESP8266]**`
    *   `> **📸 [Espaço para Print PDF: Modelo 3D da Case]**`
    *   `> **📸 [Espaço para Print PDF: Foto do Protótipo Montado]**`

## Verification Plan
*   **Manual Review**: Ensure Section 3 reads like a rigorous hardware datasheets summary and contains the 4 new placeholders.
