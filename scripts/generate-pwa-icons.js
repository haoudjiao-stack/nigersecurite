import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(8 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const crc = crc32(buf.subarray(4, 8 + len));
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

function createPng(width, height, drawFn) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  
  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8-bit depth
  ihdrData.writeUInt8(6, 9); // RGBA
  ihdrData.writeUInt8(0, 10); // Deflate
  ihdrData.writeUInt8(0, 11); // Filter standard
  ihdrData.writeUInt8(0, 12); // No interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Raw RGBA scanlines with filter byte 0 at start of each scanline
  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(height * scanlineLength);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // Filter None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawFn(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const idatCompressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', idatCompressed);

  // IEND
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Draw professional security icon: Deep dark slate background, emerald shield with gold/orange star
function drawIcon(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const r = w / 2;
  const dx = (x - cx) / r;
  const dy = (y - cy) / r;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Outer dark background #0f172a
  let bgR = 15, bgG = 23, bgB = 42, bgA = 255;

  // Shield boundary calculation
  // Normalized x [-1, 1], y [-1, 1] inside central 75%
  const sx = (x - cx) / (r * 0.72);
  const sy = (y - cy) / (r * 0.72);

  // Shield shape: top is flat (-0.7 <= sy <= -0.6), sides go down to sy=0.2, then curve to a point at (0, 0.9)
  let inShield = false;
  if (sy >= -0.7 && sy <= 0.85) {
    if (sy <= 0.2) {
      inShield = Math.abs(sx) <= 0.75;
    } else {
      // parabolic curve towards bottom point (0, 0.85)
      const t = (sy - 0.2) / 0.65;
      const maxWidth = 0.75 * (1 - t * t);
      inShield = Math.abs(sx) <= Math.max(0, maxWidth);
    }
  }

  if (inShield) {
    // Shield border vs interior
    const isBorder = Math.abs(sx) > 0.68 || sy < -0.63 || (sy > 0.15 && Math.abs(sx) > 0.70 * (1 - ((sy - 0.2) / 0.65) ** 2));
    if (isBorder) {
      // Golden/Emerald border
      return [16, 185, 129, 255]; // Emerald-500
    }

    // Shield gradient interior: Emerald-800 to Emerald-950
    const grad = (sy + 0.7) / 1.5;
    const sR = Math.round(6 + (4 - 6) * grad);
    const sG = Math.round(95 + (78 - 95) * grad);
    const sB = Math.round(70 + (50 - 70) * grad);

    // Star / Check emblem in center
    const dCenter = Math.sqrt(sx * sx + (sy + 0.05) * (sy + 0.05));
    if (dCenter < 0.22) {
      // Golden center star / emblem
      return [245, 158, 11, 255]; // Amber-500
    }

    return [sR, sG, sB, 255];
  }

  // Rounded icon border
  return [bgR, bgG, bgB, bgA];
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. pwa-192x192.png
const png192 = createPng(192, 192, drawIcon);
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), png192);

// 2. pwa-512x512.png
const png512 = createPng(512, 512, drawIcon);
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), png512);

// 3. pwa-maskable-512x512.png
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), png512);

// 4. apple-touch-icon.png (180x180)
const png180 = createPng(180, 180, drawIcon);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), png180);

// 5. favicon.ico / icon.svg
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="100" fill="#0f172a"/>
  <path d="M256 60 L390 120 V250 C390 350 256 440 256 440 C256 440 122 350 122 250 V120 Z" fill="#065f46" stroke="#10b981" stroke-width="16"/>
  <circle cx="256" cy="230" r="50" fill="#f59e0b"/>
  <path d="M256 200 L266 222 L290 224 L272 238 L277 262 L256 248 L235 262 L240 238 L222 224 L246 222 Z" fill="#ffffff"/>
  <text x="256" y="340" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="34" fill="#ffffff" text-anchor="middle" letter-spacing="3">NIGER</text>
  <text x="256" y="375" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="22" fill="#10b981" text-anchor="middle" letter-spacing="5">SÉCURITÉ</text>
</svg>`;
fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent);

console.log('PWA icons created successfully in public directory!');
