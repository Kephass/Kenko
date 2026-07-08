// Renders the Kenko app icon set from inline SVG. Rerun after changing the mark:
//   node scripts/generate-icons.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

// Geometric "K" as strokes — no font dependency. `pad` shrinks the mark into
// the maskable safe zone; `radius` rounds corners for non-masked contexts.
const icon = (size, { radius = 0, pad = 1 } = {}) => {
  const s = size / 512;
  const g = (n) => n * s;
  const markScale = 0.72 * pad;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2e2e33"/>
      <stop offset="1" stop-color="#141417"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="-0.1" r="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="0.6" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${g(radius)}" fill="url(#bg)"/>
  <rect width="${size}" height="${size}" rx="${g(radius)}" fill="url(#glow)"/>
  <g transform="translate(${size / 2} ${size / 2}) scale(${markScale}) translate(${-size / 2} ${-size / 2})"
     stroke="#fafafa" stroke-width="${g(58)}" stroke-linecap="round" fill="none">
    <path d="M ${g(176)} ${g(120)} V ${g(392)}"/>
    <path d="M ${g(360)} ${g(124)} L ${g(182)} ${g(276)}"/>
    <path d="M ${g(248)} ${g(220)} L ${g(360)} ${g(388)}"/>
  </g>
</svg>`);
};

const out = async (svg, path) => sharp(svg).png().toFile(path);

await mkdir("public/icons", { recursive: true });
// "any" icons: rounded corners since install UIs show them unmasked.
await out(icon(192, { radius: 42 }), "public/icons/icon-192.png");
await out(icon(512, { radius: 112 }), "public/icons/icon-512.png");
// maskable: full bleed, mark inside the 80% safe zone.
await out(icon(192, { pad: 0.82 }), "public/icons/icon-maskable-192.png");
await out(icon(512, { pad: 0.82 }), "public/icons/icon-maskable-512.png");
// apple-touch: full bleed square, iOS applies its own mask.
await out(icon(180, { pad: 0.94 }), "src/app/apple-icon.png");
console.log("icons written");
