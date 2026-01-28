const db = require('better-sqlite3')('./desktop-app/data/veritas.sqlite');

// Ver alguns usuários
const users = db.prepare("SELECT id, nome, diasSemana FROM users LIMIT 5").all();
console.log('=== Usuários ===');
users.forEach(u => {
  console.log(`${u.id} - ${u.nome}: ${u.diasSemana}`);
});

// Ver o dia de hoje
const today = new Date();
console.log(`\n=== Hoje ===`);
console.log(`getDay(): ${today.getDay()} (0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab)`);
console.log(`Data formatada: ${today.toLocaleDateString('pt-BR')}`);

// Teste de filtro
console.log(`\n=== Teste de Filtro ===`);
users.forEach(u => {
  const parsed = JSON.parse(u.diasSemana || '[]');
  const scheduled = parsed.includes(today.getDay());
  console.log(`${u.nome}: ${JSON.stringify(parsed)} - Inclui dia ${today.getDay()}? ${scheduled}`);
});

// Ver faltas já registradas hoje
const todayDate = today.toLocaleDateString('pt-BR');
const faltas = db.prepare("SELECT COUNT(*) as count FROM faltas WHERE date = ?").get(todayDate);
console.log(`\n=== Faltas Hoje ===`);
console.log(`Faltas registradas: ${faltas.count}`);
