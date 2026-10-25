/**
 * Regenera public/locales/locales.json a partir de los locales de cada paquete.
 *
 * El shell sirve un unico locales.json con todas las claves de la app. Ese
 * archivo se venia manteniendo a mano, asi que se desincronizaba: un texto
 * corregido en yapify-feature-store-products-pe seguia mostrandose viejo en la
 * app porque el agregado nunca se regeneraba.
 *
 * Reglas:
 *   - El paquete es la fuente de verdad de sus claves; su valor pisa al del
 *     agregado.
 *   - Las claves que solo existen en el agregado se conservan (hay textos
 *     propios del shell que no viven en ningun feature).
 *   - Si dos paquetes definen la misma clave con distinto valor, se avisa y
 *     gana el primero en orden alfabetico, para que el resultado no dependa
 *     del orden del sistema de archivos.
 *
 * Uso: node scripts/sync-locales.js [--check]
 *   --check no escribe; sale con codigo 1 si el agregado estaba desfasado.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SHELL = path.join(here, '..', 'public', 'locales', 'locales.json');
const WORKSPACE = path.join(here, '..', '..');
const CHECK = process.argv.includes('--check');

/** Paquetes hermanos con locales propios, en orden estable. */
function packages() {
  return fs
    .readdirSync(WORKSPACE)
    .filter((d) => d !== 'yapify')
    .sort()
    .map((d) => ({ name: d, file: path.join(WORKSPACE, d, 'locales', 'locales.json') }))
    .filter((p) => fs.existsSync(p.file));
}

const shell = JSON.parse(fs.readFileSync(SHELL, 'utf8'));
const langs = Object.keys(shell);
const owner = {};
const stale = [];
const collisions = [];

for (const pkg of packages()) {
  const src = JSON.parse(fs.readFileSync(pkg.file, 'utf8'));
  for (const lang of langs) {
    const from = src[lang];
    if (!from) continue;
    for (const [key, value] of Object.entries(from)) {
      const id = `${lang}::${key}`;
      if (owner[id] && owner[id].value !== value) {
        collisions.push(`${id} — ${owner[id].pkg} vs ${pkg.name}`);
        continue;
      }
      owner[id] = { pkg: pkg.name, value };
      if (shell[lang][key] !== value) {
        stale.push({ lang, key, pkg: pkg.name, was: shell[lang][key], now: value });
        shell[lang][key] = value;
      }
    }
  }
}

for (const s of stale) {
  console.log(`  ${s.pkg} :: ${s.key} [${s.lang}]`);
  console.log(`    - ${JSON.stringify(s.was)}`);
  console.log(`    + ${JSON.stringify(s.now)}`);
}
if (collisions.length) {
  console.log(`\n${collisions.length} claves definidas por mas de un paquete:`);
  collisions.forEach((c) => console.log(`  ${c}`));
}

if (!stale.length) {
  console.log('El agregado del shell ya esta al dia.');
  process.exit(0);
}
if (CHECK) {
  console.log(`\n${stale.length} claves desfasadas. Corre: node scripts/sync-locales.js`);
  process.exit(1);
}
fs.writeFileSync(SHELL, `${JSON.stringify(shell, null, 2)}\n`, 'utf8');
console.log(`\n${stale.length} claves sincronizadas en public/locales/locales.json`);
