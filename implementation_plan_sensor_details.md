# Implementation Plan - Integrating Sensor Details from V1.0 PDF

The user specifically requested the optical sensor explanation found in the Version 1.0 PDF. I have extracted this text and will integrate the specific performance metrics (FAR, FRR) and the simplified 4-step operational process into `RELATORIO_TECNICO_VERITAS.md`.

## Proposed Changes

### [RELATORIO_TECNICO_VERITAS.md](file:///e:/Códigos/PONTO/RELATORIO_TECNICO_VERITAS.md)

**Section 3.2 Sensor Biométrico Óptico (R307/R305)** will be updated to include:

1.  **Performance Metrics** (Missing in current report):
    *   Taxa de Falsos Positivos (FAR): < 0.001%
    *   Taxa de Falsos Negativos (FRR): < 0.1%
    *   Tempo de Reconhecimento: < 0.5 segundos

2.  **Ciclo de Funcionamento (The 4 Steps from PDF)**:
    *   Will add a subsection explicitly matching the PDF's flow:
        1.  **Captura da Imagem**: Aquisição digital da digital.
        2.  **Processamento**: Conversão para template único.
        3.  **Armazenamento/Comparação**: Matching 1:N.
        4.  **Resultado**: ID ou Erro.

I will preserve the existing FTIR/DSP explanation as "Fundamentação Teórica" but ensure the user-friendly "Funcionamento" from the PDF is prominent.

## Verification Plan
*   **Manual Review**: Check that Section 3.2 now contains the specific FAR/FRR numbers and the 4-step list exactly as requested.
