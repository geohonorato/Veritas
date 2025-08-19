# Veritas - Relatório do Projeto de Ponto Eletrônico com Biometria

**Autor:** Geovanni Honorato

## Sumário
1. [Introdução](#1-introdução)
2. [Motivação e Histórico do Projeto](#2-motivação-e-histórico-do-projeto)
3. [Arquitetura do Sistema](#3-arquitetura-do-sistema)
    - [3.1. Hardware](#31-hardware)
    - [3.2. Software](#32-software)
4. [Funcionalidades Detalhadas](#4-funcionalidades-detalhadas)
5. [Instalação e Uso](#5-instalação-e-uso)
6. [Construção (Build)](#6-construção-build)
7. [Licença](#7-licença)
8. [Anexos: Códigos-Fonte](#8-anexos-códigos-fonte)
    - [8.1. Firmware (main.cpp)](#81-firmware-maincpp)
    - [8.2. Aplicação Desktop (main.js)](#82-aplicação-desktop-mainjs)
    - [8.3. Lógica do Frontend (script.js)](#83-lógica-do-frontend-scriptjs)
    - [8.4. Estrutura da Interface (index.html)](#84-estrutura-da-interface-indexhtml)
    - [8.5. Estilização (style.css)](#85-estilização-stylecss)

---

## 1. Introdução

O Veritas é um sistema completo de controle de acesso e gestão de presença, desenvolvido para modernizar e automatizar o registro de frequência no Núcleo de Prática Jurídica (NPJ) do CESUPA. Utilizando tecnologia biométrica para garantir segurança e precisão, o sistema é composto por um dispositivo de hardware autônomo e uma aplicação desktop intuitiva para gerenciamento e monitoramento.

O projeto visa substituir o método tradicional de assinatura manual em papel, propenso a erros, fraudes e ineficiências, por uma solução tecnológica robusta, confiável e de fácil utilização.

## 2. Motivação e Histórico do Projeto

O projeto foi concebido para solucionar as ineficiências e a falta de segurança do sistema de controle de frequência manual do Núcleo de Prática Jurídica (NPJ). A necessidade de um método mais seguro e automatizado levou à idealização de um sistema eletrônico baseado em biometria.

A proposta foi apresentada ao Professor Adelvan Oliverio, que, na qualidade de superior responsável, aprovou a iniciativa e autorizou a aquisição dos componentes necessários. Os componentes eletrônicos, incluindo o microcontrolador, sensor biométrico e outros periféricos, foram adquiridos de fornecedores internacionais.

Após a chegada dos componentes, iniciou-se a fase de montagem do protótipo, incluindo a soldagem dos componentes em uma placa perfurada para garantir a estabilidade do circuito. A fase de desenvolvimento de software, abrangendo tanto o firmware para o microcontrolador ESP8266 quanto a aplicação desktop, foi realizada intensivamente durante o mês de julho, resultando na solução integrada que é o Veritas.

## 3. Arquitetura do Sistema

O projeto é dividido em duas partes principais: o **Firmware** para o dispositivo embarcado e a **Aplicação Desktop** para o controle e gerenciamento.

### 3.1. Hardware

O dispositivo de captura biométrica é montado com os seguintes componentes:

- **Microcontrolador:** NodeMCU (ESP8266), um microcontrolador de baixo custo com Wi-Fi integrado, responsável por orquestrar todos os outros componentes.
- **Sensor Biométrico:** R307, um sensor óptico para captura, processamento e armazenamento de impressões digitais.
- **Módulo de Relógio (RTC):** DS3231, um relógio de tempo real de alta precisão com bateria de backup, garantindo que os registros de data e hora sejam exatos mesmo após uma queda de energia.
- **Display:** LCD 20x4 com módulo I2C, para fornecer feedback visual instantâneo ao usuário.
- **Buzzer:** Para emitir alertas sonoros de sucesso ou falha durante a operação.

#### Montagem do Circuito

Os componentes devem ser conectados ao NodeMCU/ESP8266 da seguinte forma:

| Componente            | Pino no ESP8266  |
|:----------------------|:-----------------|
| **Sensor Biométrico R307** |                  |
| VCC (5V)              | VU (5V)          |
| GND                   | GND              |
| TX (Sensor)           | D7 (GPIO 13)     |
| RX (Sensor)           | D6 (GPIO 12)     |
| TOUCH (Sensor)        | D5 (GPIO 14)     |
| **Módulo RTC DS3231**     |                  |
| VCC (3.3V)            | 3V3              |
| GND                   | GND              |
| SDA                   | D2 (GPIO 4)      |
| SCL                   | D1 (GPIO 5)      |
| **Display LCD I2C 20x4**  |                  |
| VCC (5V)              | VU (5V)          |
| GND                   | GND              |
| SDA                   | D2 (GPIO 4)      |
| SCL                   | D1 (GPIO 5)      |
| **Buzzer**                |                  |
| Positivo (+)          | D0 (GPIO 16)     |
| Negativo (-)          | GND              |

*Nota: Os pinos SDA e SCL do RTC e do Display LCD são conectados nos mesmos pinos I2C do ESP8266 (D2 e D1, respectivamente), pois o I2C é um barramento que permite múltiplos dispositivos.*

### 3.2. Software

#### 3.2.1. Firmware (Dispositivo Embarcado)

O cérebro do dispositivo de hardware é programado em C++ utilizando o framework Arduino através do PlatformIO.

- **Linguagem:** C++ (Arduino)
- **Plataforma de Desenvolvimento:** PlatformIO
- **Bibliotecas Principais:**
  - `Adafruit_Fingerprint`: Para comunicação com o sensor biométrico R307.
  - `RTClib`: Para obter a data e hora do módulo RTC DS3231.
  - `LiquidCrystal_I2C`: Para controlar o display LCD 20x4.
  - `SoftwareSerial`: Para criar uma porta serial de software dedicada à comunicação com o sensor biométrico, liberando a serial de hardware para a comunicação com o PC.
  - `ArduinoJson`: Para a serialização e desserialização de dados no formato JSON, facilitando a comunicação com a aplicação desktop.

#### 3.2.2. Aplicação Desktop (Painel de Controle)

A interface de gerenciamento é uma aplicação desktop multiplataforma construída com Electron, permitindo que ela rode em Windows, macOS e Linux.

- **Tecnologias:** Electron, Node.js, HTML5, Tailwind CSS, JavaScript.
- **Localização dos Arquivos:** O código-fonte da aplicação desktop está na pasta `/data`.
- **Comunicação:** Utiliza a biblioteca `serialport` do Node.js para estabelecer a comunicação bidirecional com o dispositivo ESP via porta serial.
- **Banco de Dados:** Um arquivo `database.json` local, armazenado de forma persistente na pasta de dados do usuário do sistema operacional, armazena os dados de usuários e o histórico de atividades.

## 4. Funcionalidades Detalhadas

- **Cadastro de Usuários:** Permite o registro de novos usuários com nome, matrícula, turma, e-mail, gênero e dias da semana para controle de presença, associando-os a uma impressão digital única.
- **Monitoramento em Tempo Real:** A aplicação desktop exibe as atividades de entrada e saída assim que ocorrem, fornecendo uma visão imediata da presença.
- **Gestão de Dados:** A interface permite editar informações dos usuários, excluir registros (do software e do sensor) e sincronizar dados.
- **Dashboard Intuitivo:** Um painel principal exibe estatísticas diárias de presença (presentes, ausentes e total de alunos) e um feed de atividades recentes.
- **Feedback Visual e Sonoro:** O dispositivo físico fornece feedback instantâneo através do display LCD e de um buzzer, informando o status da verificação biométrica.
- **Relatórios de Atividade:** O sistema permite a exportação de relatórios de atividade em formato CSV para análise e arquivamento.
- **Servidor Web Integrado:** A aplicação desktop inicia um servidor web local, permitindo que o dashboard de atividades seja acessado remotamente por outros dispositivos na mesma rede.

## 5. Instalação e Uso

Siga os passos abaixo para configurar e executar o sistema.

### 5.1. Pré-requisitos

- [Visual Studio Code](https://code.visualstudio.com/) com a extensão [PlatformIO IDE](https://platformio.org/platformio-ide).
- [Node.js](https://nodejs.org/) (versão 14 ou superior).
- Hardware montado conforme a especificação da seção [3.1. Hardware](#31-hardware).

### 5.2. Configurar o Firmware

1.  Abra a pasta do projeto no Visual Studio Code.
2.  Conecte o dispositivo ESP8266 ao computador via USB.
3.  O PlatformIO deverá reconhecer o projeto e instalar as dependências das bibliotecas automaticamente.
4.  Para compilar e enviar o firmware para o dispositivo, execute o seguinte comando no terminal do PlatformIO:
    ```bash
    platformio run --target upload
    ```

### 5.3. Configurar a Aplicação Desktop

1.  Navegue até a pasta da aplicação:
    ```bash
    cd data
    ```
2.  Instale as dependências do Node.js:
    ```bash
    npm install
    ```
3.  Inicie a aplicação:
    ```bash
    npm start
    ```

### 5.4. Primeiro Uso

1.  Ao abrir a aplicação, vá para a aba **Configurações**.
2.  Selecione a porta serial correspondente ao seu dispositivo ESP na lista e clique em **Salvar configurações**. O indicador de status deve ficar verde.
3.  Vá para a aba **Usuários** e clique no botão **Adicionar** para começar a cadastrar as pessoas. Preencha todos os campos, incluindo o sexo, e siga as instruções na tela para o registro da impressão digital.

## 6. Construção (Build)

Para empacotar a aplicação desktop em um instalador ou executável portátil para Windows, macOS ou Linux, utilize o seguinte comando na pasta `/data`:

```bash
npm run dist
```

Os arquivos de saída serão gerados na pasta `/build` (relativa à pasta raiz do projeto, não à pasta `/data`).

## 7. Licença

Este projeto está licenciado sob a licença ISC.

## 8. Anexos: Códigos-Fonte

### 8.1. Firmware (main.cpp)
<details>
<summary>Clique para expandir o código do firmware</summary>

```cpp
#include <Arduino.h>
#include <SoftwareSerial.h>
#include <Adafruit_Fingerprint.h>
#include <Wire.h>
#include <RTClib.h>
#include <LiquidCrystal_I2C.h>
#include <ArduinoJson.h>

// --- Pinos ---
#define BUZZER_PIN 16      // D0

// Pinos para o barramento I2C de Hardware (RTC e LCD)
#define I2C_SCL_PIN 5      // D1
#define I2C_SDA_PIN 4      // D2

// Sensor Biométrico R307
#define R307_TOUCH_PIN 14  // D5
#define R307_RX_PIN 13     // D7
#define R307_TX_PIN 12     // D6

// --- Configurações ---
const int LCD_I2C_ADDR = 0x27;
const int LCD_COLS = 20;
const int LCD_ROWS = 4;

// --- Instâncias dos Objetos ---
RTC_DS3231 rtc;
LiquidCrystal_I2C lcd(LCD_I2C_ADDR, LCD_COLS, LCD_ROWS);
SoftwareSerial mySerial(R307_RX_PIN, R307_TX_PIN);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);

// --- Enum de Estado para controle de fluxo ---
enum SystemState { IDLE, VERIFYING, AWAITING_RESPONSE };
SystemState currentState = IDLE;

// --- Variáveis Globais ---
unsigned long previousMillis = 0;
const long interval = 1000; // Intervalo de atualização do relógio no LCD
bool initialDisplay = false;
String serialInputBuffer = ""; // Buffer para armazenar a entrada serial
bool buzzerEnabled = true; // Controla o estado do buzzer
unsigned long lastReadTime = 0; // Para debounce do sensor
const long readCooldown = 500; // 0.5 segundos de espera entre leituras

// --- Variáveis para controle do Backlight ---
unsigned long lastInteractionTime;
const unsigned long backlightTimeout = 20000; // 20 segundos em milissegundos

// --- Protótipos ---
void printCentered(String text, int row);
void displayDefaultScreen();
void beep(bool success);
void displayMessage(const String& line1, const String& line2 = "", const String& line3 = "", const String& line4 = "", int delay_ms = 1000, bool error = false);
void sendJsonResponse(const String& status, const String& message, int id = -1, const String& timestamp = "");
void requestUserData(int id);
void enrollFingerprint(uint16_t id);
void verifyFingerprint();
void deleteFingerprint(uint16_t id);



// --- Setup ---
void setup() {
  Serial.begin(115200);
  mySerial.begin(57600);
  
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(R307_TOUCH_PIN, INPUT_PULLUP);

  // Inicia o barramento I2C de Hardware
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);

  // Inicializa o LCD
  lcd.init();
  lcd.backlight();

  // Inicializa o RTC
  if (!rtc.begin()) {
    sendJsonResponse("error", "Nao foi possivel encontrar o RTC.");
    displayMessage("RTC NAO ENCONTRADO!", "USANDO HORA INTERNA", "", "", 2000, true);
  } else if (rtc.lostPower()) {
    rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
    sendJsonResponse("info", "RTC ajustado para o tempo de compilacao.");
  }

  finger.begin(57600);

  if (finger.verifyPassword()) {
    sendJsonResponse("info", "Sensor encontrado.");
  } else {
    sendJsonResponse("error", "Sensor nao encontrado ou senha invalida.");
    while (1) { 
      displayMessage("SENSOR NAO", "ENCONTRADO", "VERIFIQUE A FIACAO", "", 5000, true);
      delay(1000); 
    }
  }

  // Configura o nível de segurança do sensor para o mais baixo (1)
  // Isso torna a leitura mais permissiva, mas menos segura.
  if (finger.setSecurityLevel(FINGERPRINT_SECURITY_LEVEL_1) == FINGERPRINT_OK) {
    sendJsonResponse("info", "Nivel de seguranca configurado para 1 (baixo).");
  } else {
    sendJsonResponse("error", "Falha ao configurar o nivel de seguranca.");
  }

  displayDefaultScreen();
  sendJsonResponse("info", "Dispositivo pronto.");
  lastInteractionTime = millis(); // Inicia o contador do backlight
}

// --- Função para registrar interação e ligar o backlight ---
void recordInteraction() {
  lastInteractionTime = millis();
  lcd.backlight();
}

// --- Loop ---
void loop() {
  unsigned long currentMillis = millis();

  // Apenas atualiza o relógio se estiver no estado IDLE
  if (currentState == IDLE) {
    if (currentMillis - previousMillis >= interval || !initialDisplay) {
      previousMillis = currentMillis;
      displayDefaultScreen();
    }
  }

  // Verifica o timeout do backlight
  if (millis() - lastInteractionTime > backlightTimeout) {
    lcd.noBacklight();
  }

  // Lógica de verificação baseada no estado
  if (currentState == IDLE && digitalRead(R307_TOUCH_PIN) == LOW && (millis() - lastReadTime > readCooldown)) {
    currentState = VERIFYING;
    recordInteraction();
    verifyFingerprint();
  }

  while (Serial.available()) {
    char inChar = Serial.read();
    serialInputBuffer += inChar;
    if (inChar == '
') {
      recordInteraction(); // Registra o comando serial como uma interação
      JsonDocument doc;
      DeserializationError error = deserializeJson(doc, serialInputBuffer);
      
      // Se a deserialização falhar ou se for uma mensagem de status (eco), ignora.
      if (error || doc.containsKey("status")) {
        serialInputBuffer = ""; // Limpa o buffer e ignora a linha
        continue;
      }
      
      String command = doc["command"];
      if (command == "ENROLL") {
        enrollFingerprint(doc["id"]);
      } else if (command == "USER_DATA_RESPONSE") {
        beep(true);

        String nomeCompleto = doc["nome"];
        String genero = doc["genero"];
        String tipo = doc["type"];
        String cabine = doc["cabine"];
        
        // Extrai o primeiro nome
        int spaceIndex = nomeCompleto.indexOf(' ');
        String primeiroNome = (spaceIndex > 0) ? nomeCompleto.substring(0, spaceIndex) : nomeCompleto;

        lcd.clear();
        
        // Linha 1: BEM VINDO ou BEM VINDA
        String welcomeMsg = (genero == "Feminino" ? "BEM VINDA" : "BEM VINDO");
        
        // Linha 2: Primeiro nome
        
        // Linha 3: TIPO AS HH:MM
        DateTime now = rtc.now(); // Não precisa mais de ajuste
        char activityStr[20]; // "SAIDA AS 23:59"
        snprintf(activityStr, sizeof(activityStr), "%s AS %02d:%02d", tipo.c_str(), now.hour(), now.minute());
        
        // Linha 4: Fica vazia
        
        char rtcTimestamp[25];
        // Remove o 'Z' para que o JS interprete como horário local, não UTC
        snprintf(rtcTimestamp, sizeof(rtcTimestamp), "%04d-%02d-%02dT%02d:%02d:%02d", now.year(), now.month(), now.day(), now.hour(), now.minute(), now.second());
        sendJsonResponse("activity", "Digital encontrada.", doc["id"], rtcTimestamp);
        
        initialDisplay = false;
        
        // Exibe a mensagem de boas-vindas e aguarda a remoção do dedo
        lcd.clear();
        printCentered(welcomeMsg, 0);
        printCentered(primeiroNome, 1);
        printCentered(activityStr, 2);

        // Espera o dedo ser fisicamente removido
        while (digitalRead(R307_TOUCH_PIN) == LOW) {
          delay(50);
        }
        
        // Mantém a mensagem de boas-vindas por 1.5 segundos
        delay(1500); 

        // Redesenha a tela padrão e libera o estado
        initialDisplay = false;
        displayDefaultScreen();
        currentState = IDLE; // Libera para a próxima leitura
        lastReadTime = millis(); // Inicia o cooldown para a próxima leitura

      } else if (command == "SET_BUZZER") {
        buzzerEnabled = doc["enabled"];
        // Opcional: enviar uma confirmação de volta
        // sendJsonResponse("success", "Buzzer state updated");
      } else if (command == "DELETE_ID") {
        deleteFingerprint(doc["id"]);
      } else if (command == "SET_TIME") {
        DateTime dt(
          doc["year"], doc["month"], doc["day"],
          doc["hour"], doc["minute"], doc["second"]
        );
        rtc.adjust(dt);
        // Opcional: enviar confirmação
        sendJsonResponse("success", "RTC time updated.");
      }
      serialInputBuffer = ""; // Limpa o buffer após processar a linha
    }
  }
}

// --- Implementação das Funções ---

void printCentered(String text, int row) {
  text.toUpperCase();
  int startCol = (LCD_COLS - text.length()) / 2;
  if (startCol < 0) startCol = 0;
  lcd.setCursor(startCol, row);
  lcd.print(text);
}

void beep(bool success) {
  if (!buzzerEnabled) return;
  if (success) {
    tone(BUZZER_PIN, 1000, 100);
  } else {
    tone(BUZZER_PIN, 200, 500);
  }
}


void displayMessage(const String& line1, const String& line2, const String& line3, const String& line4, int delay_ms, bool error) {
    if (error) beep(false);
    
    lcd.clear();
    if (line1.length() > 0) printCentered(line1, 0);
    if (line2.length() > 0) printCentered(line2, 1);
    if (line3.length() > 0) printCentered(line3, 2);
    if (line4.length() > 0) printCentered(line4, 3);
    
    if (delay_ms > 0) {
      delay(delay_ms);
    }
    initialDisplay = false; // Força a limpeza na próxima chamada de displayDefaultScreen
}

void displayDefaultScreen() {
  if (!initialDisplay) {
    lcd.clear();
    printCentered("NPJ | CESUPA", 0);
    initialDisplay = true;
  }
  DateTime now = rtc.now(); // Não precisa mais de ajuste
  char timeStr[9];
  snprintf(timeStr, sizeof(timeStr), "%02d:%02d:%02d", now.hour(), now.minute(), now.second());
  printCentered(timeStr, 2);
}

void sendJsonResponse(const String& status, const String& message, int id, const String& timestamp) {
  JsonDocument doc;
  doc["status"] = status;
  doc["message"] = message;
  if (id != -1) {
    doc["id"] = id;
  }
  if (timestamp != "") {
    doc["timestamp"] = timestamp;
  }
  serializeJson(doc, Serial);
  Serial.println(); // Envia uma nova linha para delimitar a mensagem JSON
}

void requestUserData(int id) {
  JsonDocument doc;
  doc["command"] = "GET_USER_DATA";
  doc["id"] = id;
  serializeJson(doc, Serial);
  Serial.println();
}

void enrollFingerprint(uint16_t id) {
  // --- Passo 1: Obter a primeira imagem ---
  displayMessage("COLOQUE O DEDO", "NO CENTRO DO SENSOR");
  while (finger.getImage() != FINGERPRINT_OK);
  if (finger.image2Tz(1) != FINGERPRINT_OK) {
    displayMessage("ERRO AO CAPTURAR", "IMAGEM 1", "", "", 1000, true);
    sendJsonResponse("error", "Erro ao processar imagem 1.");
    return;
  }
  
  displayMessage("REMOVA O DEDO");
  delay(1500);
  while (finger.getImage() != FINGERPRINT_NOFINGER);

  // --- Passo 2: Obter a segunda imagem em um ângulo diferente ---
  displayMessage("COLOQUE O MESMO DEDO", "EM UM ANGULO", "UM POUCO DIFERENTE");
  while (finger.getImage() != FINGERPRINT_OK);
  if (finger.image2Tz(2) != FINGERPRINT_OK) {
    displayMessage("ERRO AO CAPTURAR", "IMAGEM 2", "", "", 1000, true);
    sendJsonResponse("error", "Erro ao processar imagem 2.");
    return;
  }

  // --- Passo 3: Criar o modelo ---
  if (finger.createModel() != FINGERPRINT_OK) {
    displayMessage("DIGITAIS NAO CONFEREM", "TENTE NOVAMENTE", "", "", 1500, true);
    sendJsonResponse("error", "As digitais não conferem.");
    return;
  }
  
  // --- Passo 4: Armazenar o modelo ---
  if (finger.storeModel(id) != FINGERPRINT_OK) {
    displayMessage("ERRO AO SALVAR", "A DIGITAL", "", "", 1000, true);
    sendJsonResponse("error", "Erro ao armazenar a digital.");
    return;
  }

  // --- Passo 5: Verificação final de armazenamento ---
  displayMessage("VERIFICANDO...", "SALVAMENTO");
  if (finger.loadModel(id) != FINGERPRINT_OK) {
    displayMessage("ERRO FATAL", "NAO FOI POSSIVEL", "SALVAR A DIGITAL", "", 1500, true);
    sendJsonResponse("error", "Erro fatal: não foi possível salvar a digital no sensor.");
    return;
  }
  
  displayMessage("CADASTRADO COM", "SUCESSO!", "", "", 1500);
  sendJsonResponse("success", "Digital cadastrada e verificada com sucesso!", id);
}

void verifyFingerprint() {
  if (finger.getImage() != FINGERPRINT_OK) {
    currentState = IDLE; // Libera em caso de falha
    return;
  }
  if (finger.image2Tz() != FINGERPRINT_OK) {
    currentState = IDLE; // Libera em caso de falha
    return;
  }
  
  if (finger.fingerSearch() != FINGERPRINT_OK) {
    sendJsonResponse("error", "Digital não reconhecida.");
    displayMessage("DIGITAL NAO", "RECONHECIDA.", "TENTE", "", 1000, true);
    
    // Espera o dedo ser removido para evitar re-leitura imediata da mensagem de erro
    while (digitalRead(R307_TOUCH_PIN) == LOW) {
      delay(50);
    }

    currentState = IDLE;
    lastReadTime = millis(); // Inicia o cooldown mesmo em caso de falha
    return;
  }
  
  // Digital encontrada, aguarda a resposta do app
  currentState = AWAITING_RESPONSE;
  requestUserData(finger.fingerID);
}

void deleteFingerprint(uint16_t id) {
  displayMessage("EXCLUINDO DIGITAL", "AGUARDE...", "", "", 500);
  uint8_t result = finger.deleteModel(id);
  if (result == FINGERPRINT_OK) {
    displayMessage("DIGITAL EXCLUIDA!", "", "", "", 1000);
    sendJsonResponse("success", "Digital excluida com sucesso.", id);
  } else {
    String errorMsg;
    switch (result) {
      case FINGERPRINT_PACKETRECIEVEERR:
        errorMsg = "ERRO COMUNICACAO";
        break;
      case FINGERPRINT_DELETEFAIL:
        errorMsg = "FALHA AO EXCLUIR";
        break;
      default:
        errorMsg = "ERRO DESCONHECIDO";
        break;
    }
    displayMessage("ERRO AO EXCLUIR", errorMsg, "", "", 1000, true);
    sendJsonResponse("error", "Erro ao excluir digital: " + errorMsg, id);
  }
}
```
</details>

### 8.2. Aplicação Desktop (main.js)
<details>
<summary>Clique para expandir o código principal da aplicação desktop</summary>

```javascript
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const xlsx = require('xlsx');
const path = require('path');
const db = require('./database');
const http = require('http');
const os = require('os');


let mainWindow = null;
let port = null;
let parser = null;
let csvExportPath = null; // Variável para armazenar o caminho da exportação
let studentDataPath = null; // Variável para armazenar o caminho da planilha de dados
const webPort = 8080; // Porta para o servidor web

// Variável para gerenciar a Promise de cadastro
let enrollmentHandler = null;



function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const interfaceName in interfaces) {
    const iface = interfaces[interfaceName];
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return 'localhost';
}

function startWebServer() {
  const server = http.createServer((req, res) => {
    let filePath = path.join(__dirname, req.url);
    if (filePath.endsWith('/')) {
      filePath = path.join(filePath, 'index.html');
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        return;
      }

      let contentType = 'text/html';
      if (filePath.endsWith('.js')) {
        contentType = 'application/javascript';
      } else if (filePath.endsWith('.css')) {
        contentType = 'text/css';
      } else if (filePath.endsWith('.json')) {
        contentType = 'application/json';
      } else if (filePath.endsWith('.png')) {
        contentType = 'image/png';
      } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
        contentType = 'image/jpeg';
      }

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });

  server.listen(webPort, '0.0.0.0', () => { // Escuta em todas as interfaces
    const ipAddress = getLocalIpAddress(); // Ainda útil para informar o IP local
    console.log(`Servidor web iniciado em http://${ipAddress}:${webPort} (acessível de outros dispositivos via ${ipAddress}:${webPort})`);
    // Envia o endereço para o processo de renderização ou loga para o usuário
    if (mainWindow) {
      mainWindow.webContents.send('web-server-started', { ipAddress, port: webPort });
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  startWebServer();
});

// --- Handlers de Banco de Dados e Serial ---
ipcMain.on('set-csv-path', (event, path) => {
  csvExportPath = path;
});

ipcMain.handle('select-student-data-path', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }]
  });
  if (canceled || filePaths.length === 0) {
    return null;
  }
  studentDataPath = filePaths[0];
  return studentDataPath;
});

ipcMain.handle('search-student-data', (event, { query, type }) => {
  if (!studentDataPath) {
    return null;
  }
  try {
    const workbook = xlsx.readFile(studentDataPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    if (data.length === 0) {
      return null;
    }

    const searchKey = type === 'matricula' ? 'matricula' : 'aluno';
    
    const result = data.find(row => {
      // Find the correct key in the row, case-insensitively
      const rowKey = Object.keys(row).find(k => k.toLowerCase().trim() === searchKey);
      if (rowKey) {
        const cellValue = row[rowKey];
        if (cellValue) {
          // Trim and compare case-insensitively
          return String(cellValue).trim().toLowerCase() === String(query).trim().toLowerCase();
        }
      }
      return false;
    });

    if (result) {
      // Normalize keys to lowercase so the frontend can access them consistently
      const normalizedResult = {};
      for (const key in result) {
        normalizedResult[key.toLowerCase().trim()] = result[key];
      }
      return normalizedResult;
    }

    return null;
  } catch (error) {
    console.error("Erro ao ler a planilha:", error);
    return { error: error.message };
  }
});

ipcMain.handle('get-users', () => db.getUsers());
ipcMain.handle('get-activities', () => db.getActivities());
ipcMain.handle('listar-portas', () => SerialPort.list());
ipcMain.handle('update-user', (event, { id, data }) => {
  const updatedUser = db.updateUser(id, data);
  if (updatedUser) {
    mainWindow.webContents.send('user-updated', updatedUser);
  }
  return updatedUser;
});
ipcMain.handle('clear-all-activities', () => {
  const result = db.clearAllActivities();
  mainWindow.webContents.send('activities-cleared'); // Notifica o front-end
  return result;
});

ipcMain.handle('remove-duplicates', () => {
  const result = db.removeDuplicates();
  mainWindow.webContents.send('users-updated'); // Usa um evento genérico para recarregar a lista
  return result;
});

ipcMain.handle('sync-time', () => {
  if (!port || !port.isOpen) {
    throw new Error('A porta serial não está aberta.');
  }
  const now = new Date();
  const command = JSON.stringify({
    command: 'SET_TIME',
    year: now.getFullYear(),
    month: now.getMonth() + 1, // JS months are 0-11
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes(),
    second: now.getSeconds()
  });
  port.write(command + '
');
  return { status: 'success' };
});

ipcMain.handle('select-csv-path', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (canceled) {
    return null;
  } else {
    csvExportPath = filePaths[0]; // Armazena o caminho
    return filePaths[0];
  }
});

async function exportAllActivitiesToExcel() {
  if (!csvExportPath) {
    console.log('Caminho de exportação de Excel não configurado. Exportação automática pulada.');
    return;
  }

  const activities = db.getActivities();
  const users = db.getUsers();
  const userMap = new Map(users.map(u => [u.id, u]));

  const dailyRecords = {};

  activities.forEach(a => {
    const date = new Date(a.timestamp).toLocaleDateString('pt-BR');
    const key = `${a.userId}_${date}`;

    if (!dailyRecords[key]) {
      const user = userMap.get(a.userId);
      dailyRecords[key] = {
        cabine: user ? user.cabine : 'N/A',
        userId: a.userId,
        userName: a.userName,
        userTurma: a.userTurma,
        date: date,
        entrada: null,
        saida: null,
      };
    }

    const record = dailyRecords[key];
    const activityTime = new Date(a.timestamp);

    if (a.type === 'Entrada') {
      if (!record.entrada || activityTime < record.entrada) {
        record.entrada = activityTime;
      }
    } else if (a.type === 'SAIDA') {
      if (!record.saida || activityTime > record.saida) {
        record.saida = activityTime;
      }
    }
  });

  const excelPath = path.join(csvExportPath, 'relatorio_atividades.xlsx');
  const header = ['Cabine', 'Nome', 'Turma', 'Data', 'Entrada', 'Saída'];
  const rows = Object.values(dailyRecords).map(r => ({
    Cabine: r.cabine || 'N/A',
    Nome: r.userName || 'N/A',
    Turma: r.userTurma || 'N/A',
    Data: r.date,
    Entrada: r.entrada ? r.entrada.toLocaleTimeString('pt-BR') : '---',
    Saída: r.saida ? r.saida.toLocaleTimeString('pt-BR') : '---',
  }));

  const worksheet = xlsx.utils.json_to_sheet(rows, { header });
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Atividades');
  xlsx.writeFile(workbook, excelPath);
}

ipcMain.handle('export-activities-excel', async (event, filters = {}) => {
  let activities = db.getActivities();

  // Aplica filtros
  if (filters.turma) {
    activities = activities.filter(a => a.userTurma === filters.turma);
  }
  if (filters.mes) {
    activities = activities.filter(a => {
      const activityDate = new Date(a.timestamp);
      const filterDate = new Date(filters.mes);
      return activityDate.getMonth() === filterDate.getMonth() && activityDate.getFullYear() === filterDate.getFullYear();
    });
  }

  if (activities.length === 0) {
    return { success: false, error: 'Nenhuma atividade para exportar.' };
  }

  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Salvar Relatório de Atividades',
    defaultPath: `atividades-${new Date().toISOString().slice(0, 10)}.xlsx`,
    filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
  });

  if (canceled) {
    return { success: false, canceled: true };
  }

  try {
    const users = db.getUsers();
    const userMap = new Map(users.map(u => [u.id, u]));
    const dailyRecords = {};

    activities.forEach(a => {
      const date = new Date(a.timestamp).toLocaleDateString('pt-BR');
      const key = `${a.userId}_${date}`;

      if (!dailyRecords[key]) {
        const user = userMap.get(a.userId);
        dailyRecords[key] = {
          cabine: user ? user.cabine : 'N/A',
          userName: a.userName,
          userTurma: a.userTurma,
          date: date,
          entrada: null,
          saida: null,
        };
      }

      const record = dailyRecords[key];
      const activityTime = new Date(a.timestamp);

      if (a.type === 'Entrada') {
        if (!record.entrada || activityTime < record.entrada) {
          record.entrada = activityTime;
        }
      } else if (a.type === 'SAIDA') {
        if (!record.saida || activityTime > record.saida) {
          record.saida = activityTime;
        }
      }
    });

    const header = ['Cabine', 'Nome', 'Turma', 'Data', 'Entrada', 'Saída'];
    const rows = Object.values(dailyRecords).map(r => ({
        Cabine: r.cabine || 'N/A',
        Nome: r.userName || 'N/A',
        Turma: r.userTurma || 'N/A',
        Data: r.date,
        Entrada: r.entrada ? r.entrada.toLocaleTimeString('pt-BR') : '---',
        Saída: r.saida ? r.saida.toLocaleTimeString('pt-BR') : '---',
    }));

    const worksheet = xlsx.utils.json_to_sheet(rows, { header });
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Atividades');
    xlsx.writeFile(workbook, filePath);
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-user', async (event, userId) => {
  if (!port || !port.isOpen) {
    throw new Error('A porta serial não está aberta para exclusão.');
  }

  const comando = JSON.stringify({ command: 'DELETE_ID', id: userId });

  return new Promise((resolve, reject) => {
    const onData = (line) => {
      try {
        const resposta = JSON.parse(line);
        if (resposta.status === 'success' && resposta.id === userId) {
          parser.removeListener('data', onData);
          if (db.deleteUser(userId)) {
            mainWindow.webContents.send('user-deleted', userId); // Notifica o front-end
            resolve({ status: 'success', message: `Usuário e digital com ID ${userId} excluídos com sucesso!` });
          } else {
            reject(new Error('Erro ao remover usuário do banco de dados local.'));
          }
        } else if (resposta.status === 'error' && resposta.id === userId) {
          parser.removeListener('data', onData);
          reject(new Error(`Erro ao excluir digital do sensor: ${resposta.message}`));
        }
      } catch (e) {
        // Ignora JSON inválido
      }
    };

    parser.once('data', onData); // Usa .once() para remover o listener automaticamente após a primeira resposta

    port.write(comando + '
', (err) => {
      if (err) {
        parser.removeListener('data', onData); // Remove o listener em caso de erro de escrita
        return reject(err);
      }
    });
  });
});

ipcMain.handle('set-buzzer-state', (event, enabled) => {
  if (port && port.isOpen) {
    const comando = JSON.stringify({ command: 'SET_BUZZER', enabled: enabled });
    port.write(comando + '
', (err) => {
      if (err) {
        console.error('Erro ao enviar comando do buzzer:', err);
      }
    });
  }
});

ipcMain.handle('setar-porta-serial', async (event, path) => {
  return new Promise((resolve, reject) => {
    if (port && port.isOpen) {
      port.close((err) => {
        if (err) console.error('Falha ao fechar a porta antiga:', err);
        port = null;
        parser = null;
        conectar(path, resolve, reject);
      });
    } else {
      conectar(path, resolve, reject);
    }
  });
});



function conectar(serialPath, resolve, reject) {
  if (!serialPath) return resolve(true);

  port = new SerialPort({ path: serialPath, baudRate: 115200, autoOpen: false });
  parser = port.pipe(new ReadlineParser({ delimiter: '
' }));

  port.on('open', () => {
    console.log(`Porta serial ${serialPath} aberta.`);
    // Notifica o front-end que a porta está pronta
    if (mainWindow) {
      mainWindow.webContents.send('serial-port-connected');
    }
    resolve(true);
  });

  port.on('error', (err) => {
    console.error(`Erro na porta serial ${serialPath}:`, err);
    reject(err);
  });

  parser.on('data', (line) => {
    console.log('DADO BRUTO RECEBIDO DA SERIAL:', line);
    try {
      const data = JSON.parse(line);

      // Se um processo de cadastro está ativo, ele tem prioridade
      if (enrollmentHandler) {
        mainWindow.webContents.send('biometria-status', data); // Encaminha todos os status para o front

        if (data.status === 'success') {
          clearTimeout(enrollmentHandler.timeout);
          enrollmentHandler.resolve(data);
          enrollmentHandler = null; // Limpa o handler
        } else if (data.status === 'error') {
          clearTimeout(enrollmentHandler.timeout);
          enrollmentHandler.reject(new Error(data.message));
          enrollmentHandler = null; // Limpa o handler
        }
        // Ignora status 'info' e continua esperando por 'success' ou 'error'
        return; 
      }

      // Lógica normal de operação (fora do cadastro)
      if (data.command === 'GET_USER_DATA' && data.id) {
        const user = db.getUserById(data.id);
        if (user) {
          const lastActivity = db.getActivities()
            .filter(a => a.userId === user.id)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
            .pop();
          const type = (!lastActivity || lastActivity.type === 'SAIDA') ? 'Entrada' : 'SAIDA';

          const response = {
            command: 'USER_DATA_RESPONSE',
            id: user.id,
            nome: user.nome,
            genero: user.genero,
            type: type
          };
          port.write(JSON.stringify(response) + '
');
        }
      } else if (data.status === 'activity' && data.id && data.timestamp) {
        // O timestamp do dispositivo é uma string de data/hora local (ex: "2025-08-11T14:28:00").
        // Para evitar problemas de fuso horário, convertemos essa string para um objeto Date,
        // que o JS interpreta como hora local, e então a salvamos no formato padrão UTC (ISO string).
        const localDate = new Date(data.timestamp);
        const utcTimestamp = localDate.toISOString();

        const newActivity = db.addActivity({ userId: data.id, timestamp: utcTimestamp });
        if (newActivity) {
          mainWindow.webContents.send('nova-atividade', newActivity);
          exportAllActivitiesToExcel().catch(err => console.error("Erro na exportação automática de Excel:", err));
        }
      }
    } catch (e) {
      // Ignora linhas que não são JSON válido, pode ser log de debug do ESP
      // console.warn('Linha não-JSON recebida da serial:', line);
    }
  });

  port.open((err) => {
    if (err) {
      console.error(`Falha ao abrir a porta ${serialPath}:`, err.message);
      reject(err);
    }
  });
}

// Novo handler para centralizar a lógica de cadastro
ipcMain.handle('add-user-and-enroll', async (event, { userData }) => {
  if (!port || !port.isOpen) {
    throw new Error('A porta serial não está aberta.');
  }
  if (enrollmentHandler) {
    throw new Error('Um processo de cadastro já está em andamento.');
  }

  const id = db.getNextUserId();
  const comando = JSON.stringify({ command: 'ENROLL', id: id });

  // Retorna uma Promise que será resolvida/rejeitada pelo listener de dados principal
  return new Promise((resolve, reject) => {
    // Armazena as funções resolve e reject para serem usadas pelo listener
    const timeout = setTimeout(() => {
      if (enrollmentHandler) {
        enrollmentHandler.reject(new Error('Tempo de cadastro esgotado. O dispositivo não respondeu.'));
        enrollmentHandler = null;
      }
    }, 30000); // Timeout de 30 segundos

    enrollmentHandler = { resolve, reject, timeout };

    port.write(comando + '
', (err) => {
      if (err) {
        clearTimeout(timeout);
        enrollmentHandler = null; // Limpa em caso de erro de escrita
        return reject(err);
      }
      console.log('ENVIANDO PARA SERIAL:', comando);
      
      // Envia um status inicial para o front-end
      mainWindow.webContents.send('biometria-status', {
        status: 'info',
        message: `Iniciando cadastro para ID ${id}. Siga as instruções no sensor...`
      });
    });
  }).then(successData => {
    const newUser = { id: successData.id, ...userData };
    db.addUser(newUser);
    return { status: 'success', user: newUser };
  });
});
```
</details>

### 8.3. Lógica do Frontend (script.js)
<details>
<summary>Clique para expandir o código do frontend</summary>

```javascript
document.addEventListener('DOMContentLoaded', () => {
  // --- Funcionalidade da Navegação Lateral ---
  const navItems = document.querySelectorAll('#sidebar-nav .nav-item');
  const dashboardSection = document.getElementById('dashboard-section');
  const settingsSection = document.getElementById('settings-section');
  const usuariosSection = document.getElementById('usuarios-section');
  const atividadesSection = document.getElementById('atividades-section');
  const ajudaSection = document.getElementById('ajuda-section');
  const dailySummarySection = document.getElementById('daily-summary-section'); // Nova referência

  navItems.forEach((item, idx) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      // Remove 'active' de todos os itens de navegação
      navItems.forEach((el) => el.classList.remove('active', 'bg-[#293542]'));
      // Adiciona 'active' ao item clicado
      item.classList.add('active', 'bg-[#293542]');
      
      // Esconde todas as seções e mostra a relevante
      dashboardSection.classList.add('hidden');
      settingsSection.classList.add('hidden');
      usuariosSection.classList.add('hidden');
      atividadesSection.classList.add('hidden');
      ajudaSection.classList.add('hidden');
      dailySummarySection.classList.add('hidden'); // Esconde a nova seção por padrão

      if (item.textContent.includes('Configurações')) {
        settingsSection.classList.remove('hidden');
        listarPortasSeriais();
      } else if (item.textContent.includes('Usuários')) {
        usuariosSection.classList.remove('hidden');
        renderizarTabelaUsuarios();
      } else if (item.textContent.includes('Atividade')) {
        atividadesSection.classList.remove('hidden');
        renderizarTabelaAtividades();
      } else if (item.textContent.includes('Ajuda')) {
        ajudaSection.classList.remove('hidden');
      } else { // Início (Dashboard)
        dashboardSection.classList.remove('hidden');
      }
    });
  });

  // --- Funcionalidade do Calendário (4x3 fixo) ---
  const monthYearEl = document.getElementById('month-year');
  const calendarGrid = document.getElementById('calendar-grid');
  const prevMonthBtn = document.getElementById('prev-month');
  const nextMonthBtn = document.getElementById('next-month');
  let currentDate = new Date();

  let selectedDay = null;
  let selectedMonth = null;
  let selectedYear = null;

  const dailyActivitiesTitle = document.getElementById('daily-activities-title');
  const dailyActivitiesContainer = document.getElementById('daily-activities-container');

  const renderCalendar = () => {
    calendarGrid.innerHTML = '';
    const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
    weekDays.forEach(dia => {
      const th = document.createElement('div');
      th.className = 'text-white text-center font-bold';
      th.textContent = dia;
      calendarGrid.appendChild(th);
    });
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    monthYearEl.textContent = `${currentDate.toLocaleString('pt-BR', { month: 'long' })} ${year}`;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) {
      calendarGrid.appendChild(document.createElement('div'));
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dayButton = document.createElement('button');
      dayButton.className = 'calendar-day h-12 w-12 text-white text-sm font-medium leading-normal';
      dayButton.innerHTML = `<div class="flex size-full items-center justify-center rounded-full">${day}</div>`;
      
      const isToday = (day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear());
      let isActiveSelection = (selectedDay === day && selectedMonth === month && selectedYear === year);

      if (selectedDay === null && isToday) { // Seleciona o dia atual por padrão se nenhuma seleção prévia
        selectedDay = day;
        selectedMonth = month;
        selectedYear = year;
        isActiveSelection = true;
      }

      if (isActiveSelection) {
        dayButton.classList.add('active');
      }

      dayButton.addEventListener('click', () => {
        const currentActive = document.querySelector('.calendar-day.active');
        if (currentActive) currentActive.classList.remove('active');
        dayButton.classList.add('active');
        selectedDay = day;
        selectedMonth = month;
        selectedYear = year;
        renderizarAtividadesPorData(new Date(selectedYear, selectedMonth, selectedDay)); // Renderiza atividades para a data clicada
      });
      calendarGrid.appendChild(dayButton);
    }
  };
  prevMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });
  nextMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  });
  renderCalendar();

  // --- Cadastro de Aluno: abrir/fechar modal ---
  const btnAddUser = document.getElementById('add-user-btn');
  const modalCadastro = document.getElementById('cadastro-aluno');
  const btnFecharCadastro = document.getElementById('fechar-cadastro');
  const formAluno = document.getElementById('form-aluno');
  const statusDiv = document.getElementById('status-biometria');
  const btnSalvar = formAluno.querySelector('button[type="submit"]');
  const modalTitle = document.getElementById('modal-title');
  const alunoIdInput = document.getElementById('aluno-id');
  const deleteUserModalBtn = document.getElementById('delete-user-modal-btn');

  // --- Modal de Alerta/Confirmação Customizado ---
  const customAlertModal = document.getElementById('custom-alert-modal');
  const customAlertTitle = document.getElementById('custom-alert-title');
  const customAlertMessage = document.getElementById('custom-alert-message');
  const customAlertOkBtn = document.getElementById('custom-alert-ok-btn');
  const customAlertCancelBtn = document.getElementById('custom-alert-cancel-btn');

  function showCustomAlert(title, message) {
    return new Promise(resolve => {
      customAlertTitle.textContent = title;
      customAlertMessage.textContent = message;
      customAlertCancelBtn.classList.add('hidden'); // Esconde o botão Cancelar para alertas
      customAlertModal.classList.remove('hidden');

      customAlertOkBtn.onclick = () => {
        customAlertModal.classList.add('hidden');
        resolve(true);
      };
    });
  }

  function showCustomConfirm(title, message, isInput = false) {
    return new Promise(resolve => {
      customAlertTitle.textContent = title;
      customAlertMessage.innerHTML = ''; // Limpa o conteúdo

      const messageSpan = document.createElement('p');
      messageSpan.textContent = message;
      customAlertMessage.appendChild(messageSpan);

      if (isInput) {
        const inputField = document.createElement('input');
        inputField.type = isInput === 'text' ? 'text' : 'password';
        inputField.id = 'password-input';
        inputField.className = 'form-input rounded-xl bg-[#223549] text-white h-10 px-4 mt-2 w-full';
        inputField.placeholder = isInput === 'text' ? 'Digite para confirmar' : 'Digite a senha';
        customAlertMessage.appendChild(inputField);
        setTimeout(() => inputField.focus(), 100);
      }

      customAlertCancelBtn.classList.remove('hidden');
      customAlertModal.classList.remove('hidden');

      const okHandler = () => {
        const inputValue = isInput ? document.getElementById('password-input').value : true;
        resolve(inputValue);
        cleanup();
      };

      const cancelHandler = () => {
        resolve(false);
        cleanup();
      };

      const cleanup = () => {
        customAlertModal.classList.add('hidden');
        customAlertOkBtn.removeEventListener('click', okHandler);
        customAlertCancelBtn.removeEventListener('click', cancelHandler);
      };

      customAlertOkBtn.addEventListener('click', okHandler);
      customAlertCancelBtn.addEventListener('click', cancelHandler);
    });
  }

  async function abrirModalEdicao(userId) {
    const users = await ipcRenderer.invoke('get-users');
    const user = users.find(u => u.id === userId);
    if (!user) {
      await showCustomAlert('Erro', 'Usuário não encontrado!');
      return;
    }

    formAluno.reset();
    alunoIdInput.value = user.id;
    formAluno.nome.value = user.nome || '';
    formAluno.matricula.value = user.matricula || '';
    formAluno.turma.value = user.turma || '';
    formAluno.email.value = user.email || '';
    formAluno.genero.value = user.genero || '';
    formAluno.cabine.value = user.cabine || '';
    
    // Marca os checkboxes dos dias da semana
    const diasSemanaCheckboxes = formAluno.querySelectorAll('input[name="dias-semana"]');
    diasSemanaCheckboxes.forEach(checkbox => {
      checkbox.checked = user.diasSemana && user.diasSemana.includes(parseInt(checkbox.value));
    });

    modalTitle.textContent = 'Editar Aluno';
    statusDiv.textContent = ''; // Removido o aviso
    statusDiv.className = ''; // Limpa a classe para remover estilo de aviso
    btnSalvar.disabled = false; // Habilita o botão para salvar
    deleteUserModalBtn.classList.remove('hidden'); // Mostra o botão de excluir
    
    modalCadastro.classList.remove('hidden');
  }

  function abrirModalCadastro() {
    if (modalCadastro) {
      formAluno.reset();
      alunoIdInput.value = ''; // Limpa o ID para garantir que está em modo de adição
      modalTitle.textContent = 'Adicionar Aluno';
      statusDiv.textContent = 'Preencha os dados do aluno e siga as instruções para o cadastro da digital.';
      statusDiv.className = 'text-white text-base font-medium mb-2';
      btnSalvar.disabled = false;
      deleteUserModalBtn.classList.add('hidden'); // Esconde o botão de excluir
      modalCadastro.classList.remove('hidden');
    }
  }

  function fecharModalCadastro() {
    if (modalCadastro) modalCadastro.classList.add('hidden');
  }

  if (btnAddUser) btnAddUser.addEventListener('click', abrirModalCadastro);
  if (btnFecharCadastro) btnFecharCadastro.addEventListener('click', fecharModalCadastro);
  
  // Lógica de busca e preenchimento automático no modal de cadastro
  const searchByNameBtn = document.getElementById('search-by-name');
  const searchByMatriculaBtn = document.getElementById('search-by-matricula');

  async function searchAndFill(type) {
    const query = formAluno[type].value;
    if (!query) {
        showCustomAlert('Aviso', `Por favor, digite um(a) ${type} para buscar.`);
        return;
    }
    const result = await ipcRenderer.invoke('search-student-data', { query, type });

    if (result && result.error) {
        showCustomAlert('Erro', `Erro ao ler a planilha: ${result.error}`);
    } else if (result) {
        formAluno.nome.value = result.aluno || '';
        formAluno.matricula.value = result.matricula || '';
        formAluno.turma.value = result.turma || '';
        formAluno.email.value = result.email || '';
        formAluno.genero.value = result.genero || '';
        formAluno.cabine.value = result.cabine || '';
        showCustomAlert('Sucesso', 'Dados do aluno preenchidos.');
    } else {
        showCustomAlert('Não encontrado', 'Nenhum aluno encontrado com os dados fornecidos. Prossiga com o cadastro manual.');
    }
  }

  searchByNameBtn.addEventListener('click', () => searchAndFill('nome'));
  searchByMatriculaBtn.addEventListener('click', () => searchAndFill('matricula'));

  formAluno.addEventListener('submit', async (e) => {
    e.preventDefault();
    btnSalvar.disabled = true;
    
    const formData = new FormData(formAluno);
    const id = formData.get('id');
    const diasSemana = Array.from(formAluno.querySelectorAll('input[name="dias-semana"]:checked')).map(cb => cb.value);
    
    const userData = {
      nome: formData.get('nome'),
      matricula: formData.get('matricula'),
      turma: formData.get('turma'),
      email: formData.get('email'),
      genero: formData.get('genero'),
      cabine: formData.get('cabine'),
      diasSemana,
    };

    if (id) {
      // --- MODO EDIÇÃO ---
      try {
        await ipcRenderer.invoke('update-user', { id, data: userData });
        await showCustomAlert('Sucesso!', 'Usuário atualizado com sucesso!');
        fecharModalCadastro();
        renderizarTabelaUsuarios();
      } catch (error) {
        await showCustomAlert('Erro', `Erro ao atualizar: ${error.message}`);
        btnSalvar.disabled = false;
      }
    } else {
      // --- MODO ADIÇÃO ---
      statusDiv.textContent = 'Iniciando processo de cadastro...';
      try {
        const result = await ipcRenderer.invoke('add-user-and-enroll', { userData });
        if (result.error) {
          await showCustomAlert('Erro', result.error);
          btnSalvar.disabled = false;
        } else if (result.status === 'success') {
            // A mensagem de sucesso já é enviada pelo listener 'biometria-status'
            // Apenas fechamos o modal e atualizamos a tabela.
            fecharModalCadastro();
            renderizarTabelaUsuarios(); // Atualiza a tabela principal
            await showCustomAlert('Sucesso!', `Usuário ${result.user.nome} cadastrado com ID ${result.user.id}.`);
        }
      } catch (error) {
        // O erro já é exibido pelo listener 'biometria-status'
        // Apenas reabilitamos o botão
        btnSalvar.disabled = false;
      }
    }
  });

  // Listener para o botão de exclusão dentro do modal
  if (deleteUserModalBtn) {
    deleteUserModalBtn.addEventListener('click', async () => {
      const userId = parseInt(alunoIdInput.value, 10);
      const confirmed = await showCustomConfirm('Confirmação', `Tem certeza que deseja excluir o usuário com ID ${userId} do banco de dados e do sensor?`);
      if (confirmed) {
        try {
          const result = await ipcRenderer.invoke('delete-user', userId);
          await showCustomAlert('Sucesso!', result.message);
          fecharModalCadastro();
          renderizarTabelaUsuarios();
        } catch (error) {
          await showCustomAlert('Erro', `Erro ao excluir usuário: ${error.message}`);
        }
      }
    });
  }

  // --- Comunicação com Main Process ---
  const { ipcRenderer } = require('electron');

  // Controle do Buzzer
  const toggleBuzzer = document.getElementById('toggle-buzzer');

  function setBuzzerState(enabled) {
    ipcRenderer.invoke('set-buzzer-state', enabled);
    localStorage.setItem('buzzerEnabled', enabled);
    toggleBuzzer.checked = enabled;
  }

  if (toggleBuzzer) {
    toggleBuzzer.addEventListener('change', () => {
      setBuzzerState(toggleBuzzer.checked);
    });

    // Carrega o estado salvo ao iniciar
    const savedBuzzerState = localStorage.getItem('buzzerEnabled') !== 'false'; // Padrão é true
    toggleBuzzer.checked = savedBuzzerState;
    // Não envia o estado aqui, espera a conexão serial
  }

  // Listener para quando a porta serial é conectada com sucesso
  ipcRenderer.on('serial-port-connected', () => {
    // Envia o estado atual do buzzer para o dispositivo assim que ele se conecta
    if (toggleBuzzer) {
      setBuzzerState(toggleBuzzer.checked);
    }
  });

  // Listener para atualizações em tempo real
  ipcRenderer.on('nova-atividade', (event, data) => {
    // Atualiza as seções de atividade e dashboard
    renderizarTabelaAtividades();
    renderizarAtividadesRecentes();
    renderizarAtividadesPorData(new Date(selectedYear, selectedMonth, selectedDay));
    atualizarCardsDashboard();
  });

  ipcRenderer.on('user-added', (event, data) => {
    // Atualiza a tabela de usuários e o dashboard
    renderizarTabelaUsuarios();
    atualizarCardsDashboard();
  });

  ipcRenderer.on('user-updated', (event, data) => {
    // Atualiza a tabela de usuários e o dashboard
    renderizarTabelaUsuarios();
    atualizarCardsDashboard();
  });

  ipcRenderer.on('user-deleted', (event, userId) => {
    // Atualiza a tabela de usuários e o dashboard
    renderizarTabelaUsuarios();
    atualizarCardsDashboard();
  });

  ipcRenderer.on('users-cleared', () => {
    renderizarTabelaUsuarios();
    atualizarCardsDashboard();
  });

  ipcRenderer.on('activities-cleared', () => {
    // Atualiza as seções de atividade e dashboard
    renderizarTabelaAtividades();
    renderizarAtividadesRecentes();
    renderizarAtividadesPorData(new Date(selectedYear, selectedMonth, selectedDay)); // Atualiza o dashboard do dia
    atualizarCardsDashboard();
  });

  // Listener para o fluxo de cadastro
  ipcRenderer.on('biometria-status', (event, data) => {
    if (!statusDiv) return;
    statusDiv.textContent = data.message;
    if (data.status === 'error') {
      statusDiv.className = 'text-red-400 text-base font-bold mb-2';
      btnSalvar.disabled = false;
    } else if (data.status === 'success') {
      statusDiv.className = 'text-green-400 text-base font-bold mb-2';
      // Não fecha o modal automaticamente para sucesso no cadastro biométrico
      // Apenas mostra a mensagem de sucesso e o usuário pode fechar manualmente
    } else {
      statusDiv.className = 'text-white text-base font-medium mb-2';
    }
  });

  // --- Renderização das Tabelas e Listas ---
  async function renderizarAtividadesRecentes() {
    const container = document.getElementById('recent-activities-container');
    if (!container) return;

    const allActivities = await ipcRenderer.invoke('get-activities');
    // Pega as últimas 3 atividades
    const recentActivities = allActivities.slice(-3).reverse();

    container.innerHTML = ''; // Limpa o conteúdo atual

    if (recentActivities.length === 0) {
      container.innerHTML = '<p class="text-[#9badc0] text-base font-normal leading-normal col-span-2 py-3">Nenhuma atividade recente.</p>';
      return;
    }

    recentActivities.forEach((activity, index) => {
      const time = new Date(activity.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const isLast = index === recentActivities.length - 1;

      const activityHtml = `
        <div class="flex flex-col items-center gap-1 ${index === 0 ? 'pt-3' : ''} ${isLast ? 'pb-3' : ''}">
          ${index > 0 ? '<div class="w-[1.5px] bg-[#3b4c5e] h-2"></div>' : ''}
          <div class="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-6" style="background-image: url('https://i.pravatar.cc/24?u=${activity.userId}');"></div>
          ${!isLast ? '<div class="w-[1.5px] bg-[#3b4c5e] h-2 grow"></div>' : ''}
        </div>
        <div class="flex flex-1 flex-col py-3">
          <p class="text-white text-base font-medium leading-normal">${activity.userName} registrou ${activity.type.toLowerCase()}</p>
          <p class="text-[#9badc0] text-base font-normal leading-normal">${time}</p>
        </div>
      `;
      container.innerHTML += activityHtml;
    });
  }

  async function renderizarTabelaAtividades(filters = {}) {
    const tbody = document.getElementById('atividades-tbody');
    let atividades = await ipcRenderer.invoke('get-activities');
    
    // Aplica filtros
    if (filters.turma) {
      atividades = atividades.filter(a => a.userTurma === filters.turma);
    }
    if (filters.mes) {
      atividades = atividades.filter(a => {
        const activityDate = new Date(a.timestamp);
        const filterDate = new Date(filters.mes);
        return activityDate.getMonth() === filterDate.getMonth() && activityDate.getFullYear() === filterDate.getFullYear();
      });
    }

    tbody.innerHTML = '';
    if (!atividades || atividades.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-[#9badc0]">Nenhuma atividade encontrada para os filtros selecionados.</td></tr>';
      return;
    }

    const dailyRecords = {};

    atividades.forEach(a => {
      const date = new Date(a.timestamp).toLocaleDateString('pt-BR');
      const key = `${a.userId}_${date}`;

      if (!dailyRecords[key]) {
        dailyRecords[key] = {
          userName: a.userName,
          userTurma: a.userTurma,
          date: date,
          entrada: null,
          saida: null,
        };
      }

      const record = dailyRecords[key];
      const activityTime = new Date(a.timestamp);

      if (a.type === 'Entrada') {
        if (!record.entrada || activityTime < record.entrada) {
          record.entrada = activityTime;
        }
      } else if (a.type === 'SAIDA') {
        if (!record.saida || activityTime > record.saida) {
          record.saida = activityTime;
        }
      }
    });

    const sortedRecords = Object.values(dailyRecords).sort((a, b) => {
      const dateA = new Date(a.date.split('/').reverse().join('-'));
      const dateB = new Date(b.date.split('/').reverse().join('-'));
      if (dateA > dateB) return -1;
      if (dateA < dateB) return 1;
      return a.userName.localeCompare(b.userName);
    });

    let lastDate = null;
    sortedRecords.forEach(r => {
      if (r.date !== lastDate) {
        const dateHeader = document.createElement('tr');
        dateHeader.innerHTML = `<td colspan="4" class="bg-[#182634] text-white p-2 font-bold">${r.date}</td>`;
        tbody.appendChild(dateHeader);
        lastDate = r.date;
      }

      const tr = document.createElement('tr');
      tr.className = 'border-t border-t-[#314c68]';
      const entradaStr = r.entrada ? r.entrada.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '---';
      const saidaStr = r.saida ? r.saida.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '---';
      tr.innerHTML = `
          <td class="h-[72px] px-4 py-2 text-white text-sm font-normal">${r.userName}</td>
          <td class="h-[72px] px-4 py-2 text-[#9badc0] text-sm font-normal">${r.userTurma}</td>
          <td class="h-[72px] px-4 py-2 text-[#9badc0] text-sm font-normal">${entradaStr}</td>
          <td class="h-[72px] px-4 py-2 text-[#9badc0] text-sm font-normal">${saidaStr}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  let deleteMode = false;

  async function renderizarTabelaUsuarios(filtro = "") {
    const tbody = document.getElementById('usuarios-tbody');
    const alunos = await ipcRenderer.invoke('get-users');
    
    const deleteModeCols = document.querySelectorAll('.delete-mode-col');
    deleteModeCols.forEach(col => col.style.display = deleteMode ? '' : 'none');

    let filteredAlunos = alunos;
    if (filtro) {
      const filtroLower = filtro.toLowerCase();
      filteredAlunos = alunos.filter(aluno =>
        (aluno.nome && aluno.nome.toLowerCase().includes(filtroLower)) ||
        (aluno.matricula && aluno.matricula.toLowerCase().includes(filtroLower)) ||
        (String(aluno.id) && String(aluno.id).includes(filtroLower))
      );
    }
    
    tbody.innerHTML = '';
    if (!filteredAlunos || filteredAlunos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-[#9badc0]">Nenhum aluno cadastrado.</td></tr>';
      return;
    }
    
    const diasNomes = {
      0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb'
    };

    filteredAlunos.forEach(aluno => {
      const tr = document.createElement('tr');
      tr.className = 'border-t border-t-[#314c68]';
      const dias = aluno.diasSemana ? aluno.diasSemana.map(d => diasNomes[d]).join(', ') : 'N/A';
      tr.innerHTML = `
        <td class="h-[72px] px-4 py-2 text-center delete-mode-col" style="display: ${deleteMode ? '' : 'none'};">
          <input type="checkbox" data-id="${aluno.id}" class="form-checkbox rounded bg-[#223549] text-blue-500 delete-checkbox">
        </td>
        <td class="h-[72px] px-4 py-2 text-white text-sm font-normal text-center border-r border-[#314c68]">${aluno.nome}</td>
        <td class="h-[72px] px-4 py-2 text-[#9badc0] text-sm font-normal text-center border-r border-[#314c68]">${aluno.matricula}</td>
        <td class="h-[72px] px-4 py-2 text-white text-sm font-normal text-center border-r border-[#314c68]">${aluno.turma}</td>
        <td class="h-[72px] px-4 py-2 text-[#9badc0] text-sm font-normal text-center border-r border-[#314c68]">${aluno.email}</td>
        <td class="h-[72px] px-4 py-2 text-white text-sm font-normal text-center border-r border-[#314c68]">${aluno.cabine || 'N/A'}</td>
        <td class="h-[72px] px-4 py-2 text-white text-sm font-normal text-center border-r border-[#314c68]">${aluno.genero || 'N/A'}</td>
        <td class="h-[72px] px-4 py-2 text-white text-sm font-normal text-center border-r border-[#314c68]">${aluno.id}</td>
        <td class="h-[72px] px-4 py-2 text-white text-sm font-normal text-center border-r border-[#314c68]">${dias}</td>
        <td class="h-[72px] px-4 py-2 text-center">
          <button data-id="${aluno.id}" class="edit-user-btn text-gray-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v.01M12 12v.01M12 19v.01" />
            </svg>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Adiciona os event listeners para os novos botões de editar
    document.querySelectorAll('.edit-user-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        const userId = parseInt(e.currentTarget.getAttribute('data-id'), 10);
        abrirModalEdicao(userId);
      });
    });

  }
  
  // --- Configurações: Serial ---
  const saveBtn = document.getElementById('save-serial-settings');
  if (saveBtn) {
    saveBtn.onclick = async () => {
      const porta = document.getElementById('select-serial-port').value;
      if (porta) {
        try {
          await ipcRenderer.invoke('setar-porta-serial', porta);
          localStorage.setItem('porta-esp', porta);
          atualizarStatusSerial(true);
        } catch (error) {
          console.error("Falha ao configurar a porta serial:", error);
          atualizarStatusSerial(false);
        }
      } else {
        localStorage.removeItem('porta-esp');
        atualizarStatusSerial(false);
      }
    };
  }

  async function listarPortasSeriais() {
    const select = document.getElementById('select-serial-port');
    if (!select) return;
    select.innerHTML = '<option value="">Selecione a porta serial do ESP</option>';
    const portas = await ipcRenderer.invoke('listar-portas');
    portas.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.path;
      opt.textContent = `${p.path} - ${p.manufacturer || 'N/A'}`;
      select.appendChild(opt);
    });
    const portaSalva = localStorage.getItem('porta-esp');
    if (portaSalva) {
      select.value = portaSalva;
      // Tenta reconectar automaticamente
      saveBtn.click();
    }
  }

  function atualizarStatusSerial(conectado) {
    const status = document.getElementById('status-serial');
    if (!status) return;
    status.className = 'size-3 rounded-full ' + (conectado ? 'bg-green-500' : 'bg-red-500');
  }

  // Busca de Usuários
  const searchAluno = document.getElementById('search-aluno');
  if (searchAluno) {
    searchAluno.addEventListener('input', (e) => {
      renderizarTabelaUsuarios(e.target.value);
    });
  }

  // Seleção de pasta para Excel
  const selectExcelPathBtn = document.getElementById('select-excel-path-btn');
  const excelPathDisplay = document.getElementById('excel-path-display');

  if (selectExcelPathBtn) {
    selectExcelPathBtn.addEventListener('click', async () => {
      const path = await ipcRenderer.invoke('select-csv-path');
      if (path) {
        localStorage.setItem('excel-export-path', path);
        excelPathDisplay.value = path;
      }
    });
  }

  // Carregar caminho salvo
  const savedExcelPath = localStorage.getItem('excel-export-path');
  if (savedExcelPath && excelPathDisplay) {
    excelPathDisplay.value = savedExcelPath;
    ipcRenderer.send('set-csv-path', savedExcelPath); // Envia o caminho para o main process
  }

  // Seleção de planilha de dados de alunos
  const selectStudentDataBtn = document.getElementById('select-student-data-path-btn');
  const studentDataPathDisplay = document.getElementById('student-data-path-display');

  if (selectStudentDataBtn) {
    selectStudentDataBtn.addEventListener('click', async () => {
      const path = await ipcRenderer.invoke('select-student-data-path');
      if (path) {
        localStorage.setItem('student-data-path', path);
        studentDataPathDisplay.value = path;
        await showCustomAlert('Sucesso', 'Planilha de dados dos alunos selecionada.');
      }
    });
  }

  // Carregar caminho da planilha salvo
  const savedStudentDataPath = localStorage.getItem('student-data-path');
  if (savedStudentDataPath && studentDataPathDisplay) {
    studentDataPathDisplay.value = savedStudentDataPath;
    // Não precisa enviar para o main process na inicialização, o main process vai ler quando precisar
  }

  // Menu de Opções de Usuário
  const userMenuBtn = document.getElementById('user-menu-btn');
  const userMenuDropdown = document.getElementById('user-menu-dropdown');
  const deleteUsersMenuItem = document.getElementById('delete-users-menu-item');
  const removeDuplicatesMenuItem = document.getElementById('remove-duplicates-menu-item');

  if (userMenuBtn) {
    userMenuBtn.addEventListener('click', () => {
      userMenuDropdown.classList.toggle('hidden');
    });
  }

  if (deleteUsersMenuItem) {
    deleteUsersMenuItem.addEventListener('click', (e) => {
      e.preventDefault();
      deleteMode = !deleteMode;
      userMenuDropdown.classList.add('hidden');
      renderizarTabelaUsuarios(); // Re-renderiza a tabela para mostrar/ocultar checkboxes

      // Adiciona um botão para confirmar a exclusão
      const header = document.querySelector('#usuarios-section .p-4');
      let actionContainer = document.getElementById('delete-action-container');

      if (deleteMode && !actionContainer) {
        // Oculta os botões principais e mostra os de ação de exclusão
        document.getElementById('add-user-btn').classList.add('hidden');
        userMenuBtn.classList.add('hidden');

        actionContainer = document.createElement('div');
        actionContainer.id = 'delete-action-container';
        actionContainer.className = 'flex items-center gap-2 ml-auto';
        
        const selectAllBtn = document.createElement('button');
        selectAllBtn.textContent = 'Selecionar Todos';
        selectAllBtn.className = 'rounded-full bg-blue-600 text-white font-bold px-4 h-10';

        const cancelDeleteBtn = document.createElement('button');
        cancelDeleteBtn.textContent = 'Cancelar';
        cancelDeleteBtn.className = 'rounded-full bg-gray-600 text-white font-bold px-4 h-10';
        
        const deleteConfirmBtn = document.createElement('button');
        deleteConfirmBtn.textContent = 'Excluir Selecionados';
        deleteConfirmBtn.className = 'rounded-full bg-red-600 text-white font-bold px-4 h-10';

        actionContainer.appendChild(selectAllBtn);
        actionContainer.appendChild(cancelDeleteBtn);
        actionContainer.appendChild(deleteConfirmBtn);
        header.appendChild(actionContainer);

        selectAllBtn.addEventListener('click', () => {
            const checkboxes = document.querySelectorAll('.delete-checkbox');
            const allChecked = Array.from(checkboxes).every(cb => cb.checked);
            checkboxes.forEach(checkbox => {
                checkbox.checked = !allChecked;
            });
        });

        const exitDeleteMode = () => {
          deleteMode = false;
          // Mostra os botões principais novamente
          document.getElementById('add-user-btn').classList.remove('hidden');
          userMenuBtn.classList.remove('hidden');
          if (actionContainer) {
            actionContainer.remove();
          }
          renderizarTabelaUsuarios();
        };

        cancelDeleteBtn.addEventListener('click', exitDeleteMode);

        deleteConfirmBtn.addEventListener('click', async () => {
          const checkboxes = document.querySelectorAll('.delete-checkbox:checked');
          const userIdsToDelete = Array.from(checkboxes).map(cb => parseInt(cb.dataset.id, 10));

          if (userIdsToDelete.length === 0) {
            await showCustomAlert('Aviso', 'Nenhum usuário selecionado para exclusão.');
            return;
          }

          const confirmed = await showCustomConfirm('Confirmação', `Tem certeza que deseja excluir ${userIdsToDelete.length} usuário(s)?`);
          if (confirmed) {
            try {
              for (const userId of userIdsToDelete) {
                await ipcRenderer.invoke('delete-user', userId);
              }
              await showCustomAlert('Sucesso!', `${userIdsToDelete.length} usuário(s) excluído(s) com sucesso.`);
              exitDeleteMode();
            } catch (error) {
              await showCustomAlert('Erro', `Erro ao excluir usuários: ${error.message}`);
            }
          }
        });
      } else if (!deleteMode && actionContainer) {
        actionContainer.remove();
      }
    });
  }

  if (removeDuplicatesMenuItem) {
    removeDuplicatesMenuItem.addEventListener('click', async (e) => {
      e.preventDefault();
      userMenuDropdown.classList.add('hidden');
      const confirmed = await showCustomConfirm('Remover Duplicados', 'Esta ação irá verificar todos os usuários e remover aqueles com matrículas duplicadas, mantendo apenas a primeira ocorrência encontrada. Deseja continuar?');
      if (confirmed) {
        try {
          const result = await ipcRenderer.invoke('remove-duplicates');
          await showCustomAlert('Sucesso', `${result.count} usuário(s) duplicado(s) removido(s).`);
          renderizarTabelaUsuarios();
        } catch (error) {
          await showCustomAlert('Erro', `Erro ao remover duplicados: ${error.message}`);
        }
      }
    });
  }

  

  // Funcionalidade dos Cards do Dashboard
  const dashboardCards = document.querySelectorAll('.dashboard-card');
  dashboardCards.forEach(card => {
    card.addEventListener('click', async (e) => {
      const target = e.currentTarget.dataset.target;
      // Ativa a seção de usuários
      navItems.forEach((el) => el.classList.remove('active', 'bg-[#293542]'));
      const usuariosNavItem = document.querySelector('.nav-item:nth-child(3)'); // "Usuários" é o terceiro item
      // Esconde todas as seções e mostra a relevante
      dashboardSection.classList.add('hidden');
      settingsSection.classList.add('hidden');
      usuariosSection.classList.add('hidden');
      atividadesSection.classList.add('hidden');
      ajudaSection.classList.add('hidden');
      dailySummarySection.classList.add('hidden'); // Esconde a nova seção

      // Ativa o item de navegação correspondente (se houver)
      let activeNavItem = null;

      if (target === 'presentes') {
        dailySummarySection.classList.remove('hidden');
