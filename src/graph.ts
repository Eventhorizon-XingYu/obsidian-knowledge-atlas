/** 纯数据层：不访问磁盘或 DOM，便于验证筛选、关系和路径处理。 */
export interface Note {
  id: string;
  title: string;
  folder: string;
  tags: string[];
  aliases: string[];
  modified: number;
}
export interface AtlasNode extends Note {
  degree: number;
  color: string;
  x?: number; y?: number; vx?: number; vy?: number;
  fx?: number; fy?: number;
}
export interface AtlasLink { source: string; target: string; }
export interface Graph { nodes: AtlasNode[]; links: AtlasLink[]; }
export interface Filter {
  query: string; folder: string; tag: string; hideOrphans: boolean;
  focus: string; depth: number; maxNodes: number;
}
export function folderContains(path: string, folder: string): boolean {
  return folder === '' || path === folder || path.startsWith(folder + '/');
}
export function folderColor(folder: string): string {
  let hash = 0;
  for (const char of folder.split('/')[0]) hash = ((hash * 31) + char.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360}, 68%, 65%)`;
}
export function buildGraph(notes: Note[], resolved: Record<string, Record<string, number>>): Graph {
  const nodes = notes.map(note => ({ ...note, degree: 0, color: folderColor(note.folder) }));
  const ids = new Set(nodes.map(n => n.id));
  const neighbors = new Map<string, Set<string>>();
  const links: AtlasLink[] = [];
  for (const source of ids) {
    for (const target of Object.keys(resolved[source] ?? {})) {
      if (target === source || !ids.has(target)) continue;
      links.push({ source, target });
      if (!neighbors.has(source)) neighbors.set(source, new Set());
      if (!neighbors.has(target)) neighbors.set(target, new Set());
      neighbors.get(source)!.add(target);
      neighbors.get(target)!.add(source);
    }
  }
  for (const node of nodes) node.degree = neighbors.get(node.id)?.size ?? 0;
  return { nodes, links };
}
export function filterGraph(graph: Graph, filter: Filter): Graph & { matched: number } {
  let neighborhood: Set<string> | undefined;
  if (filter.focus) {
    neighborhood = new Set([filter.focus]);
    const adjacency = new Map<string, Set<string>>();
    for (const { source, target } of graph.links) {
      if (!adjacency.has(source)) adjacency.set(source, new Set());
      if (!adjacency.has(target)) adjacency.set(target, new Set());
      adjacency.get(source)!.add(target); adjacency.get(target)!.add(source);
    }
    let frontier = [filter.focus];
    for (let step = 0; step < filter.depth; step++) {
      const next: string[] = [];
      for (const id of frontier) for (const other of adjacency.get(id) ?? []) {
        if (!neighborhood.has(other)) { neighborhood.add(other); next.push(other); }
      }
      frontier = next;
    }
  }
  const tokens = filter.query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = graph.nodes.filter(n => {
    const haystack = [n.title, n.id, ...n.tags, ...n.aliases].join(' ').toLocaleLowerCase();
    return tokens.every(token => haystack.includes(token)) && folderContains(n.folder, filter.folder)
      && (!filter.tag || n.tags.includes(filter.tag)) && (!filter.hideOrphans || n.degree > 0)
      && (!neighborhood || neighborhood.has(n.id));
  });
  // 优先保留焦点和高关联节点；上限始终对用户可见，搜索在全量笔记中进行。
  matches.sort((a, b) => Number(b.id === filter.focus) - Number(a.id === filter.focus)
    || b.degree - a.degree || a.id.localeCompare(b.id));
  const nodes = matches.slice(0, Math.max(1, filter.maxNodes)).map(n => ({ ...n }));
  const ids = new Set(nodes.map(n => n.id));
  return { nodes, links: graph.links.filter(l => ids.has(l.source) && ids.has(l.target)).map(l => ({ ...l })), matched: matches.length };
}
/** 禁止绝对路径、父目录跳转和跨平台非法名字；所有写入都相对当前 vault。 */
export function notePath(input: string): string {
  const raw = input.trim().replace(/\\/g, '/');
  if (!raw || raw.startsWith('/') || /[:*?"<>|]/.test(raw) || Array.from(raw).some(char => char.charCodeAt(0) < 32)) throw new Error('invalidPath');
  const parts = raw.split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || p.startsWith('.') || /[ .]$/.test(p)
    || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))) throw new Error('invalidPath');
  return /\.md$/i.test(raw) ? raw.slice(0, -3) + '.md' : raw + '.md';
}
