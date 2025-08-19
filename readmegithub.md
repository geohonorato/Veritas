# Veritas - Ponto Eletrônico com Biometria

Veritas é um sistema completo de controle de acesso e gestão de presença, utilizando biometria para garantir segurança e precisão. O sistema é composto por um dispositivo de hardware autônomo (baseado em ESP8266) e uma aplicação desktop multiplataforma (Electron) para gerenciamento e monitoramento.

## Funcionalidades Principais

- **Cadastro Biométrico:** Registro de usuários associado a uma impressão digital única.
- **Controle de Ponto:** Registra entradas e saídas com data e hora exatas.
- **Dashboard de Gestão:** Interface para adicionar, editar e remover usuários.
- **Monitoramento em Tempo Real:** Feed de atividades e estatísticas de presença (presentes, ausentes).
- **Exportação de Relatórios:** Gera planilhas (CSV/Excel) com os registros de frequência.
- **Feedback Físico:** O dispositivo de hardware usa um display LCD e um buzzer para feedback instantâneo.
- **Sincronização de Horário:** O relógio do dispositivo pode ser sincronizado pelo software.

## Arquitetura do Sistema

### Hardware

- **Microcontrolador:** NodeMCU (ESP8266)
- **Sensor Biométrico:** R307 (Óptico)
- **Relógio de Tempo Real (RTC):** DS3231
- **Display:** LCD 20x4 com módulo I2C
- **Buzzer:** Para alertas sonoros

#### Montagem do Circuito

| Componente | Pino no ESP8266 |
| :--- | :--- |
| **Sensor Biométrico R307** | |
| VCC (5V) | VU (5V) |
| GND | GND |
| TX (Sensor) | D7 (GPIO 13) |
| RX (Sensor) | D6 (GPIO 12) |
| **Módulo RTC DS3231** | |
| VCC (3.3V) | 3V3 |
| GND | GND |
| SDA | D2 (GPIO 4) |
| SCL | D1 (GPIO 5) |
| **Display LCD I2C 20x4** | |
| VCC (5V) | VU (5V) |
| GND | GND |
| SDA | D2 (GPIO 4) |
| SCL | D1 (GPIO 5) |
| **Buzzer** | |
| Positivo (+) | D0 (GPIO 16) |
| Negativo (-) | GND |

*Nota: O barramento I2C (SDA/SCL) é compartilhado entre o RTC e o Display LCD.*

### Software

#### Firmware (Dispositivo Embarcado)

- **Local:** Raiz do projeto (`main.cpp`)
- **Linguagem:** C++ (Framework Arduino)
- **Plataforma:** PlatformIO
- **Bibliotecas:** `Adafruit_Fingerprint`, `RTClib`, `LiquidCrystal_I2C`, `ArduinoJson`, `SoftwareSerial`.

#### Aplicação Desktop (Painel de Controle)

- **Local:** Pasta `/data`
- **Tecnologias:** Electron, Node.js, HTML5, Tailwind CSS, JavaScript.
- **Comunicação:** Via porta serial com o dispositivo (`serialport`).
- **Banco de Dados:** Arquivo local `database.json`.

## Instalação e Uso

### Pré-requisitos

- [Visual Studio Code](https://code.visualstudio.com/) + [Extensão PlatformIO IDE](https://platformio.org/platformio-ide)
- [Node.js](https://nodejs.org/) (v14 ou superior)
- Hardware montado conforme a especificação.

### 1. Configurar o Firmware

1.  Abra a pasta do projeto no VS Code com PlatformIO.
2.  Conecte o dispositivo ESP8266 via USB.
3.  Compile e envie o firmware:
    ```bash
    platformio run --target upload
    ```

### 2. Configurar a Aplicação Desktop

1.  Navegue até a pasta da aplicação:
    ```bash
    cd data
    ```
2.  Instale as dependências:
    ```bash
    npm install
    ```
3.  Inicie a aplicação:
    ```bash
    npm start
    ```
4.  Na aplicação, vá em **Configurações**, selecione a porta serial do dispositivo e salve.

## Build

Para empacotar a aplicação desktop em um executável, execute o seguinte comando na pasta `/data`:

```bash
npm run dist
```
Os arquivos de saída serão gerados na pasta `/build`.

## Licença

Este projeto está licenciado sob a licença ISC.
