const Database = require('../desktop-app/node_modules/better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../desktop-app/data/veritas.sqlite');
console.log(`Checking DB at: ${dbPath}`);

const db = new Database(dbPath);

try {
    const row = db.prepare('SELECT count(*) as count FROM users').get();
    console.log(`Total users: ${row.count}`);
} catch (err) {
    console.error('Error querying database:', err);
}
