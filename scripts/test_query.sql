-- Ver alguns usuários e seus diasSemana
SELECT id, nome, diasSemana FROM users LIMIT 5;

-- Ver faltas registradas hoje
SELECT COUNT(*) as faltas_hoje FROM faltas WHERE date = date('now', 'localtime');

-- Ver all faltas
SELECT id, userName, userTurma, date FROM faltas LIMIT 10;
