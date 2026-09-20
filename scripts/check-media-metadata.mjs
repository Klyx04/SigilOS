#!/usr/bin/env node
/**
 * Contrôle média (dépôt PUBLIC) — échoue si une image suivie par git porte des
 * métadonnées qui trahissent le poste de travail ou le logiciel utilisé :
 *   • PNG  : chunks eXIf / tEXt / iTXt / zTXt / tIME
 *   • JPEG : segments APP1 (EXIF/XMP), APP11 (JUMBF), APP13 (Photoshop), COM
 *   • WebP : chunks RIFF « EXIF » / « XMP »
 *
 * Pourquoi : une capture d'écran ou un export d'éditeur embarque souvent
 * « Adobe Photoshop 26.5 (Windows) », un horodatage, une date d'appareil ou un
 * chemin local. Dans un dépôt public, c'est une empreinte de la machine.
 *
 * Usage (zéro dépendance, lisible par un auditeur) :
 *   node scripts/check-media-metadata.mjs
 *
 * Corriger : ré-exporter l'image sans métadonnées (`sharp().withMetadata(false)`
 * par défaut, ou « Exporter pour le Web » sans métadonnées), ou lancer le
 * nettoyeur `strip-metadata.mjs` de l'archive de ménage (retrait lossless).
 * Cf. docs/RULES.md §Sécurité.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PNG_DROP = ['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME'];
const JPEG_DROP = { 0xe1: 'APP1 (EXIF/XMP)', 0xeb: 'APP11 (JUMBF)', 0xed: 'APP13 (Photoshop)', 0xfe: 'COM (commentaire)' };

const files = execSync('git ls-files -z', { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter((f) => /\.(png|jpe?g|webp)$/i.test(f));

const findings = [];

for (const file of files) {
  const buf = readFileSync(file);
  const low = file.toLowerCase();

  if (low.endsWith('.png')) {
    let pos = 8;
    while (pos + 12 <= buf.length) {
      const size = buf.readUInt32BE(pos);
      const type = buf.toString('latin1', pos + 4, pos + 8);
      if (PNG_DROP.includes(type)) findings.push(`${file} → chunk PNG « ${type} »`);
      pos += 12 + size;
      if (type === 'IEND') break;
    }
  } else if (low.endsWith('.webp')) {
    if (buf.toString('latin1', 0, 4) !== 'RIFF') continue;
    let pos = 12;
    while (pos + 8 <= buf.length) {
      const id = buf.toString('latin1', pos, pos + 4);
      const size = buf.readUInt32LE(pos + 4);
      if (id === 'EXIF' || id === 'XMP ') findings.push(`${file} → chunk WebP « ${id.trim()} »`);
      pos += 8 + size + (size % 2);
    }
  } else {
    let pos = 2;
    while (pos + 4 <= buf.length && buf[pos] === 0xff) {
      const marker = buf[pos + 1];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0xff) {
        pos += 1;
        continue;
      }
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        pos += 2;
        continue;
      }
      const len = buf.readUInt16BE(pos + 2);
      if (len < 2) break;
      if (JPEG_DROP[marker]) findings.push(`${file} → segment JPEG ${JPEG_DROP[marker]}`);
      pos += 2 + len;
    }
  }
}

if (findings.length) {
  console.error(`❌ ${findings.length} image(s) suivie(s) portent des métadonnées (dépôt PUBLIC) :\n`);
  findings.forEach((f) => console.error(`   - ${f}`));
  console.error('\n   → ré-exporter sans métadonnées (cf. docs/RULES.md §Sécurité).');
  process.exit(1);
}

console.log(`✅ Média : ${files.length} image(s) suivie(s), 0 métadonnée (EXIF/XMP/texte).`);
