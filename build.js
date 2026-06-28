#!/usr/bin/env node
// ===================== SYNC DEV =====================
// Utilitaire de développement : recopie src/ vers public/src/ après une
// modification du code source, pour que public/ reste à jour.
//
// IMPORTANT : public/src/ est désormais committé directement dans le dépôt
// (ce n'est plus un artefact ignoré par git). Ce script n'est PAS exécuté
// par Vercel/Netlify au moment du déploiement — le déploiement est 100%
// statique, sans étape de build, pour éviter tout risque de désynchronisation
// entre ce que Vercel construit et ce qui est réellement dans le dépôt.
//
// Workflow : après avoir édité un fichier dans src/, lance `node build.js`
// puis committe et pousse public/src/ avec le reste.

import { cpSync, rmSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = __dirname;
const srcDir = join(root, 'src');
const publicSrcDir = join(root, 'public', 'src');

if (existsSync(publicSrcDir)) {
  rmSync(publicSrcDir, { recursive: true, force: true });
}
mkdirSync(publicSrcDir, { recursive: true });
cpSync(srcDir, publicSrcDir, { recursive: true });

console.log('✓ src/ synchronisé vers public/src/ — pense à committer public/src/ avant de pousser.');
