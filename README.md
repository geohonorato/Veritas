# WorkWise - Sistema de Ponto Eletrônico com Biometria

O WorkWise é um sistema completo de controle de acesso e gestão de presença, utilizando tecnologia biométrica para garantir segurança e precisão. Ele é composto por um dispositivo de hardware inteligente (baseado em ESP8266 com display LCD) e uma aplicação desktop intuitiva para gerenciamento.

## Visão Geral

Com o WorkWise, você pode facilmente:
- Cadastrar novos usuários com suas impressões digitais.
- Monitorar as atividades de entrada e saída em tempo real.
- Gerenciar os dados dos usuários (editar, excluir, sincronizar), incluindo o sexo para mensagens personalizadas.
- Visualizar estatísticas diárias de presença em um dashboard amigável.
- Receber feedback visual instantâneo em um display LCD 20x4 no próprio dispositivo.
- Exportar relatórios de atividade para análise.
- Acessar uma interface web para monitoramento remoto.

---

## Arquitetura do Sistema

O projeto é dividido em duas partes principais: o **Firmware** para o dispositivo embarcado e a **Aplicação Desktop** para o controle e gerenciamento.

### 1. Hardware

O dispositivo de captura biométrica é montado com os seguintes componentes:

- **Microcontrolador:** NodeMCU (ESP8266)
- **Sensor Biométrico:** R307
- **Módulo de Relógio (RTC):** DS3231
- **Display:** LCD 20x4 com módulo I2C

#### Montagem do Circuito

Os componentes devem ser conectados ao NodeMCU/ESP8266 da seguinte forma:

```
+-----------------------+------------------+
| Componente            | Pino no ESP8266  |
+=======================+==================+
| Sensor Biométrico R307|                  |
+-----------------------+------------------+
| VCC (5V)              | VU (5V)          |
| GND                   | GND              |
| TX (Sensor)           | D7 (GPIO 13)     |
| RX (Sensor)           | D6 (GPIO 12)     |
| TOUCH (Sensor)        | D5 (GPIO 14)     |
+-----------------------+------------------+
| Módulo RTC DS3231     |                  |
+-----------------------+------------------+
| VCC (3.3V)            | 3V3              |
| GND                   | GND              |
| SDA                   | D3 (GPIO 0)      |
| SCL                   | D4 (GPIO 2)      |
+-----------------------+------------------+
| Display LCD I2C 20x4  |                  |

+-----------------------+------------------+
| VCC (5V)              | VU (5V)          |
| GND                   | GND              |
| SDA                   | D3 (GPIO 0)      |
| SCL                   | D4 (GPIO 2)      |
+-----------------------+------------------+
```
*Nota: Os pinos SDA e SCL do RTC e do Display LCD são conectados nos mesmos pinos I2C do ESP8266.*

### 2. Software

#### a. Firmware (Dispositivo Embarcado)

O cérebro do dispositivo de hardware é programado em C++ utilizando o framework Arduino através do PlatformIO.

- **Linguagem:** C++ (Arduino)
- **Plataforma:** PlatformIO
- **Bibliotecas Principais:**
  - `Adafruit_Fingerprint`: Para comunicação com o sensor biométrico.
  - `RTClib`: Para obter a data e hora do módulo RTC.
  - `LiquidCrystal_I2C`: Para controlar o display LCD.
  - `SoftwareSerial`: Para criar uma porta serial secundária para o sensor.
  - `ArduinoJson`: Para a comunicação serial com a aplicação desktop via JSON.
- **Funcionalidades:**
  - Gerencia o cadastro, verificação e exclusão de impressões digitais.
  - Exibe informações no display LCD (tela padrão, relógio, mensagens de status e erro).
  - Solicita dados do usuário (nome, sexo) à aplicação desktop após uma leitura bem-sucedida para exibir uma mensagem de boas-vindas personalizada.
  - Envia os registros de atividade com timestamp preciso do RTC para a aplicação desktop.

#### b. Aplicação Desktop (Painel de Controle)

A interface de gerenciamento é uma aplicação desktop multiplataforma construída com Electron.

- **Tecnologias:** Electron, Node.js, HTML5, Tailwind CSS, JavaScript.
- **Localização dos Arquivos:** O código-fonte da aplicação desktop está na pasta `/data`.
- **Funcionalidades:**
  - Interface gráfica para listar, cadastrar, editar e excluir usuários (incluindo o campo "Sexo").
  - Responde às solicitações de dados do dispositivo ESP para a exibição no display.
  - Visualização da tabela de atividades em tempo real.
  - Dashboard com estatísticas de presença.
  - Configuração da porta de comunicação com o hardware.
  - Exportação de dados em formato CSV.
  - Servidor web local para acesso remoto ao dashboard.
- **Comunicação:** Utiliza a biblioteca `serialport` para se comunicar com o dispositivo ESP.
- **Banco de Dados:** Um arquivo `database.json` local (na pasta `/data`) armazena os dados de usuários e atividades.

---

## Instalação e Uso

Siga os passos abaixo para configurar e executar o sistema.

### 1. Pré-requisitos

- [Visual Studio Code](https://code.visualstudio.com/) com a extensão [PlatformIO IDE](https://platformio.org/platformio-ide).
- [Node.js](https://nodejs.org/) (versão 14 ou superior).
- Hardware montado conforme a especificação acima.

### 2. Configurar o Firmware

1.  Abra a pasta do projeto no Visual Studio Code.
2.  Conecte o dispositivo ESP8266 ao computador via USB.
3.  O PlatformIO deverá reconhecer o projeto automaticamente.
4.  Para compilar e enviar o firmware para o dispositivo, execute o seguinte comando no terminal do PlatformIO:
    ```bash
    platformio run --target upload
    ```

### 3. Configurar a Aplicação Desktop

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

### 4. Primeiro Uso

1.  Ao abrir a aplicação, vá para a aba **Configurações**.
2.  Selecione a porta serial correspondente ao seu dispositivo ESP na lista e clique em **Salvar configurações**. O indicador de status deve ficar verde.
3.  Vá para a aba **Usuários** e clique no botão **Adicionar Usuário** para começar a cadastrar as pessoas. Preencha todos os campos, incluindo o sexo, e siga as instruções na tela para o registro da impressão digital.

---

## Como Construir (Build)

Para empacotar a aplicação desktop em um instalador para Windows, macOS ou Linux, utilize o seguinte comando na pasta `/data`:

```bash
npm run dist
```

Os arquivos de saída serão gerados na pasta `/build`.

---

## Autor

- **Geovanni Honorato**

## Licença

Este projeto está licenciado sob a licença ISC.


// --- INÍCIO DO CÓDIGO DE EXEMPLO ---

// Defina o pino onde seu buzzer ou alto-falante está conectado
#define BUZZER_PIN 8

// Melodia da Marcha Imperial (corrigida)
int melody[] = {
  NOTE_G4, NOTE_G4, NOTE_G4, NOTE_DS4, NOTE_AS4,
  NOTE_G4, NOTE_DS4, NOTE_AS4, NOTE_G4,
  NOTE_D5, NOTE_D5, NOTE_D5, NOTE_DS5, NOTE_AS4,
  NOTE_FS4, NOTE_DS4, NOTE_AS4, NOTE_G4
};

// Duração das notas: 4 = semínima, 8 = colcheia, 16 = semicolcheia.
int noteDurations[] = {
  4, 4, 4, 8, 8,
  4, 8, 8, 4,
  4, 4, 4, 8, 8,
  4, 8, 8, 4
};

void setup() {
  // Não precisa de nada no setup para este exemplo
}

void loop() {
  // Toca a Marcha Imperial uma vez
  playImperialMarch();
  // Pausa de 2 segundos antes de repetir
  delay(2000);
}

void playImperialMarch() {
  // Pega o número total de notas na melodia
  int noteCount = sizeof(melody) / sizeof(melody[0]);

  for (int thisNote = 0; thisNote < noteCount; thisNote++) {
    // Calcula a duração da nota em milissegundos.
    // 1000ms = 1 segundo. Uma semínima (4) dura 1000/4 = 250ms.
    int noteDuration = 1000 / noteDurations[thisNote];
    
    // Toca a nota
    tone(BUZZER_PIN, melody[thisNote], noteDuration);

    // Adiciona uma pequena pausa entre as notas para separá-las
    // Aumentar o valor (ex: 1.30) aumenta a pausa
    int pauseBetweenNotes = noteDuration * 1.20;
    delay(pauseBetweenNotes);
    
    // Para de tocar a nota
    noTone(BUZZER_PIN);
  }
}

// --- FIM DO CÓDIGO DE EXEMPLO ---