var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// lib/fz.js
var require_fz = __commonJS({
  "lib/fz.js"(exports2, module2) {
    var zlib = require("zlib");
    var FZ_KEY = [
      634966600,
      3780125701,
      1454756998,
      1763786720,
      2720305388,
      33413626,
      109155679,
      262938669,
      3670666932,
      4127345338,
      3448458438,
      2670754958,
      1253636823,
      590321277,
      1585866403,
      3734400331,
      3326868252,
      3934236818,
      443882110,
      938012860,
      861522163,
      2526724651,
      1628395524,
      3650949350,
      3314373846,
      530246283,
      2386070554,
      3841446637,
      1046323702,
      3992879498,
      1918021654,
      3036914032,
      3289550774,
      747884267,
      1397987950,
      3671029352,
      985108050,
      2397689877,
      1883502489,
      3332398543,
      1920933282,
      234723387,
      2026190962,
      9721490
    ];
    var KEY_PARITY = [
      0,
      1,
      1,
      0,
      1,
      0,
      1,
      0,
      0,
      0,
      1,
      0,
      0,
      1,
      1,
      0,
      1,
      1,
      0,
      1,
      0,
      0,
      0,
      1,
      1,
      1,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      1,
      0,
      0,
      1,
      1,
      0,
      1
    ];
    function parity(x) {
      x ^= x >>> 16;
      x ^= x >>> 8;
      x ^= x >>> 4;
      x ^= x >>> 2;
      x ^= x >>> 1;
      return ~x & 1;
    }
    function keyOk() {
      return FZ_KEY.every((w, i) => parity(w) === KEY_PARITY[i]);
    }
    function mul32(a, b) {
      a = a >>> 0;
      b = b >>> 0;
      const a0 = a & 65535, a1 = a >>> 16;
      const b0 = b & 65535, b1 = b >>> 16;
      const lo = a0 * b0;
      const mid = a0 * b1 + a1 * b0;
      return lo + ((mid & 65535) << 16) >>> 0;
    }
    function rotl(a, b) {
      b = b & 31;
      a = a >>> 0;
      if (b === 0) return a;
      return (a << b | a >>> 32 - b) >>> 0;
    }
    function rc6Decode(data) {
      const n = data.length;
      if (n === 0) return data;
      const key = FZ_KEY;
      let A = 0, B = 0, C = 0, D = 0;
      const out = Buffer.alloc(n);
      const ib = new Uint8Array(16);
      for (let pos = 0; pos < n; pos++) {
        B = B + key[0] >>> 0;
        D = D + key[1] >>> 0;
        for (let i = 1; i <= 20; i++) {
          const t = rotl(mul32(B, (B << 1 | 1) >>> 0), 5);
          const u = rotl(mul32(D, (D << 1 | 1) >>> 0), 5);
          A = rotl(A ^ t, u) + key[2 * i] >>> 0;
          C = rotl(C ^ u, t) + key[2 * i + 1] >>> 0;
          const tmp = A;
          A = B;
          B = C;
          C = D;
          D = tmp;
        }
        A = A + key[42] >>> 0;
        C = C + key[43] >>> 0;
        const cur = data[pos];
        out[pos] = cur ^ A & 255;
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
      let mult = 1;
      let block = 0;
      for (let line of content.split(/\r?\n/)) {
        line = line.trim();
        if (!line) continue;
        if (line === "UNIT:millimeters") {
          mult = 25.4;
          continue;
        }
        if (line.startsWith("A!")) {
          const hdr = line.slice(2).split("!")[0];
          block = {
            REFDES: 1,
            NET_NAME: 2,
            TESTVIA: 3,
            GRAPHIC_DATA_NAME: 4,
            CLASS: 5,
            LOGOInfo: 6,
            UnDrawSym: 7
          }[hdr];
          if (block === void 0) block = -1;
          continue;
        }
        if (!line.startsWith("S!")) continue;
        const f = line.split("!");
        if (block === 1 && f.length >= 6) {
          const name = f[1];
          const side = f[4] === "YES" ? "bottom" : "top";
          const part = {
            name,
            sym: f[3] || "",
            mirror: f[4],
            rotate: f[5] || "",
            side,
            desc: "",
            partno: "",
            qty: "",
            x1: 0,
            y1: 0,
            x2: 0,
            y2: 0
          };
          parts.push(part);
          partIndex[name] = parts.length - 1;
        } else if (block === 2 && f.length >= 9) {
          const x = parseFloat(f[5]);
          const y = parseFloat(f[6]);
          if (isNaN(x) || isNaN(y)) continue;
          let radius = 0.5;
          if (f[8]) {
            const rv = parseFloat(f[8]);
            if (!isNaN(rv)) radius = Math.max(0.5, rv / 100) * mult;
          }
          const ref = f[2];
          let pi = partIndex[ref];
          if (pi === void 0) {
            parts.push({
              name: ref,
              sym: "",
              mirror: "",
              rotate: "",
              side: "top",
              desc: "",
              partno: "",
              qty: "",
              x1: 0,
              y1: 0,
              x2: 0,
              y2: 0
            });
            pi = parts.length - 1;
            partIndex[ref] = pi;
          }
          const num = f[3], name = f[4];
          const label = num.length <= 1 && (num === "" || num === "0") ? name : num;
          pins.push({
            net: f[1],
            ref,
            num,
            name,
            l: label,
            pcode: num,
            x: x * mult,
            y: y * mult,
            rad: radius,
            s: parts[pi].side
          });
        } else if (block === 3 && f.length >= 10) {
          const x = parseFloat(f[6]);
          const y = parseFloat(f[7]);
          if (isNaN(x) || isNaN(y)) continue;
          const num = f[4], name = f[5];
          const label = num.length <= 1 && (num === "" || num === "0") ? name : num;
          const side = f[8] === "T" ? "top" : "bottom";
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
        p.x1 = found ? minX : 0;
        p.y1 = found ? minY : 0;
        p.x2 = found ? maxX : 0;
        p.y2 = found ? maxY : 0;
      }
      return { parts, partIndex, pins, nails };
    }
    function parseDescr(descr, partIndex, parts) {
      const lines = descr.split(/\r?\n/);
      const title = (lines[0] || "").trim();
      for (let i = 2; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line[0] === "s") continue;
        const field = line.split("	");
        if (field.length < 4) continue;
        const partno = field[0], description = field[1], qty = field[2];
        for (const refdes of field[3].split(/\s+/)) {
          const idx = partIndex[refdes];
          if (idx !== void 0 && idx < parts.length) {
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
      let section = "";
      let outline = [];
      let skipBrdoutHeader = false;
      for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        if (line.startsWith("BRDOUT:")) {
          section = "BRDOUT";
          skipBrdoutHeader = true;
          continue;
        }
        if (/^(NETS|PARTS|PINS|NAILS):/.test(line)) {
          section = line.slice(0, line.indexOf(":"));
          continue;
        }
        const fields = line.split(/\s+/);
        if (section === "BRDOUT" && fields.length >= 2) {
          if (skipBrdoutHeader) {
            skipBrdoutHeader = false;
            continue;
          }
          const x = Number(fields[0]), y = Number(fields[1]);
          if (Number.isFinite(x) && Number.isFinite(y)) outline.push([x, y]);
        } else if (section === "NETS" && fields.length >= 2) {
          nets[fields[0]] = fields.slice(1).join(" ");
        } else if (section === "PARTS" && fields.length >= 6) {
          const x12 = Number(fields[1]), y12 = Number(fields[2]);
          const x2 = Number(fields[3]), y2 = Number(fields[4]);
          if (![x12, y12, x2, y2].every(Number.isFinite)) continue;
          parts.push({
            name: fields[0],
            sym: "",
            mirror: "",
            rotate: "",
            side: fields[fields.length - 1] === "2" ? "bottom" : "top",
            desc: "",
            partno: "",
            qty: "",
            x1: x12,
            y1: y12,
            x2,
            y2
          });
        } else if (section === "PINS" && fields.length >= 4) {
          const x = Number(fields[0]), y = Number(fields[1]);
          if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
          const netId = fields[2];
          const candidates = parts.filter((part2) => part2.x1 <= x && x <= part2.x2 && part2.y1 <= y && y <= part2.y2);
          candidates.sort((a, b) => (a.x2 - a.x1) * (a.y2 - a.y1) - (b.x2 - b.x1) * (b.y2 - b.y1));
          const part = candidates[0];
          const num = fields[2];
          const name = nets[netId] || netId;
          pins.push({
            net: name,
            ref: part ? part.name : "",
            num,
            name,
            l: name,
            pcode: fields[3] && netId !== fields[3] ? fields[3] : num,
            x,
            y,
            rad: 0.5,
            s: part ? part.side : "top"
          });
        } else if (section === "NAILS" && fields.length >= 5) {
          const netId = fields[0], x = Number(fields[1]), y = Number(fields[2]);
          if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
          const name = nets[netId] || netId;
          nails.push({
            net: name,
            ref: "",
            num: netId,
            name,
            l: name,
            x,
            y,
            s: fields[4] === "2" ? "bottom" : "top"
          });
        }
      }
      if (!outline.length && pins.length) {
        const xs2 = pins.map((pin) => pin.x), ys2 = pins.map((pin) => pin.y);
        const x02 = Math.min(...xs2) - 20, x12 = Math.max(...xs2) + 20;
        const y02 = Math.min(...ys2) - 20, y12 = Math.max(...ys2) + 20;
        outline = [[x02, y02], [x12, y02], [x12, y12], [x02, y12], [x02, y02]];
      }
      const xs = outline.map((point) => point[0]), ys = outline.map((point) => point[1]);
      const x0 = xs.length ? Math.min(...xs) : 0, x1 = xs.length ? Math.max(...xs) : 100;
      const y0 = ys.length ? Math.min(...ys) : 0, y1 = ys.length ? Math.max(...ys) : 100;
      const netPins = {};
      pins.forEach((pin, index) => {
        if (!netPins[pin.net]) netPins[pin.net] = [];
        netPins[pin.net].push(index);
      });
      return { title: "BRD Board", x0, y0, x1, y1, outline, parts, pins, nails, netPins };
    }
    function loadBoard2(buffer) {
      if (!Buffer.isBuffer(buffer)) throw new Error("expected a Buffer");
      if (buffer.length < 8) throw new Error("file too small");
      if (buffer[0] === 36) return loadCad(buffer);
      if (!keyOk()) throw new Error("invalid FZ key (parity check failed)");
      const header = buffer.subarray(0, 32).toString("utf8");
      if (header.includes("BRDOUT:")) return parseBrd(buffer.toString("utf8"));
      const s1 = buffer[4], s2 = buffer[5];
      let dec;
      if (s1 === 120 && (s2 === 156 || s2 === 218)) {
        dec = buffer;
      } else {
        dec = rc6Decode(buffer);
      }
      if (dec.length < 4) throw new Error("decoded stream too small");
      const descrLen = dec.readUInt32LE(dec.length - 4);
      if (descrLen <= 0 || descrLen > dec.length) {
        throw new Error("decoded stream does not split cleanly (bad key or file)");
      }
      const contentEnd = dec.length - descrLen + 4;
      const contentRaw = dec.subarray(4, contentEnd);
      const descrRaw = dec.subarray(contentEnd);
      let content, descr;
      try {
        content = zlib.inflateSync(contentRaw).toString("utf8");
        descr = zlib.inflateSync(descrRaw).toString("utf8");
      } catch (e) {
        throw new Error("zlib decompression failed: " + e.message);
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
        if (netPins[pin.net] === void 0) netPins[pin.net] = [];
        netPins[pin.net].push(i);
      }
      const m = 20;
      let outline = [];
      if (parsed.pins.length) {
        x0 -= m;
        y0 -= m;
        x1 += m;
        y1 += m;
        outline = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
      } else {
        x0 = y0 = 0;
        x1 = y1 = 100;
      }
      return {
        title,
        x0,
        y0,
        x1,
        y1,
        outline,
        parts: parsed.parts,
        pins: parsed.pins,
        nails: parsed.nails,
        netPins
      };
    }
    function pascal(buf, pos, end) {
      if (pos >= end) return null;
      const l = buf[pos];
      if (l > 64 || pos + 1 + l > end) return null;
      let s = "";
      for (let i = 0; i < l; i++) {
        const c = buf[pos + 1 + i];
        s += c >= 32 && c < 127 ? String.fromCharCode(c) : "\uFFFD";
      }
      return { s, l, end: pos + 1 + l };
    }
    function tvwFindPads(buf, end) {
      const cands = [];
      for (let o = 8; o < end - 40; o++) {
        const count = buf.readUInt32LE(o);
        if (count < 300 || count > 2e5) continue;
        const unk = buf.readUInt32LE(o + 4);
        if (unk > 5e3) continue;
        let p = o + 8, ok = true, distinct = /* @__PURE__ */ new Set();
        const limit = Math.min(count, 6e4);
        for (let k = 0; k < limit; k++) {
          if (p + 18 > end) {
            ok = false;
            break;
          }
          const net = buf.readUInt32LE(p);
          if (net >= 1580) {
            ok = false;
            break;
          }
          distinct.add(net);
          const hasDim = buf[p + 18];
          let L = 19;
          if (hasDim) {
            if (p + 37 > end) {
              ok = false;
              break;
            }
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
      const MAX = 3e3;
      for (let o = 4; o < end - 60; o++) {
        const count = buf.readUInt32LE(o);
        if (count < 5 || count > MAX) continue;
        const unk = buf.readUInt32LE(o + 4);
        if (unk > 10) continue;
        let p = o + 8, ok = true, pins = 0;
        let firstRef = "";
        for (let k = 0; k < count; k++) {
          const r = tvwPartLen(buf, p, end);
          if (r < 0) {
            ok = false;
            break;
          }
          if (!firstRef) {
            const nm = pascal(buf, p, end);
            if (nm && nm.s) firstRef = nm.s;
          }
          pins += r.pins;
          p += r.len;
        }
        if (!ok) continue;
        if (!/^[A-Z]{1,4}[0-9][A-Z0-9]*$/.test(firstRef)) continue;
        cands.push({ o, count, unk, pins });
      }
      cands.sort((a, b) => b.pins - a.pins);
      return cands;
    }
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
          if (v < -15e5 || v > 15e5) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        p += 24;
        for (let k = 0; k < 5; k++) {
          if (buf.readUInt32LE(p + k * 4) > 2e5) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        p += 20;
        if (buf[p] !== 1) continue;
        p += 1;
        const v1 = pascal(buf, p, end);
        if (!v1 || !v1.s) continue;
        p = v1.end;
        if (buf[p] !== 0 || buf[p + 1] !== 0) continue;
        p += 2;
        const v2 = pascal(buf, p, end);
        if (!v2 || v2.s !== v1.s) continue;
        p = v2.end;
        if (p + 24 > end) continue;
        if (buf.readUInt32LE(p) !== 0 || buf.readUInt32LE(p + 8) !== 512 || buf.readUInt32LE(p + 12) !== 0 || buf.readUInt32LE(p + 20) !== 0) continue;
        const count = buf[p + 5];
        const layer = buf[p + 9];
        if (count < 1 || count > 400 || layer !== 2 && layer !== 7) continue;
        const posx = buf.readInt32LE(nm.end + 16), posy = buf.readInt32LE(nm.end + 20);
        let q = p + 24;
        if (buf[q] === 0 && buf[q + 1] !== 0) q += 1;
        const pins = [];
        let bad = false;
        for (let i = 0; i < count; i++) {
          const last = i === count - 1;
          if (q + 6 > end) {
            bad = true;
            break;
          }
          if (buf[q] !== i + 1) {
            bad = true;
            break;
          }
          if (buf[q + 1] || buf[q + 2] || buf[q + 3]) {
            bad = true;
            break;
          }
          const pn = pascal(buf, q + 4, end);
          if (!pn || pn.l > 3) {
            bad = true;
            break;
          }
          if (buf.readUInt32LE(pn.end) !== 0) {
            bad = true;
            break;
          }
          const padraw = buf.readUInt32LE(pn.end + 4);
          if (padraw > 9e3 && !last) {
            bad = true;
            break;
          }
          if (buf.readUInt32LE(pn.end + 8) !== 0 && !last) {
            bad = true;
            break;
          }
          pins.push({ idx: buf[q], name: pn.s });
          q = pn.end + 12;
        }
        if (bad || pins.length !== count) continue;
        out.push({
          name: nm.s,
          rot: 0,
          posx,
          posy,
          type: 0,
          layer,
          value: v1.s,
          s3: "",
          s4: "",
          pkg: v1.s,
          serial: "",
          pins: [],
          c1x,
          c1y,
          c2x,
          c2y,
          end: q,
          richCount: pins.length,
          pinNames: pins.map((x) => x.name)
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
      const rot = buf.readUInt32LE(p);
      p += 4;
      p += 4;
      const type = buf.readUInt32LE(p);
      p += 4;
      p += 4 + 4;
      const hasS = buf[p];
      p += 1;
      let value = "", s3 = "", s4 = "", pkg = "", serial = "";
      if (hasS) {
        const vs = pascal(buf, p, end);
        if (vs) {
          value = vs.s;
          p = vs.end;
        }
        const a = pascal(buf, p, end);
        if (a) {
          s3 = a.s;
          p = a.end;
        }
        const b1 = pascal(buf, p, end);
        if (b1) {
          s4 = b1.s;
          p = b1.end;
        }
        const c1 = pascal(buf, p, end);
        if (c1) {
          pkg = c1.s;
          p = c1.end;
        }
        const d1 = pascal(buf, p, end);
        if (d1) {
          serial = d1.s;
          p = d1.end;
        }
      }
      p += 4;
      const numpins = buf.readUInt32LE(p);
      p += 4;
      const layer = buf.readUInt32LE(p);
      p += 4;
      p += 4;
      const pins = [];
      for (let k = 0; k < numpins; k++) {
        const padid = buf.readUInt32LE(p) >> 3;
        p += 4;
        p += 4;
        const pinNo = buf.readUInt32LE(p);
        p += 4;
        const pn = pascal(buf, p, end);
        p = (pn ? pn.end : p) + 4;
        pins.push({ padid, pinNo, name: pn ? pn.s : String(pinNo) });
      }
      return {
        name: nm.s,
        rot,
        posx,
        posy,
        type,
        layer,
        value,
        s3,
        s4,
        pkg,
        serial,
        pins,
        end: p,
        c1x,
        c1y,
        c2x,
        c2y
      };
    }
    function tvwPartLen(buf, o, end) {
      const nm = pascal(buf, o, end);
      if (!nm) return -1;
      if (nm.s !== "" && !/^[A-Za-z0-9][A-Za-z0-9_#+\-.*()]*$/.test(nm.s)) return -1;
      let p = nm.end + 16 + 8 + 4 + 4 + 4 + 4 + 4;
      if (p >= end) return -1;
      const hasS = buf[p];
      p += 1;
      if (hasS > 1) return -1;
      for (let k = 0; k < 5; k++) {
        if (!hasS) break;
        const s = pascal(buf, p, end);
        if (!s) return -1;
        p = s.end;
      }
      p += 4;
      if (p + 12 > end) return -1;
      const np = buf.readUInt32LE(p);
      p += 4;
      const layer = buf.readUInt32LE(p);
      p += 4;
      p += 4;
      if (np > 2e3 || layer !== 2 && layer !== 7) return -1;
      let pins = 0;
      for (let i = 0; i < np; i++) {
        if (p + 16 > end) return -1;
        const pad = buf.readUInt32LE(p);
        p += 4;
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
        if (count < 50 || count > 2e4) continue;
        const dup = buf.readUInt32LE(o + 4);
        if (dup !== count) continue;
        let p2 = o + 8, ok = true, readable = 0;
        for (let i = 0; i < count && p2 + 2 < end; i++) {
          const s = pascal(buf, p2, end);
          if (!s) {
            ok = false;
            break;
          }
          if (s.l > 0 && !s.s.includes("\uFFFD")) readable++;
          p2 = s.end;
        }
        if (!ok) continue;
        if (!best || readable > best.readable) best = { o, count, readable };
      }
      if (!best) return null;
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
      const labels = [];
      for (const p of parts) {
        if (p.posx === void 0 || p.posy === void 0) continue;
        if (!isFinite(p.posx) || !isFinite(p.posy)) continue;
        labels.push({ text: p.name, x: p.posx, y: p.posy, side: p.side });
      }
      return labels;
    }
    function tvwReadPadsTable(buf, offset, count, end) {
      const pads = [];
      let p = offset + 8;
      for (let i = 0; i < count; i++) {
        if (p + 18 > end) throw new Error("TVW: pad list truncated");
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
    function loadTvw2(buf) {
      if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
      const end = buf.length;
      if (end < 64) throw new Error("TVW file too small");
      let licensee = "";
      for (let i = 6; i < Math.min(40, end); i++) {
        const c = buf[i];
        if (c === 0) break;
        licensee += c >= 32 && c < 127 ? String.fromCharCode(c) : ".";
      }
      const nets = tvwFindNets(buf);
      if (!nets) throw new Error("TVW: could not locate nets table");
      if (nets.count !== nets.names.length) throw new Error("TVW: bad nets table");
      const netName = (id) => id >= 0 && id < nets.names.length ? nets.names[id] : "net_" + id;
      const partTbls = tvwFindParts(buf, end) || [];
      let padTbls = tvwFindPads(buf, partTbls.length ? partTbls[0].o : end);
      if (padTbls.length < 2 && partTbls[0]) padTbls = tvwFindPads(buf, partTbls[0].o);
      if (padTbls.length === 0) throw new Error("TVW: could not locate pads tables");
      const padLayers = [[], []];
      let padCoords = [];
      for (let i = 0; i < Math.min(2, padTbls.length); i++) {
        const tbl = padTbls[i];
        const parsed = tvwReadPadsTable(buf, tbl.o, tbl.count, end);
        padLayers[i] = parsed.pads;
      }
      let P0 = Infinity, P1 = -Infinity, Q0 = Infinity, Q1 = -Infinity;
      for (let i = 0; i < padLayers.length; i++) {
        for (const pad of padLayers[i]) {
          if (pad.x < P0) P0 = pad.x;
          if (pad.x > P1) P1 = pad.x;
          if (pad.y < Q0) Q0 = pad.y;
          if (pad.y > Q1) Q1 = pad.y;
        }
      }
      const PM = P0 === Infinity ? 1e5 : 1e5;
      P0 -= PM;
      P1 += PM;
      Q0 -= PM;
      Q1 += PM;
      const parts = [];
      const partRef = /* @__PURE__ */ new Map();
      const best = /* @__PURE__ */ new Map();
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
          name: r.name,
          sym: "",
          mirror: "",
          rotate: String(r.rot),
          side: r.layer === 7 ? "bottom" : "top",
          desc: r.pkg && r.pkg !== r.value ? r.value + " / " + r.pkg : r.value,
          partno: "",
          qty: "",
          posx: r.posx || 0,
          posy: r.posy || 0,
          x1: r.c1x,
          y1: r.c1y,
          x2: r.c2x,
          y2: r.c2y,
          richCount: r.richCount || 0,
          pinNames: r.pinNames || []
        });
      }
      const refByLayer = [/* @__PURE__ */ new Map(), /* @__PURE__ */ new Map()];
      const codeByLayer = [/* @__PURE__ */ new Map(), /* @__PURE__ */ new Map()];
      for (let pi = 0; pi < parts.length; pi++) {
        const prt = partRef.get(pi);
        if (!prt) continue;
        const li = prt.layer === 7 ? 1 : 0;
        for (const pin of prt.pins) {
          if (!refByLayer[li].has(pin.padid)) refByLayer[li].set(pin.padid, parts[pi].name);
          if (!codeByLayer[li].has(pin.padid)) codeByLayer[li].set(pin.padid, pin.name);
        }
      }
      const pins = [];
      const netPins = {};
      for (let i = 0; i < padLayers.length; i++) {
        const layer = i === 0 ? "top" : "bottom";
        padLayers[i].forEach((pad, idx) => {
          const net = netName(pad.net);
          const ref = refByLayer[i].get(idx) || "";
          const pcode = codeByLayer[i].get(idx) || "";
          const pi = pins.length;
          pins.push({
            net,
            ref,
            num: String(idx),
            name: net,
            l: net,
            padIdx: idx,
            netid: pad.net,
            pcode,
            x: pad.x,
            y: pad.y,
            rad: 1,
            s: layer,
            dcode: pad.dcode,
            flag1: pad.flag1
          });
          if (!netPins[net]) netPins[net] = [];
          netPins[net].push(pi);
        });
      }
      {
        const realParts = [];
        for (let i = 0; i < parts.length; i++) {
          const p = parts[i];
          if (p.x1 === void 0 || p.x1 === p.x2 && p.y1 === p.y2) continue;
          realParts.push(p);
        }
        for (const pin of pins) {
          if (pin.ref) continue;
          let d1 = Infinity, d2 = Infinity, b1 = -1;
          for (let k = 0; k < realParts.length; k++) {
            const p2 = realParts[k];
            const dx = pin.x < p2.x1 ? p2.x1 - pin.x : pin.x > p2.x2 ? pin.x - p2.x2 : 0;
            const dy = pin.y < p2.y1 ? p2.y1 - pin.y : pin.y > p2.y2 ? pin.y - p2.y2 : 0;
            const d = dx * dx + dy * dy;
            if (d < d1) {
              d2 = d1;
              d1 = d;
              b1 = k;
            } else if (d < d2) d2 = d;
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
      const refCount = /* @__PURE__ */ new Map();
      for (const pin of pins) if (pin.ref) refCount.set(pin.ref, (refCount.get(pin.ref) || 0) + 1);
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (!p.richCount || p.x1 === void 0) continue;
        if ((refCount.get(p.name) || 0) >= p.richCount) continue;
        const W = Math.abs(p.x2 - p.x1), H = Math.abs(p.y2 - p.y1);
        const S = Math.max(W, H);
        const maxOut = 0.85 * S, minOut = -0.1 * S;
        const cand = [];
        for (const pin of pins) {
          if (pin.ref) continue;
          const dx = pin.x < p.x1 ? p.x1 - pin.x : pin.x > p.x2 ? pin.x - p.x2 : 0;
          const dy = pin.y < p.y1 ? p.y1 - pin.y : pin.y > p.y2 ? pin.y - p.y2 : 0;
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
      let x0b = Infinity, y0b = Infinity, x1b = -Infinity, y1b = -Infinity;
      for (const pin of pins) {
        if (pin.x < x0b) x0b = pin.x;
        if (pin.x > x1b) x1b = pin.x;
        if (pin.y < y0b) y0b = pin.y;
        if (pin.y > y1b) y1b = pin.y;
      }
      const pinSpan = Math.max(x1b - x0b || 1, y1b - y0b || 1);
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
        if (a0 !== Infinity && a1 - a0 <= pinSpan * 0.25 && b1 - b0 <= pinSpan * 0.25) {
          p.x1 = a0;
          p.x2 = a1;
          p.y1 = b0;
          p.y2 = b1;
        }
      }
      {
        const partById = new Map(parts.map((p, i) => [p.name, p]));
        const bySide = /* @__PURE__ */ new Map();
        for (const pin of pins) {
          if (!pin.ref) continue;
          let arr = bySide.get(pin.ref);
          if (!arr) {
            arr = { top: 0, bottom: 0 };
            bySide.set(pin.ref, arr);
          }
          arr[pin.s]++;
        }
        for (const [name, arr] of bySide) {
          const p = partById.get(name);
          if (!p) continue;
          const total = arr.top + arr.bottom;
          if (total >= 2 && Math.abs(arr.top - arr.bottom) >= 2) {
            p.side = arr.bottom > arr.top ? "bottom" : "top";
          }
        }
        let cleared = 0;
        for (const pin of pins) {
          if (!pin.ref) continue;
          const p = partById.get(pin.ref);
          if (!p || pin.s !== p.side) {
            pin.ref = "";
            cleared++;
          }
        }
      }
      const labels = tvwFindLabels(parts);
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
        x0 -= m;
        y0 -= m;
        x1 += m;
        y1 += m;
        outline = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
      } else {
        x0 = y0 = 0;
        x1 = y1 = 100;
      }
      return {
        title: "TVW Board (" + licensee.trim() + ")",
        x0,
        y0,
        x1,
        y1,
        outline,
        parts,
        pins,
        nails: [],
        netPins,
        labels
      };
    }
    module2.exports = { loadBoard: loadBoard2, loadTvw: loadTvw2, loadCad, rc6Decode, keyOk, mul32, rotl };
    function loadCad(buf) {
      if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
      let text = buf.toString("utf8");
      if (text.indexOf("\uFFFD") !== -1) text = buf.toString("latin1");
      const lines = text.split(/\r?\n/);
      const shapes = /* @__PURE__ */ new Map();
      const comps = [];
      const devs = /* @__PURE__ */ new Map();
      const signals = [];
      const vias = [];
      let revision = "";
      let sec = "";
      let curShape = null;
      let curSig = null;
      let curComp = null;
      for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const line = raw.trim();
        if (line.length === 0) continue;
        const up = line.toUpperCase();
        if (line.charAt(0) === "$") {
          if (up.startsWith("$END")) {
            sec = "";
            curShape = null;
            curSig = null;
            curComp = null;
          } else {
            sec = up.slice(1);
          }
          continue;
        }
        switch (sec) {
          case "HEADER":
            if (up.startsWith("REVISION ")) {
              const m2 = line.match(/"([^"]+)"/);
              if (m2) revision = m2[1];
            }
            break;
          case "SHAPES":
            if (up.startsWith("SHAPE ")) {
              curShape = { name: line.slice(6).trim().split(/\s+/)[0], pins: [] };
              shapes.set(curShape.name, curShape);
            } else if (up.startsWith("PIN ") && curShape) {
              const f = line.split(/\s+/);
              if (f.length >= 6) {
                curShape.pins.push({
                  n: parseInt(f[1], 10),
                  pad: f[2],
                  x: parseFloat(f[3]),
                  y: parseFloat(f[4])
                });
              }
            }
            break;
          case "COMPONENTS":
            if (up.startsWith("COMPONENT ")) {
              curComp = { ref: line.slice(10).trim(), x: 0, y: 0, layer: "TOP", rot: 0, mirror: "", shape: "", device: "" };
              comps.push(curComp);
            } else if (curComp) {
              const f = line.split(/\s+/);
              const kw = f[0].toUpperCase();
              if (kw === "PLACE" && f.length >= 3) {
                curComp.x = parseFloat(f[1]);
                curComp.y = parseFloat(f[2]);
              } else if (kw === "LAYER" && f.length >= 2) curComp.layer = f[1];
              else if (kw === "ROTATION" && f.length >= 2) curComp.rot = parseFloat(f[1]);
              else if (kw === "SHAPE" && f.length >= 2) {
                curComp.shape = f[1];
                curComp.mirror = f.length >= 3 ? f[2] : "";
              } else if (kw === "DEVICE" && f.length >= 2) curComp.device = f[1];
            }
            break;
          case "SIGNALS":
            if (up.startsWith("SIGNAL ")) {
              curSig = { name: line.slice(7).trim(), nodes: [] };
              signals.push(curSig);
            } else if (up.startsWith("NODE ") && curSig) {
              const f = line.split(/\s+/);
              if (f.length >= 3) curSig.nodes.push([f[1], parseInt(f[2], 10)]);
            }
            break;
          case "DEVICES":
            if (up.startsWith("DEVICE ")) {
              curSig = line.split(/\s+/);
              if (curSig.length >= 2) devs.set(curSig.slice(1).join(" ").trim(), "");
            } else if (up.startsWith("PART ") && curSig) {
              devs.set(curSig.slice(1).join(" ").trim(), line.slice(5).trim());
            }
            break;
          case "ROUTES":
            if (up.startsWith("VIA ")) {
              const f = line.split(/\s+/);
              if (f.length >= 4) {
                vias.push({ x: parseFloat(f[2]), y: parseFloat(f[3]), layer: f.length >= 5 ? f[4] : "ALL" });
              }
            }
            break;
        }
      }
      const netByKey = /* @__PURE__ */ new Map();
      for (const sig of signals) {
        for (const [ref, n] of sig.nodes) {
          const key = ref + "|" + n;
          if (!netByKey.has(key)) netByKey.set(key, sig.name);
        }
      }
      const DEG = Math.PI / 180;
      const parts = [];
      const pins = [];
      const netPins = {};
      const allByPart = /* @__PURE__ */ new Map();
      for (const c of comps) {
        const bottom = c.layer.toUpperCase() === "BOTTOM";
        const side = bottom ? "bottom" : "top";
        const sp = shapes.get(c.shape) || { pins: [] };
        const a = (c.rot || 0) * DEG;
        const ca = Math.cos(a), sa = Math.sin(a);
        const idxList = [];
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of sp.pins) {
          let lx = p.x, ly = p.y;
          if (bottom) {
            if (c.mirror.toUpperCase() === "MIRRORY") lx = -lx;
            else if (c.mirror.toUpperCase() === "MIRRORX") ly = -ly;
          }
          const rx = lx * ca - ly * sa;
          const ry = lx * sa + ly * ca;
          const px = c.x + rx;
          const py = c.y + ry;
          const net = netByKey.get(c.ref + "|" + p.n) || "";
          const pcode = p.pad;
          const pi = pins.length;
          pins.push({
            x: px,
            y: py,
            net,
            ref: c.ref,
            num: String(p.n),
            name: net || pcode,
            l: net || pcode,
            pcode,
            s: side,
            rad: 8,
            dcode: 0,
            flag1: 0,
            netid: -1
          });
          idxList.push(pi);
          if (!netPins[net]) netPins[net] = [];
          if (net) netPins[net].push(pi);
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
        }
        if (minX === Infinity) {
          minX = c.x - 10;
          maxX = c.x + 10;
          minY = c.y - 10;
          maxY = c.y + 10;
        }
        const dev = devs.get(c.device);
        parts.push({
          name: c.ref,
          sym: "",
          mirror: c.mirror,
          rotate: String(c.rot),
          side,
          desc: dev && dev !== c.device ? c.device + " / " + dev : c.device,
          partno: dev || "",
          qty: "",
          x1: minX,
          y1: minY,
          x2: maxX,
          y2: maxY
        });
        allByPart.set(c.ref, idxList);
      }
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
        x0 -= m;
        y0 -= m;
        x1 += m;
        y1 += m;
        outline = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
      } else {
        x0 = y0 = 0;
        x1 = y1 = 100;
      }
      const nails = [];
      for (const v of vias) {
        const lay = v.layer.toUpperCase();
        nails.push({ x: v.x, y: v.y, s: lay === "BOTTOM" ? "bottom" : "top" });
        if (lay === "ALL") nails.push({ x: v.x, y: v.y, s: "bottom" });
      }
      return {
        title: "CAD Board" + (revision ? " \xB7 " + revision : ""),
        x0,
        y0,
        x1,
        y1,
        outline,
        parts,
        pins,
        nails,
        netPins,
        _allByPart: allByPart
      };
    }
  }
});

// embedded-assets.js
var require_embedded_assets = __commonJS({
  "embedded-assets.js"(exports2, module2) {
    module2.exports = { "app.js": `'use strict';

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
        open: 'Abrir', fit: 'Ajustar', clear: 'Limpiar', search: 'B\xFAsqueda', language: 'Idioma', searchPlaceholder: 'refdes o red...', panel: 'Panel', selectFile: 'Seleccionar archivo', noSelection: 'Sin selecci\xF3n',
        side: 'Lado', all: 'Todos', top: 'Superior', bottom: 'Inferior', nails: 'Clavos', color: 'Color', net: 'Red', flip: 'Voltear', rotate: 'Rotar', rotation: 'Rotaci\xF3n', idx: '\xCDndice',
        dropFile: 'Arrastra un archivo .fz', part: 'Parte', connection: 'Conexi\xF3n', info: 'Info', connections: 'Conexiones',
        board: 'Placa', content: 'Contenido', pieces: 'Piezas', pins: 'Pines', nets: 'Redes', vias: 'V\xEDas', filter: 'Filtro',
        ref: 'Ref.', pin: 'Pin', pinName: 'Nombre', infoCol: 'Informaci\xF3n', selected: 'seleccionado', noSelection: 'sin selecci\xF3n',
    },
    en: {
        open: 'Open', fit: 'Fit', clear: 'Clear', search: 'Search', language: 'Language', searchPlaceholder: 'refdes or net...', panel: 'Panel', selectFile: 'Select a file', noSelection: 'No selection',
        side: 'Side', all: 'All', top: 'Top', bottom: 'Bottom', nails: 'Nails', color: 'Color', net: 'Net', flip: 'Flip', rotate: 'Rotate', rotation: 'Rotation', idx: 'Index',
        dropFile: 'Drop a .fz file', part: 'Part', connection: 'Connection', info: 'Info', connections: 'Connections',
        board: 'Board', content: 'Content', pieces: 'Parts', pins: 'Pins', nets: 'Nets', vias: 'Vias', filter: 'Filter',
        ref: 'Ref.', pin: 'Pin', pinName: 'Name', infoCol: 'Information', selected: 'selected', noSelection: 'no selection',
    },
    fr: {
        open: 'Ouvrir', fit: 'Ajuster', clear: 'Effacer', search: 'Recherche', language: 'Langue', searchPlaceholder: 'refdes ou r\xE9seau...', panel: 'Panneau', selectFile: 'S\xE9lectionner un fichier', noSelection: 'Aucune s\xE9lection',
        side: 'C\xF4t\xE9', all: 'Tous', top: 'Haut', bottom: 'Bas', nails: 'Clous', color: 'Couleur', net: 'R\xE9seau', flip: 'Retourner', rotate: 'Tourner', rotation: 'Rotation', idx: 'Indice',
        dropFile: 'D\xE9posez un fichier .fz', part: 'Pi\xE8ce', connection: 'Connexion', info: 'Info', connections: 'Connexions',
        board: 'Carte', content: 'Contenu', pieces: 'Pi\xE8ces', pins: 'Broches', nets: 'R\xE9seaux', vias: 'Travers\xE9es', filter: 'Filtre',
        ref: 'R\xE9f.', pin: 'Broche', pinName: 'Nom', infoCol: 'Information', selected: 's\xE9lectionn\xE9', noSelection: 'aucune s\xE9lection',
    },
    zh: {
        open: '\u6253\u5F00', fit: '\u9002\u914D', clear: '\u6E05\u9664', search: '\u641C\u7D22', language: '\u8BED\u8A00', searchPlaceholder: '\u5143\u4EF6\u7F16\u53F7\u6216\u7F51\u7EDC...', panel: '\u9762\u677F', selectFile: '\u9009\u62E9\u6587\u4EF6', noSelection: '\u672A\u9009\u62E9\u7684\u5143\u7D20',
        side: '\u4FA7\u9762', all: '\u5168\u90E8', top: '\u9876\u90E8', bottom: '\u5E95\u90E8', nails: '\u9489\u5B50', color: '\u989C\u8272', net: '\u7F51\u7EDC', flip: '\u7FFB\u8F6C', rotate: '\u65CB\u8F6C', rotation: '\u65CB\u8F6C\u89D2\u5EA6', idx: '\u7D22\u5F15',
        dropFile: '\u62D6\u653E .fz \u6587\u4EF6', part: '\u90E8\u4EF6', connection: '\u8FDE\u63A5', info: '\u4FE1\u606F', connections: '\u8FDE\u63A5',
        board: '\u677F\u9762', content: '\u5185\u5BB9', pieces: '\u90E8\u4EF6', pins: '\u5F15\u811A', nets: '\u7F51\u7EDC', vias: '\u8FC7\u5B54', filter: '\u8FC7\u6EE4',
        ref: '\u53C2\u8003', pin: '\u5F15\u811A', pinName: '\u540D\u79F0', infoCol: '\u4FE1\u606F', selected: '\u5DF2\u9009', noSelection: '\u672A\u9009\u62E9',
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
    $('btn-rotate').textContent = '\u21BB';
    $('rotation-status').textContent = t('rotation') + ': ' + V.rotation + '\xB0';
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
    setStatus('Conexi\xF3n: ' + pin.net);
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
                'N\xFAmero: ' + (p.num || p.l || '-'),
                'Red: ' + p.net + '  [id ' + (p.netid !== undefined && p.netid !== null ? p.netid : (p.num || '?')) + ']',
                cand ? 'Tipo: Negativo (tierra)' : '',
                'Componente: ' + p.ref,
            ];
            if (part) lines.push('Tipo: ' + partType(part), 'Lado: ' + part.side);
            showTooltip(lines.filter(Boolean).join('\\n'), mx, my);
        } else if (V.hoverPart >= 0) {
            const p = BOARD.parts[V.hoverPart];
            const count = BOARD.pins.filter((pin) => pin.ref === p.name).length;
            showTooltip([
                'COMPONENTE ' + p.name,
                'Tipo: ' + partType(p),
                'Lado: ' + p.side,
                'Pines: ' + count,
                'Tama\xF1o: ' + (p.x2 - p.x1).toFixed(0) + ' x ' +
                    (p.y2 - p.y1).toFixed(0) + ' mil',
                p.desc ? 'Descripci\xF3n: ' + p.desc : '',
            ].filter(Boolean).join('\\n'), mx, my);
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
    $('rotation-status').textContent = t('rotation') + ': ' + V.rotation + '\xB0';
    $('btn-rotate').textContent = '\u21BB';
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
initAutoLoad();`, "index.html": '<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>FZ BoardView</title>\n<link rel="stylesheet" href="style.css">\n</head>\n<body>\n<div id="toolbar">\n    <button id="btn-open" title="Abrir archivo .fz (Ctrl+O)">Abrir</button>\n    <button id="btn-fit" title="Ajustar a la placa (F)">Ajustar</button>\n    <button id="btn-side">Lado: Todos</button>\n    <button id="btn-nails">Clavos: On</button>\n    <button id="btn-color">Color: Lado</button>\n    <select id="btn-idx" title="Etiqueta de pin (I)"></select>\n    <button id="btn-flip">Voltear: Off</button>\n    <button id="btn-panel" title="Ocultar/mostrar panel lateral">Panel: On</button>\n    <button id="btn-rotate" title="Rotar esquema" aria-label="Rotar esquema">\u21BB</button>\n    <span id="rotation-status" aria-live="polite">Rotaci\xF3n: 0\xB0</span>\n    <label class="sep"><span id="lang-label">Idioma</span>\n        <select id="lang-select">\n            <option value="es">Espa\xF1ol</option>\n            <option value="en">English</option>\n            <option value="fr">Fran\xE7ais</option>\n            <option value="zh">\u4E2D\u6587</option>\n        </select>\n    </label>\n    <label class="sep"><span id="search-label">B\xFAsqueda</span> <input id="search" type="text" placeholder="refdes o red...">\n        <button id="search-prev" title="Coincidencia anterior">\u25C0</button>\n        <button id="search-next" title="Coincidencia siguiente">\u25B6</button>\n        <span id="search-count"></span></label>\n    <button id="btn-clear">Limpiar</button>\n    <select id="file-list" title="Archivos .fz en el servidor"></select>\n    <span id="status" class="grow"></span>\n</div>\n\n<div id="body">\n    <aside id="side">\n        <div id="tabs">\n            <button id="tab-board" class="tab">Placa</button>\n            <button id="tab-part" class="tab active">Parte</button>\n            <button id="tab-conn" class="tab">Conexi\xF3n</button>\n        </div>\n        <div id="panel"></div>\n    </aside>\n    <div id="resizer"></div>\n    <div id="stage">\n        <canvas id="board"></canvas>\n        <div id="canvas-tooltip" role="status"></div>\n        <div id="drop-msg">Arrastra un archivo .fz</div>\n        <input type="file" id="file-input" accept=".fz,.brd,.bdv,.tvw,.cad" hidden>\n    </div>\n</div>\n\n<div id="statusbar"><span id="bar-text"></span></div>\n\n<script src="app.js"></script>\n</body>\n</html>', "style.css": '* { box-sizing: border-box; margin: 0; padding: 0; }\n\nhtml, body {\n    height: 100%;\n    overflow: hidden;\n    font-family: "Segoe UI", system-ui, sans-serif;\n    background: #111417;\n    color: #cfd8dc;\n}\n\n#toolbar {\n    display: flex;\n    align-items: center;\n    gap: 5px;\n    padding: 5px 8px;\n    background: #0c0e10;\n    border-bottom: 1px solid #232a30;\n    user-select: none;\n    flex-wrap: wrap;\n}\n\n#toolbar .sep {\n    display: inline-flex;\n    align-items: center;\n    gap: 6px;\n    color: #8ea2ad;\n    font-size: 12px;\n    white-space: nowrap;\n}\n\n#search-count {\n    color: #ffd54f;\n    font-size: 12px;\n    min-width: 34px;\n    text-align: center;\n}\n\n#search-prev, #search-next {\n    padding: 0 6px;\n    font-size: 11px;\n    line-height: 18px;\n    cursor: pointer;\n    background: #232a30;\n    color: #cfd8dc;\n    border: 1px solid #2c353c;\n    border-radius: 3px;\n}\n#search-prev:hover, #search-next:hover { background: #2e3a42; }\n\n#toolbar button, #toolbar select {\n    background: #1e262c;\n    color: #e6edf1;\n    border: 1px solid #2a363d;\n    border-radius: 4px;\n    padding: 4px 9px;\n    font-size: 12px;\n    cursor: pointer;\n}\n#toolbar button:hover, #toolbar select:hover { background: #2a363d; }\n#toolbar button.active { background: #33424b; box-shadow: inset 0 0 0 1px #4a5b66; }\n\n#toolbar input[type=text] {\n    background: #14181b;\n    color: #e6edf1;\n    border: 1px solid #2a363d;\n    border-radius: 4px;\n    padding: 4px 8px;\n    font-size: 12px;\n    width: 170px;\n    min-width: 120px;\n}\n#toolbar input[type=text]:focus { outline: 1px solid #4a5b66; }\n\n#status { color: #ffb300; font-size: 12px; font-family: Consolas, monospace; text-align: right; }\n#rotation-status { color: #aed581; font-size: 12px; font-family: Consolas, monospace; white-space: nowrap; }\n.grow { flex: 1; }\n\n#body { display: flex; height: calc(100% - 70px); }\n\n#side {\n    width: 380px;\n    min-width: 200px;\n    background: #0c0e10;\n    border-right: 1px solid #232a30;\n    display: flex;\n    flex-direction: column;\n}\n\n#resizer {\n    width: 6px;\n    cursor: col-resize;\n    background: #232a30;\n    flex-shrink: 0;\n}\n#resizer:hover, #resizer.active { background: #ffd54f; }\n\nbody.panel-hidden #side,\nbody.panel-hidden #resizer { display: none; }\n\n#tabs { display: flex; }\n#tabs .tab {\n    flex: 1;\n    padding: 8px;\n    border: none;\n    background: #d5d9dd;\n    color: #1d2124;\n    font-size: 12px;\n    cursor: pointer;\n}\n#tabs .tab.active { background: #f4f4f4; font-weight: 600; }\n#tabs .tab:hover { background: #e8ebee; }\n\n#panel {\n    flex: 1;\n    overflow: auto;\n    padding: 10px;\n    font-family: Consolas, "Menlo", monospace;\n    font-size: 12px;\n    line-height: 1.45;\n    color: #d7e0e6;\n    background: #0f1214;\n}\n#panel .sec { margin-bottom: 10px; }\n#panel h3 {\n    font-size: 11px;\n    color: #8ea2ad;\n    text-transform: uppercase;\n    letter-spacing: .5px;\n    margin-bottom: 4px;\n}\n#panel table { border-collapse: collapse; width: 100%; }\n#panel th, #panel td {\n    text-align: left;\n    padding: 3px 6px;\n    border-bottom: 1px solid #1c2328;\n    white-space: nowrap;\n}\n#panel th { position: sticky; top: 0; background: #0f1214; color: #8ea2ad; font-weight: 600; }\n#panel tr { cursor: pointer; }\n#panel tr:hover td { background: #1c2328; }\n#panel tr.sel td, #panel tr.sel:hover td {\n    background: #ffd54f;\n    color: #14181a;\n}\n#panel tr.sel td.ref, #panel tr.sel td.info { color: #14181a; }\n#panel td.ref { color: #ffd54f; }\n#panel td.info { color: #9aa7b0; }\n\n#stage { position: relative; flex: 1; overflow: hidden; }\n#board { position: absolute; inset: 0; width: 100%; height: 100%; cursor: crosshair; background: #111417; }\n\n#canvas-tooltip {\n    position: absolute;\n    display: none;\n    z-index: 4;\n    max-width: min(440px, calc(100% - 20px));\n    max-height: min(240px, calc(100% - 20px));\n    overflow: auto;\n    padding: 9px 11px;\n    background: rgba(8, 11, 13, 0.94);\n    border: 1px solid #8ea2ad;\n    border-radius: 3px;\n    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45);\n    color: #e6edf1;\n    font: 12px/1.45 Consolas, monospace;\n    white-space: pre-wrap;\n    pointer-events: none;\n}\n\n#drop-msg {\n    position: absolute;\n    inset: 0;\n    display: none;\n    align-items: center;\n    justify-content: center;\n    font-size: 28px;\n    color: #4fc3f7;\n    background: rgba(17, 20, 23, 0.72);\n    border: 3px dashed #4fc3f7;\n    z-index: 5;\n    pointer-events: none;\n}\n#stage.dragging #drop-msg { display: flex; }\n\n#statusbar {\n    height: 24px;\n    background: #0c0e10;\n    border-top: 1px solid #232a30;\n    color: #c9d4da;\n    font-family: Consolas, monospace;\n    font-size: 12px;\n    display: flex;\n    align-items: center;\n    padding: 0 8px;\n    position: fixed;\n    left: 0; right: 0; bottom: 0;\n}\n\n::-webkit-scrollbar { width: 10px; height: 10px; }\n::-webkit-scrollbar-thumb { background: #2a363d; border-radius: 5px; }\n::-webkit-scrollbar-track { background: #0c0e10; }' };
  }
});

// server.js
var http = require("http");
var fs = require("fs");
var path = require("path");
var cp = require("child_process");
var { loadBoard, loadTvw } = require_fz();
var isPkg = !!process.pkg || !/^node(\.exe)?$/i.test(path.basename(process.execPath));
var EMBED = require_embedded_assets();
var EXE_DIR = isPkg ? path.dirname(process.execPath) : null;
var ROOT = __dirname;
var PUBLIC = path.join(ROOT, "public");
var brArg = process.argv.indexOf("--board-root");
var BOARD_ROOT = brArg >= 0 ? path.resolve(process.argv[brArg + 1]) : process.env.BOARD_ROOT || (isPkg ? EXE_DIR : path.resolve(ROOT, ".."));
if (isPkg) {
  const withBoards = (dir) => {
    const found = [];
    walkFz(dir, found, 0);
    return found.length > 0;
  };
  if (!withBoards(BOARD_ROOT)) {
    const parent = path.resolve(BOARD_ROOT, "..");
    if (withBoards(parent)) BOARD_ROOT = parent;
  }
}
var PORT = process.env.PORT || 9e3;
var RECENT = isPkg ? path.join(BOARD_ROOT, "recent.json") : path.join(ROOT, "recent.json");
var MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".fz": "application/octet-stream",
  ".cad": "text/plain; charset=utf-8"
};
var cliFile = process.argv[2] ? path.resolve(process.argv[2]) : null;
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
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}
function error(res, msg, code) {
  res.writeHead(code || 400, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ error: String(msg) }));
}
function loadRecent() {
  try {
    const arr = JSON.parse(fs.readFileSync(RECENT, "utf8"));
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}
function saveRecent(list) {
  try {
    fs.writeFileSync(RECENT, JSON.stringify(list, null, 2));
  } catch (e) {
  }
}
function normPath(p) {
  return String(p).replace(/\\/g, "/").toLowerCase();
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
  const dir = path.join(BOARD_ROOT, "uploads");
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
  }
  const base = (name || "archivo").replace(/[<>:"/\\|?*]/g, "_");
  const fp = path.join(dir, base);
  fs.writeFileSync(fp, buf);
  return fp;
}
function serveBoard(res, readFn, label, onOk) {
  try {
    const buf = readFn();
    const board = /\.tvw$/i.test(String(label)) ? loadTvw(buf) : loadBoard(buf, label);
    if (onOk) onOk();
    json(res, Object.assign({ ok: true, file: label }, board));
  } catch (e) {
    error(res, e.message);
  }
}
var server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const p = url.pathname;
  if (p === "/api/load") {
    const fp = url.searchParams.get("path");
    if (!fp) return error(res, "missing path");
    serveBoard(res, () => fs.readFileSync(fp), fp, () => {
      addRecent({ path: fp, name: path.basename(fp) });
    });
    return;
  }
  if (p === "/api/load-bytes") {
    const name2 = url.searchParams.get("name") || "";
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      let savedPath = null;
      const buf = Buffer.concat(chunks);
      const real = name2 ? findBoardPath(name2) : null;
      if (real) {
        savedPath = real;
      } else {
        try {
          savedPath = saveUpload(buf, name2 || "archivo");
        } catch (e) {
          savedPath = name2 || "uploaded file";
        }
      }
      serveBoard(res, () => buf, savedPath, () => {
        addRecent({ path: savedPath, name: path.basename(savedPath) });
      });
    });
    return;
  }
  if (p === "/api/recent") {
    json(res, { recent: loadRecent() });
    return;
  }
  if (p === "/api/list") {
    const root = cliFile ? path.dirname(cliFile) : BOARD_ROOT;
    json(res, { files: walkFz(root, [], 0), current: cliFile });
    return;
  }
  if (p.startsWith("/api/")) {
    return error(res, "endpoint not found", 404);
  }
  let f = path.normalize(path.join(PUBLIC, p === "/" ? "index.html" : p));
  if (!f.startsWith(PUBLIC)) {
    res.writeHead(403);
    return res.end("forbidden");
  }
  const name = path.basename(f);
  if (isPkg && Object.prototype.hasOwnProperty.call(EMBED, name)) {
    res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" });
    return res.end(EMBED[name]);
  }
  fs.readFile(f, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("not found");
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" });
    res.end(data);
  });
});
function start(port, opts) {
  opts = opts || {};
  return server.listen(port === void 0 || port === null ? PORT : port, () => {
    const addr = server.address().port;
    console.log("FZ BoardView server on http://localhost:" + addr);
    if (cliFile) console.log("Pre-selected file: " + cliFile);
    if (opts.openBrowser && isPkg) {
      try {
        cp.exec('start "" "http://localhost:' + addr + '"');
      } catch (e) {
      }
    }
  });
}
if (require.main === module) {
  start(null, { openBrowser: true });
}
module.exports = { start };
