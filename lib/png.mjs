/* =========================================================
   极简 PNG / ICO 编码器 —— 零外部依赖，仅用 Node 内置 zlib。
   用途：构建时生成位图 favicon。
   为什么必须有位图：Google 搜索结果与社交平台的图标抓取不识别 SVG，
   必须有 .ico / .png 位图版本才能正确显示。
   ========================================================= */

import zlib from "node:zlib";

/* ---------- CRC32（PNG chunk 校验） ---------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/* ---------- PNG 编码：rgba Buffer，长度 = w*h*4 ---------- */
export function encodePNG(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter type: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression: deflate
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace: none
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------- ICO 打包（Vista+ 支持内嵌 PNG，无需 BMP 编码） ---------- */
export function encodeICO(images) {
  const dir = Buffer.alloc(6);
  dir.writeUInt16LE(0, 0); // reserved
  dir.writeUInt16LE(1, 2); // type: 1 = icon
  dir.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + images.length * 16;
  for (const { size, data } of images) {
    const e = Buffer.alloc(16);
    e[0] = size >= 256 ? 0 : size; // 宽（256 记作 0）
    e[1] = size >= 256 ? 0 : size; // 高
    e.writeUInt16LE(1, 4); // color planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += data.length;
  }
  return Buffer.concat([dir, ...entries, ...images.map((i) => i.data)]);
}

/* ---------- 绘制：4x 超采样抗锯齿 ---------- */
const SS = 4;

function hexToRgb(h) {
  const s = h.replace("#", "");
  return [
    parseInt(s.slice(0, 2), 16),
    parseInt(s.slice(2, 4), 16),
    parseInt(s.slice(4, 6), 16),
  ];
}

function insideRounded(x, y, S, r) {
  const px = x + 0.5, py = y + 0.5;
  const cxL = r, cxR = S - r, cyT = r, cyB = S - r;
  let dx = 0, dy = 0;
  if (px < cxL) dx = cxL - px; else if (px > cxR) dx = px - cxR;
  if (py < cyT) dy = cyT - py; else if (py > cyB) dy = py - cyB;
  if (dx === 0 && dy === 0) return true;
  if (dx === 0) return dy <= r;
  if (dy === 0) return dx <= r;
  return dx * dx + dy * dy <= r * r;
}

/**
 * 绘制品牌图标：圆角方块（垂直渐变）+ 白色医疗十字。
 * 十字形取自站头 logo-mark「✚」，保证与页内品牌标识一致。
 */
export function drawIcon(size, { from = "#004a99", to = "#0b6fc4", radius = 0.22 } = {}) {
  const S = size * SS;
  const hi = Buffer.alloc(S * S * 4);
  const c1 = hexToRgb(from);
  const c2 = hexToRgb(to);
  const white = [255, 255, 255];
  const r = radius * S;

  // 十字几何：臂宽 20%，臂长 62%
  const cx = S / 2, cy = S / 2;
  const armLen = 0.62 * S, armW = 0.20 * S;
  const outer0 = cx - armLen / 2, outer1 = cx + armLen / 2;
  const inner0 = cx - armW / 2, inner1 = cx + armW / 2;

  for (let y = 0; y < S; y++) {
    const t = y / (S - 1);
    const bg = [
      Math.round(c1[0] + (c2[0] - c1[0]) * t),
      Math.round(c1[1] + (c2[1] - c1[1]) * t),
      Math.round(c1[2] + (c2[2] - c1[2]) * t),
    ];
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      // 圆角外：填背景色但 alpha=0 —— 预乘后边缘不会发黑
      if (!insideRounded(x, y, S, r)) {
        hi[i] = bg[0]; hi[i + 1] = bg[1]; hi[i + 2] = bg[2]; hi[i + 3] = 0;
        continue;
      }
      const inVertical = x >= inner0 && x < inner1 && y >= outer0 && y < outer1;
      const inHorizontal = y >= inner0 && y < inner1 && x >= outer0 && x < outer1;
      const col = inVertical || inHorizontal ? white : bg;
      hi[i] = col[0]; hi[i + 1] = col[1]; hi[i + 2] = col[2]; hi[i + 3] = 255;
    }
  }

  // 降采样（SS×SS 盒式平均）
  const out = Buffer.alloc(size * size * 4);
  const n = SS * SS;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let rr = 0, gg = 0, bb = 0, aa = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * S + (x * SS + sx)) * 4;
          rr += hi[i]; gg += hi[i + 1]; bb += hi[i + 2]; aa += hi[i + 3];
        }
      }
      const o = (y * size + x) * 4;
      out[o] = Math.round(rr / n);
      out[o + 1] = Math.round(gg / n);
      out[o + 2] = Math.round(bb / n);
      out[o + 3] = Math.round(aa / n);
    }
  }
  return out;
}

/** 矢量版 favicon（浏览器优先使用，缩放最清晰） */
export function iconSVG({ from = "#004a99", to = "#0b6fc4", radius = 0.22 } = {}) {
  const S = 96;
  const r = Math.round(radius * S);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
  </linearGradient></defs>
  <rect width="${S}" height="${S}" rx="${r}" fill="url(#g)"/>
  <path d="M42 17h12v25h25v12H54v25H42V54H17V42h25z" fill="#fff"/>
</svg>
`;
}
