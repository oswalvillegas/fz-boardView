const zlib = require('zlib');

const FZ_KEY = [
    0x25d8d248, 0xe1502405, 0x56b5d486, 0x69213fe0, 0xa22490ec,
    0x01fdd9fa, 0x0681955f, 0x0fac202d, 0xdac9eeb4, 0xf6024aba,
    0xcd8b4cc6, 0x9f307c8e, 0x4ab8fad7, 0x232f967d, 0x5e8666a3,
    0xde966d4b, 0xc64bfb1c, 0xea7fb092, 0x1a751a7e, 0x37e8f0bc,
    0x3359c8f3, 0x969ac22b, 0x610f5804, 0xd99d10e6, 0xc58d54d6,
    0x1f9aea8b, 0x8e388c1a, 0xe4f7d2ed, 0x3e5da1f6, 0xedfe818a,
    0x7252b016, 0xb503a170, 0xc4128fb6, 0x2c93ceeb, 0x53539a6e,
    0xdacf7668, 0x3ab78e52, 0x8ee9d815, 0x7043f799, 0xc6a05dcf,
    0x727f1da2, 0x0dfd983b, 0x78c53872, 0x00945692,
];

const KEY_PARITY = [
    0, 1, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1,
    0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0,
    1, 1, 0, 1,
];

function parity(x) {
    x ^= x >>> 16;
    x ^= x >>> 8;
    x ^= x >>> 4;
    x ^= x >>> 2;
    x ^= x >>> 1;
    return (~x) & 1;
}

function keyOk() {
    return FZ_KEY.every((w, i) => parity(w) === KEY_PARITY[i]);
}

function mul32(a, b) {
    a = a >>> 0;
    b = b >>> 0;
    const a0 = a & 0xffff, a1 = a >>> 16;
    const b0 = b & 0xffff, b1 = b >>> 16;
    const lo = a0 * b0;
    const mid = a0 * b1 + a1 * b0;
    return (lo + ((mid & 0xffff) << 16)) >>> 0;
}

function rotl(a, b) {
    b = b & 31;
    a = a >>> 0;
    if (b === 0) return a;
    return ((a << b) | (a >>> (32 - b))) >>> 0;
}

function rc6Decode(data) {
    const n = data.length;
    if (n === 0) return data;
    const key = FZ_KEY;
    let A = 0, B = 0, C = 0, D = 0;
    const out = Buffer.alloc(n);
    const ib = new Uint8Array(16);
    for (let pos = 0; pos < n; pos++) {
        B = (B + key[0]) >>> 0;
        D = (D + key[1]) >>> 0;
        for (let i = 1; i <= 20; i++) {
            const t = rotl(mul32(B, ((B << 1) | 1) >>> 0), 5);
            const u = rotl(mul32(D, ((D << 1) | 1) >>> 0), 5);
            A = (rotl(A ^ t, u) + key[2 * i]) >>> 0;
            C = (rotl(C ^ u, t) + key[2 * i + 1]) >>> 0;
            const tmp = A; A = B; B = C; C = D; D = tmp;
        }
        A = (A + key[42]) >>> 0;
        C = (C + key[43]) >>> 0;
        const cur = data[pos];
        out[pos] = cur ^ (A & 0xff);
        for (let i = 0; i < 15; i++) ib[i] = ib[i + 1];
        ib[15] = cur;
        A = (ib[0] | ib[1] << 8 | ib[2] << 16 | ib[3] << 24) >>> 0;
        B = (ib[4] | ib[5] << 8 | ib[6] << 16 | ib[7] << 24) >>> 0;
        C = (ib[8] | ib[9] << 8 | ib[10] << 16 | ib[11] << 24) >>> 0;
        D = (ib[12] | ib[13] << 8 | ib[14] << 16 | ib[15] << 24) >>> 0;
    }
    return out;
}

function parseContent(content) {
    const parts = [];
    const partIndex = {};
    const pins = [];
    const nails = [];
    let mult = 1.0;
    let block = 0;

    for (let line of content.split(/\r?\n/)) {
        line = line.trim();
        if (!line) continue;
        if (line === 'UNIT:millimeters') {
            mult = 25.4;
            continue;
        }
        if (line.startsWith('A!')) {
            const hdr = line.slice(2).split('!')[0];
            block = { REFDES: 1, NET_NAME: 2, TESTVIA: 3, GRAPHIC_DATA_NAME: 4,
                      CLASS: 5, LOGOInfo: 6, UnDrawSym: 7 }[hdr];
            if (block === undefined) block = -1;
            continue;
        }
        if (!line.startsWith('S!')) continue;
        const f = line.split('!');
        if (block === 1 && f.length >= 6) {
            const name = f[1];
            const side = f[4] === 'YES' ? 'bottom' : 'top';
            const part = { name, sym: f[3] || '', mirror: f[4], rotate: f[5] || '',
                           side, desc: '', partno: '', qty: '', x1: 0, y1: 0, x2: 0, y2: 0 };
            parts.push(part);
            partIndex[name] = parts.length - 1;
        } else if (block === 2 && f.length >= 9) {
            const x = parseFloat(f[5]);
            const y = parseFloat(f[6]);
            if (isNaN(x) || isNaN(y)) continue;
            let radius = 0.5;
            if (f[8]) {
                const rv = parseFloat(f[8]);
                if (!isNaN(rv)) radius = Math.max(0.5, rv / 100.0) * mult;
            }
            const ref = f[2];
            let pi = partIndex[ref];
            if (pi === undefined) {
                parts.push({ name: ref, sym: '', mirror: '', rotate: '', side: 'top',
                             desc: '', partno: '', qty: '', x1: 0, y1: 0, x2: 0, y2: 0 });
                pi = parts.length - 1;
                partIndex[ref] = pi;
            }
            const num = f[3], name = f[4];
            const label = (num.length <= 1 && (num === '' || num === '0')) ? name : num;
            pins.push({ net: f[1], ref, num, name, l: label, pcode: num,
                        x: x * mult, y: y * mult, rad: radius, s: parts[pi].side });
        } else if (block === 3 && f.length >= 10) {
            const x = parseFloat(f[6]);
            const y = parseFloat(f[7]);
            if (isNaN(x) || isNaN(y)) continue;
            const num = f[4], name = f[5];
            const label = (num.length <= 1 && (num === '' || num === '0')) ? name : num;
            const side = f[8] === 'T' ? 'top' : 'bottom';
            nails.push({ net: f[2], ref: f[3], l: label, x: x * mult, y: y * mult, s: side });
        }
    }

    for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let found = false;
        for (const pin of pins) {
            if (pin.ref !== p.name) continue;
            if (pin.x < minX) minX = pin.x;
            if (pin.x > maxX) maxX = pin.x;
            if (pin.y < minY) minY = pin.y;
            if (pin.y > maxY) maxY = pin.y;
            found = true;
        }
        p.x1 = found ? minX : 0; p.y1 = found ? minY : 0;
        p.x2 = found ? maxX : 0; p.y2 = found ? maxY : 0;
    }

    return { parts, partIndex, pins, nails };
}

function parseDescr(descr, partIndex, parts) {
    const lines = descr.split(/\r?\n/);
    const title = (lines[0] || '').trim();
    for (let i = 2; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line[0] === 's') continue;
        const field = line.split('\t');
        if (field.length < 4) continue;
        const partno = field[0], description = field[1], qty = field[2];
        for (const refdes of field[3].split(/\s+/)) {
            const idx = partIndex[refdes];
            if (idx !== undefined && idx < parts.length) {
                parts[idx].partno = partno;
                parts[idx].desc = description;
                parts[idx].qty = qty;
            }
        }
    }
    return title;
}

function parseBrd(text) {
    const lines = text.split(/\r?\n/);
    const nets = {};
    const parts = [];
    const pins = [];
    const nails = [];
    let section = '';
    let outline = [];
    let skipBrdoutHeader = false;

    for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        if (line.startsWith('BRDOUT:')) {
            section = 'BRDOUT';
            skipBrdoutHeader = true;
            continue;
        }
        if (/^(NETS|PARTS|PINS|NAILS):/.test(line)) {
            section = line.slice(0, line.indexOf(':'));
            continue;
        }
        const fields = line.split(/\s+/);
        if (section === 'BRDOUT' && fields.length >= 2) {
            if (skipBrdoutHeader) {
                skipBrdoutHeader = false;
                continue;
            }
            const x = Number(fields[0]), y = Number(fields[1]);
            if (Number.isFinite(x) && Number.isFinite(y)) outline.push([x, y]);
        } else if (section === 'NETS' && fields.length >= 2) {
            nets[fields[0]] = fields.slice(1).join(' ');
        } else if (section === 'PARTS' && fields.length >= 6) {
            const x1 = Number(fields[1]), y1 = Number(fields[2]);
            const x2 = Number(fields[3]), y2 = Number(fields[4]);
            if (![x1, y1, x2, y2].every(Number.isFinite)) continue;
            parts.push({
                name: fields[0], sym: '', mirror: '', rotate: '',
                side: fields[fields.length - 1] === '2' ? 'bottom' : 'top',
                desc: '', partno: '', qty: '', x1, y1, x2, y2,
            });
        } else if (section === 'PINS' && fields.length >= 4) {
            const x = Number(fields[0]), y = Number(fields[1]);
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            const netId = fields[2];
            const candidates = parts.filter((part) =>
                part.x1 <= x && x <= part.x2 && part.y1 <= y && y <= part.y2);
            candidates.sort((a, b) =>
                ((a.x2 - a.x1) * (a.y2 - a.y1)) - ((b.x2 - b.x1) * (b.y2 - b.y1)));
            const part = candidates[0];
            const num = fields[2];
            const name = nets[netId] || netId;
            pins.push({
                net: name, ref: part ? part.name : '', num, name, l: name,
                pcode: fields[3] && netId !== fields[3] ? fields[3] : num,
                x, y, rad: 0.5, s: part ? part.side : 'top',
            });
        } else if (section === 'NAILS' && fields.length >= 5) {
            const netId = fields[0], x = Number(fields[1]), y = Number(fields[2]);
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            const name = nets[netId] || netId;
            nails.push({ net: name, ref: '', num: netId, name, l: name,
                         x, y, s: fields[4] === '2' ? 'bottom' : 'top' });
        }
    }

    if (!outline.length && pins.length) {
        const xs = pins.map((pin) => pin.x), ys = pins.map((pin) => pin.y);
        const x0 = Math.min(...xs) - 20, x1 = Math.max(...xs) + 20;
        const y0 = Math.min(...ys) - 20, y1 = Math.max(...ys) + 20;
        outline = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
    }
    const xs = outline.map((point) => point[0]), ys = outline.map((point) => point[1]);
    const x0 = xs.length ? Math.min(...xs) : 0, x1 = xs.length ? Math.max(...xs) : 100;
    const y0 = ys.length ? Math.min(...ys) : 0, y1 = ys.length ? Math.max(...ys) : 100;
    const netPins = {};
    pins.forEach((pin, index) => {
        if (!netPins[pin.net]) netPins[pin.net] = [];
        netPins[pin.net].push(index);
    });
    return { title: 'BRD Board', x0, y0, x1, y1, outline, parts, pins, nails, netPins };
}

function loadBoard(buffer) {
    if (!Buffer.isBuffer(buffer)) throw new Error('expected a Buffer');
    if (buffer.length < 8) throw new Error('file too small');
    if (buffer[0] === 0x24) return loadCad(buffer);
    if (!keyOk()) throw new Error('invalid FZ key (parity check failed)');
    const header = buffer.subarray(0, 32).toString('utf8');
    if (header.includes('BRDOUT:')) return parseBrd(buffer.toString('utf8'));

    const s1 = buffer[4], s2 = buffer[5];
    let dec;
    if (s1 === 0x78 && (s2 === 0x9c || s2 === 0xda)) {
        dec = buffer;
    } else {
        dec = rc6Decode(buffer);
    }

    if (dec.length < 4) throw new Error('decoded stream too small');
    const descrLen = dec.readUInt32LE(dec.length - 4);
    if (descrLen <= 0 || descrLen > dec.length) {
        throw new Error('decoded stream does not split cleanly (bad key or file)');
    }
    const contentEnd = dec.length - descrLen + 4;
    const contentRaw = dec.subarray(4, contentEnd);
    const descrRaw = dec.subarray(contentEnd);

    let content, descr;
    try {
        content = zlib.inflateSync(contentRaw).toString('utf8');
        descr = zlib.inflateSync(descrRaw).toString('utf8');
    } catch (e) {
        throw new Error('zlib decompression failed: ' + e.message);
    }

    const parsed = parseContent(content);
    const title = parseDescr(descr, parsed.partIndex, parsed.parts);

    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const netPins = {};
    for (let i = 0; i < parsed.pins.length; i++) {
        const pin = parsed.pins[i];
        if (pin.x < x0) x0 = pin.x;
        if (pin.x > x1) x1 = pin.x;
        if (pin.y < y0) y0 = pin.y;
        if (pin.y > y1) y1 = pin.y;
        if (!pin.net) continue;
        if (netPins[pin.net] === undefined) netPins[pin.net] = [];
        netPins[pin.net].push(i);
    }

    const m = 20;
    let outline = [];
    if (parsed.pins.length) {
        x0 -= m; y0 -= m; x1 += m; y1 += m;
        outline = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
    } else {
        x0 = y0 = 0; x1 = y1 = 100;
    }

    return {
        title,
        x0, y0, x1, y1,
        outline,
        parts: parsed.parts,
        pins: parsed.pins,
        nails: parsed.nails,
        netPins,
    };
}

/* ---------------------------------------------------------------- *
 * TVW (TeboView) support.
 *
 * Parser written from the public DOML/MIT format notes
 * (tvw.h / tvw.c / tvwread.c). The file layout:
 *
 *   header (scrambled strings) ... layers ... nets ... ProbeDB ...
 *   parts ... packages
 *
 * Layer record (per layer):
 *   [00 00 00 00] [3 2 1 | 1 2 1] prefijo
 *   name1(name pascal) name2(name pascal) filename(pascal)
 *   layer_type(u32) pad_color(u32) line_color(u32) unknown(u32)
 *   DCODE declarations (24B std / custom variant) mientras llega el
 *     fin-de-tabla 01 00 00 00 00 00 00 00 01 00 00 00 00 00 00 00
 *   PADS:   [count][unknown] + records
 *   LINES:  [count][unknown] + 24B records
 *   (arcs / surfaces / text)
 *   tail:   07 00 00 00 ... 04 00 00 00 ... siguiente prefijo
 *
 * PAD record (tvw.c tvw_read_pad):
 *   net_id(4) dcode_id(4) posx(4) posy(4) flag1(1) has_dim(1)
 *   si has_dim: flags2(2) c1x(4) c1y(4) c2x(4) c2y(4) has_ext1(1)
 *               [+16 si has_ext1]
 *   has_ext2(1)
 *
 * PART record (tvw.c tvw_read_part):
 *   name(pascal) c1x c1y c2x c2y posx posy rot unknown type unknown
 *   unknown has_strings(1) [value s3 s4 package serial (pascal)]
 *   unknown numpins layer unknown + pins{pad_id>>3 unknown pinno
 *   name(pascal) unknown}
 *
 * NET: [count][count duplicado] + count names(pascal)
 * ---------------------------------------------------------------- */

function pascal(buf, pos, end) {
    if (pos >= end) return null;
    const l = buf[pos];
    if (l > 64 || pos + 1 + l > end) return null;
    let s = '';
    for (let i = 0; i < l; i++) {
        const c = buf[pos + 1 + i];
        s += (c >= 32 && c < 127) ? String.fromCharCode(c) : '\uFFFD';
    }
    return { s, l, end: pos + 1 + l };
}

function tvwFindPads(buf, end) {
    // busca tablas [count][unknown=2] + records que parsean completo
    // con net<len y posiciones razonables
    const cands = [];
    for (let o = 8; o < end - 40; o++) {
        const count = buf.readUInt32LE(o);
        if (count < 300 || count > 200000) continue;
        const unk = buf.readUInt32LE(o + 4);
        if (unk > 5000) continue;
        let p = o + 8, ok = true, distinct = new Set();
        const limit = Math.min(count, 60000);
        for (let k = 0; k < limit; k++) {
            if (p + 18 > end) { ok = false; break; }
            const net = buf.readUInt32LE(p);
            if (net >= 1580) { ok = false; break; }
            distinct.add(net);
            const hasDim = buf[p + 18];
            let L = 19;
            if (hasDim) {
                if (p + 37 > end) { ok = false; break; }
                L = 38;
                if (buf[p + 37]) L += 16;
            }
            p += L;
        }
        if (!ok) continue;
        cands.push({ o, count, unk, distinct: distinct.size });
    }
    cands.sort((a, b) => b.distinct - a.distinct);
    return cands.slice(0, 2);
}

function tvwFindParts(buf, end) {
    const cands = [];
    const MAX = 3000;
    for (let o = 4; o < end - 60; o++) {
        const count = buf.readUInt32LE(o);
        if (count < 5 || count > MAX) continue;
        const unk = buf.readUInt32LE(o + 4);
        if (unk > 10) continue;
        let p = o + 8, ok = true, pins = 0;
        let firstRef = '';
        for (let k = 0; k < count; k++) {
            const r = tvwPartLen(buf, p, end);
            if (r < 0) { ok = false; break; }
            if (!firstRef) {
                const nm = pascal(buf, p, end);
                if (nm && nm.s) firstRef = nm.s;
            }
            pins += r.pins;
            p += r.len;
        }
        if (!ok) continue;
        // el primer registro (no vacio) debe ser un refdes valido
        if (!/^[A-Z]{1,4}[0-9][A-Z0-9]*$/.test(firstRef)) continue;
        cands.push({ o, count, unk, pins });
    }
    cands.sort((a, b) => b.pins - a.pins);
    return cands;
}

// Registros 'ricos' del TVW (refdes al inicio, coordenadas, valor en etiquetas
// duplicadas al final y pines). Muchos componentes grandes (conectores, BGA,
// chips tipo LQFP como IT8586E/UE1) solo estan representados con este layout
// (coords-first); las tablas principales los omiten.
function tvwFindPartsRich(buf, end) {
    const out = [];
    for (let o = 4; o < end - 60; o++) {
        const nm = pascal(buf, o, end);
        if (!nm || !nm.s) continue;
        if (!/^[A-Z]{1,4}[0-9][A-Z0-9]*$/.test(nm.s)) continue;
        let p = nm.end, ok = true;
        const c1x = buf.readInt32LE(p), c1y = buf.readInt32LE(p + 4);
        const c2x = buf.readInt32LE(p + 8), c2y = buf.readInt32LE(p + 12);
        for (let k = 0; k < 6; k++) {
            const v = buf.readInt32LE(p + k * 4);
            if (v < -1500000 || v > 1500000) { ok = false; break; }
        }
        if (!ok) continue;
        p += 24;
        for (let k = 0; k < 5; k++) {
            if (buf.readUInt32LE(p + k * 4) > 200000) { ok = false; break; }
        }
        if (!ok) continue;
        p += 20;
        if (buf[p] !== 1) continue; p += 1;
        const v1 = pascal(buf, p, end); if (!v1 || !v1.s) continue; p = v1.end;
        if (buf[p] !== 0 || buf[p + 1] !== 0) continue; p += 2;
        const v2 = pascal(buf, p, end); if (!v2 || v2.s !== v1.s) continue; p = v2.end;
        if (p + 24 > end) continue;
        if (buf.readUInt32LE(p) !== 0 || buf.readUInt32LE(p + 8) !== 0x200 ||
            buf.readUInt32LE(p + 12) !== 0 || buf.readUInt32LE(p + 20) !== 0) continue;
        const count = buf[p + 5];
        const layer = buf[p + 9];
        if (count < 1 || count > 400 || (layer !== 2 && layer !== 7)) continue;
        // pos en este layout = 5o/6o par (ancla del refdes), NO la esquina c1
        const posx = buf.readInt32LE(nm.end + 16), posy = buf.readInt32LE(nm.end + 20);
        let q = p + 24;
        if (buf[q] === 0 && buf[q + 1] !== 0) q += 1;
        const pins = [];
        let bad = false;
        for (let i = 0; i < count; i++) {
            const last = i === count - 1;
            if (q + 6 > end) { bad = true; break; }
            if (buf[q] !== i + 1) { bad = true; break; }
            if (buf[q + 1] || buf[q + 2] || buf[q + 3]) { bad = true; break; }
            const pn = pascal(buf, q + 4, end);
            if (!pn || pn.l > 3) { bad = true; break; }
            if (buf.readUInt32LE(pn.end) !== 0) { bad = true; break; }
            const padraw = buf.readUInt32LE(pn.end + 4);
            if (padraw > 9000 && !last) { bad = true; break; }
            if (buf.readUInt32LE(pn.end + 8) !== 0 && !last) { bad = true; break; }
            pins.push({ idx: buf[q], name: pn.s });
            q = pn.end + 12;
        }
        if (bad || pins.length !== count) continue;
        out.push({
            name: nm.s, rot: 0, posx, posy, type: 0, layer, value: v1.s,
            s3: '', s4: '', pkg: v1.s, serial: '', pins: [],
            c1x, c1y, c2x, c2y, end: q,
            richCount: pins.length, pinNames: pins.map(x => x.name),
        });
    }
    return out;
}

function tvwReadOnePart(buf, o, end) {
    const nm = pascal(buf, o, end);
    if (!nm) return null;
    let p = nm.end;
    const c1x = buf.readInt32LE(p), c1y = buf.readInt32LE(p + 4);
    const c2x = buf.readInt32LE(p + 8), c2y = buf.readInt32LE(p + 12);
    p += 16;
    const posx = buf.readInt32LE(p), posy = buf.readInt32LE(p + 4);
    p += 8;
    const rot = buf.readUInt32LE(p); p += 4;
    p += 4;
    const type = buf.readUInt32LE(p); p += 4;
    p += 4 + 4;
    const hasS = buf[p]; p += 1;
    let value = '', s3 = '', s4 = '', pkg = '', serial = '';
    if (hasS) {
        const vs = pascal(buf, p, end); if (vs) { value = vs.s; p = vs.end; }
        const a = pascal(buf, p, end); if (a) { s3 = a.s; p = a.end; }
        const b1 = pascal(buf, p, end); if (b1) { s4 = b1.s; p = b1.end; }
        const c1 = pascal(buf, p, end); if (c1) { pkg = c1.s; p = c1.end; }
        const d1 = pascal(buf, p, end); if (d1) { serial = d1.s; p = d1.end; }
    }
    p += 4;
    const numpins = buf.readUInt32LE(p); p += 4;
    const layer = buf.readUInt32LE(p); p += 4;
    p += 4;
    const pins = [];
    for (let k = 0; k < numpins; k++) {
        const padid = buf.readUInt32LE(p) >> 3; p += 4;
        p += 4;
        const pinNo = buf.readUInt32LE(p); p += 4;
        const pn = pascal(buf, p, end); p = (pn ? pn.end : p) + 4;
        pins.push({ padid, pinNo, name: pn ? pn.s : String(pinNo) });
    }
    return { name: nm.s, rot, posx, posy, type, layer, value, s3, s4, pkg, serial, pins, end: p,
        c1x, c1y, c2x, c2y };
}

function tvwPartLen(buf, o, end) {
    const nm = pascal(buf, o, end);
    if (!nm) return -1;
    if (nm.s !== '' && !/^[A-Za-z0-9][A-Za-z0-9_#+\-.*()]*$/.test(nm.s)) return -1;
    let p = nm.end + 16 + 8 + 4 + 4 + 4 + 4 + 4;
    if (p >= end) return -1;
    const hasS = buf[p]; p += 1;
    if (hasS > 1) return -1;
    for (let k = 0; k < 5; k++) {
        if (!hasS) break;
        const s = pascal(buf, p, end);
        if (!s) return -1;
        p = s.end;
    }
    p += 4;
    if (p + 12 > end) return -1;
    const np = buf.readUInt32LE(p); p += 4;
    const layer = buf.readUInt32LE(p); p += 4;
    p += 4;
    if (np > 2000 || (layer !== 2 && layer !== 7)) return -1;
    let pins = 0;
    for (let i = 0; i < np; i++) {
        if (p + 16 > end) return -1;
        const pad = buf.readUInt32LE(p); p += 4;
        p += 4 + 4;
        const name = pascal(buf, p, end);
        if (!name) return -1;
        p = name.end + 4;
        if (pad < 0) return -1;
        pins++;
    }
    return { len: p - o, pins };
}

function tvwFindNets(buf) {
    const end = buf.length;
    let best = null;
    for (let o = 4; o < end - 8; o++) {
        const count = buf.readUInt32LE(o);
        if (count < 50 || count > 20000) continue;
        const dup = buf.readUInt32LE(o + 4);
        if (dup !== count) continue;
        let p = o + 8, ok = true, readable = 0;
        for (let i = 0; i < count && p + 2 < end; i++) {
            const s = pascal(buf, p, end);
            if (!s) { ok = false; break; }
            if (s.l > 0 && !s.s.includes('\uFFFD')) readable++;
            p = s.end;
        }
        if (!ok) continue;
        if (!best || readable > best.readable) best = { o, count, readable };
    }
    if (!best) return null;
    // re-parse garantizado
    const names = [];
    let p = best.o + 8;
    for (let i = 0; i < best.count; i++) {
        const s = pascal(buf, p, end);
        names.push(s.s);
        p = s.end;
    }
    return { o: best.o, count: best.count, names, readable: best.readable };
}

function tvwFindLabels(parts) {
    // El TVW no guarda una tabla separada de textos de serigrafia con
    // coordenadas propias: cada registro de componente lleva su ancla de
    // texto (posx,posy), el punto donde el programa de origen dibuja el
    // refdes. Escanear cadenas pascal arbitrarias fabricaba etiquetas falsas
    // (p.ej. el refdes del registro 'rico' hacia aparecer UE1 apoyado en la
    // esquina de su caja). Las etiquetas reales salen de las partes.
    const labels = [];
    for (const p of parts) {
        if (p.posx === undefined || p.posy === undefined) continue;
        if (!isFinite(p.posx) || !isFinite(p.posy)) continue;
        labels.push({ text: p.name, x: p.posx, y: p.posy, side: p.side });
    }
    return labels;
}

function tvwReadPadsTable(buf, offset, count, end) {
    const pads = [];
    let p = offset + 8;
    for (let i = 0; i < count; i++) {
        if (p + 18 > end) throw new Error('TVW: pad list truncated');
        const net = buf.readUInt32LE(p);
        const dcode = buf.readUInt32LE(p + 4);
        const x = buf.readInt32LE(p + 8);
        const y = buf.readInt32LE(p + 12);
        const flag1 = buf[p + 16];
        const hasDim = buf[p + 17];
        let L = 19;
        let c = null;
        if (hasDim) {
            const c1x = buf.readInt32LE(p + 21), c1y = buf.readInt32LE(p + 25);
            const c2x = buf.readInt32LE(p + 29), c2y = buf.readInt32LE(p + 33);
            L = 38;
            if (buf[p + 37]) L += 16;
            c = { s: padRectFromCorners(c1x, c1y, c2x, c2y) };
        }
        pads.push({ net, dcode, x, y, flag1, c });
        p += L;
    }
    return { pads, end: p };
}

function padRectFromCorners(x1, y1, x2, y2) {
    return { w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
}

function loadTvw(buf) {
    if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
    const end = buf.length;
    if (end < 64) throw new Error('TVW file too small');

    // licenciante / fecha (strings scrambled, saltos de 0x00)
    let licensee = '';
    for (let i = 6; i < Math.min(40, end); i++) {
        const c = buf[i];
        if (c === 0) break;
        licensee += (c >= 32 && c < 127) ? String.fromCharCode(c) : '.';
    }

    // nets
    const nets = tvwFindNets(buf);
    if (!nets) throw new Error('TVW: could not locate nets table');
    if (nets.count !== nets.names.length) throw new Error('TVW: bad nets table');
    const netName = (id) => (id >= 0 && id < nets.names.length) ? nets.names[id] : ('net_' + id);

    // parts (para powering de pins -> ref)
    const partTbls = tvwFindParts(buf, end) || [];

    // pads (2 tablas: TOP y BOTTOM)
    let padTbls = tvwFindPads(buf, partTbls.length ? partTbls[0].o : end);
    if (padTbls.length < 2 && partTbls[0]) padTbls = tvwFindPads(buf, partTbls[0].o);
    if (padTbls.length === 0) throw new Error('TVW: could not locate pads tables');

    const padLayers = [[], []];
    let padCoords = [];   // {x,y,net,layer,pins}
    for (let i = 0; i < Math.min(2, padTbls.length); i++) {
        const tbl = padTbls[i];
        const parsed = tvwReadPadsTable(buf, tbl.o, tbl.count, end);
        padLayers[i] = parsed.pads;
    }

    // rango de coordenadas de pads para filtrar partes invalidas
    let P0 = Infinity, P1 = -Infinity, Q0 = Infinity, Q1 = -Infinity;
    for (let i = 0; i < padLayers.length; i++) {
        for (const pad of padLayers[i]) {
            if (pad.x < P0) P0 = pad.x; if (pad.x > P1) P1 = pad.x;
            if (pad.y < Q0) Q0 = pad.y; if (pad.y > Q1) Q1 = pad.y;
        }
    }
    const PM = P0 === Infinity ? 100000 : 100000;
    P0 -= PM; P1 += PM; Q0 -= PM; Q1 += PM;

    // parts parse (tvw.c) -> model; fusiona tablas candidatas complementarias
    // por cada refdes se conserva la ocurrencia con la caja mas plausible
    // (la menor area), descartando scans desalineados que producen cajas
    // gigantes/erroneas y componentes superpuestos.
    const parts = [];
    const partRef = new Map(); // part name -> {layer, pins}
    const best = new Map();    // name -> {r, area}
    for (const tbl of partTbls) {
        let p = tbl.o + 8;
        for (let i = 0; i < tbl.count; i++) {
            const r = tvwReadOnePart(buf, p, end);
            if (!r) break;
            p = r.end;
            if (!r.name) continue;
            if (r.posx < P0 || r.posx > P1 || r.posy < Q0 || r.posy > Q1) continue;
            if (r.c1x < P0 || r.c1x > P1 || r.c2y < Q0 || r.c2y > Q1) continue;
            const area = Math.abs((r.c2x - r.c1x) * (r.c2y - r.c1y));
            const prev = best.get(r.name);
            if (!prev || area < prev.area) best.set(r.name, { r, area });
        }
    }

    // registros 'ricos' (coords-first): componentes grandes que las tablas
    // principales omiten (UE1/IT8586E, conectores, etc.). Se fusionan por
    // refdes conservando la caja mas plausible (menor area).
    const richParts = tvwFindPartsRich(buf, end);
    for (const r of richParts) {
        if (!r.name) continue;
        if (r.posx < P0 || r.posx > P1 || r.posy < Q0 || r.posy > Q1) continue;
        if (r.c1x < P0 || r.c1x > P1 || r.c2y < Q0 || r.c2y > Q1) continue;
        const area = Math.abs((r.c2x - r.c1x) * (r.c2y - r.c1y));
        const prev = best.get(r.name);
        if (!prev || !isFinite(prev.area) || area < prev.area) best.set(r.name, { r, area });
    }
    for (const { r } of best.values()) {
        partRef.set(parts.length, { layer: r.layer, pins: r.pins });
        parts.push({
            name: r.name, sym: '', mirror: '', rotate: String(r.rot),
            side: r.layer === 7 ? 'bottom' : 'top',
            desc: r.pkg && r.pkg !== r.value ? r.value + ' / ' + r.pkg : r.value,
            partno: '', qty: '',
            posx: r.posx || 0, posy: r.posy || 0,
            x1: r.c1x, y1: r.c1y, x2: r.c2x, y2: r.c2y,
            richCount: r.richCount || 0, pinNames: r.pinNames || [],
        });
    }

    // ref y codigo de pin por almohadilla, por capa
    const refByLayer = [new Map(), new Map()];
    const codeByLayer = [new Map(), new Map()];
    for (let pi = 0; pi < parts.length; pi++) {
        const prt = partRef.get(pi);
        if (!prt) continue;
        const li = prt.layer === 7 ? 1 : 0;
        for (const pin of prt.pins) {
            if (!refByLayer[li].has(pin.padid)) refByLayer[li].set(pin.padid, parts[pi].name);
            if (!codeByLayer[li].has(pin.padid)) codeByLayer[li].set(pin.padid, pin.name);
        }
    }

    // pins = pads proyectados; ref y net desde parts
    const pins = [];
    const netPins = {};
    for (let i = 0; i < padLayers.length; i++) {
        const layer = i === 0 ? 'top' : 'bottom';
        padLayers[i].forEach((pad, idx) => {
            const net = netName(pad.net);
            const ref = refByLayer[i].get(idx) || '';
            const pcode = codeByLayer[i].get(idx) || '';
            const pi = pins.length;
            pins.push({
                net, ref, num: String(idx), name: net, l: net, padIdx: idx, netid: pad.net,
                pcode, x: pad.x, y: pad.y, rad: 1, s: layer,
                dcode: pad.dcode, flag1: pad.flag1,
            });
            if (!netPins[net]) netPins[net] = [];
            netPins[net].push(pi);
        });
    }

    // Asignacion espacial por caja real (con margen de claridad): cada pad
    // sin ref queda asociado a la parte cuya caja este mas cerca, solo si esa
    // distancia es claramente menor que la del 2o candidato. Asi los pines
    // perimetrales de los componentes 'ricos' (UE1 y demas) y de todas las
    // partes cuyo mapeo padid no fue fiable recuperan su ref sin robar pads
    // de vecinos (un pad entre dos cajas queda sin ref: caso ambiguo).
    {
        const realParts = [];
        for (let i = 0; i < parts.length; i++) {
            const p = parts[i];
            if (p.x1 === undefined || (p.x1 === p.x2 && p.y1 === p.y2)) continue;
            realParts.push(p);
        }
        for (const pin of pins) {
            if (pin.ref) continue;
            let d1 = Infinity, d2 = Infinity, b1 = -1;
            for (let k = 0; k < realParts.length; k++) {
                const p = realParts[k];
                const dx = (pin.x < p.x1) ? p.x1 - pin.x : (pin.x > p.x2 ? pin.x - p.x2 : 0);
                const dy = (pin.y < p.y1) ? p.y1 - pin.y : (pin.y > p.y2 ? pin.y - p.y2 : 0);
                const d = dx * dx + dy * dy;
                if (d < d1) { d2 = d1; d1 = d; b1 = k; }
                else if (d < d2) d2 = d;
            }
            if (b1 < 0) continue;
            const p = realParts[b1];
            const tol = Math.max(600, 0.18 * Math.max(p.x2 - p.x1, p.y2 - p.y1));
            if (d1 > tol * tol) continue;
            const r1 = Math.sqrt(d1);
            const r2 = d2 === Infinity ? Infinity : Math.sqrt(d2);
            const spread = Math.max(300, r1 * 0.25);
            if (r2 - r1 >= spread) pin.ref = p.name;
        }
    }

    // componentes 'ricos' con numero de pines conocido: si el pase espacial
    // no alcanzo ese conteo (zonas muy pobladas con cajas solapadas), se
    // rellenan con los pads del anillo exterior de caja mas cercanos que
    // sigan sin ref, del mismo lado y dentro de un radio razonable.
    const refCount = new Map();
    for (const pin of pins) if (pin.ref) refCount.set(pin.ref, (refCount.get(pin.ref) || 0) + 1);
    for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (!p.richCount || p.x1 === undefined) continue;
        if ((refCount.get(p.name) || 0) >= p.richCount) continue;
        const W = Math.abs(p.x2 - p.x1), H = Math.abs(p.y2 - p.y1);
        const S = Math.max(W, H);
        const maxOut = 0.85 * S, minOut = -0.1 * S;
        const cand = [];
        for (const pin of pins) {
            if (pin.ref) continue;
            const dx = (pin.x < p.x1) ? p.x1 - pin.x : (pin.x > p.x2 ? pin.x - p.x2 : 0);
            const dy = (pin.y < p.y1) ? p.y1 - pin.y : (pin.y > p.y2 ? pin.y - p.y2 : 0);
            const out = Math.max(dx, dy);
            if (out >= minOut && out <= maxOut) cand.push([out, pin]);
        }
        cand.sort((a, b) => a[0] - b[0]);
        for (let k = 0; k < cand.length && (refCount.get(p.name) || 0) < p.richCount; k++) {
            if (!cand[k][1].ref) {
                cand[k][1].ref = p.name;
                refCount.set(p.name, (refCount.get(p.name) || 0) + 1);
            }
        }
    }

    // partes con bbox degenerado (punto) -> derivar extents reales desde sus pines
    // SOLO si sus pines forman un cumulo compacto (<=25% del board); si no,
    // se deja como punto para no dibujar cajas gigantes/superpuestas.
    let x0b = Infinity, y0b = Infinity, x1b = -Infinity, y1b = -Infinity;
    for (const pin of pins) {
        if (pin.x < x0b) x0b = pin.x;
        if (pin.x > x1b) x1b = pin.x;
        if (pin.y < y0b) y0b = pin.y;
        if (pin.y > y1b) y1b = pin.y;
    }
    const pinSpan = Math.max((x1b - x0b) || 1, (y1b - y0b) || 1);
    for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (p.x1 !== p.x2 || p.y1 !== p.y2) continue;
        let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
        for (const pin of pins) {
            if (pin.ref !== p.name) continue;
            if (pin.x < a0) a0 = pin.x;
            if (pin.x > a1) a1 = pin.x;
            if (pin.y < b0) b0 = pin.y;
            if (pin.y > b1) b1 = pin.y;
        }
        if (a0 !== Infinity && (a1 - a0) <= pinSpan * 0.25 && (b1 - b0) <= pinSpan * 0.25) {
            p.x1 = a0; p.x2 = a1;
            p.y1 = b0; p.y2 = b1;
        }
    }

    // Reconciliacion de lados: el lado real de una parte es el de la mayoria
    // de sus pines (las 2 tablas de pads corresponden a los lados fisicos).
    // Primero se ajusta part.side a la mayoria y despues se limpian los refs
    // cruzados (pin.s != part.side) para que ningun componente muestre pines
    // mezclados entre la vista superior e inferior.
    {
        const partById = new Map(parts.map((p, i) => [p.name, p]));
        const bySide = new Map();
        for (const pin of pins) {
            if (!pin.ref) continue;
            let arr = bySide.get(pin.ref);
            if (!arr) { arr = { top: 0, bottom: 0 }; bySide.set(pin.ref, arr); }
            arr[pin.s]++;
        }
        for (const [name, arr] of bySide) {
            const p = partById.get(name);
            if (!p) continue;
            const total = arr.top + arr.bottom;
            if (total >= 2 && Math.abs(arr.top - arr.bottom) >= 2) {
                p.side = arr.bottom > arr.top ? 'bottom' : 'top';
            }
        }
        let cleared = 0;
        for (const pin of pins) {
            if (!pin.ref) continue;
            const p = partById.get(pin.ref);
            if (!p || pin.s !== p.side) { pin.ref = ''; cleared++; }
        }
    }

    // labels de serigrafia (texto + coords) del archivo TVW
    const labels = tvwFindLabels(parts);

    // bounds
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const pin of pins) {
        if (pin.x < x0) x0 = pin.x;
        if (pin.x > x1) x1 = pin.x;
        if (pin.y < y0) y0 = pin.y;
        if (pin.y > y1) y1 = pin.y;
    }
    const m = 20;
    let outline = [];
    if (pins.length) {
        x0 -= m; y0 -= m; x1 += m; y1 += m;
        outline = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
    } else {
        x0 = y0 = 0; x1 = y1 = 100;
    }

    return {
        title: 'TVW Board (' + licensee.trim() + ')',
        x0, y0, x1, y1, outline,
        parts, pins, nails: [], netPins, labels,
    };
}

module.exports = { loadBoard, loadTvw, loadCad, rc6Decode, keyOk, mul32, rotl };

/* ---------------------------------------------------------------- *
 * CAD (GenCAD/CAMCAD ASCII, e.g. MSI "*.cad" exports) support.
 *
 * Text format with $-sections ($HEADER $LAYERS $PADS $PADSTACKS
 * $SHAPES $COMPONENTS $SIGNALS $DEVICES $ROUTES $BOARD ...).
 * Units are mils (line "UNITS USER 1000" in the header).
 *
 * Geometry rules verified against the copper track endpoints:
 *   - TOP  part: pin = PLACE + rotate(pinOffset, ROTATION)
 *   - BOTTOM part: pin = PLACE + rotate(mirrorY(pinOffset), ROTATION)
 *     where mirrorY(x, y) = (-x, y)  (SHAPE ... MIRRORY FLIP).
 * ---------------------------------------------------------------- */

function loadCad(buf) {
    if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
    let text = buf.toString('utf8');
    if (text.indexOf('\uFFFD') !== -1) text = buf.toString('latin1');
    const lines = text.split(/\r?\n/);

    const shapes = new Map();   // shape name -> { pins: [{n, pad, x, y}] }
    const comps = [];           // {ref, x, y, layer, rot, mirror, shape, device}
    const devs = new Map();     // device -> part value
    const signals = [];         // {name, nodes: [[ref, pinNo]]}
    const vias = [];            // {x, y, layer}
    let revision = '';

    let sec = '';
    let curShape = null;
    let curSig = null;
    let curComp = null;

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const line = raw.trim();
        if (line.length === 0) continue;
        const up = line.toUpperCase();

        if (line.charAt(0) === '$') {
            if (up.startsWith('$END')) {
                sec = '';
                curShape = null;
                curSig = null;
                curComp = null;
            } else {
                sec = up.slice(1);
            }
            continue;
        }

        switch (sec) {
            case 'HEADER':
                if (up.startsWith('REVISION ')) {
                    const m = line.match(/"([^"]+)"/);
                    if (m) revision = m[1];
                }
                break;
            case 'SHAPES':
                if (up.startsWith('SHAPE ')) {
                    curShape = { name: line.slice(6).trim().split(/\s+/)[0], pins: [] };
                    shapes.set(curShape.name, curShape);
                } else if (up.startsWith('PIN ') && curShape) {
                    const f = line.split(/\s+/);
                    if (f.length >= 6) {
                        curShape.pins.push({
                            n: parseInt(f[1], 10),
                            pad: f[2],
                            x: parseFloat(f[3]),
                            y: parseFloat(f[4]),
                        });
                    }
                }
                break;
            case 'COMPONENTS':
                if (up.startsWith('COMPONENT ')) {
                    curComp = { ref: line.slice(10).trim(), x: 0, y: 0, layer: 'TOP', rot: 0, mirror: '', shape: '', device: '' };
                    comps.push(curComp);
                } else if (curComp) {
                    const f = line.split(/\s+/);
                    const kw = f[0].toUpperCase();
                    if (kw === 'PLACE' && f.length >= 3) { curComp.x = parseFloat(f[1]); curComp.y = parseFloat(f[2]); }
                    else if (kw === 'LAYER' && f.length >= 2) curComp.layer = f[1];
                    else if (kw === 'ROTATION' && f.length >= 2) curComp.rot = parseFloat(f[1]);
                    else if (kw === 'SHAPE' && f.length >= 2) {
                        curComp.shape = f[1];
                        curComp.mirror = f.length >= 3 ? f[2] : '';
                    }
                    else if (kw === 'DEVICE' && f.length >= 2) curComp.device = f[1];
                }
                break;
            case 'SIGNALS':
                if (up.startsWith('SIGNAL ')) {
                    curSig = { name: line.slice(7).trim(), nodes: [] };
                    signals.push(curSig);
                } else if (up.startsWith('NODE ') && curSig) {
                    const f = line.split(/\s+/);
                    if (f.length >= 3) curSig.nodes.push([f[1], parseInt(f[2], 10)]);
                }
                break;
            case 'DEVICES':
                if (up.startsWith('DEVICE ')) {
                    curSig = line.split(/\s+/);
                    if (curSig.length >= 2) devs.set(curSig.slice(1).join(' ').trim(), '');
                } else if (up.startsWith('PART ') && curSig) {
                    devs.set(curSig.slice(1).join(' ').trim(), line.slice(5).trim());
                }
                break;
            case 'ROUTES':
                if (up.startsWith('VIA ')) {
                    const f = line.split(/\s+/);
                    if (f.length >= 4) {
                        vias.push({ x: parseFloat(f[2]), y: parseFloat(f[3]), layer: f.length >= 5 ? f[4] : 'ALL' });
                    }
                }
                break;
        }
    }

    // signal lookup: ref + '|' + pinNo -> net
    const netByKey = new Map();
    for (const sig of signals) {
        for (const [ref, n] of sig.nodes) {
            const key = ref + '|' + n;
            if (!netByKey.has(key)) netByKey.set(key, sig.name);
        }
    }

    const DEG = Math.PI / 180;
    const parts = [];
    const pins = [];
    const netPins = {};
    const allByPart = new Map(); // ref -> array of pin indexes

    for (const c of comps) {
        const bottom = c.layer.toUpperCase() === 'BOTTOM';
        const side = bottom ? 'bottom' : 'top';
        const sp = shapes.get(c.shape) || { pins: [] };
        const a = (c.rot || 0) * DEG;
        const ca = Math.cos(a), sa = Math.sin(a);
        const idxList = [];
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of sp.pins) {
            let lx = p.x, ly = p.y;
            if (bottom) {
                if (c.mirror.toUpperCase() === 'MIRRORY') lx = -lx;
                else if (c.mirror.toUpperCase() === 'MIRRORX') ly = -ly;
            }
            const rx = lx * ca - ly * sa;
            const ry = lx * sa + ly * ca;
            const px = c.x + rx;
            const py = c.y + ry;
            const net = netByKey.get(c.ref + '|' + p.n) || '';
            const pcode = p.pad;
            const pi = pins.length;
            pins.push({
                x: px, y: py, net, ref: c.ref, num: String(p.n),
                name: net || pcode, l: net || pcode, pcode,
                s: side, rad: 8, dcode: 0, flag1: 0, netid: -1,
            });
            idxList.push(pi);
            if (!netPins[net]) netPins[net] = [];
            if (net) netPins[net].push(pi);
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
        }
        if (minX === Infinity) { minX = c.x - 10; maxX = c.x + 10; minY = c.y - 10; maxY = c.y + 10; }
        const dev = devs.get(c.device);
        parts.push({
            name: c.ref, sym: '', mirror: c.mirror, rotate: String(c.rot),
            side, desc: (dev && dev !== c.device) ? c.device + ' / ' + dev : c.device,
            partno: dev || '',
            qty: '', x1: minX, y1: minY, x2: maxX, y2: maxY,
        });
        allByPart.set(c.ref, idxList);
    }

    // bounds + outline
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const pin of pins) {
        if (pin.x < x0) x0 = pin.x;
        if (pin.x > x1) x1 = pin.x;
        if (pin.y < y0) y0 = pin.y;
        if (pin.y > y1) y1 = pin.y;
    }
    const m = 20;
    let outline = [];
    if (pins.length) {
        x0 -= m; y0 -= m; x1 += m; y1 += m;
        outline = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
    } else {
        x0 = y0 = 0; x1 = y1 = 100;
    }

    const nails = [];
    for (const v of vias) {
        const lay = v.layer.toUpperCase();
        nails.push({ x: v.x, y: v.y, s: lay === 'BOTTOM' ? 'bottom' : 'top' });
        if (lay === 'ALL') nails.push({ x: v.x, y: v.y, s: 'bottom' });
    }

    return {
        title: 'CAD Board' + (revision ? ' · ' + revision : ''),
        x0, y0, x1, y1, outline,
        parts, pins, nails, netPins,
        _allByPart: allByPart,
    };
}