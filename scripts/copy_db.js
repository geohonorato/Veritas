const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../cesupa-dashboard/veritas.sqlite');
const destDir = path.join(__dirname, '../desktop-app/data');
const dest = path.join(destDir, 'veritas.sqlite');
const destShm = path.join(destDir, 'veritas.sqlite-shm');
const destWal = path.join(destDir, 'veritas.sqlite-wal');

console.log(`Copying from ${src} to ${dest}`);

try {
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    if (fs.existsSync(destShm)) fs.unlinkSync(destShm);
    if (fs.existsSync(destWal)) fs.unlinkSync(destWal);
    
    fs.copyFileSync(src, dest);
    console.log('Copy successful.');
} catch (err) {
    console.error('Copy failed:', err);
}
