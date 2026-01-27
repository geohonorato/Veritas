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
char serialInputBuffer[256]; // Buffer para armazenar a entrada serial
byte bufferPosition = 0;
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
void getAllFingerprintIDs();
void emptyDatabase();



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
    finger.getParameters();
    sendJsonResponse("info", "Capacidade do sensor: " + String(finger.capacity));
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
    char inChar = (char)Serial.read();

    if (inChar == '\n') {
      serialInputBuffer[bufferPosition] = '\0'; // Null-terminate the string
      recordInteraction();

      StaticJsonDocument<256> doc;
      DeserializationError error = deserializeJson(doc, serialInputBuffer);

      if (!error) {
        String command = doc["command"];
        if (command == "GET_ALL_IDS") {
          getAllFingerprintIDs();
        } else if (command == "ENROLL") {
          enrollFingerprint(doc["id"].as<uint16_t>());
        } else if (command == "ENROLL_CONFIRMED") {
          displayMessage("CADASTRADO COM", "SUCESSO!", "", "", 1500);
        } else if (command == "USER_NOT_FOUND") {
          displayMessage("USUARIO NAO", "ENCONTRADO NO APP", "SINCRONIZE OS DADOS", "", 2000, true);
          currentState = IDLE;
        } else if (command == "USER_DATA_RESPONSE") {
          beep(true);
          String nomeCompleto = doc["nome"];
          String genero = doc["genero"];
          String tipo = doc["type"];
          int spaceIndex = nomeCompleto.indexOf(' ');
          String primeiroNome = (spaceIndex > 0) ? nomeCompleto.substring(0, spaceIndex) : nomeCompleto;
          String messageLine1 = (tipo == "SAIDA") ? "ATE LOGO" : (genero == "Feminino" ? "BEM VINDA" : "BEM VINDO");
          
          DateTime now = rtc.now();
          char activityStr[20];
          snprintf(activityStr, sizeof(activityStr), "%s AS %02d:%02d", tipo.c_str(), now.hour(), now.minute());
          
          char rtcTimestamp[25];
          snprintf(rtcTimestamp, sizeof(rtcTimestamp), "%04d-%02d-%02dT%02d:%02d:%02d", now.year(), now.month(), now.day(), now.hour(), now.minute(), now.second());
          sendJsonResponse("activity", "Digital encontrada.", doc["id"], rtcTimestamp);
          
          initialDisplay = false;
          lcd.clear();
          printCentered(messageLine1, 0);
          printCentered(primeiroNome, 1);
          printCentered(activityStr, 2);
          
          while (digitalRead(R307_TOUCH_PIN) == LOW) { delay(50); }
          delay(1500);

          initialDisplay = false;
          displayDefaultScreen();
          currentState = IDLE;
          lastReadTime = millis();
        } else if (command == "SET_BUZZER") {
          buzzerEnabled = doc["enabled"];
        } else if (command == "DELETE_ID") {
          deleteFingerprint(doc["id"]);
        } else if (command == "SET_TIME") {
          rtc.adjust(DateTime(doc["year"], doc["month"], doc["day"], doc["hour"], doc["minute"], doc["second"]));
          sendJsonResponse("success", "RTC time updated.");
        } else if (command == "EMPTY_DATABASE") {
          emptyDatabase();
        }
      }
      
      // Reset buffer for next message
      bufferPosition = 0;
      memset(serialInputBuffer, 0, sizeof(serialInputBuffer));

    } else if (bufferPosition < sizeof(serialInputBuffer) - 1) {
      serialInputBuffer[bufferPosition++] = inChar;
    }
    // Else: character is dropped if buffer is full, preventing overflow
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
  StaticJsonDocument<256> doc;
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
  StaticJsonDocument<256> doc;
  doc["command"] = "GET_USER_DATA";
  doc["id"] = id;
  serializeJson(doc, Serial);
  Serial.println();
}

void enrollFingerprint(uint16_t id) {
  sendJsonResponse("info", "Iniciando cadastro para ID: " + String(id));
  // --- Passo 1: Obter a primeira imagem ---
  displayMessage("COLOQUE O DEDO", "NO CENTRO DO SENSOR");
  while (finger.getImage() != FINGERPRINT_OK);
  if (finger.image2Tz(1) != FINGERPRINT_OK) {
    displayMessage("ERRO AO CAPTURAR", "IMAGEM 1", "", "", 1000, true);
    sendJsonResponse("error", "Erro ao processar imagem 1.");
    return;
  }
  
  displayMessage("REMOVA O DEDO", "", "", "", 1500);
  while (finger.getImage() != FINGERPRINT_NOFINGER);

  // --- Passo 2: Obter a segunda imagem em um ângulo diferente ---
  displayMessage("COLOQUE O MESMO DEDO", "NO SENSOR");
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

  delay(100); // Pequeno delay para garantir que o sensor processe o modelo.
  
  // --- Passo 4: Armazenar o modelo ---
  sendJsonResponse("info", "Armazenando modelo no ID: " + String(id));
  if (finger.storeModel(id) != FINGERPRINT_OK) {
    displayMessage("ERRO AO SALVAR", "A DIGITAL", "", "", 1000, true);
    sendJsonResponse("error", "Erro ao armazenar a digital.");
    return;
  }
  beep(true); // Emite um bipe de sucesso após salvar no sensor

  // --- Passo 5: Verificação final de armazenamento ---
  displayMessage("VERIFICANDO...", "SALVAMENTO");
  if (finger.loadModel(id) != FINGERPRINT_OK) {
    displayMessage("ERRO FATAL", "NAO FOI POSSIVEL", "SALVAR A DIGITAL", "", 1500, true);
    sendJsonResponse("error", "Erro fatal: não foi possível salvar a digital no sensor.");
    return;
  }
  
  // Envia um sinal de sucesso parcial e aguarda a confirmação final do app
  sendJsonResponse("success", "Digital salva no sensor, aguardando confirmacao final.", id);
  // A mensagem final de "CADASTRADO COM SUCESSO" só será exibida
  // quando o comando "ENROLL_CONFIRMED" for recebido.
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
    displayMessage("DIGITAL NAO", "RECONHECIDA.", "TENTE NOVAMENTE", "", 1000, true);
    
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

void getAllFingerprintIDs() {
  uint16_t templateCount = 0;
  if (finger.getTemplateCount() != FINGERPRINT_OK) {
    sendJsonResponse("error", "Falha ao obter contagem de templates.");
    return;
  }
  templateCount = finger.templateCount;
  if (templateCount == 0) {
    sendJsonResponse("info", "Nenhuma digital encontrada no sensor.");
    sendJsonResponse("sync_complete", "Sincronizacao finalizada.");
    return;
  }

  sendJsonResponse("info", "Iniciando varredura de " + String(templateCount) + " digitais...");

  for (uint16_t id = 1; id <= finger.capacity; id++) {
    if (finger.loadModel(id) == FINGERPRINT_OK) {
      // Envia um JSON para cada ID encontrado
      sendJsonResponse("found_id", "ID encontrado no sensor.", id);
    }
  }
  
  sendJsonResponse("sync_complete", "Sincronizacao finalizada.");
}

void emptyDatabase() {
  displayMessage("APAGANDO MEMORIA", "DO SENSOR...", "AGUARDE...", "", 0);
  uint8_t result = finger.emptyDatabase();
  if (result == FINGERPRINT_OK) {
    displayMessage("MEMORIA DO SENSOR", "APAGADA COM SUCESSO!", "", "", 2000);
    sendJsonResponse("success", "Memoria do sensor apagada.");
  } else {
    displayMessage("ERRO AO APAGAR", "MEMORIA DO SENSOR", "", "", 2000, true);
    sendJsonResponse("error", "Nao foi possivel apagar a memoria do sensor.");
  }
}
