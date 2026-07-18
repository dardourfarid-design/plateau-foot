// ===================== IMAGES OG DE PARTAGE (#111) =====================
// Génère les 3 images d'aperçu des pages de partage (victoire / défaite /
// match nul) à partir du même vocabulaire graphique que public/og-image.svg,
// puis les rasterise en JPEG avec le Chromium de Playwright (déjà présent pour
// les tests E2E — aucune dépendance supplémentaire).
//
// CHOIX ASSUMÉ : 3 images STATIQUES, une par type de résultat, plutôt qu'une
// image générée à la volée avec le score exact. Une image dynamique impose une
// fonction serveur sur le chemin critique du partage, pour un gain d'acquisition
// quasi nul — le score exact figure déjà dans le texte du partage. Décision
// notée dans #111.
//
// Usage : node tools/build-share-og.mjs
// Les fichiers produits sont commités (pas de génération en CI).

import { chromium } from '@playwright/test';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'img', 'partage');

const VARIANTS = [
  { slug: 'victoire',  kicker: 'VICTOIRE',  accent: '#F6D365', line: 'Battu à Tactic Master ?' },
  { slug: 'defaite',   kicker: 'DÉFAITE',   accent: '#C0392B', line: 'Fais mieux que moi.' },
  { slug: 'match-nul', kicker: 'MATCH NUL', accent: '#2C6FB0', line: 'Viens nous départager.' }
];

function buildSvg({ kicker, accent, line }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#14100A"/><stop offset="0.55" stop-color="#1C160D"/><stop offset="1" stop-color="#0E0B06"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#F6D365"/><stop offset="0.6" stop-color="#C8841A"/><stop offset="1" stop-color="#F6D365"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.8" cy="0.2" r="0.9">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.30"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect x="28" y="28" width="1144" height="574" rx="18" fill="none" stroke="${accent}" stroke-opacity="0.5" stroke-width="2"/>

  <g transform="translate(84,96)">
    <circle cx="8" cy="8" r="8" fill="${accent}"/>
    <text x="28" y="14" font-family="Arial, sans-serif" font-size="22" letter-spacing="3" fill="${accent}" font-weight="700">RÉSULTAT DE PARTIE</text>
  </g>

  <text x="80" y="250" font-family="Arial Black, Arial, sans-serif" font-size="118" font-weight="900" fill="${accent}" letter-spacing="2">${kicker}</text>
  <rect x="84" y="286" width="360" height="8" rx="4" fill="${accent}"/>
  <text x="84" y="366" font-family="Arial, sans-serif" font-size="40" fill="#F2E8D5">${line}</text>

  <text x="80" y="510" font-family="Arial Black, Arial, sans-serif" font-size="76" font-weight="900" fill="#F2E8D5" letter-spacing="2">TACTIC</text>
  <text x="80" y="580" font-family="Arial Black, Arial, sans-serif" font-size="76" font-weight="900" fill="url(#gold)" letter-spacing="2">MASTER</text>

  <g transform="translate(760,150)">
    <rect x="0" y="0" width="360" height="330" rx="12" fill="#0B0805" stroke="${accent}" stroke-opacity="0.35" stroke-width="2"/>
    <circle cx="70" cy="70" r="26" fill="#C0392B"/><text x="70" y="79" font-family="Arial" font-size="26" font-weight="800" fill="#fff" text-anchor="middle">9</text>
    <circle cx="180" cy="70" r="26" fill="#C0392B"/><text x="180" y="79" font-family="Arial" font-size="26" font-weight="800" fill="#fff" text-anchor="middle">7</text>
    <circle cx="290" cy="70" r="26" fill="#C0392B"/><text x="290" y="79" font-family="Arial" font-size="26" font-weight="800" fill="#fff" text-anchor="middle">11</text>
    <circle cx="180" cy="165" r="24" fill="#F2E8D5"/>
    <path d="M180 149 l7 5 -3 8 -8 0 -3 -8 z" fill="#14100A"/>
    <circle cx="70" cy="260" r="26" fill="#2C6FB0"/><text x="70" y="269" font-family="Arial" font-size="26" font-weight="800" fill="#fff" text-anchor="middle">10</text>
    <circle cx="180" cy="260" r="26" fill="#2C6FB0"/><text x="180" y="269" font-family="Arial" font-size="26" font-weight="800" fill="#fff" text-anchor="middle">8</text>
    <circle cx="290" cy="260" r="26" fill="#2C6FB0"/><text x="290" y="269" font-family="Arial" font-size="26" font-weight="800" fill="#fff" text-anchor="middle">2</text>
  </g>
</svg>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await mkdir(OUT_DIR, { recursive: true });

for (const variant of VARIANTS) {
  const svg = buildSvg(variant);
  // Passer par un fichier local : un data: URI de cette taille est fragile.
  const tmp = path.join(OUT_DIR, `.${variant.slug}.tmp.svg`);
  await writeFile(tmp, svg, 'utf8');
  await page.goto(`file://${tmp.replace(/\\/g, '/')}`);
  await page.screenshot({
    path: path.join(OUT_DIR, `${variant.slug}.jpg`),
    type: 'jpeg',
    quality: 82
  });
  await unlink(tmp);
  console.log(`✓ img/partage/${variant.slug}.jpg`);
}

await browser.close();
