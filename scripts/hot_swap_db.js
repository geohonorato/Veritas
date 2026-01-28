const Database = require('../desktop-app/node_modules/better-sqlite3');
const path = require('path');

const srcPath = path.join(__dirname, '../cesupa-dashboard/veritas.sqlite');
const destPath = path.join(__dirname, '../desktop-app/data/veritas.sqlite');

console.log(`Source: ${srcPath}`);
console.log(`Dest: ${destPath}`);

const db = new Database(destPath);

try {
    // Attach source database
    db.prepare(`ATTACH DATABASE '${srcPath}' AS src_db`).run();
    console.log('Attached source DB.');

    // Get list of tables from source
    const tables = db.prepare("SELECT name FROM src_db.sqlite_master WHERE type='table' AND name != 'sqlite_sequence'").all();
    console.log('Tables found:', tables.map(t => t.name).join(', '));

    const copyTransaction = db.transaction(() => {
        for (const table of tables) {
            const tableName = table.name;
            console.log(`Syncing table: ${tableName}`);
            
            // Clear destination table (except sqlite_sequence)
            // Check if table exists in dest
            const destExists = db.prepare(`SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name=?`).get(tableName);
            
            if (destExists.count > 0) {
                 console.log(`Dropping table ${tableName} in destination...`);
                 db.prepare(`DROP TABLE main.${tableName}`).run();
            }

            console.log(`Creating table ${tableName} from source schema...`);
            // Get Schema from source
            const schema = db.prepare(`SELECT sql FROM src_db.sqlite_master WHERE type='table' AND name=?`).get(tableName);
            if (schema && schema.sql) {
                 db.prepare(schema.sql).run();
            }

            // Insert data
            db.prepare(`INSERT INTO main.${tableName} SELECT * FROM src_db.${tableName}`).run();
            console.log(`Copied data for ${tableName}.`);
        }
    });

    copyTransaction();
    console.log('Database hot-swap completed successfully.');
    
    db.prepare("DETACH DATABASE src_db").run();

} catch (err) {
    console.error('Hot-swap failed:', err);
}
