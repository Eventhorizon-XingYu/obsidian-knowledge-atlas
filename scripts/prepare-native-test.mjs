import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
const root = path.resolve('.qa');
const vault = path.join(root, 'Atlas-test-vault');
const profile = path.join(root, 'profile');
// Test fixtures only. This profile never registers or edits the user's vault.
await mkdir(profile, { recursive: true });
for (const name of ['knowledge-atlas', 'atlas-native-tests']) await mkdir(path.join(vault, '.obsidian/plugins', name), { recursive: true });
const contents = {
  'Welcome.md': '# Welcome to Knowledge Atlas\n\nExplore your ideas.\n\n[[Projects/Atlas]] · [[Learning/Graph theory]] · [[Ideas/Local first]]\n\n#atlas\n',
  'Projects/Atlas.md': '---\naliases: [Knowledge map]\ntags: [project, atlas]\n---\n# Atlas\n\nA visual home for your notes.\n\n[[Learning/Graph theory]]\n[[Ideas/Local first]]\n[[Projects/Release]]\n',
  'Projects/Release.md': '# Release checklist\n\n- [ ] Review docs\n- [ ] Build plugin\n\n[[Projects/Atlas]]\n',
  'Learning/Graph theory.md': '# Graph theory\n\nNodes represent notes. Edges represent links.\n\n[[Learning/Algorithms]]\n[[Learning/中文笔记]]\n',
  'Learning/Algorithms.md': '# Algorithms\n\nBreadth-first search explores a neighborhood.\n\n[[Learning/Graph theory]]\n',
  'Learning/中文笔记.md': '---\naliases: [中文别名]\ntags: [学习]\n---\n# 中文笔记\n\n支持中文路径、标签与双向链接。\n\n[[Ideas/Local first]]\n',
  'Ideas/Local first.md': '# Local first\n\nYour notes stay on your device.\n\n[[Projects/Atlas]]\n[[Ideas/Offline]]\n',
  'Ideas/Offline.md': '# Offline\n\nNo server required.\n',
  'Journal/Day one.md': '# Day one\n\nA small step toward a useful graph.\n\n[[Projects/Atlas]]\n',
  'Inbox/Unlinked thought.md': '# Unlinked thought\n\nAn idea waiting to be connected.\n',
  'A/Same.md': '# First same-name note\n\n[[B/Same]]\n',
  'B/Same.md': '# Second same-name note\n',
};
for (const [name, text] of Object.entries(contents)) {
  const target = path.join(vault, name); await mkdir(path.dirname(target), { recursive: true });
  // Never overwrite edited fixtures on a repeated preparation run.
  await writeFile(target, text, { flag: 'wx' }).catch(e => { if (e.code !== 'EEXIST') throw e; });
}
for (const file of ['main.js', 'styles.css', 'manifest.json']) await copyFile(file, path.join(vault, '.obsidian/plugins/knowledge-atlas', file));
await writeFile(path.join(vault, '.obsidian/plugins/knowledge-atlas/data.json'), JSON.stringify({ language: 'zh', maxNodes: 1500 }));
await writeFile(path.join(vault, '.obsidian/plugins/atlas-native-tests/manifest.json'), JSON.stringify({ id: 'atlas-native-tests', name: 'Atlas native test harness', version: '1.0.0', minAppVersion: '1.8.7', author: 'Local tests', description: 'Runs only inside the generated Atlas-test-vault.', isDesktopOnly: true }));
await build({ entryPoints: ['scripts/native-tests.ts'], bundle: true, external: ['obsidian'], format: 'cjs', platform: 'browser', outfile: path.join(vault, '.obsidian/plugins/atlas-native-tests/main.js') });
await writeFile(path.join(vault, '.obsidian/community-plugins.json'), JSON.stringify(['knowledge-atlas', 'atlas-native-tests']));
await writeFile(path.join(vault, '.obsidian/app.json'), JSON.stringify({ alwaysUpdateLinks: true, trashOption: 'local' }));
await writeFile(path.join(vault, '.obsidian/appearance.json'), JSON.stringify({ theme: 'obsidian' }));
await writeFile(path.join(profile, 'obsidian.json'), JSON.stringify({ vaults: { 'a71a570000000001': { path: vault, ts: Date.now(), open: true } } }));
console.log(JSON.stringify({ vault, profile }, null, 2));
