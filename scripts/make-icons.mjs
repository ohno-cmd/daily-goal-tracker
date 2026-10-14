// アプリのアイコン(緑の地に白い✓)をPNGで書き出す。依存なし
//   node scripts/make-icons.mjs
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = path.resolve(import.meta.dirname, "..");
const BG = [5, 150, 105]; // emerald-600
const FG = [255, 255, 255];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** size: 画像の大きさ。scale: ✓の大きさ(マスカブル用は小さめ) */
function png(size, scale = 1) {
  const S = 4; // 4×4 のサンプリングで縁をなめらかに
  const pts = [
    [0.27, 0.52],
    [0.43, 0.68],
    [0.74, 0.35],
  ].map(([x, y]) => [0.5 + (x - 0.5) * scale, 0.5 + (y - 0.5) * scale]);
  const w = 0.085 * scale;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let hit = 0;
      for (let sy = 0; sy < S; sy++)
        for (let sx = 0; sx < S; sx++) {
          const u = (x + (sx + 0.5) / S) / size, v = (y + (sy + 0.5) / S) / size;
          const d = Math.min(distToSegment(u, v, ...pts[0], ...pts[1]), distToSegment(u, v, ...pts[1], ...pts[2]));
          if (d <= w / 2) hit++;
        }
      const a = hit / (S * S);
      const o = y * (size * 3 + 1) + 1 + x * 3;
      for (let i = 0; i < 3; i++) raw[o + i] = Math.round(BG[i] * (1 - a) + FG[i] * a);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(path.join(root, "public", "icons"), { recursive: true });
const out = {
  "public/icons/icon-192.png": png(192),
  "public/icons/icon-512.png": png(512),
  "public/icons/maskable-512.png": png(512, 0.75),
  "app/apple-icon.png": png(180, 0.9),
  "app/icon.png": png(64),
};
for (const [p, buf] of Object.entries(out)) {
  fs.writeFileSync(path.join(root, p), buf);
  console.log(p, buf.length, "bytes");
}
