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
  port.write(command + '\n');
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

    port.write(comando + '\n', (err) => {
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
    port.write(comando + '\n', (err) => {
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
  parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

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
          port.write(JSON.stringify(response) + '\n');
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

    port.write(comando + '\n', (err) => {
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
