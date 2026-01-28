const fs = require('fs');
const path = require('path');
const Database = require('../desktop-app/node_modules/better-sqlite3');

const SOURCE_JSON = path.join(__dirname, '../cesupa-dashboard/database.json');
const TARGET_DB_DIR = path.join(__dirname, '../desktop-app/data');
const TARGET_DB = path.join(TARGET_DB_DIR, 'veritas.sqlite');

function migrate() {
    console.log('--- Starting Migration: Cesupa Dashboard -> Veritas SQLite ---');
    console.log(`Source: ${SOURCE_JSON}`);
    console.log(`Target: ${TARGET_DB}`);

    if (!fs.existsSync(SOURCE_JSON)) {
        console.error('ERROR: Source JSON file not found.');
        process.exit(1);
    }

    if (!fs.existsSync(TARGET_DB_DIR)) {
        fs.mkdirSync(TARGET_DB_DIR, { recursive: true });
    }

    const db = new Database(TARGET_DB);

    // Ensure table exists (simplified schema check)
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

    // Ensure 'turno' column exists
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

    const rawData = fs.readFileSync(SOURCE_JSON, 'utf8');
    let jsonData;
    try {
        jsonData = JSON.parse(rawData);
    } catch (e) {
        console.error('ERROR: Failed to parse Source JSON.', e);
        process.exit(1);
    }

    const users = jsonData.users || [];
    console.log(`Found ${users.length} users in source JSON.`);

    const insertOrUpdate = db.prepare(`
        INSERT INTO users (id, nome, matricula, turma, email, genero, cabine, turno, diasSemana)
        VALUES (@id, @nome, @matricula, @turma, @email, @genero, @cabine, @turno, @diasSemana)
        ON CONFLICT(matricula) DO UPDATE SET
            nome = excluded.nome,
            turma = excluded.turma,
            email = excluded.email,
            genero = excluded.genero,
            cabine = excluded.cabine,
            turno = excluded.turno,
            diasSemana = excluded.diasSemana
    `);

    // We also need to handle ID conflicts if matricula changed but ID didn't (unlikely but possible).
    // Or if ID is PRIMARY KEY, we might have collisions. 
    // Strategy: We respect the ID from JSON if possible, but if it conflicts with an existing ID of a DIFFERENT matricula, we might have issues.
    // However, SQLite AUTOINCREMENT is usually strictly increasing. 
    // SAFEST STRATEGY for ID: Let SQLite handle IDs for new inserts?
    // BUT we want to preserve IDs if they match the source to keep consistency if source is "canonical".
    // given "user.id" is in the JSON, let's try to use it. If there is a PK conflict, we might need to ignore ID or update ID.
    // simpler: Insert with ID. If PK conflict, we upsert. Use REPLACE or ON CONFLICT(id).
    // Wait, ON CONFLICT(matricula) is ensuring uniqueness of matricula.
    // If we have an ID collision with a DIFFERENT matricula, it will fail.
    // FOR SAFETY: Let's NOT force the ID from JSON if it risks collision, OR we assume JSON is the master.
    // Let's assume JSON is master for now.

    const insertOrUpdateWithId = db.prepare(`
        INSERT INTO users (id, nome, matricula, turma, email, genero, cabine, turno, diasSemana)
        VALUES (@id, @nome, @matricula, @turma, @email, @genero, @cabine, @turno, @diasSemana)
        ON CONFLICT(id) DO UPDATE SET
            nome = excluded.nome,
            matricula = excluded.matricula,
            turma = excluded.turma,
            email = excluded.email,
            genero = excluded.genero,
            cabine = excluded.cabine,
            turno = excluded.turno,
            diasSemana = excluded.diasSemana
    `);

    // Actually, uniqueness of matricula is also a constraint. 
    // If we update ID X with Matricula Y, but Matricula Y already exists at ID Z... constraint fail.
    // To handle this properly without complex logic, we can:
    // 1. Check if matricula exists. If so, update that record (whatever the ID).
    // 2. If not, insert.
    // This ignores the JSON ID but keeps referential integrity of existing DB if activities refer to it.
    // BUT the user might want the IDs from JSON.
    // Let's stick effectively to "Update by Matricula" as primary key for logic.

    const checkMatricula = db.prepare("SELECT id FROM users WHERE matricula = ?");
    const updateByMatricula = db.prepare(`
        UPDATE users SET nome=@nome, turma=@turma, email=@email, genero=@genero, cabine=@cabine, turno=@turno, diasSemana=@diasSemana
        WHERE matricula = @matricula
    `);

    // We will allow SQLite to generate new IDs for NEW matriculas to avoid ID collision.
    const insertNew = db.prepare(`
        INSERT INTO users (nome, matricula, turma, email, genero, cabine, turno, diasSemana)
        VALUES (@nome, @matricula, @turma, @email, @genero, @cabine, @turno, @diasSemana)
    `);

    // Activity Statements
    const checkActivity = db.prepare("SELECT id FROM activities WHERE userId = ? AND timestamp = ?");
    const insertActivity = db.prepare(`
        INSERT INTO activities (userId, userName, userTurma, userCabine, userTurno, type, timestamp)
        VALUES (@userId, @userName, @userTurma, @userCabine, @userTurno, @type, @timestamp)
    `);

    let updated = 0;
    let added = 0;
    let skipped = 0;
    let activitiesAdded = 0;
    let activitiesSkipped = 0;

    // Map JSON ID -> SQLite ID (Real ID)
    const idMap = new Map();

    const runTransaction = db.transaction((userList, activityList) => {
        // 1. Process Users & Build Map
        for (const u of userList) {
            try {
                let realId;
                const existing = checkMatricula.get(u.matricula);

                const payload = {
                    nome: u.nome,
                    matricula: u.matricula,
                    turma: u.turma,
                    email: u.email,
                    genero: u.genero,
                    cabine: u.cabine,
                    turno: u.turno || null,
                    diasSemana: JSON.stringify(u.diasSemana || [])
                };

                if (existing) {
                    // Update
                    updateByMatricula.run(payload);
                    realId = existing.id;
                    updated++;
                } else {
                    // Insert
                    const info = insertNew.run(payload);
                    realId = info.lastInsertRowid;
                    added++;
                }

                // Map the JSON ID to the Real SQLite ID
                if (u.id) {
                    idMap.set(u.id, realId);
                }

            } catch (err) {
                console.error(`Error processing user ${u.nome} (${u.matricula}):`, err.message);
                skipped++;
            }
        }

        // 2. Process Activities
        if (activityList && activityList.length > 0) {
            console.log(`Processing ${activityList.length} activities...`);
            for (const act of activityList) {
                try {
                    const jsonUserId = act.userId;
                    const realUserId = idMap.get(jsonUserId);

                    if (!realUserId) {
                        // User not found in map (maybe skipped or didn't exist in users array?)
                        // console.warn(`Skipping activity for JSON UserID ${jsonUserId} (No mapping found)`);
                        activitiesSkipped++;
                        continue;
                    }

                    // Check for duplicate activity (same user + same time)
                    const exists = checkActivity.get(realUserId, act.timestamp);
                    if (!exists) {
                        insertActivity.run({
                            userId: realUserId,
                            userName: act.userName,
                            userTurma: act.userTurma,
                            userCabine: act.userCabine,
                            userTurno: act.userTurno,
                            type: act.type,
                            timestamp: act.timestamp
                        });
                        activitiesAdded++;
                    } else {
                        activitiesSkipped++;
                    }
                } catch (e) {
                    console.error('Error inserting activity:', e.message);
                    activitiesSkipped++;
                }
            }
        }
    });

    try {
        const activities = jsonData.activities || [];
        runTransaction(users, activities); // Pass both lists

        console.log('--- Migration Completed ---');
        console.log(`[Users]`);
        console.log(`  Source: ${users.length}`);
        console.log(`  Added: ${added}`);
        console.log(`  Updated: ${updated}`);
        console.log(`  Errors: ${skipped}`);

        console.log(`[Activities]`);
        console.log(`  Source: ${activities.length}`);
        console.log(`  Added: ${activitiesAdded}`);
        console.log(`  Skipped (Duplicate/Orphan): ${activitiesSkipped}`);

        const count = db.prepare("SELECT count(*) as c FROM users").get().c;
        const countAct = db.prepare("SELECT count(*) as c FROM activities").get().c;
        console.log(`Total Users in DB: ${count}`);
        console.log(`Total Activities in DB: ${countAct}`);

    } catch (e) {
        console.error('Transaction Failed:', e);
    }
}

migrate();
