const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const serverModule = require('./bundle.js');

let win = null;

function createWindow(port) {
    const opts = {
        width: 1440,
        height: 900,
        autoHideMenuBar: true,
        title: 'FZ BoardView',
        backgroundColor: '#11151c'
    };
    if (process.platform === 'win32' || process.platform === 'darwin') {
        const iconPath = path.join(__dirname, 'icon.ico');
        if (fs.existsSync(iconPath)) opts.icon = iconPath;
    }
    win = new BrowserWindow(opts);
    win.loadURL('http://localhost:' + port);
    win.on('closed', () => {
        win = null;
        app.quit();
    });
}

app.whenReady().then(() => {
    app.setAppUserModelId('FZ.BoardView');
    const srv = serverModule.start(0, { openBrowser: false });
    srv.on('listening', () => {
        createWindow(srv.address().port);
    });
    srv.on('error', (e) => {
        console.error('server error: ' + e.message);
        app.quit();
    });
});

app.on('window-all-closed', () => {
    app.quit();
});