const sharp = require('sharp');
const fs = require('fs');

async function check() {
    const files = ['exemple1.png', 'exemple2.png', 'exemple3.png', 'exemple4.png'];
    for (const f of files) {
        const meta = await sharp(`public/uploads/ladder/${f}`).metadata();
        console.log(`${f}: ${meta.width}x${meta.height}, format: ${meta.format}`);
    }
}
check();
