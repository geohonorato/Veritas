const fs = require('fs');
const path = require('path');
// Usa 'app' do Electron para encontrar a pasta de dados do usuário, que é um local seguro e persistente
const { app } = require('electron'); 

// Define o caminho correto e persistente para o banco de dados
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'database.json');
// Define o caminho antigo para fins de migração
const oldDbPath = path.join(__dirname, 'database.json');

const defaultData = {
  users: [],
  activities: []
};

// Salva o banco de dados no disco (no novo local)
function save() {
  try {
    const jsonData = JSON.stringify(db, null, 2);
    fs.writeFileSync(dbPath, jsonData);
  } catch (error) {
    console.error("Erro ao salvar o banco de dados:", error);
  }
}

// Carrega o banco de dados em memória uma vez
let db = defaultData;
try {
  // Se o banco de dados já existe no novo local, carrega-o
  if (fs.existsSync(dbPath)) {
    const jsonData = fs.readFileSync(dbPath);
    db = JSON.parse(jsonData);
  } 
  // Se não, verifica se existe um banco de dados no local antigo (para migração)
  else if (fs.existsSync(oldDbPath)) {
    console.log('Migrando banco de dados do local antigo...');
    const jsonData = fs.readFileSync(oldDbPath);
    db = JSON.parse(jsonData);
    save(); // Salva imediatamente no novo local
    console.log('Migração concluída com sucesso para:', dbPath);
  }
  // Se não existe em nenhum dos locais, cria um novo no local correto
  else {
    save(); // Salva os dados padrão no novo local
  }
} catch (error) {
  console.error("Erro fatal ao carregar ou migrar o banco de dados:", error);
}

function getUsers() {
  return db.users;
}

function addUser(user) {
  // Verifica se já existe um usuário com a mesma matrícula
  const existingUser = db.users.find(u => u.matricula === user.matricula);
  if (existingUser) {
    // Retorna um erro ou um indicador de que o usuário já existe
    return { error: 'Usuário com esta matrícula já existe.' };
  }

  // Garante que o ID seja um número
  user.id = parseInt(user.id, 10);
  // Garante que diasSemana seja um array de números
  user.diasSemana = user.diasSemana ? user.diasSemana.map(Number) : [];
  // Garante que a cabine seja uma string
  user.cabine = user.cabine || 'N/A';
  user.genero = user.genero || 'N/A';
  user.acao = user.acao || 'N/A';
  user.turno = user.turno || 'N/A';
  db.users.push(user);
  save(); // Salva após adicionar um usuário (operação crítica)
  return user;
}

function getUserById(id) {
    // Garante que a comparação seja feita com o mesmo tipo (número)
    return db.users.find(u => u.id === parseInt(id, 10));
}

function updateUser(userId, updatedData) {
  const userIndex = db.users.findIndex(u => u.id === parseInt(userId, 10));
  if (userIndex === -1) {
    return null;
  }

  // Garante que diasSemana seja um array de números
  if (updatedData.diasSemana) {
    updatedData.diasSemana = updatedData.diasSemana.map(Number);
  }
  // Garante que a cabine seja uma string
  if (updatedData.cabine) {
    updatedData.cabine = updatedData.cabine;
  }
  if (updatedData.genero) {
    updatedData.genero = updatedData.genero;
  }
  if (updatedData.acao) {
    updatedData.acao = updatedData.acao;
  }
  if (updatedData.turno) {
    updatedData.turno = updatedData.turno;
  }
  
  // Atualiza o usuário, mantendo o ID original
  db.users[userIndex] = { ...db.users[userIndex], ...updatedData };
  save();
  return db.users[userIndex];
}

function deleteUser(userId) {
  const initialLength = db.users.length;
  db.users = db.users.filter(u => u.id !== parseInt(userId, 10));
  if (db.users.length < initialLength) {
    save();
    return true;
  }
  return false;
}

function getActivities() {
  return db.activities;
}

function getNextActivityType(userId) {
  const lastActivity = db.activities
    .filter(a => a.userId === userId)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .pop();
  
  return (!lastActivity || lastActivity.type === 'SAIDA') ? 'Entrada' : 'SAIDA';
}

function addActivity(activityData) {
  const user = getUserById(activityData.userId);
  if (!user) {
    console.error(`Tentativa de registrar atividade para usuário não encontrado. ID: ${activityData.userId}`);
    return null;
  }
    
  const type = getNextActivityType(activityData.userId);

  const newActivity = {
    userId: user.id,
    userName: user.nome,
    userTurma: user.turma || 'N/A', // Garante que userTurma seja sempre uma string
    userCabine: user.cabine || 'N/A', // Adiciona a cabine à atividade
    userTurno: user.turno || 'N/A', // Adiciona o turno à atividade
    type,
    timestamp: activityData.timestamp || new Date().toISOString()
  };

  db.activities.push(newActivity);
  save(); // Salva a cada atividade para garantir persistência
  return newActivity;
}

function getNextUserId() {
    const maxId = db.users.reduce((max, user) => (user.id > max ? user.id : max), 0);
    return maxId + 1;
}


function clearAllActivities() {
  db.activities = [];
  save();
  return { status: 'success', message: 'Todos os registros de atividades foram apagados.' };
}

function removeDuplicates() {
  const uniqueUsers = [];
  const seenMatriculas = new Set();
  let removedCount = 0;

  db.users.forEach(user => {
    if (seenMatriculas.has(user.matricula)) {
      removedCount++;
    } else {
      seenMatriculas.add(user.matricula);
      uniqueUsers.push(user);
    }
  });

  db.users = uniqueUsers;
  save();
  return { status: 'success', count: removedCount };
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
  getNextActivityType
};
