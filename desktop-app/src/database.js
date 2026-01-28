const path = require('path');
const fs = require('fs');
let app;
try {
  // Tenta carregar electron apenas se disponível/necessário
  if (process.versions.electron) {
    app = require('electron').app;
  }
} catch (e) { }

const Database = require('better-sqlite3');

// Define caminho do banco: Electron (AppData) vs Server (Local 'data' folder)
let dbPath;
if (app) {
  dbPath = path.join(app.getPath('userData'), 'veritas.sqlite');
} else {
  const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  dbPath = path.join(dataDir, 'veritas.sqlite');
  console.log(`[DB] Running in Server Mode. Database path: ${dbPath}`);
}

const db = new Database(dbPath);

// --- Criação das Tabelas (Schema) ---
db.pragma('journal_mode = WAL');

// Tabela de Admins para Login Web
db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
  );
`);

// Criar admin padrão se não existir
const adminCheck = db.prepare("SELECT count(*) as count FROM admins").get();
if (adminCheck.count === 0) {
  // Default: admin / admin
  db.prepare("INSERT INTO admins (username, password) VALUES (?, ?)").run('admin', 'admin');
  console.log("[DB] Criado usuário admin padrão (admin/admin)");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    nome TEXT NOT NULL,
    matricula TEXT NOT NULL UNIQUE,
    turma TEXT,
    email TEXT,
    genero TEXT,
    cabine TEXT,
    turno TEXT,
    diasSemana TEXT
  );
`);

// --- Migração de Schema (Adicionar coluna 'turno' se não existir) ---
try {
  const tableInfo = db.pragma('table_info(users)');
  const hasTurno = tableInfo.some(column => column.name === 'turno');
  if (!hasTurno) {
    console.log("Adicionando coluna 'turno' à tabela users...");
    db.exec('ALTER TABLE users ADD COLUMN turno TEXT');
  }
} catch (err) {
  console.error("Erro ao verificar/adicionar coluna turno:", err);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    userName TEXT,
    userTurma TEXT,
    userCabine TEXT,
    userTurno TEXT,
    type TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
  );
`);

// Tabela de Faltas
db.exec(`
  CREATE TABLE IF NOT EXISTS faltas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    userName TEXT,
    userTurma TEXT,
    userTurno TEXT,
    date TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    motivo TEXT,
    FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
  );
`);

// Migração: Adicionar coluna userTurno se não existir
try {
  const faltasTableInfo = db.pragma('table_info(faltas)');
  const hasUserTurno = faltasTableInfo.some(column => column.name === 'userTurno');
  if (!hasUserTurno) {
    console.log("Adicionando coluna 'userTurno' à tabela faltas...");
    db.exec('ALTER TABLE faltas ADD COLUMN userTurno TEXT');
  }
} catch (err) {
  console.error("Erro ao verificar/adicionar coluna userTurno em faltas:", err);
}

// --- Migração de Turnos (Inferir baseada no histórico) ---
function inferAndPopulateUserTurnos() {
  try {
    // 1. Buscar usuários com turno vazio/nulo
    const usersWithoutTurnoStr = db.prepare("SELECT id, nome FROM users WHERE turno IS NULL OR turno = ''").all();
    
    if (usersWithoutTurnoStr.length === 0) return; // Nada a fazer

    console.log(`[DB] Inferindo turno para ${usersWithoutTurnoStr.length} usuários...`);

    const updateStmt = db.prepare("UPDATE users SET turno = ? WHERE id = ?");
    let updatedCount = 0;

    db.transaction(() => {
      for (const u of usersWithoutTurnoStr) {
        // Analisar últimas 50 atividades
        const activities = db.prepare("SELECT timestamp FROM activities WHERE userId = ? ORDER BY timestamp DESC LIMIT 50").all(u.id);
        
        if (activities.length === 0) {
           // Default se não tiver histórico: MATUTINO (padrão mais comum)
           // Ou não atualiza? O user pediu para "definir", então definir um padrão é útil.
           // updateStmt.run('MATUTINO', u.id); 
           continue; 
        }

        let morningCount = 0;
        let afternoonCount = 0;

        for (const act of activities) {
          try {
            const date = new Date(act.timestamp);
            const hour = date.getHours();
            if (hour < 13) morningCount++;
            else afternoonCount++;
          } catch(e) {}
        }

        const inferredTurno = (morningCount >= afternoonCount) ? 'Matutino' : 'Vespertino';
        updateStmt.run(inferredTurno, u.id);
        updatedCount++;
        // console.log(`[DB] Usuário ${u.nome} definido como ${inferredTurno} (${morningCount} vs ${afternoonCount})`);
      }
    })();
    
    if (updatedCount > 0) {
      console.log(`[DB] Turnos atualizados para ${updatedCount} usuários.`);
    }

    // 2. Sincronizar turnos nas faltas existentes (Correção Retroativa)
    console.log("[DB] Sincronizando turnos na tabela de faltas...");
    const syncFaltasStmt = db.prepare(`
      UPDATE faltas 
      SET userTurno = (SELECT turno FROM users WHERE users.id = faltas.userId)
      WHERE (userTurno IS NULL OR userTurno = '' OR userTurno = 'N/A' OR userTurno = 'INDEFINIDO')
        AND userId IN (SELECT id FROM users WHERE turno IS NOT NULL AND turno != '')
    `);
    const faltasUpdated = syncFaltasStmt.run();
    if (faltasUpdated.changes > 0) {
      console.log(`[DB] Turnos atualizados em ${faltasUpdated.changes} registros de faltas.`);
    }

  } catch (err) {
    console.error("[DB] Erro ao inferir turnos:", err);
  }
}

// Executar inferência na inicialização
inferAndPopulateUserTurnos();

// --- Migração de Dados Única ---
const oldJsonDbPath = path.join(__dirname, 'database.json');
const migrationCheck = db.prepare("SELECT count(*) as count FROM users").get();

if (migrationCheck.count === 0 && fs.existsSync(oldJsonDbPath)) {
  console.log('Migrando banco de dados JSON antigo para SQLite...');
  try {
    const oldData = JSON.parse(fs.readFileSync(oldJsonDbPath));
    const insertUser = db.prepare('INSERT OR IGNORE INTO users (id, nome, matricula, turma, email, genero, cabine, turno, diasSemana) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const insertActivity = db.prepare('INSERT INTO activities (userId, userName, userTurma, userCabine, userTurno, type, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)');

    db.transaction(() => {
      if (oldData.users) {
        for (const user of oldData.users) {
          insertUser.run(
            user.id,
            user.nome,
            user.matricula,
            user.turma,
            user.email,
            user.genero,
            user.cabine,
            user.turno || null,
            JSON.stringify(user.diasSemana || [])
          );
        }
      }
      if (oldData.activities) {
        for (const activity of oldData.activities) {
          insertActivity.run(
            activity.userId,
            activity.userName,
            activity.userTurma,
            activity.userCabine,
            activity.userTurno,
            activity.type,
            activity.timestamp
          );
        }
      }
    })();
    console.log('Migração concluída com sucesso.');
    fs.renameSync(oldJsonDbPath, oldJsonDbPath + '.migrated');
  } catch (error) {
    console.error('Erro ao migrar o banco de dados JSON:', error);
  }
}

// --- Funções do Banco de Dados ---

function getUsers() {
  const stmt = db.prepare('SELECT * FROM users ORDER BY nome');
  const users = stmt.all();
  return users.map(user => ({
    ...user,
    diasSemana: JSON.parse(user.diasSemana || '[]')
  }));
}

function addUser(user) {
  const stmt = db.prepare('INSERT INTO users (id, nome, matricula, turma, email, genero, cabine, turno, diasSemana) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  try {
    stmt.run(
      user.id,
      user.nome,
      user.matricula,
      user.turma,
      user.email,
      user.genero,
      user.cabine,
      user.turno,
      JSON.stringify(user.diasSemana || [])
    );
    return getUserById(user.id);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { error: 'Usuário com esta matrícula já existe.' };
    }
    throw error;
  }
}

function getUserById(id) {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  const user = stmt.get(parseInt(id, 10));
  if (user) {
    return { ...user, diasSemana: JSON.parse(user.diasSemana || '[]') };
  }
  return null;
}

function updateUser(userId, updatedData) {
  const stmt = db.prepare('UPDATE users SET nome = ?, matricula = ?, turma = ?, email = ?, genero = ?, cabine = ?, turno = ?, diasSemana = ? WHERE id = ?');
  const userToUpdate = getUserById(userId);
  if (!userToUpdate) return null;

  const info = stmt.run(
    updatedData.nome || userToUpdate.nome,
    updatedData.matricula || userToUpdate.matricula,
    updatedData.turma || userToUpdate.turma,
    updatedData.email || userToUpdate.email,
    updatedData.genero || userToUpdate.genero,
    updatedData.cabine || userToUpdate.cabine,
    updatedData.turno || userToUpdate.turno,
    JSON.stringify(updatedData.diasSemana || userToUpdate.diasSemana),
    parseInt(userId, 10)
  );
  return info.changes > 0 ? getUserById(userId) : null;
}

function deleteUser(userId) {
  const stmt = db.prepare('DELETE FROM users WHERE id = ?');
  const info = stmt.run(parseInt(userId, 10));
  return info.changes > 0;
}

function getActivities() {
  const stmt = db.prepare('SELECT * FROM activities ORDER BY timestamp DESC');
  return stmt.all();
}

function updateActivity(originalTimestamp, userId, newData) {
  const stmt = db.prepare('UPDATE activities SET type = ?, timestamp = ? WHERE userId = ? AND timestamp = ?');
  const info = stmt.run(
    newData.type,
    newData.timestamp,
    parseInt(userId, 10),
    originalTimestamp
  );
  return info.changes > 0 ? getActivities().find(a => a.timestamp === newData.timestamp && a.userId === parseInt(userId, 10)) : null;
}

function getNextActivityType(userId) {
  const stmt = db.prepare("SELECT type FROM activities WHERE userId = ? AND date(timestamp) = date('now', 'localtime') ORDER BY timestamp DESC LIMIT 1");
  const lastActivity = stmt.get(parseInt(userId, 10));
  return (!lastActivity || lastActivity.type === 'SAIDA') ? 'Entrada' : 'SAIDA';
}

function addActivity(activityData) {
  console.log(`[DB] addActivity chamado com:`, JSON.stringify(activityData));
  const user = getUserById(activityData.userId);
  if (!user) {
    console.error(`[DB] Erro: Usuário não encontrado para ID: ${activityData.userId}`);
    return null;
  }

  // Se o tipo vier explicitamente (manual), usar ele. Se não, calcular automático (biometria/toggle).
  const type = activityData.type || getNextActivityType(activityData.userId);
  const timestamp = activityData.timestamp || new Date().toISOString();
  // Formatar type para Capitalize (Entrada/Saída) para consistência
  const formattedType = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
  // Ajuste para "SAIDA" vindo de getNextActivityType que retorna upper
  const finalType = (formattedType === 'Saida' || formattedType === 'Saída') ? 'Saída' : 'Entrada';

  console.log(`[DB] Inserindo atividade: User=${user.nome}, Tipo=${finalType}, Time=${timestamp}`);

  const stmt = db.prepare('INSERT INTO activities (userId, userName, userTurma, userCabine, userTurno, type, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)');

  try {
    const info = stmt.run(
      user.id,
      user.nome,
      user.turma || 'N/A',
      user.cabine || 'N/A',
      user.turno || 'N/A',
      finalType,
      timestamp
    );
    console.log(`[DB] Atividade inserida com sucesso. ID=${info.lastInsertRowid}`);
    
    // Se tipo é 'Entrada', remover falta automática do dia
    if (finalType === 'Entrada') {
      const date = new Date(timestamp).toLocaleDateString('pt-BR');
      const deleteFaltaStmt = db.prepare('DELETE FROM faltas WHERE userId = ? AND date = ?');
      const delInfo = deleteFaltaStmt.run(user.id, date);
      console.log(`[DB] Removido falta para ${user.nome} em ${date}? Changes=${delInfo.changes}`);
    }

    return { id: info.lastInsertRowid, ...activityData, type: finalType };
  } catch (err) {
    console.error(`[DB] Erro fatal ao inserir atividade:`, err);
    throw err;
  }
}

function getNextUserId() {
  const stmt = db.prepare('SELECT id FROM users ORDER BY id');
  const existingIds = stmt.all().map(u => u.id);
  let nextId = 1;
  for (const id of existingIds) {
    if (id > nextId) {
      break;
    }
    nextId = id + 1;
  }
  return nextId;
}

function clearAllActivities() {
  db.exec('DELETE FROM activities');
  return { status: 'success', message: 'Todos os registros de atividades foram apagados.' };
}

function removeDuplicates() {
  const users = getUsers();
  const seenMatriculas = new Set();
  let removedCount = 0;

  const idsToDelete = [];
  for (const user of users) {
    if (seenMatriculas.has(user.matricula)) {
      idsToDelete.push(user.id);
      removedCount++;
    } else {
      seenMatriculas.add(user.matricula);
    }
  }

  if (idsToDelete.length > 0) {
    const stmt = db.prepare('DELETE FROM users WHERE id IN (' + idsToDelete.map(() => '?').join(',') + ')');
    stmt.run(...idsToDelete);
  }

  return { status: 'success', count: removedCount };
}

function checkLogin(username, password) {
  const stmt = db.prepare('SELECT * FROM admins WHERE username = ? AND password = ?');
  return stmt.get(username, password);
}

function getWeeklyStats() {
  // Retorna contagem de alunos presentes (Entrada única) por dia nos últimos 7 dias
  const sql = `
    SELECT 
      date(timestamp) as date, 
      COUNT(DISTINCT userId) as count
    FROM activities
    WHERE type = 'Entrada' 
      AND date(timestamp) >= date('now', '-6 days', 'localtime')
    GROUP BY date(timestamp)
    ORDER BY date(timestamp) ASC;
  `;
  const rows = db.prepare(sql).all();

  // Preenche dias vazios com 0
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const row = rows.find(r => r.date === dateStr);
    result.push({ date: dateStr, count: row ? row.count : 0 });
  }
  return result;
}

function getLastSemesterActivities(userId) {
  // Retorna todas as atividades do usuário nos últimos 6 meses
  const stmt = db.prepare(`
    SELECT * FROM activities 
    WHERE userId = ? 
      AND date(timestamp) >= date('now', '-6 months', 'localtime')
    ORDER BY timestamp DESC
  `);
  return stmt.all(parseInt(userId, 10));
}

function addFalta(faltaData) {
  // Verificar se já existe falta para este usuário nesta data
  const checkStmt = db.prepare('SELECT id FROM faltas WHERE userId = ? AND date = ?');
  const existing = checkStmt.get(faltaData.userId, faltaData.date);
  if (existing) return { id: existing.id, ...faltaData }; // Já existe, retorna

  const stmt = db.prepare('INSERT INTO faltas (userId, userName, userTurma, userTurno, date, timestamp, motivo) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const info = stmt.run(
    faltaData.userId,
    faltaData.userName,
    faltaData.userTurma,
    faltaData.userTurno || 'N/A',
    faltaData.date,
    faltaData.timestamp || new Date().toISOString(),
    faltaData.motivo || ''
  );
  return { id: info.lastInsertRowid, ...faltaData };
}

function initializeTodaysFaltas() {
  // Registrar faltas automáticas para todos os alunos esperados hoje
  const today = new Date();
  const todayDay = today.getDay(); // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
  const todayDate = today.toLocaleDateString('pt-BR');

  console.log(`[DEBUG initializeTodaysFaltas] Hoje: ${todayDate}, getDay: ${todayDay}`);

  // Verificar se já inicializou faltas hoje
  const checkStmt = db.prepare("SELECT COUNT(*) as count FROM faltas WHERE date = ?");
  const result = checkStmt.get(todayDate);
  if (result.count > 0) {
    console.log(`[DEBUG initializeTodaysFaltas] Faltas já inicializadas hoje (${result.count})`);
    return;
  }

  const users = getUsers();
  console.log(`[DEBUG initializeTodaysFaltas] Total de usuários: ${users.length}`);

  const usersScheduledToday = users.filter(u => {
    // diasSemana pode ter strings ou números (1-7 ou 0-6)
    // Converter para string para comparação segura
    const todayDayStr = String(todayDay);
    const todayDayStr1to7 = String(todayDay === 0 ? 7 : todayDay);
    
    const isScheduled = u.diasSemana && (
      u.diasSemana.includes(todayDay) || 
      u.diasSemana.includes(todayDayStr) ||
      u.diasSemana.includes(todayDayStr1to7)
    );
    
    if (isScheduled) {
      console.log(`[DEBUG] ${u.nome}: ${JSON.stringify(u.diasSemana)} - INCLUÍDO (dia ${todayDay})`);
    }
    return isScheduled;
  });

  console.log(`[DEBUG initializeTodaysFaltas] Usuários agendados hoje: ${usersScheduledToday.length}`);

  usersScheduledToday.forEach(user => {
    addFalta({
      userId: user.id,
      userName: user.nome,
      userTurma: user.turma,
      userTurno: user.turno || 'N/A',
      date: todayDate,
      timestamp: new Date().toISOString(),
      motivo: ''
    });
  });

  return usersScheduledToday.length;
}

function getFaltas(filters = {}) {
  // Join com users para garantir turno atualizado
  let sql = `
    SELECT f.*, u.turno as realTurno 
    FROM faltas f
    LEFT JOIN users u ON f.userId = u.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.date) {
    sql += ' AND f.date = ?';
    params.push(filters.date);
  }
  if (filters.turma) {
    sql += ' AND f.userTurma = ?';
    params.push(filters.turma);
  }
  if (filters.userId) {
    sql += ' AND f.userId = ?';
    params.push(filters.userId);
  }

  sql += ' ORDER BY f.date DESC, f.timestamp DESC';
  const stmt = db.prepare(sql);
  const results = stmt.all(...params);

  // Sobrescrever userTurno com realTurno se disponível
  return results.map(r => ({
    ...r,
    userTurno: r.realTurno || r.userTurno
  }));
}

function deleteFalta(faltaId) {
  const stmt = db.prepare('DELETE FROM faltas WHERE id = ?');
  const info = stmt.run(parseInt(faltaId, 10));
  return info.changes > 0;
}
// --- Settings Table ---
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

function getSettings() {
  const rows = db.prepare("SELECT key, value FROM settings").all();
  const settings = {};
  rows.forEach(row => {
    settings[row.key] = row.value;
  });
  return settings;
}

function saveSettings(newSettings) {
  const insert = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
  const transaction = db.transaction((obj) => {
    for (const [key, value] of Object.entries(obj)) {
      insert.run(key, String(value));
    }
  });
  transaction(newSettings);
  return getSettings();
}

module.exports = {
  getUsers,
  addUser,
  getUserById,
  updateUser,
  deleteUser,
  getActivities,
  addActivity,
  getNextUserId,
  clearAllActivities,
  removeDuplicates,
  getNextActivityType,
  updateActivity,
  checkLogin,
  getWeeklyStats,
  getSettings,
  saveSettings,
  getLastSemesterActivities,
  addFalta,
  getFaltas,
  deleteFalta,
  initializeTodaysFaltas
};
