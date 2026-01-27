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
  const user = getUserById(activityData.userId);
  if (!user) {
    console.error(`Tentativa de registrar atividade para usuário não encontrado. ID: ${activityData.userId}`);
    return null;
  }

  const type = getNextActivityType(activityData.userId);
  const stmt = db.prepare('INSERT INTO activities (userId, userName, userTurma, userCabine, userTurno, type, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)');

  const info = stmt.run(
    user.id,
    user.nome,
    user.turma || 'N/A',
    user.cabine || 'N/A',
    user.turno || 'N/A',
    type,
    activityData.timestamp || new Date().toISOString()
  );

  return { id: info.lastInsertRowid, ...activityData, type };
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
  getLastSemesterActivities
};
