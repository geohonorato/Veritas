const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
// const { SerialPort } = require('serialport'); // Removido, agora via Service
// const { ReadlineParser } = require('@serialport/parser-readline'); // Removido
const xlsx = require('xlsx');
const path = require('path');
const db = require('./database');
const http = require('http');
const os = require('os');
const serialService = require('./services/SerialService');
const EmailService = require('./services/EmailService');

let mainWindow = null;
// let port = null; // Removido
// let parser = null; // Removido
let csvExportPath = null;
let studentDataPath = null;
const webPort = 8080;

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
    // Serve files from the ../public directory
    let filePath = path.join(__dirname, '../public', req.url);
    if (filePath.endsWith('/') || req.url === '/') {
      filePath = path.join(__dirname, '../public', 'index.html');
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        return;
      }

      let contentType = 'text/html';
      const ext = path.extname(filePath);
      if (ext === '.js') contentType = 'application/javascript';
      else if (ext === '.css') contentType = 'text/css';
      else if (ext === '.json') contentType = 'application/json';
      else if (ext === '.png') contentType = 'image/png';
      else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });

  server.listen(webPort, '0.0.0.0', () => {
    const ipAddress = getLocalIpAddress();
    console.log(`Servidor web iniciado em http://${ipAddress}:${webPort}`);
    if (mainWindow) {
      mainWindow.webContents.send('web-server-started', { ipAddress, port: webPort });
    }
  });
}



// ... (previous imports)

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false, // Security: Disable Node.js in renderer
      contextIsolation: true, // Security: Enable Context Isolation
      preload: path.join(__dirname, 'preload.js') // Path to preload script
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, '../public/index.html'));

  serialService.setMainWindow(mainWindow);
  serialService.setOnDataCallback(processSerialData);
}

// --- AI Handler ---
const aiService = require('./services/AIService');

app.whenReady().then(() => {
  createWindow();
  startWebServer();
  // Initialize AI Service (Async training)
  aiService.initialize().catch(err => console.error('Erro ao inicializar IA:', err));
});

// ... (existing code) ...

ipcMain.handle('ai-query', async (event, text) => {
  try {
    const response = await aiService.processQuery(text);
    return response;
  } catch (error) {
    console.error('Erro no processamento da IA:', error);
    return "Desculpe, tive um problema ao processar sua pergunta.";
  }
});

// --- Lógica de Processamento Serial (Migrada para função isolada) ---
function processSerialData(line) {
  console.log('DADO BRUTO RECEBIDO DA SERIAL:', line);
  try {
    const data = JSON.parse(line);

    // Se um processo de cadastro está ativo, ele tem prioridade
    if (enrollmentHandler) {
      if (data.status === 'success' || data.status === 'error' || data.status === 'info') {
        mainWindow.webContents.send('biometria-status', data);

        if (data.status === 'success') {
          clearTimeout(enrollmentHandler.timeout);
          enrollmentHandler.resolve(data);
          enrollmentHandler = null;
        } else if (data.status === 'error') {
          clearTimeout(enrollmentHandler.timeout);
          enrollmentHandler.reject(new Error(data.message));
          enrollmentHandler = null;
        }
      }
      return;
    }

    // Lógica normal de operação
    if (data.command === 'GET_USER_DATA' && data.id) {
      const user = db.getUserById(data.id);
      if (user) {
        const type = db.getNextActivityType(user.id);
        const response = {
          command: 'USER_DATA_RESPONSE',
          id: user.id,
          nome: user.nome,
          genero: user.genero, // Envia o gênero para o ESP personalizar a saudação
          type: type
        };
        serialService.write(JSON.stringify(response) + '\n');
      } else {
        serialService.write(JSON.stringify({ command: 'USER_NOT_FOUND' }) + '\n');
      }
    } else if (data.status === 'activity' && data.id && data.timestamp) {
      const localDate = new Date(data.timestamp);
      const utcTimestamp = localDate.toISOString();

      const newActivity = db.addActivity({ userId: data.id, timestamp: utcTimestamp });
      if (newActivity) {
        mainWindow.webContents.send('nova-atividade', newActivity);
        exportAllActivitiesToExcel().catch(err => console.error("Erro na exportação automática:", err));
        
        // Enviar notificação por Email
        const user = db.getUserById(data.id);
        if (user) {
             EmailService.sendPointNotification(user, newActivity);
        }
      }
    }
  } catch (e) {
    // Ignora JSON inválido
  }
}

// --- IPC Handlers ---

ipcMain.on('set-csv-path', (event, path) => {
  csvExportPath = path;
});

ipcMain.handle('select-student-data-path', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }]
  });
  if (canceled || filePaths.length === 0) return null;
  studentDataPath = filePaths[0];
  return studentDataPath;
});

ipcMain.handle('search-student-data', (event, { query, type }) => {
  if (!studentDataPath) return null;
  try {
    const workbook = xlsx.readFile(studentDataPath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);
    if (data.length === 0) return null;

    const searchKey = type === 'matricula' ? 'matricula' : 'aluno';
    const result = data.find(row => {
      const rowKey = Object.keys(row).find(k => k.toLowerCase().trim() === searchKey);
      if (rowKey && row[rowKey]) {
        return String(row[rowKey]).trim().toLowerCase() === String(query).trim().toLowerCase();
      }
      return false;
    });

    if (result) {
      const normalizedResult = {};
      for (const key in result) normalizedResult[key.toLowerCase().trim()] = result[key];
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

ipcMain.handle('add-manual-activity', (event, activityData) => {
  const newActivity = db.addActivity(activityData);
  if (newActivity) {
    mainWindow.webContents.send('nova-atividade', newActivity);
    exportAllActivitiesToExcel().catch(err => console.error(err));
    
    // Enviar notificação por Email
    const user = db.getUserById(activityData.userId);
    if (user) {
          EmailService.sendPointNotification(user, newActivity);
    }

    return { success: true, activity: newActivity };
  }
  return { success: false, error: 'Não foi possível adicionar a atividade.' };
});

ipcMain.handle('listar-portas', () => serialService.listPorts());

ipcMain.handle('setar-porta-serial', async (event, path) => {
  return serialService.connect(path);
});

ipcMain.handle('update-user', (event, { id, data }) => {
  const updatedUser = db.updateUser(id, data);
  if (updatedUser) mainWindow.webContents.send('user-updated', updatedUser);
  return updatedUser;
});

ipcMain.handle('clear-all-activities', () => {
  const result = db.clearAllActivities();
  mainWindow.webContents.send('activities-cleared');
  return result;
});

ipcMain.handle('remove-duplicates', () => {
  const result = db.removeDuplicates();
  mainWindow.webContents.send('users-updated');
  return result;
});

ipcMain.handle('update-activity', (event, { originalTimestamp, userId, newData }) => {
  const updatedActivity = db.updateActivity(originalTimestamp, userId, newData);
  if (updatedActivity) mainWindow.webContents.send('activity-updated', updatedActivity);
  return updatedActivity;
});

ipcMain.handle('sync-time', () => {
  try {
    serialService.setTime();
    return { status: 'success' };
  } catch (e) {
    throw new Error('A porta serial não está aberta.');
  }
});

ipcMain.handle('select-csv-path', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (canceled) return null;
  csvExportPath = filePaths[0];
  return filePaths[0];
});

async function exportAllActivitiesToExcel() {
  if (!csvExportPath) return;

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
      if (!record.entrada || activityTime < record.entrada) record.entrada = activityTime;
    } else if (a.type === 'SAIDA') {
      if (!record.saida || activityTime > record.saida) record.saida = activityTime;
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
  if (filters.turma) activities = activities.filter(a => a.userTurma === filters.turma);
  if (filters.turno) activities = activities.filter(a => a.userTurno === filters.turno);
  if (filters.nome) {
    const lowerNome = filters.nome.toLowerCase();
    activities = activities.filter(a => a.userName && a.userName.toLowerCase().includes(lowerNome));
  }
  if (filters.mes) {
    activities = activities.filter(a => {
      const d = new Date(a.timestamp);
      const [filterYear, filterMonth] = filters.mes.split('-').map(Number);
      return d.getMonth() === (filterMonth - 1) && d.getFullYear() === filterYear;
    });
  }
  if (activities.length === 0) return { success: false, error: 'Nenhuma atividade.' };

  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Salvar Relatório',
    defaultPath: `atividades-${new Date().toISOString().slice(0, 10)}.xlsx`,
    filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
  });
  if (canceled) return { success: false, canceled: true };

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
          cabine: user ? user.cabine : 'N/A', userName: a.userName, userTurma: a.userTurma,
          date: date, entrada: null, saida: null
        };
      }
      const r = dailyRecords[key];
      const t = new Date(a.timestamp);
      if (a.type === 'Entrada') (!r.entrada || t < r.entrada) ? r.entrada = t : null;
      else if (a.type === 'SAIDA') (!r.saida || t > r.saida) ? r.saida = t : null;
    });

    const header = ['Cabine', 'Nome', 'Turma', 'Data', 'Entrada', 'Saída'];
    const rows = Object.values(dailyRecords).map(r => ({
      Cabine: r.cabine, Nome: r.userName, Turma: r.userTurma, Data: r.date,
      Entrada: r.entrada ? r.entrada.toLocaleTimeString('pt-BR') : '---',
      Saída: r.saida ? r.saida.toLocaleTimeString('pt-BR') : '---'
    }));
    const ws = xlsx.utils.json_to_sheet(rows, { header });
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Atividades');
    xlsx.writeFile(wb, filePath);
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-user', async (event, userId) => {
  if (!serialService.isOpen()) throw new Error('A porta serial não está aberta.');

  // Envia comando para exclusão no sensor
  serialService.deleteUser(userId);

  // Assume exclusão no banco com sucesso (Limitação temporária do refactor)
  // Idealmente aguardaria resposta serial.
  return new Promise((resolve, reject) => {
    if (db.deleteUser(userId)) {
      mainWindow.webContents.send('user-deleted', userId);
      resolve({ status: 'success', message: 'Usuário excluído (Comando enviado ao sensor).' });
    } else {
      reject(new Error('Erro ao remover do DB.'));
    }
  });
});

ipcMain.handle('set-buzzer-state', (event, enabled) => {
  serialService.setBuzzer(enabled);
});


ipcMain.handle('add-user-and-enroll', async (event, { userData }) => {
  if (!serialService.isOpen()) throw new Error('Porta fechada.');
  if (enrollmentHandler) throw new Error('Cadastro em andamento.');

  const id = db.getNextUserId();
  const comando = JSON.stringify({ command: 'ENROLL', id: id });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (enrollmentHandler) {
        enrollmentHandler.reject(new Error('Timeout.'));
        enrollmentHandler = null;
      }
    }, 30000);

    enrollmentHandler = { resolve, reject, timeout };

    // Envia comando utilizando o service
    serialService.write(comando + '\n');

    mainWindow.webContents.send('biometria-status', {
      status: 'info',
      message: `Iniciando cadastro para ID ${id}...`
    });
  })
    .then(successData => {
      const newUser = { id: successData.id, ...userData };
      const addUserResult = db.addUser(newUser);

      if (addUserResult.error) {
        serialService.deleteUser(newUser.id); // Rollback
        throw new Error(addUserResult.error);
      }

      serialService.write(JSON.stringify({ command: 'ENROLL_CONFIRMED' }) + '\n');
      return { status: 'success', user: addUserResult };
    });
});

ipcMain.handle('sync-from-sensor', async () => {
  // TODO: Reimplementar lógica de sync usando listeners temporários no service
  throw new Error("Funcionalidade temporariamente indisponível (Refatoração). Use o modo manual.");
});

ipcMain.handle('empty-sensor-database', async () => {
  serialService.write(JSON.stringify({ command: 'EMPTY_DATABASE' }) + '\n');
  return { status: 'success', message: 'Comando enviado.' };
});
