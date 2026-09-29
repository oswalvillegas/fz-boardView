'use strict';

const $ = (id) => document.getElementById(id);

const COL = {
    boardFill: '#171c21',
    boardLine: '#3d4650',
    pinTop: '#cfd8dc',
    pinBot: '#4fc3f7',
    nail: '#ffb300',
    label: '#aed581',
    sel: '#ffd54f',
    halo: '#ff5252',
    selPin: '#4caf50',
    hover: '#ffffff',
    pinLabel: '#dfe7eb',
    partBox: '#7d8991',
    silk: 'rgba(160, 225, 190, 0.55)',
};

const TAU = Math.PI * 2;

const I18N = {
    es: {
        open: 'Abrir', fit: 'Ajustar', clear: 'Limpiar', search: 'Búsqueda', language: 'Idioma', searchPlaceholder: 'refdes o red...', panel: 'Panel', selectFile: 'Seleccionar archivo', noSelection: 'Sin selección',
        side: 'Lado', all: 'Todos', top: 'Superior', bottom: 'Inferior', nails: 'Clavos', color: 'Color', net: 'Red', flip: 'Voltear', rotate: 'Rotar', rotation: 'Rotación', idx: 'Índice',
        dropFile: 'Arrastra un archivo .fz', part: 'Parte', connection: 'Conexión', info: 'Info', connections: 'Conexiones',
        board: 'Placa', content: 'Contenido', pieces: 'Piezas', pins: 'Pines', nets: 'Redes', vias: 'Vías', filter: 'Filtro',
        ref: 'Ref.', pin: 'Pin', pinName: 'Nombre', infoCol: 'Información', selected: 'seleccionado', noSelection: 'sin selección',
    },
    en: {
        open: 'Open', fit: 'Fit', clear: 'Clear', search: 'Search', language: 'Language', searchPlaceholder: 'refdes or net...', panel: 'Panel', selectFile: 'Select a file', noSelection: 'No selection',
        side: 'Side', all: 'All', top: 'Top', bottom: 'Bottom', nails: 'Nails', color: 'Color', net: 'Net', flip: 'Flip', rotate: 'Rotate', rotation: 'Rotation', idx: 'Index',
        dropFile: 'Drop a .fz file', part: 'Part', connection: 'Connection', info: 'Info', connections: 'Connections',
        board: 'Board', content: 'Content', pieces: 'Parts', pins: 'Pins', nets: 'Nets', vias: 'Vias', filter: 'Filter',
        ref: 'Ref.', pin: 'Pin', pinName: 'Name', infoCol: 'Information', selected: 'selected', noSelection: 'no selection',
    },
    fr: {
        open: 'Ouvrir', fit: 'Ajuster', clear: 'Effacer', search: 'Recherche', language: 'Langue', searchPlaceholder: 'refdes ou réseau...', panel: 'Panneau', selectFile: 'Sélectionner un fichier', noSelection: 'Aucune sélection',
        side: 'Côté', all: 'Tous', top: 'Haut', bottom: 'Bas', nails: 'Clous', color: 'Couleur', net: 'Réseau', flip: 'Retourner', rotate: 'Tourner', rotation: 'Rotation', idx: 'Indice',
        dropFile: 'Déposez un fichier .fz', part: 'Pièce', connection: 'Connexion', info: 'Info', connections: 'Connexions',
        board: 'Carte', content: 'Contenu', pieces: 'Pièces', pins: 'Broches', nets: 'Réseaux', vias: 'Traversées', filter: 'Filtre',
        ref: 'Réf.', pin: 'Broche', pinName: 'Nom', infoCol: 'Information', selected: 'sélectionné', noSelection: 'aucune sélection',
    },
    zh: {
        open: '打开', fit: '适配', clear: '清除', search: '搜索', language: '语言', searchPlaceholder: '元件编号或网络...', panel: '面板', selectFile: '选择文件', noSelection: '未选择的元素',
        side: '侧面', all: '全部', top: '顶部', bottom: '底部', nails: '钉子', color: '颜色', net: '网络', flip: '翻转', rotate: '旋转', rotation: '旋转角度', idx: '索引',
        dropFile: '拖放 .fz 文件', part: '部件', connection: '连接', info: '信息', connections: '连接',
        board: '板面', content: '内容', pieces: '部件', pins: '引脚', nets: '网络', vias: '过孔', filter: '过滤',
        ref: '参考', pin: '引脚', pinName: '名称', infoCol: '信息', selected: '已选', noSelection: '未选择',
    },
};

let CURRENT_LANG = 'es';
let BOARD = null;
let GRID = null;
let REF_INDEX = {};

const V = {
    cx: 0, cy: 0, scale: 1, panX: 0, panY: 0,
    flip: false,
    rotation: 0,
    sideFilter: 1,
    showNails: true,
    netColor: false,
    pinLabel: 'idx',
    selPart: -1,
    selPin: -1,
    filterNets: new Set(),
    filterPins: new Set(),
    filterLabel: '',
    connView: false,
    boardView: true,
    searchMark: null,
    results: [],
    resultIdx: -1,
    hoverPin: -1,
    hoverPart: -1,
    raf: 0,
    dirty: false,
    drag: null,
};

const canvas = $('board');
const ctx = canvas.getContext('2d');
const tooltip = $('canvas-tooltip');
let DPR = 1;

function viewW() {
    return Math.max(canvas.clientWidth, 200);
}
function viewH() {
    return Math.max(canvas.clientHeight, 200);
}

function xf(x) {
    if (V.flip) return BOARD.x0 + BOARD.x1 - x;
    return x;
}

function transformPoint(x, y) {
    const centerX = (BOARD.x0 + BOARD.x1) / 2;
    const centerY = (BOARD.y0 + BOARD.y1) / 2;
    const dx = x - centerX;
    const dy = y - centerY;
    let tx = x, ty = y;
    if (V.rotation === 90) {
        tx = centerX - dy;
        ty = centerY + dx;
    } else if (V.rotation === 180) {
        tx = centerX - dx;
        ty = centerY - dy;
    } else if (V.rotation === 270) {
        tx = centerX + dy;
        ty = centerY - dx;
    }
    return [xf(tx), ty];
}

function toScreen(x, y) {
    const W = viewW(), H = viewH();
    const [tx, ty] = transformPoint(x, y);
    return [
        (tx - V.cx) * V.scale + W / 2 + V.panX,
        H / 2 - (ty - V.cy) * V.scale + V.panY,
    ];
}

function fromScreen(sx, sy) {
    const W = viewW(), H = viewH();
    let tx = (sx - W / 2 - V.panX) / V.scale + V.cx;
    const ty = V.cy + (H / 2 + V.panY - sy) / V.scale;
    if (V.flip) tx = BOARD.x0 + BOARD.x1 - tx;
    const centerX = (BOARD.x0 + BOARD.x1) / 2;
    const centerY = (BOARD.y0 + BOARD.y1) / 2;
    const dx = tx - centerX;
    const dy = ty - centerY;
    if (V.rotation === 90) return [centerX + dy, centerY - dx];
    if (V.rotation === 180) return [centerX - dx, centerY - dy];
    if (V.rotation === 270) return [centerX - dy, centerY + dx];
    return [tx, ty];
}

function zoomTo(wx, wy, ww, wh, pad) {
    const W = viewW(), H = viewH();
    if (pad === undefined) pad = 0.1;
    if (ww <= 0) ww = 100;
    if (wh <= 0) wh = 100;
    if (V.rotation === 90 || V.rotation === 270) [ww, wh] = [wh, ww];
    ww *= 1 + pad;
    wh *= 1 + pad;
    V.scale = Math.min(W / ww, H / wh) * 0.94;
    [V.cx, V.cy] = transformPoint(wx, wy);
    V.panX = 0;
    V.panY = 0;
    schedule();
}

function zoomAll() {
    zoomTo((BOARD.x0 + BOARD.x1) / 2, (BOARD.y0 + BOARD.y1) / 2,
        BOARD.x1 - BOARD.x0, BOARD.y1 - BOARD.y0);
}

function labelFontFont() {
    const base = 7 * Math.sqrt(V.scale);
    return Math.max(6, Math.floor(base)) + 'px Consolas, monospace';
}

function pinLabelFont() {
    const base = 8 * Math.sqrt(Math.max(V.scale, 0.25));
    return Math.max(6, Math.floor(base));
}

function partLabelFont(pw, ph, scale) {
    const shortSide = Math.min(pw, ph);
    const longSide = Math.max(pw, ph);
    const isRectangle = longSide / Math.max(shortSide, 1) >= 1.8;
    let u;
    if (!isRectangle) u = shortSide * 0.28;
    else if (ph <= pw) u = longSide * 0.12;
    else {
        // verticales: texto normal. SOLO si el elemento es tan alto que
        // abarca una parte importante del esquema (>=40% del alto del board),
        // su texto se reduce a un tamano fijo (fraccion del alto del board),
        // menor al de los elementos normales. Condicion y tamano son fijos,
        // por lo que nunca cambian con el zoom.
        const boardH = BOARD ? (BOARD.y1 - BOARD.y0) : 0;
        const giant = boardH > 0 && ph >= boardH * 0.4;
        u = giant ? boardH * 0.005 : longSide * 0.12;
    }
    return Math.max(8, Math.floor(u * (scale || 1)));
}

function fitPartLabelFont(partName, isTall, bw, bh, pw, ph, scale) {
    const base = partLabelFont(pw, ph, scale);
    let f = base;
    let font = 'bold ' + f + 'px Consolas, monospace';
    ctx.font = font;
    let tw = ctx.measureText(partName).width;
    return { f, font, tw };
}

function partLabelOpacity(fontSize) {
    if (fontSize < 40) return 1;
    const progress = Math.max(0, Math.min(1, (V.scale - 1.1) / 4));
    const sizeProgress = Math.min(0.45, (fontSize - 40) / 160);
    const fadeRate = 0.35 + sizeProgress;
    return Math.max(0.05, 0.5 - progress * fadeRate);
}

function shouldDrawPartLabel(bw, bh, part) {
    if (part && part === BOARD.parts[V.selPart]) return true;
    if (part && part === BOARD.parts[V.hoverPart]) return true;
    if (V.scale >= 1.5 && (bw > 120 || bh > 120)) return true;
    if (V.scale >= 0.8 && (bw > 180 || bh > 180)) return true;
    if (part) {
        const pw = part.x2 - part.x1;
        const ph = part.y2 - part.y1;
        if ((bw > 26 || bh > 26)) {
            if (pw > 300 || ph > 300) return true;
            if (V.scale >= 0.36 && (pw > 140 || ph > 140)) return true;
            if (V.scale >= 0.78 && (pw > 70 || ph > 70)) return true;
        }
    }
    return false;
}

function schedule() {
    if (!V.dirty) {
        V.dirty = true;
        V.raf = requestAnimationFrame(render);
    }
}

function render() {
    V.dirty = false;
    V.raf = 0;
    if (!BOARD) return;
    resizeCanvas();
    ctx.clearRect(0, 0, viewW(), viewH());

    const [w0x, w0y] = fromScreen(0, 0);
    const [w1x, w1y] = fromScreen(viewW(), viewH());
    const vx0 = Math.min(w0x, w1x) - 250;
    const vx1 = Math.max(w0x, w1x) + 250;
    const vy0 = Math.min(w0y, w1y) - 250;
    const vy1 = Math.max(w0y, w1y) + 250;

    const boardPx = Math.max((BOARD.x1 - BOARD.x0) * V.scale,
        (BOARD.y1 - BOARD.y0) * V.scale);
    if (boardPx < 200000) {
        ctx.beginPath();
        BOARD.outline.forEach(([x, y], i) => {
            const [sx, sy] = toScreen(x, y);
            if (i === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
        });
        ctx.closePath();
        ctx.fillStyle = COL.boardFill;
        ctx.fill();
        ctx.strokeStyle = COL.boardLine;
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    const drawn = new Set();
    const cell = 3;
    for (let i = 0; i < BOARD.pins.length; i++) {
        const pin = BOARD.pins[i];
        if (pin.x < vx0 || pin.x > vx1 || pin.y < vy0 || pin.y > vy1) continue;
        if (V.sideFilter && pin.s !== (V.sideFilter === 1 ? 'top' : 'bottom')) continue;
        const [sx, sy] = toScreen(pin.x, pin.y);
        if (sx < -20 || sx > viewW() + 20 || sy < -20 || sy > viewH() + 20) continue;
        const key = (sx / cell | 0) + ',' + (sy / cell | 0);
        const hoveredPart = V.hoverPart >= 0 ? BOARD.parts[V.hoverPart] : null;
        const isPartPin = hoveredPart && pin.ref === hoveredPart.name;
        const isSelPartPin = V.selPart >= 0 && pin.ref === BOARD.parts[V.selPart].name;
        const isActivePin = V.hoverPin === i || V.selPin === i || isPartPin || isSelPartPin;
        if (drawn.has(key) && !isActivePin) continue;
        drawn.add(key);
        const col = V.netColor ? netColor(pin.net)
            : (pin.s === 'bottom' ? COL.pinBot : COL.pinTop);
        const r = Math.min(Math.max(1.4, pin.rad * V.scale), 8.0);
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, TAU);
        ctx.strokeStyle = col;
        ctx.lineWidth = V.scale >= 1.0 ? 1.2 : 0.8;
        ctx.stroke();
        if (pin.l && isActivePin) {
            let ly = sy - Math.max(2.5, r * 0.9);
            if (ly < sy - 14) ly = sy - 14;
            ctx.fillStyle = COL.pinLabel;
            ctx.font = 'bold ' + pinLabelFont() + 'px Consolas, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(pinTag(pin) || pin.name || pin.l, sx, ly);
        }
    }

    if (V.showNails) {
        for (const nail of BOARD.nails) {
            if (nail.x < vx0 || nail.x > vx1 || nail.y < vy0 || nail.y > vy1) continue;
            if (V.sideFilter && nail.s !== (V.sideFilter === 1 ? 'top' : 'bottom')) continue;
            const [sx, sy] = toScreen(nail.x, nail.y);
            if (sx < -20 || sx > viewW() + 20 || sy < -20 || sy > viewH() + 20) continue;
            const r = 2.6;
            ctx.beginPath();
            ctx.moveTo(sx, sy - r);
            ctx.lineTo(sx + r, sy);
            ctx.lineTo(sx, sy + r);
            ctx.lineTo(sx - r, sy);
            ctx.closePath();
            ctx.fillStyle = COL.nail;
            ctx.fill();
        }
    }

    const hasSilk = !!(BOARD.labels && BOARD.labels.length);
    const partNames = new Set(hasSilk ? BOARD.parts.map(p => p.name) : []);
    const labelByPart = hasSilk ? new Map(BOARD.labels.map(l => [l.text, l])) : new Map();
    const boardSpan = Math.max(BOARD.x1 - BOARD.x0, BOARD.y1 - BOARD.y0);
    for (let i = 0; i < BOARD.parts.length; i++) {
        const part = BOARD.parts[i];
        if (V.sideFilter && part.side !== (V.sideFilter === 1 ? 'top' : 'bottom')) continue;
        if (!(part.x2 >= vx0 && part.x1 <= vx1 && part.y2 >= vy0 && part.y1 <= vy1)) continue;
        const [ax, ay] = toScreen(part.x1, part.y1);
        const [bx, by] = toScreen(part.x2, part.y2);
        const bw = Math.abs(bx - ax);
        const bh = Math.abs(by - ay);
        if (bw < 3 && bh < 3) continue;
        if (hasSilk && (part.x2 - part.x1 > boardSpan * 0.45 || part.y2 - part.y1 > boardSpan * 0.45)) continue;
        const borderPad = Math.max(6, Math.min(24, V.scale * 3));
        ctx.strokeStyle = COL.partBox;
        ctx.lineWidth = V.scale >= 0.8 ? 1.2 : 1;
        ctx.strokeRect(Math.min(ax, bx) - borderPad, Math.min(ay, by) - borderPad,
            bw + borderPad * 2, bh + borderPad * 2);
        const sideVisible = !V.sideFilter ||
            part.side === (V.sideFilter === 1 ? 'top' : 'bottom');
        if (sideVisible && (bw > 26 || bh > 26) && shouldDrawPartLabel(bw, bh, part)) {
            const isTall = part.y2 - part.y1 > (part.x2 - part.x1) * 1.8;
            const fit = fitPartLabelFont(part.name, isTall, bw, bh,
                part.x2 - part.x1, part.y2 - part.y1, V.scale);
            const fontSize = fit.f;
            ctx.font = fit.font;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            let labelX, labelY;
            const lp = labelByPart.get(part.name);
            if (lp) {
                const s = toScreen(lp.x, lp.y);
                labelX = s[0];
                labelY = s[1];
            } else {
                labelX = (ax + bx) / 2;
                labelY = (ay + by) / 2;
            }
            const textWidth = fit.tw;
            const textH = isTall ? textWidth : fontSize;
            const textW = isTall ? fontSize : textWidth;
            const textOutside = labelX - textW / 2 < 0 ||
                labelX + textW / 2 > viewW() ||
                labelY - textH / 2 < 0 ||
                labelY + textH / 2 > viewH();
            const opacity = textOutside ? 0.2 : 0.8;
            ctx.fillStyle = 'rgba(174, 213, 129, ' + opacity + ')';
            if (isTall) {
                ctx.save();
                ctx.translate(labelX, labelY);
                ctx.rotate(Math.PI / 2);
                ctx.fillText(part.name, 0, 0);
                ctx.restore();
            } else {
                ctx.fillText(part.name, labelX, labelY);
            }
        }
    }

    if (BOARD.labels && V.scale >= 0.2) {
        ctx.font = labelFontFont();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const lb of BOARD.labels) {
            if (partNames.has(lb.text)) continue;
            if (lb.x < vx0 || lb.x > vx1 || lb.y < vy0 || lb.y > vy1) continue;
            if (V.sideFilter && lb.side !== (V.sideFilter === 1 ? 'top' : 'bottom')) continue;
            const [sx, sy] = toScreen(lb.x, lb.y);
            if (sx < -40 || sx > viewW() + 40 || sy < -40 || sy > viewH() + 40) continue;
            ctx.fillStyle = COL.silk;
            ctx.fillText(lb.text, sx, sy);
        }
    }

    if (V.selPart >= 0 && BOARD.parts[V.selPart]) {
        const p = BOARD.parts[V.selPart];
        if (!V.sideFilter || p.side === (V.sideFilter === 1 ? 'top' : 'bottom')) {
            const [ax, ay] = toScreen(p.x1, p.y1);
            const [bx, by] = toScreen(p.x2, p.y2);
            ctx.strokeStyle = COL.sel;
            ctx.lineWidth = 2;
            ctx.strokeRect(Math.min(ax, bx) - 3, Math.min(ay, by) - 3,
                Math.abs(bx - ax) + 6, Math.abs(by - ay) + 6);
        }
    }

    if (V.selPin >= 0) {
        const pin = BOARD.pins[V.selPin];
        const net = pin.net;
        if (net && BOARD.netPins[net]) {
            for (const i of BOARD.netPins[net]) {
                if (i === V.selPin) continue;
                const p = BOARD.pins[i];
                if (V.sideFilter && p.s !== (V.sideFilter === 1 ? 'top' : 'bottom')) continue;
                const [sx, sy] = toScreen(p.x, p.y);
                if (sx < -30 || sx > viewW() + 30 || sy < -30 || sy > viewH() + 30) continue;
                const rr = Math.min(Math.max(4.0, p.rad * V.scale + 2.5), 16.0);
                ctx.save();
                ctx.shadowColor = COL.halo;
                ctx.shadowBlur = 9;
                ctx.beginPath();
                ctx.arc(sx, sy, rr, 0, TAU);
                ctx.strokeStyle = COL.halo;
                ctx.lineWidth = 1.5;
                ctx.stroke();
                ctx.restore();
                ctx.save();
                ctx.globalAlpha = 0.14;
                ctx.fillStyle = COL.halo;
                ctx.beginPath();
                ctx.arc(sx, sy, rr * 1.5, 0, TAU);
                ctx.fill();
                ctx.restore();
            }
        }
        const [sx, sy] = toScreen(pin.x, pin.y);
        const r = Math.min(Math.max(6.0, pin.rad * V.scale + 5.0), 22.0);
        ctx.save();
        ctx.shadowColor = COL.selPin;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, TAU);
        ctx.strokeStyle = COL.selPin;
        ctx.lineWidth = 2.4;
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = COL.selPin;
        ctx.beginPath();
        ctx.arc(sx, sy, r * 1.7, 0, TAU);
        ctx.fill();
        ctx.restore();
    }

    if (V.hoverPin >= 0) {
        const pin = BOARD.pins[V.hoverPin];
        const [sx, sy] = toScreen(pin.x, pin.y);
        const r = Math.min(Math.max(5.0, pin.rad * V.scale + 4.0), 18.0);
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, TAU);
        ctx.strokeStyle = COL.hover;
        ctx.lineWidth = 1.8;
        ctx.stroke();
    } else if (V.hoverPart >= 0) {
        const p = BOARD.parts[V.hoverPart];
        const [ax, ay] = toScreen(p.x1, p.y1);
        const [bx, by] = toScreen(p.x2, p.y2);
        ctx.save();
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = COL.hover;
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.min(ax, bx), Math.min(ay, by),
            Math.abs(bx - ax), Math.abs(by - ay));
        ctx.restore();
    }

    if (V.searchMark) {
        const blink = 0.55 + 0.45 * Math.sin(Date.now() / 220);
        ctx.save();
        ctx.globalAlpha = blink;
        ctx.lineWidth = 2.6;
        ctx.strokeStyle = '#ffd54f';
        if (V.searchMark.type === 'part') {
            const p = BOARD.parts[V.searchMark.value];
            if (p && (!V.sideFilter || p.side === (V.sideFilter === 1 ? 'top' : 'bottom'))) {
                const [ax, ay] = toScreen(p.x1, p.y1);
                const [bx, by] = toScreen(p.x2, p.y2);
                const pad = 7;
                ctx.strokeRect(Math.min(ax, bx) - pad, Math.min(ay, by) - pad,
                    Math.abs(bx - ax) + pad * 2, Math.abs(by - ay) + pad * 2);
            }
        } else if (V.searchMark.type === 'net') {
            const idxs = BOARD.netPins[V.searchMark.value] || [];
            const refs = new Set();
            for (const i of idxs) if (BOARD.pins[i].ref) refs.add(BOARD.pins[i].ref);
            for (const p of BOARD.parts) {
                if (!refs.has(p.name)) continue;
                if (V.sideFilter && p.side !== (V.sideFilter === 1 ? 'top' : 'bottom')) continue;
                const [ax, ay] = toScreen(p.x1, p.y1);
                const [bx, by] = toScreen(p.x2, p.y2);
                if (Math.max(Math.abs(bx - ax), Math.abs(by - ay)) < 4) continue;
                const pad = 5;
                ctx.strokeRect(Math.min(ax, bx) - pad, Math.min(ay, by) - pad,
                    Math.abs(bx - ax) + pad * 2, Math.abs(by - ay) + pad * 2);
            }
        }
        ctx.restore();
    }
    if (V.searchMark) schedule();
}

function resizeCanvas() {
    const w = viewW(), h = viewH();
    DPR = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(w * DPR) || canvas.height !== Math.round(h * DPR)) {
        canvas.width = Math.round(w * DPR);
        canvas.height = Math.round(h * DPR);
    }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(str) {
    let c = 0xffffffff;
    for (let i = 0; i < str.length; i++) {
        c = CRC_TABLE[(c ^ str.charCodeAt(i)) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
}

function hsv2rgb(h, s, v) {
    const i = Math.floor(h);
    const f = h - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    const m = i % 6;
    let r, g, b;
    if (m === 0) [r, g, b] = [v, t, p];
    else if (m === 1) [r, g, b] = [q, v, p];
    else if (m === 2) [r, g, b] = [p, v, t];
    else if (m === 3) [r, g, b] = [p, q, v];
    else if (m === 4) [r, g, b] = [t, p, v];
    else [r, g, b] = [v, p, q];
    const x = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
    return '#' + x(r) + x(g) + x(b);
}

function netColor(net) {
    const h = ((crc32(net) % 360) + 360) % 360;
    return hsv2rgb(h, 0.7, 0.92);
}

function pinTag(pin) {
    if (V.pinLabel === 'idx') {
        if (pin.netid !== undefined && pin.netid !== null) return 'net_' + pin.netid;
        if (pin.num !== undefined && String(pin.num) !== '') return String(pin.num);
        return 'net_' + (pin.netid === undefined ? '?' : pin.netid);
    }
    if (V.pinLabel === 'name') return pin.name || pin.l || 'net_' + (pin.netid === undefined ? '?' : pin.netid);
    return pin.net || pin.l || '';
}

function buildGrid() {
    const buckets = new Map();
    for (let i = 0; i < BOARD.pins.length; i++) {
        const p = BOARD.pins[i];
        const k = (Math.floor(p.x / 200)) + ',' + (Math.floor(p.y / 200));
        let a = buckets.get(k);
        if (!a) { a = []; buckets.set(k, a); }
        a.push(i);
    }
    return {
        query(x, y, r) {
            const c = 200;
            const out = [];
            const gx0 = Math.floor((x - r) / c), gx1 = Math.floor((x + r) / c);
            const gy0 = Math.floor((y - r) / c), gy1 = Math.floor((y + r) / c);
            for (let gx = gx0; gx <= gx1; gx++) {
                for (let gy = gy0; gy <= gy1; gy++) {
                    const a = buckets.get(gx + ',' + gy);
                    if (a) out.push.apply(out, a);
                }
            }
            return out;
        },
    };
}

function hitPin(sx, sy, extra) {
    if (extra === undefined) extra = 10;
    if (!BOARD || !GRID) return -1;
    const [wx, wy] = fromScreen(sx, sy);
    let r = Math.max(extra, 12) / V.scale;
    r = Math.min(r, 3000);
    let best = -1, bestD = Infinity;
    const cand = GRID.query(wx, wy, r);
    for (let k = 0; k < cand.length; k++) {
        const idx = cand[k];
        const p = BOARD.pins[idx];
        if (V.sideFilter && p.s !== (V.sideFilter === 1 ? 'top' : 'bottom')) continue;
        const dx = p.x - wx, dy = p.y - wy;
        const dd = dx * dx + dy * dy;
        const th = Math.max(r, p.rad * 2 / V.scale);
        if (dd <= th * th && dd < bestD) {
            best = idx;
            bestD = dd;
        }
    }
    return best;
}

function hitPart(wx, wy) {
    if (!BOARD) return -1;
    const hasSilk = !!(BOARD.labels && BOARD.labels.length);
    const boardSpan = Math.max(BOARD.x1 - BOARD.x0, BOARD.y1 - BOARD.y0);
    const pad = Math.max(6, Math.min(24, V.scale * 3)) / Math.max(V.scale, 0.0001);
    let best = -1;
    let bestArea = Infinity;
    for (let i = 0; i < BOARD.parts.length; i++) {
        const p = BOARD.parts[i];
        if (V.sideFilter && p.side !== (V.sideFilter === 1 ? 'top' : 'bottom')) continue;
        if (hasSilk && (Math.abs(p.x2 - p.x1) > boardSpan * 0.45 || Math.abs(p.y2 - p.y1) > boardSpan * 0.45)) continue;
        const minX = Math.min(p.x1, p.x2) - pad, maxX = Math.max(p.x1, p.x2) + pad;
        const minY = Math.min(p.y1, p.y2) - pad, maxY = Math.max(p.y1, p.y2) + pad;
        if (minX <= wx && wx <= maxX && minY <= wy && wy <= maxY) {
            const area = (maxX - minX) * (maxY - minY);
            if (area < bestArea) {
                best = i;
                bestArea = area;
            }
        }
    }
    return best;
}

function partType(part) {
    const ref = String(part.name || '').toUpperCase();
    if (/^FB|^FL|^F/.test(ref)) return 'Filtro';
    if (/^R/.test(ref)) return 'Resistencia';
    if (/^C/.test(ref)) return 'Capacitor';
    if (/^L/.test(ref)) return 'Inductor';
    if (/^D/.test(ref)) return 'Diodo';
    if (/^Q/.test(ref)) return 'Transistor';
    if (/^J|^CN|^CON/.test(ref)) return 'Conector';
    if (/^U|^IC/.test(ref)) return 'Circuito integrado';
    return 'Componente';
}

function clearSelection() {
    V.selPart = -1;
    V.selPin = -1;
    V.filterNets.clear();
    V.filterPins.clear();
    V.filterLabel = '';
    V.connView = false;
    V.boardView = true;
    V.results = [];
    V.resultIdx = -1;
    V.searchMark = null;
    updateSearchCount();
    refreshTabs();
    buildPanel();
    schedule();
}

function setStatus(msg) {
    $('status').textContent = msg;
}

function showTooltip(text, x, y) {
    tooltip.textContent = text;
    tooltip.style.display = 'block';
    const gap = 14;
    const maxX = canvas.clientWidth - tooltip.offsetWidth - 8;
    const maxY = canvas.clientHeight - tooltip.offsetHeight - 8;
    tooltip.style.left = Math.max(8, Math.min(x + gap, maxX)) + 'px';
    tooltip.style.top = Math.max(8, Math.min(y + gap, maxY)) + 'px';
}

function hideTooltip() {
    tooltip.style.display = 'none';
}

function clearStatus() {
    $('status').textContent = '';
}

function updateStatusbar() {
    const [wx, wy] = fromScreen(0, 0);
    void wx; void wy;
    const mid = fromScreen(viewW() / 2, viewH() / 2);
    $('bar-text').textContent =
        (BOARD ? BOARD.title : '') +
        '    zoom x' + V.scale.toFixed(2) +
        '    centro (' + mid[0].toFixed(1) + ', ' + mid[1].toFixed(1) + ') mil';
}

// ---------------------------------------------------------------- panel

function truncate(s, width) {
    const t = String(s == null ? '' : s);
    if (t.length <= width) return t;
    return t.slice(0, width - 3) + '...';
}

function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function t(key) {
    return (I18N[CURRENT_LANG] && I18N[CURRENT_LANG][key]) || I18N.es[key] || key;
}

function applyLanguage(lang) {
    CURRENT_LANG = lang in I18N ? lang : 'es';
    $('lang-select').value = CURRENT_LANG;
    const langLabel = $('lang-label');
    const searchLabel = $('search-label');
    if (langLabel) langLabel.textContent = t('language');
    if (searchLabel) searchLabel.textContent = t('search');
    $('btn-open').textContent = t('open');
    $('btn-fit').textContent = t('fit');
    $('btn-clear').textContent = t('clear');
    $('btn-rotate').textContent = '↻';
    $('rotation-status').textContent = t('rotation') + ': ' + V.rotation + '°';
    $('tab-board').textContent = t('board');
    $('tab-part').textContent = t('part');
    $('tab-conn').textContent = t('connection');
    $('search').placeholder = t('searchPlaceholder');
    $('drop-msg').textContent = t('dropFile');
    const fl = $('file-list');
    for (const opt of fl.options) {
        if (opt.value === '') { opt.textContent = t('selectFile'); break; }
    }
    updateButtons();
    buildPanel();
}



function updateConnTab() {
    const el = $('tab-conn');
    if (!el) return;
    let n = 0;
    if (V.selPin >= 0 && BOARD) {
        const arr = BOARD.netPins[BOARD.pins[V.selPin].net];
        if (arr) n = arr.length;
    }
    el.textContent = t('connection') + (n ? ' (' + n + ')' : '');
}

function boardInfoHtml() {
    const b = BOARD;
    let html = '';
    html += '<div class="sec"><h3>' + t('board') + '</h3><div>' + esc(b.title || 'FZ BoardView') + '</div></div>';
    html += '<div class="sec"><h3>' + t('content') + '</h3>';
    html += t('pieces') + ' ' + b.parts.length + '<br>' + t('pins') + ' ' + b.pins.length + '<br>';
    html += t('nets') + ' ' + Object.keys(b.netPins).length + '<br>';
    html += t('vias') + ' ' + b.nails.length + '<br>';
    html += 'X ' + b.x0.toFixed(0) + '..' + b.x1.toFixed(0) + '  (' + ((b.x1 - b.x0) / 1000).toFixed(2) + ' in)<br>';
    html += 'Y ' + b.y0.toFixed(0) + '..' + b.y1.toFixed(0) + '  (' + ((b.y1 - b.y0) / 1000).toFixed(2) + ' in)<br>';
    html += '</div>';
    return html;
}

function buildPanel() {
    const panel = $('panel');
    if (!BOARD) return;
    updateConnTab();
    if (V.boardView) {
        panel.innerHTML = boardInfoHtml();
        return;
    }
    if (V.connView && V.selPin >= 0) {
        const net = BOARD.pins[V.selPin].net;

        const idxs = BOARD.netPins[net] || [];

        panel.innerHTML = '<div class="sec"><h3>' + t('net') + ' ' + esc(net) + ' (' + idxs.length + ' ' + t('pins').toLowerCase() + ')</h3></div>';
        
        const table = document.createElement('table');
        const head = document.createElement('tr');
        [t('ref'), t('pin'), t('pinName'), t('side'), t('infoCol')].forEach((label) => {
            const th = document.createElement('th');
            th.textContent = label;
            head.appendChild(th);
        });
        table.appendChild(head);
        for (const idx of idxs) {
            const pin = BOARD.pins[idx];
            const part = BOARD.parts[REF_INDEX[pin.ref]];
            const info = part ? String(part.desc || '') : '';
            const row = document.createElement('tr');
            if (idx === V.selPin) row.className = 'sel';
            row.addEventListener('click', () => {
                V.selPin = idx;
                V.selPart = REF_INDEX[pin.ref] !== undefined ? REF_INDEX[pin.ref] : -1;
                V.sideFilter = pin.s === 'top' ? 1 : 2;
                const [cx, cy] = transformPoint(pin.x, pin.y);
                V.cx = cx; V.cy = cy; V.panX = 0; V.panY = 0;
                setStatus('p=' + pin.l + ' n=' + pin.net);
                buildPanel();
                updateButtons();
                schedule();
            });
            const td1 = document.createElement('td');
            td1.className = 'ref';
            td1.textContent = pin.ref;
            const td2 = document.createElement('td');
            td2.textContent = pin.pcode || pin.num || '-';
            const td3 = document.createElement('td');
            td3.textContent = pin.name || pin.l || '-';
            const td4 = document.createElement('td');
            td4.textContent = t(pin.s);
            const td5 = document.createElement('td');
            td5.className = 'info';
            td5.textContent = info;
            row.appendChild(td1); row.appendChild(td2); row.appendChild(td3); row.appendChild(td4); row.appendChild(td5);
            table.appendChild(row);
        }
        panel.appendChild(table);
        const selRow = panel.querySelector('tr.sel');
        if (selRow) {
            const panelRect = panel.getBoundingClientRect();
            const rowRect = selRow.getBoundingClientRect();
            panel.scrollTop += (rowRect.top - panelRect.top) - (panelRect.height / 2);
        }
        return;
    }

    let html = '';
    if (V.selPin < 0 && V.selPart < 0) {
        html += '<div class="sec"><h3>' + t('part') + '</h3>' + t('noSelection') + '</div>';
    }

    if (V.selPin >= 0) {
        const pin = BOARD.pins[V.selPin];
        const connCount = (BOARD.netPins[pin.net] || []).length;
        const noConn = !pin.net || connCount <= 1;
        html += '<div class="sec"><h3>' + t('pin') + '</h3>';
        html += 'Label ' + esc(pin.l) + '<br>' + t('net') + ' ' + esc(pinTag(pin)) + '<br>';
        html += t('connections') + ' ' + connCount + '<br>';
        if (noConn) html += 'Tipo: <b>Negativo (tierra)</b><br>';
        html += 'Refdes ' + esc(pin.ref) + '<br>' + t('side') + ' ' + pin.s + '<br></div>';
    }

    if (V.selPart >= 0 && BOARD.parts[V.selPart]) {
        const p = BOARD.parts[V.selPart];
        let count = 0;
        const nets = new Map();
        for (const pin of BOARD.pins) {
            if (pin.ref !== p.name) continue;
            count++;
            nets.set(pin.net, (nets.get(pin.net) || 0) + 1);
        }
        html += '<div class="sec"><h3>' + t('part') + ' ' + esc(p.name) + '</h3>';
        html += 'Tipo ' + partType(p) + '<br>';
        html += t('side') + ' ' + p.side + '<br>' + t('pins') + ' ' + count + '<br>';
        html += 'Size ' + (p.x2 - p.x1).toFixed(0) + ' x ' + (p.y2 - p.y1).toFixed(0) + ' mil<br>';
        if (p.desc) html += 'Device ' + esc(p.desc) + '<br>';
        if (p.partno) html += 'P/N ' + esc(p.partno) + '<br>';
        if (p.qty) html += 'Qty ' + esc(p.qty) + '<br>';
        if (p.sym) html += 'Sym ' + esc(p.sym) + '<br>';
        html += '<b>' + t('nets') + ' (' + nets.size + '):</b><br>';
        const sorted = Array.from(nets.entries())
            .sort((a, z) => (z[1] - a[1]) || (a[0] < z[0] ? -1 : 1));
        html += sorted.map(([n, c]) => c + '  ' + esc(n)).join('<br>') + '<br>';
        html += '</div>';
    }
    panel.innerHTML = html;
}

function refreshTabs() {
    $('tab-board').classList.toggle('active', V.boardView);
    $('tab-part').classList.toggle('active', !V.boardView && !V.connView);
    $('tab-conn').classList.toggle('active', V.connView);
}

function showBoard() {
    V.connView = false;
    V.boardView = true;
    refreshTabs();
    buildPanel();
    schedule();
}

function showInfo() {
    V.connView = false;
    V.boardView = false;
    refreshTabs();
    buildPanel();
    schedule();
}

function showConnections() {
    const pin = V.selPin >= 0 ? BOARD.pins[V.selPin] : null;
    if (!pin) {
        setStatus('selecciona un pin para ver sus conexiones');
        V.connView = false;
        refreshTabs();
        return;
    }
    V.connView = true;
    V.boardView = false;
    refreshTabs();
    V.filterNets.clear();
    V.filterNets.add(pin.net);
    V.filterPins = new Set(BOARD.netPins[pin.net] || []);
    V.filterLabel = pin.net;
    setStatus('Conexión: ' + pin.net);
    buildPanel();
    schedule();
}

function pick(sx, sy, doZoom) {
    const [wx, wy] = fromScreen(sx, sy);
    const pin = hitPin(sx, sy, 14);
    V.selPin = pin;
    V.selPart = -1;
    V.boardView = false;
    V.searchMark = null;
    V.filterNets.clear();
    V.filterPins.clear();
    V.filterLabel = '';
    let part = -1;
    if (pin >= 0) {
        const ref = BOARD.pins[pin].ref;
        part = REF_INDEX[ref] !== undefined ? REF_INDEX[ref] : -1;
        V.selPart = part;
        V.filterNets.add(BOARD.pins[pin].net);
        V.filterPins = new Set(BOARD.netPins[BOARD.pins[pin].net] || []);
        V.filterLabel = BOARD.pins[pin].net;
        setStatus('p=' + BOARD.pins[pin].l + ' n=' + BOARD.pins[pin].net);
        if (V.connView) {
            buildPanel();
            schedule();
            return;
        }
    } else {
        part = hitPart(wx, wy);
        V.selPart = part;
        if (part >= 0) {
            setStatus('p=' + BOARD.parts[part].name);
        } else {
            setStatus('');
        }
    }
    if (part >= 0 && doZoom) {
        const p = BOARD.parts[part];
        zoomTo((p.x1 + p.x2) / 2, (p.y1 + p.y2) / 2, p.x2 - p.x1, p.y2 - p.y1);
    } else {
        schedule();
    }
    refreshTabs();
    buildPanel();
    updateButtons();
}

function doSearch() {
    const text = $('search').value.trim();
    if (!text) {
        V.results = [];
        V.resultIdx = -1;
        updateSearchCount();
        clearSelection();
        $('search').value = '';
        return;
    }
    const up = text.toUpperCase();
    const curSide = V.sideFilter === 1 ? 'top' : (V.sideFilter === 2 ? 'bottom' : null);
    V.searchSide = curSide;
    const results = [];
    const seen = new Set();
    for (let i = 0; i < BOARD.parts.length; i++) {
        if (curSide && BOARD.parts[i].side !== curSide) continue;
        const n = BOARD.parts[i].name.toUpperCase();
        if (n === up) { results.push({ type: 'part', value: i }); seen.add(i); }
    }
    for (let i = 0; i < BOARD.parts.length; i++) {
        if (seen.has(i)) continue;
        if (curSide && BOARD.parts[i].side !== curSide) continue;
        const n = BOARD.parts[i].name.toUpperCase();
        if (n.startsWith(up)) results.push({ type: 'part', value: i });
    }

    V.results = results;
    V.resultIdx = results.length ? 0 : -1;
    updateSearchCount();
    if (V.resultIdx >= 0) applyResult();
    else setStatus('no match for ' + text.trim());
}

function updateSearchCount() {
    const el = $('search-count');
    if (el) el.textContent = V.results.length ? ((V.resultIdx + 1) + ' / ' + V.results.length) : '0';
}

function applyResult() {
    if (V.resultIdx < 0 || V.resultIdx >= V.results.length) return;
    const r = V.results[V.resultIdx];
    if (r.type !== 'part') return;
    V.searchMark = { type: 'part', value: r.value };
    const curSide = V.searchSide;
    V.filterNets.clear();
    V.filterPins.clear();
    V.filterLabel = '';
    V.selPart = r.value;
    V.selPin = -1;
    const p = BOARD.parts[r.value];
    if (!curSide) V.sideFilter = p.side === 'top' ? 1 : 2;
    zoomTo((p.x1 + p.x2) / 2, (p.y1 + p.y2) / 2, p.x2 - p.x1, p.y2 - p.y1);
    setStatus('part ' + p.name + ' (' + (V.resultIdx + 1) + ' / ' + V.results.length + ')');
    V.boardView = false;
    V.connView = false;
    refreshTabs();
    buildPanel();
    updateButtons();
    schedule();
}

function searchStep(d) {
    if (!V.results || V.results.length === 0) return;
    V.resultIdx = (V.resultIdx + d + V.results.length) % V.results.length;
    updateSearchCount();
    applyResult();
}

function reSearch() {
    if ($('search').value.trim()) doSearch();
}

function updateButtons() {
    $('btn-side').textContent = t('side') + ': ' +
        (V.sideFilter === 1 ? t('top') : t('bottom'));
    $('btn-nails').textContent = t('nails') + ': ' + (V.showNails ? 'On' : 'Off');
    $('btn-color').textContent = t('color') + ': ' + (V.netColor ? t('net') : t('side'));
    const idxSel = $('btn-idx');
    idxSel.innerHTML = '<option value="idx">' + t('pin') + ': ' + t('idx') + '</option>' +
        '<option value="net">' + t('pin') + ': ' + t('net') + '</option>' +
        '<option value="name">' + t('pin') + ': ' + t('pinName') + '</option>';
    idxSel.value = V.pinLabel;
    $('btn-flip').textContent = t('flip') + ': ' + (V.flip ? 'On' : 'Off');
    $('btn-panel').textContent = t('panel') + ': ' +
        (document.body.classList.contains('panel-hidden') ? 'Off' : 'On');
}


// ---------------------------------------------------------------- load

async function loadBoardFromPath(p) {
    const r = await fetch('/api/load?path=' + encodeURIComponent(p));
    const j = await r.json();
    if (!r.ok || !j.ok) throw new Error(j.error || 'load failed');
    return j;
}

async function loadBoardFromBytes(buf, name) {
    const url = '/api/load-bytes' + (name ? '?name=' + encodeURIComponent(name) : '');
    const r = await fetch(url, { method: 'POST', body: buf });
    const j = await r.json();
    if (!r.ok || !j.ok) throw new Error(j.error || 'load failed');
    return j;
}

async function applyBoard(b) {
    BOARD = b;
    REF_INDEX = {};
    for (let i = 0; i < b.parts.length; i++) REF_INDEX[b.parts[i].name] = i;
    GRID = buildGrid();
    V.selPart = -1;
    V.selPin = -1;
    V.filterNets.clear();
    V.filterPins.clear();
    V.filterLabel = '';
    V.connView = false;
    V.boardView = true;
    V.flip = false;
    V.sideFilter = 1;
    V.showNails = true;
    V.netColor = false;
    V.pinLabel = 'idx';
    V.results = [];
    V.resultIdx = -1;
    V.searchMark = null;
    updateSearchCount();
    refreshTabs();
    updateButtons();
    zoomAll();
    buildPanel();
    setStatus(b.title.split('|')[0] + ' cargada');
    updateStatusbar();
    reSearch();
    const entry = $('file-list');
    let found = false;
    for (const opt of entry.options) {
        if (opt.value === b.file) { found = true; break; }
    }
    if (!found) {
        const opt = document.createElement('option');
        opt.value = b.file;
        opt.textContent = b.file;
        entry.appendChild(opt);
    }
    entry.value = b.file;
    applyLanguage(CURRENT_LANG);
}

async function initAutoLoad() {
    try {
        const r = await fetch('/api/list');
        const j = await r.json();
        const sel = $('file-list');
        $('lang-select').addEventListener('change', (e) => applyLanguage(e.target.value));
        const ph = document.createElement('option');
        ph.value = '';
        ph.textContent = t('selectFile');
        sel.appendChild(ph);
        sel.value = '';
        for (const f of j.files) {
            const opt = document.createElement('option');
            opt.value = f;
            opt.textContent = f;
            sel.appendChild(opt);
        }
        sel.onchange = () => {
            if (sel.value) loadBoardFromPath(sel.value).then(applyBoard).catch(fail);
        };
        if (j.current) {
            for (const opt of sel.options) if (opt.value === j.current) sel.value = j.current;
            const b = await loadBoardFromPath(j.current);
            await applyBoard(b);
        }
    } catch (err) {
        setStatus('server sin archivos: ' + err.message);
    }
}

function fail(err) {
    setStatus('ERROR: ' + err.message);
    $('bar-text').textContent = String(err.message);
}

// ---------------------------------------------------------------- input

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const [wx, wy] = fromScreen(mx, my);
    const [tx, ty] = transformPoint(wx, wy);
    const newScale = Math.min(Math.max(V.scale * factor, 1e-6), 20000);
    const W = viewW(), H = viewH();
    V.cx = tx - (mx - W / 2 - V.panX) / newScale;
    V.cy = ty - (H / 2 + V.panY - my) / newScale;
    V.scale = newScale;
    updateStatusbar();
    schedule();
}, { passive: false });

canvas.addEventListener('pointerdown', (e) => {
    if (e.button === 0) {
        const rect = canvas.getBoundingClientRect();
        V.drag = {
            x: e.clientX - rect.left, y: e.clientY - rect.top,
            total: 0, lastX: e.clientX - rect.left, lastY: e.clientY - rect.top,
        };
        canvas.setPointerCapture(e.pointerId);
    }
});

canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    if (V.drag) {
        hideTooltip();
        const dx = mx - V.drag.lastX, dy = my - V.drag.lastY;
        V.panX += dx;
        V.panY += dy;
        V.drag.lastX = mx;
        V.drag.lastY = my;
        V.drag.total += Math.abs(dx) + Math.abs(dy);
        schedule();
    } else {
        const pin = hitPin(mx, my);
        V.hoverPin = pin;
        V.hoverPart = -1;
        if (pin < 0) {
            const [wx, wy] = fromScreen(mx, my);
            V.hoverPart = hitPart(wx, wy);
        }
        if (pin >= 0) {
            const p = BOARD.pins[pin];
            const part = BOARD.parts[REF_INDEX[p.ref]];
            const cand = !p.net || (BOARD.netPins[p.net] || []).length <= 1;
            const lines = [
                'PIN',
                'Nombre: ' + (p.name || p.l || '-'),
                'Número: ' + (p.num || p.l || '-'),
                'Red: ' + p.net + '  [id ' + (p.netid !== undefined && p.netid !== null ? p.netid : (p.num || '?')) + ']',
                cand ? 'Tipo: Negativo (tierra)' : '',
                'Componente: ' + p.ref,
            ];
            if (part) lines.push('Tipo: ' + partType(part), 'Lado: ' + part.side);
            showTooltip(lines.filter(Boolean).join('\n'), mx, my);
        } else if (V.hoverPart >= 0) {
            const p = BOARD.parts[V.hoverPart];
            const count = BOARD.pins.filter((pin) => pin.ref === p.name).length;
            showTooltip([
                'COMPONENTE ' + p.name,
                'Tipo: ' + partType(p),
                'Lado: ' + p.side,
                'Pines: ' + count,
                'Tamaño: ' + (p.x2 - p.x1).toFixed(0) + ' x ' +
                    (p.y2 - p.y1).toFixed(0) + ' mil',
                p.desc ? 'Descripción: ' + p.desc : '',
            ].filter(Boolean).join('\n'), mx, my);
        } else {
            hideTooltip();
            setStatus('');
        }
        updateStatusbar();
        schedule();
    }
});

canvas.addEventListener('pointerup', (e) => {
    if (!V.drag) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const wasDrag = V.drag.total >= 5;
    V.drag = null;
    if (!wasDrag) pick(mx, my, false);
    updateStatusbar();
});

canvas.addEventListener('dblclick', (e) => {
    const rect = canvas.getBoundingClientRect();
    pick(e.clientX - rect.left, e.clientY - rect.top, true);
});

canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    clearSelection();
});

canvas.addEventListener('mouseleave', () => {
    V.hoverPin = -1;
    V.hoverPart = -1;
    hideTooltip();
    schedule();
});

window.addEventListener('resize', () => {
    resizeCanvas();
    schedule();
});

const sidebar = $('panel');
sidebar.addEventListener('click', (e) => {
    if (e.target.closest('td')) return;
    void e;
});

// ---------------------------------------------------------------- controls

$('btn-open').addEventListener('click', () => $('file-input').click());
$('btn-fit').addEventListener('click', zoomAll);
$('btn-side').addEventListener('click', () => {
    V.sideFilter = V.sideFilter === 1 ? 2 : 1;
    updateButtons();
    reSearch();
    schedule();
});
$('btn-nails').addEventListener('click', () => {
    V.showNails = !V.showNails;
    updateButtons();
    schedule();
});
$('btn-color').addEventListener('click', () => {
    V.netColor = !V.netColor;
    updateButtons();
    schedule();
});
$('btn-idx').addEventListener('change', (e) => {
    V.pinLabel = e.target.value || 'idx';
    updateButtons();
    buildPanel();
    schedule();
});
$('btn-flip').addEventListener('click', () => {
    V.flip = !V.flip;
    updateButtons();
    schedule();
});
$('btn-panel').addEventListener('click', () => {
    document.body.classList.toggle('panel-hidden');
    updateButtons();
    resizeCanvas();
    schedule();
});
$('btn-rotate').addEventListener('click', () => {
    V.rotation = (V.rotation + 90) % 360;
    $('rotation-status').textContent = t('rotation') + ': ' + V.rotation + '°';
    $('btn-rotate').textContent = '↻';
    updateButtons();
    schedule();
});
$('btn-clear').addEventListener('click', () => {
    $('search').value = '';
    clearSelection();
});
$('tab-board').addEventListener('click', showBoard);
$('tab-part').addEventListener('click', showInfo);
$('tab-conn').addEventListener('click', showConnections);
$('resizer').addEventListener('mousedown', (e) => {
    e.preventDefault();
    const side = $('side');
    const startX = e.clientX;
    const startW = side.getBoundingClientRect().width;
    $('resizer').classList.add('active');
    const move = (ev) => {
        side.style.width = Math.min(1000, Math.max(180, startW + (ev.clientX - startX))) + 'px';
    };
    const up = () => {
        $('resizer').classList.remove('active');
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        resizeCanvas();
        schedule();
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
});
let searchTimer = 0;
$('search').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(doSearch, 350);
});
$('search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { clearTimeout(searchTimer); doSearch(); }
    else if (e.key === 'ArrowDown') { doSearch(); searchStep(1); }
    else if (e.key === 'ArrowUp') { doSearch(); searchStep(-1); }
});
$('search-prev').addEventListener('click', () => searchStep(-1));
$('search-next').addEventListener('click', () => searchStep(1));
$('file-input').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    f.arrayBuffer().then((buf) => loadBoardFromBytes(buf, f.name).then(applyBoard).catch(fail));
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { clearSelection(); $('search').value = ''; }
    else if (e.key === 'f' && !e.ctrlKey) zoomAll();
    else if (e.key === '+' || e.key === '=') { centerZoom(1.12); }
    else if (e.key === '-') centerZoom(1 / 1.12);
    else if (e.key === 'o') $('file-input').click();
    else if (e.key === 'c') { $('search').value = ''; clearSelection(); }
    else if (e.key === 'n') { V.showNails = !V.showNails; updateButtons(); schedule(); }
    else if (e.key === 'x') { V.netColor = !V.netColor; updateButtons(); schedule(); }
    const next = { idx: 'net', net: 'name', name: 'idx' };
    if (e.key === 'i') { V.pinLabel = next[V.pinLabel] || 'idx'; updateButtons(); buildPanel(); schedule(); }
    else if (e.key === 'r') { V.flip = !V.flip; updateButtons(); schedule(); }
    else if (e.key === 's') { V.sideFilter = V.sideFilter === 1 ? 2 : 1; updateButtons(); reSearch(); schedule(); }
});

function centerZoom(factor) {
    const W = viewW(), H = viewH();
    const [wx, wy] = fromScreen(W / 2, H / 2);
    const [tx, ty] = transformPoint(wx, wy);
    const newScale = Math.min(Math.max(V.scale * factor, 1e-6), 20000);
    V.cx = tx;
    V.cy = ty;
    V.scale = newScale;
    updateStatusbar();
    schedule();
}

const stage = $('stage');
let dragDepth = 0;
window.addEventListener('dragover', (e) => { e.preventDefault(); });
window.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; stage.classList.add('dragging'); });
window.addEventListener('dragleave', (e) => { e.preventDefault(); dragDepth--; if (dragDepth <= 0) { dragDepth = 0; stage.classList.remove('dragging'); } });
window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0;
    stage.classList.remove('dragging');
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return;
    f.arrayBuffer().then((buf) => loadBoardFromBytes(buf, f.name).then(applyBoard).catch(fail));
});

refreshTabs();
initAutoLoad();