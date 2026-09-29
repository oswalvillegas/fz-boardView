const http = require('http');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { loadBoard, loadTvw } = require('./lib/fz.js');

const isPkg = !!process.pkg || !/^node(\.exe)?$/i.test(path.basename(process.execPath));
const EMBED = require('./embedded-assets.js');
const EXE_DIR = isPkg ? path.dirname(process.execPath) : null;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const brArg = process.argv.indexOf('--board-root');
let BOARD_ROOT = brArg >= 0
    ? path.resolve(process.argv[brArg + 1])
    : (process.env.BOARD_ROOT || (isPkg ? EXE_DIR : path.resolve(ROOT, '..')));
if (isPkg) {
    const withBoards = (dir) => {
        const found = [];
        walkFz(dir, found, 0);
        return found.length > 0;
    };
    if (!withBoards(BOARD_ROOT)) {
        const parent = path.resolve(BOARD_ROOT, '..');
        if (withBoards(parent)) BOARD_ROOT = parent;
    }
}
const PORT = process.env.PORT || 9000;
const RECENT = isPkg ? path.join(BOARD_ROOT, 'recent.json') : path.join(ROOT, 'recent.json');
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.fz': 'application/octet-stream',
    '.cad': 'text/plain; charset=utf-8',
};

const cliFile = process.argv[2] ? path.resolve(process.argv[2]) : null;

function walkFz(dir, out, depth) {
    if (depth > 6) return out;
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
        return out;
    }
    for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
            walkFz(full, out, depth + 1);
        } else if (ent.isFile() && /\.(fz|brd|bdv|tvw|cad)$/i.test(ent.name)) {
            out.push(full);
        }
    }
    return out;
}

function json(res, obj) {
    const body = JSON.stringify(obj);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(body);
}

function error(res, msg, code) {
    res.writeHead(code || 400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: String(msg) }));
}

function loadRecent() {
    try {
        const arr = JSON.parse(fs.readFileSync(RECENT, 'utf8'));
        return Array.isArray(arr) ? arr : [];
    } catch (e) {
        return [];
    }
}

function saveRecent(list) {
    try {
        fs.writeFileSync(RECENT, JSON.stringify(list, null, 2));
    } catch (e) {
        // ignore write errors
    }
}

function normPath(p) {
    return String(p).replace(/\\/g, '/').toLowerCase();
}

function addRecent(entry) {
    const list = loadRecent().filter((x) => normPath(x.path) !== normPath(entry.path));
    list.unshift(Object.assign({ ts: Date.now() }, entry));
    if (list.length > 30) list.length = 30;
    saveRecent(list);
}

function findBoardPath(name) {
    const found = [];
    walkFz(BOARD_ROOT, found, 0);
    for (const f of found) {
        if (path.basename(f).toLowerCase() === String(name).toLowerCase()) return f;
    }
    return null;
}

function saveUpload(buf, name) {
    const dir = path.join(BOARD_ROOT, 'uploads');
    try {
        fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
        // ignore
    }
    const base = (name || 'archivo').replace(/[<>:"/\\|?*]/g, '_');
    const fp = path.join(dir, base);
    fs.writeFileSync(fp, buf);
    return fp;
}

function serveBoard(res, readFn, label, onOk) {
    try {
        const buf = readFn();
        const board = /\.tvw$/i.test(String(label))
            ? loadTvw(buf)
            : loadBoard(buf, label);
        if (onOk) onOk();
        json(res, Object.assign({ ok: true, file: label }, board));
    } catch (e) {
        error(res, e.message);
    }
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;

    if (p === '/api/load') {
        const fp = url.searchParams.get('path');
        if (!fp) return error(res, 'missing path');
        serveBoard(res, () => fs.readFileSync(fp), fp, () => {
            addRecent({ path: fp, name: path.basename(fp) });
        });
        return;
    }

    if (p === '/api/load-bytes') {
        const name = url.searchParams.get('name') || '';
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
            let savedPath = null;
            const buf = Buffer.concat(chunks);
            const real = name ? findBoardPath(name) : null;
            if (real) {
                savedPath = real;
            } else {
                try {
                    savedPath = saveUpload(buf, name || 'archivo');
                } catch (e) {
                    savedPath = name || 'uploaded file';
                }
            }
            serveBoard(res, () => buf, savedPath, () => {
                addRecent({ path: savedPath, name: path.basename(savedPath) });
            });
        });
        return;
    }

    if (p === '/api/recent') {
        json(res, { recent: loadRecent() });
        return;
    }

    if (p === '/api/list') {
        const root = cliFile ? path.dirname(cliFile) : BOARD_ROOT;
        json(res, { files: walkFz(root, [], 0), current: cliFile });
        return;
    }

    if (p.startsWith('/api/')) {
        return error(res, 'endpoint not found', 404);
    }

    let f = path.normalize(path.join(PUBLIC, p === '/' ? 'index.html' : p));
    if (!f.startsWith(PUBLIC)) {
        res.writeHead(403);
        return res.end('forbidden');
    }
    const name = path.basename(f);
    if (isPkg && Object.prototype.hasOwnProperty.call(EMBED, name)) {
        res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
        return res.end(EMBED[name]);
    }
    fs.readFile(f, (err, data) => {
        if (err) {
            res.writeHead(404);
            return res.end('not found');
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
        res.end(data);
    });
});

function start(port, opts) {
    opts = opts || {};
    return server.listen(port === undefined || port === null ? PORT : port, () => {
        const addr = server.address().port;
        console.log('FZ BoardView server on http://localhost:' + addr);
        if (cliFile) console.log('Pre-selected file: ' + cliFile);
        if (opts.openBrowser && isPkg) {
            try {
                cp.exec('start "" "http://localhost:' + addr + '"');
            } catch (e) {
                // ignore
            }
        }
    });
}

if (require.main === module) {
    start(null, { openBrowser: true });
}

module.exports = { start };