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
    if (inChar == '\n') {
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


