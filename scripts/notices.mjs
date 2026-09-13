// Collect the full licenses of the actual production dependency closure.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const seen = new Set(); const sections = ['# Third-party notices\n\nXingyu Note Atlas bundles the following open-source dependencies. Obsidian is provided by the host and is not redistributed.\n'];
async function visit(name) {
  if (seen.has(name)) return;
  seen.add(name);
  const directory = path.join('node_modules', name);
  const pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
  const files = (await readdir(directory)).filter(file => /^(licen[cs]e|copying)(\.|$)/i.test(file));
  if (!files.length && name !== 'bezier-js') throw new Error(`Missing license for ${name}`);
  sections.push(`## ${name} ${pkg.version}\n\nLicense: ${pkg.license}\n`);
  if (!files.length) {
    const license = await readFile('LICENSE', 'utf8');
    sections.push('The npm package omits its license file. Upstream: https://github.com/Pomax/bezierjs/blob/master/LICENSE.md\n\n```text\n' + license.replace('Copyright (c) 2026 Xingyu Note Atlas contributors', 'Copyright (c) 2023 Pomax') + '\n```\n');
  }
  for (const file of files) sections.push('```text\n' + (await readFile(path.join(directory, file), 'utf8')).trim() + '\n```\n');
  for (const dep of Object.keys(pkg.dependencies ?? {}).sort()) await visit(dep);
}
await visit('force-graph');
await writeFile('THIRD_PARTY_NOTICES.md', sections.join('\n'));
console.log(`Recorded licenses for ${seen.size} runtime packages.`);
