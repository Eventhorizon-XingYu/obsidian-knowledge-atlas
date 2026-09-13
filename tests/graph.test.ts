import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph, filterGraph, folderContains, notePath, Note, Filter } from '../src/graph';
import { translator } from '../src/i18n';
const note = (id: string, extras: Partial<Note> = {}): Note => ({ id, title: id.replace(/\.md$/, ''), folder: id.includes('/') ? id.slice(0, id.lastIndexOf('/')) : '', tags: [], aliases: [], modified: 0, ...extras });
const notes = [note('中文/起点.md', { tags: ['#学习'], aliases: ['Start'] }), note('中文/后续.md'), note('项目/结论.md'), note('孤立.md')];
const graph = buildGraph(notes, { '中文/起点.md': { '中文/后续.md': 2, '附件.png': 1, '中文/起点.md': 1 }, '中文/后续.md': { '中文/起点.md': 1, '项目/结论.md': 1 } });
const defaults: Filter = { query: '', folder: '', tag: '', hideOrphans: false, focus: '', depth: 1, maxNodes: 1500 };
test('Uses resolved paths, excludes attachments/self links, counts unique undirected neighbors', () => {
  assert.equal(graph.links.length, 3);
  assert.deepEqual(graph.nodes.map(n => n.degree), [1, 2, 1, 0]);
});
test('Filters by Chinese title, aliases, tag, folder boundary and multiple search tokens', () => {
  assert.equal(filterGraph(graph, { ...defaults, query: 'start 学习' }).nodes[0].id, '中文/起点.md');
  assert.equal(filterGraph(graph, { ...defaults, folder: '中文', tag: '#学习' }).nodes.length, 1);
  assert.equal(folderContains('学习计划', '学习'), false);
  assert.equal(folderContains('学习/计划', '学习'), true);
  assert.equal(filterGraph(graph, { ...defaults, query: 'not-present' }).nodes.length, 0);
});
test('Neighborhood traversal handles incoming/outgoing edges and depth without leaking isolated notes', () => {
  assert.equal(filterGraph(graph, { ...defaults, focus: '中文/起点.md', depth: 1 }).nodes.length, 2);
  assert.equal(filterGraph(graph, { ...defaults, focus: '中文/起点.md', depth: 2 }).nodes.length, 3);
  assert.equal(filterGraph(graph, { ...defaults, hideOrphans: true }).nodes.length, 3);
});
test('Limits nodes after matching, retains focus, leaves original graph untouched for force-graph mutations', () => {
  const result = filterGraph(graph, { ...defaults, maxNodes: 1, focus: '中文/起点.md', depth: 2 });
  assert.equal(result.matched, 3); assert.equal(result.nodes[0].id, '中文/起点.md'); assert.equal(result.links.length, 0);
  result.nodes[0].x = 100; assert.equal(graph.nodes[0].x, undefined);
  const complete = filterGraph(graph, defaults); complete.links[0].source = 'mutated';
  assert.equal(graph.links[0].source, '中文/起点.md');
});
test('Identical filenames in different folders stay separate', () => {
  const duplicate = buildGraph([note('A/Note.md'), note('B/Note.md')], { 'A/Note.md': { 'B/Note.md': 1 } });
  assert.equal(duplicate.nodes.length, 2); assert.equal(duplicate.links[0].target, 'B/Note.md');
});
test('Cross-platform paths support Chinese and spaces, reject traversal, hidden folders and reserved names', () => {
  assert.equal(notePath('  项目\\我的 笔记  '), '项目/我的 笔记.md');
  assert.equal(notePath('项目/Note.MD'), '项目/Note.md');
  for (const path of ['', '/absolute', 'C:\\secret', '../escape', 'a/../b', '.obsidian/config', 'a//b', 'CON.md', 'a/LPT1.md', 'a?.md', 'a./b']) {
    assert.throws(() => notePath(path), /invalidPath/, path);
  }
});
test('Empty vault and dangling links are valid', () => {
  assert.deepEqual(filterGraph(buildGraph([], { x: { y: 1 } }), defaults), { nodes: [], links: [], matched: 0 });
});
test('Language follows the host unless explicitly overridden', () => {
  assert.equal(translator('auto', 'zh')('newNote'), '新建笔记');
  assert.equal(translator('en', 'zh')('newNote'), 'New note');
  assert.equal(translator('zh', 'en')('newNote'), '新建笔记');
});
