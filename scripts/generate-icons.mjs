/**
 * Generates the PWA icon set from a single vector source.
 *
 * Run with `node scripts/generate-icons.mjs`. The PNGs it writes into
 * public/icons are committed, so this only needs re-running when the mark or
 * the brand colour changes.
 *
 * The mark is drawn as paths rather than text so the output does not depend on
 * whichever fonts happen to be installed on the machine that runs it.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

/** Converts the app's oklch brand colour to sRGB hex. */
function oklchToHex(lightness, chroma, hueDegrees) {
  const hue = (hueDegrees * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);

  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  const channel = (value) => {
    const clamped = Math.max(0, Math.min(1, value));
    const srgb = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
    return Math.round(srgb * 255)
      .toString(16)
      .padStart(2, "0");
  };

  return `#${linear.map(channel).join("")}`;
}

const BRAND = oklchToHex(0.47, 0.135, 252);
const OUT_DIR = path.join(process.cwd(), "public", "icons");

/**
 * The mark: a ledger card with three ruled lines and a settled tick.
 *
 * `inset` shrinks the mark for maskable icons, keeping it inside the safe zone
 * Android and iOS crop to.
 */
function markSvg({ size, inset, background }) {
  const scale = 1 - inset * 2;
  const translate = size * inset;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${background}"/>
  <g transform="translate(${translate} ${translate}) scale(${scale})">
    <g transform="translate(${size * 0.18} ${size * 0.16}) scale(${(size * 0.64) / 100})">
      <rect x="0" y="0" width="100" height="128" rx="12" fill="#ffffff"/>
      <rect x="18" y="26" width="64" height="9" rx="4.5" fill="${background}" opacity="0.28"/>
      <rect x="18" y="50" width="48" height="9" rx="4.5" fill="${background}" opacity="0.28"/>
      <rect x="18" y="74" width="56" height="9" rx="4.5" fill="${background}" opacity="0.28"/>
      <path d="M22 103 L38 119 L78 79" fill="none" stroke="${background}" stroke-width="13"
            stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </g>
</svg>`;
}

const TARGETS = [
  { file: "icon-192.png", size: 192, inset: 0 },
  { file: "icon-512.png", size: 512, inset: 0 },
  // Maskable icons get cropped to a circle on some launchers, so the mark sits
  // inside the inner 80% safe zone.
  { file: "maskable-192.png", size: 192, inset: 0.1 },
  { file: "maskable-512.png", size: 512, inset: 0.1 },
  // iOS rounds the corners itself, so this stays a full-bleed square.
  { file: "apple-touch-icon.png", size: 180, inset: 0 },
  { file: "favicon-32.png", size: 32, inset: 0 },
];

await mkdir(OUT_DIR, { recursive: true });

for (const target of TARGETS) {
  const svg = markSvg({ size: target.size, inset: target.inset, background: BRAND });
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(path.join(OUT_DIR, target.file), png);
  console.log(`wrote icons/${target.file} (${target.size}px)`);
}

console.log(`brand colour: ${BRAND}`);
