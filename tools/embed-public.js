const fs = require('fs');
const path = require('path');

const PUB = path.join(__dirname, '..', 'public');

const out = {};
for (const f of fs.readdirSync(PUB)) {
    if (!fs.statSync(path.join(PUB, f)).isFile()) continue;
    out[f] = fs.readFileSync(path.join(PUB, f), 'utf8');
}

const js = 'module.exports = ' + JSON.stringify(out) + ';\n';
fs.writeFileSync(path.join(__dirname, '..', 'embedded-assets.js'), js);
console.log('embedded-assets.js generado: ' + Object.keys(out).join(', '));