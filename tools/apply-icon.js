const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = path.resolve(__dirname, '..');
const exe = process.argv[2] || path.join(root, '..', 'dist', 'FZBoardView-win32-x64', 'FZBoardView.exe');
const ico = process.argv[3] || path.join(root, '..', 'icono.ico');

if (!fs.existsSync(ico)) {
    console.log('apply-icon: no se encuentra el icono ' + ico);
    process.exit(0);
}

const rcedit = path.join(root, 'node_modules', 'rcedit', 'bin', 'rcedit-x64.exe');

try {
    cp.execFileSync(rcedit, [exe, '--set-icon', ico], { stdio: 'inherit' });
    console.log('apply-icon: icono aplicado a ' + exe);
} catch (e) {
    console.error('apply-icon: error aplicando icono: ' + (e.message || e));
    process.exit(1);
}