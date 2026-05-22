#!/usr/bin/env node
/**
 * Generates colored placeholder PNGs at native asset dimensions.
 * Prefer real art in assets/images/blocks/ — see blockCatalog.ts filenames.
 * Run: npm run generate-block-placeholders
 */

const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const OUT_DIR = path.join(__dirname, '../assets/images/blocks');

const ASSETS = [
  { file: 'DJ_Controller.png', nativeW: 197, nativeH: 218, color: [91, 141, 239] },
  { file: 'Equipment_Box.png', nativeW: 218, nativeH: 194, color: [107, 203, 119] },
  { file: 'LED_Panel_Block.png', nativeW: 164, nativeH: 259, color: [244, 211, 94] },
  { file: 'Light_Projector.png', nativeW: 258, nativeH: 177, color: [238, 108, 77] },
  { file: 'Speaker_1.png', nativeW: 224, nativeH: 260, color: [155, 93, 229] },
  { file: 'Speaker_2.png', nativeW: 243, nativeH: 259, color: [0, 187, 249] },
  { file: 'Speaker_3.png', nativeW: 150, nativeH: 200, color: [241, 91, 181] },
  { file: 'Stage truss block.png', nativeW: 219, nativeH: 255, color: [224, 122, 95] },
];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type);
  const crcBuf = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcBuf), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function writePng(filePath, w, h, rgb) {
  const row = Buffer.alloc(1 + w * 3);
  const raw = Buffer.alloc((1 + w * 3) * h);
  for (let y = 0; y < h; y++) {
    row[0] = 0;
    for (let x = 0; x < w; x++) {
      const border =
        x < 2 || y < 2 || x >= w - 2 || y >= h - 2;
      const i = 1 + x * 3;
      if (border) {
        row[i] = 26;
        row[i + 1] = 26;
        row[i + 2] = 46;
      } else {
        row[i] = rgb[0];
        row[i + 1] = rgb[1];
        row[i + 2] = rgb[2];
      }
    }
    row.copy(raw, y * row.length);
  }
  const compressed = zlib.deflateSync(raw);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const png = Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(filePath, png);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const a of ASSETS) {
  const out = path.join(OUT_DIR, a.file);
  writePng(out, a.nativeW, a.nativeH, a.color);
  console.log(`Wrote ${a.file} (${a.nativeW}x${a.nativeH})`);
}
