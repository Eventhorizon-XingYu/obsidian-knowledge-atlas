import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
if (pkg.version !== manifest.version) throw new Error('Package and manifest versions must match');
const destination = path.join('dist', manifest.id);
await mkdir(destination, { recursive: true });
const sums = [];
for (const file of ['main.js', 'manifest.json', 'styles.css', 'LICENSE', 'THIRD_PARTY_NOTICES.md']) {
  const bytes = await readFile(file);
  await copyFile(file, path.join(destination, file));
  sums.push(`${createHash('sha256').update(bytes).digest('hex')}  ${file}`);
}
await writeFile(path.join('dist', 'SHA256SUMS.txt'), sums.join('\n') + '\n');
console.log(`Installable plugin: ${destination}`);
