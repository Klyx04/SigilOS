#!/usr/bin/env node
/**
 * strip-metadata.mjs — supprime les métadonnées embarquées des images (sans perte).
 *
 * PNG  : retire les chunks eXIf / tEXt / iTXt / zTXt / tIME
 * JPEG : retire les segments APP1 (EXIF/XMP), APP11, APP13 (Photoshop), COM
 *
 * Usage :
 *   node scripts/strip-metadata.mjs <glob-ou-dossier> [...]
 *   node scripts/strip-metadata.mjs public/images/guides/sanctuaire/enigmes
 *
 * Zéro dépendance npm — pure lib Node.js.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const PNG_DROP = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME']);
const JPEG_DROP = new Set([0xe1, 0xeb, 0xed, 0xfe]); // APP1, APP11, APP13, COM

/** Collecte récursivement tous les fichiers images dans un chemin. */
function collectFiles(target) {
  const st = statSync(target);
  if (st.isDirectory()) {
    return readdirSync(target).flatMap((name) => collectFiles(join(target, name)));
  }
  return [target];
}

/** Strip les chunks de métadonnées d'un buffer PNG. Retourne le nouveau buffer. */
function stripPng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47 || buf.readUInt32BE(4) !== 0x0d0a1a0a) {
    throw new Error('Pas un PNG valide');
  }
  const parts = [buf.slice(0, 8)]; // signature
  let pos = 8;
  while (pos + 12 <= buf.length) {
    const size = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const total = 12 + size;
    if (!PNG_DROP.has(type)) {
      parts.push(buf.slice(pos, pos + total));
    }
    pos += total;
    if (type === 'IEND') break;
  }
  return Buffer.concat(parts);
}

/** Strip les segments de métadonnées d'un buffer JPEG. Retourne le nouveau buffer. */
function stripJpeg(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error('Pas un JPEG valide');
  const parts = [buf.slice(0, 2)]; // SOI
  let pos = 2;
  while (pos + 4 <= buf.length && buf[pos] === 0xff) {
    const marker = buf[pos + 1];
    if (marker === 0xda || marker === 0xd9) {
      // SOS / EOI : copie le reste tel quel
      parts.push(buf.slice(pos));
      break;
    }
    const segLen = buf.readUInt16BE(pos + 2); // longueur inclut les 2 octets de longueur
    if (JPEG_DROP.has(marker)) {
      // segment à ignorer
    } else {
      parts.push(buf.slice(pos, pos + 2 + segLen));
    }
    pos += 2 + segLen;
  }
  return Buffer.concat(parts);
}

const args = process.argv.slice(2);
if (!args.length) {
  console.error('Usage: node scripts/strip-metadata.mjs <chemin|dossier> [...]');
  process.exit(1);
}

const files = args.flatMap(collectFiles).filter((f) => /\.(png|jpe?g)$/i.test(f));

if (!files.length) {
  console.log('Aucun fichier PNG/JPEG trouvé.');
  process.exit(0);
}

let count = 0;
for (const file of files) {
  try {
    const buf = readFileSync(file);
    const ext = extname(file).toLowerCase();
    let stripped;
    if (ext === '.png') {
      stripped = stripPng(buf);
    } else {
      stripped = stripJpeg(buf);
    }
    if (stripped.length !== buf.length) {
      writeFileSync(file, stripped);
      console.log(`✅  ${file}  (${buf.length - stripped.length} octets retirés)`);
      count++;
    } else {
      console.log(`—   ${file}  (rien à retirer)`);
    }
  } catch (e) {
    console.error(`❌  ${file} : ${e.message}`);
  }
}

console.log(`\n${count} fichier(s) nettoyé(s).`);
