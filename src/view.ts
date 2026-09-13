import { Component, ItemView, MarkdownRenderer, Menu, Notice, WorkspaceLeaf, getLanguage } from 'obsidian';
import ForceGraph, { LinkObject } from 'force-graph';
import type AtlasPlugin from './main';
import { AtlasNode, Filter, Graph, filterGraph } from './graph';
import { Translate, translator } from './i18n';
import { ActionModal, LinkPicker, PathModal, errorText, requireNote } from './operations';
export const VIEW_TYPE = 'xingyu-note-atlas-view';
type RenderLink = LinkObject<AtlasNode>;

export class AtlasView extends ItemView {
  private t: Translate;
  private graph?: ForceGraph<AtlasNode, RenderLink>;
  private data: Graph = { nodes: [], links: [] };
  private visible: AtlasNode[] = [];
  private stage!: HTMLDivElement;
  private detail!: HTMLElement;
  private status!: HTMLElement;
  private empty!: HTMLElement;
  private list!: HTMLElement;
  private search!: HTMLInputElement;
  private folders!: HTMLSelectElement;
  private tags!: HTMLSelectElement;
  private orphanInput!: HTMLInputElement;
  private scopeButton!: HTMLButtonElement;
  private observer?: ResizeObserver;
  private previewComponent?: Component;
  private previewToken = 0;
  private searchTimer?: number;
  private fitTimer?: number;
  private closed = true;
  private selected = '';
  private hovered = '';
  private textColor = '#dbe5f7';
  private fitPending = true;
  private lastClick = { id: '', time: 0 };
  private filter: Filter = { query: '', folder: '', tag: '', hideOrphans: false, focus: '', depth: 1, maxNodes: 1500 };

  constructor(leaf: WorkspaceLeaf, private plugin: AtlasPlugin) { super(leaf); this.t = translator(plugin.settings.language, getLanguage()); }
  getViewType(): string { return VIEW_TYPE; }
  getDisplayText(): string { return this.t('title'); }
  getIcon(): string { return 'network'; }
  async onOpen(): Promise<void> { await this.rebuild(); }
  async onClose(): Promise<void> { this.dispose(); }
  dispose(): void {
    this.closed = true; this.previewToken++;
    this.observer?.disconnect(); this.observer = undefined;
    this.previewComponent?.unload(); this.previewComponent = undefined;
    if (this.searchTimer !== undefined) window.clearTimeout(this.searchTimer);
    if (this.fitTimer !== undefined) window.clearTimeout(this.fitTimer);
    this.graph?._destructor(); this.graph = undefined;
  }
  private button(parent: HTMLElement, text: string, action: () => void): HTMLButtonElement {
    const button = parent.createEl('button', { text, attr: { type: 'button' } });
    button.addEventListener('click', action); return button;
  }
  async rebuild(): Promise<void> {
    this.dispose(); this.closed = false; this.fitPending = true;
    this.t = translator(this.plugin.settings.language, getLanguage());
    const root = this.contentEl; root.empty(); root.addClass('ka-root');
    const header = root.createDiv('ka-header');
    const brand = header.createDiv('ka-brand');
    brand.createSpan({ text: '◈', cls: 'ka-mark', attr: { 'aria-hidden': 'true' } });
    brand.createDiv().createEl('h2', { text: this.t('title') });
    this.button(header, '+ ' + this.t('newNote'), () => this.newNote()).addClass('mod-cta');
    this.button(header, this.t('fit'), () => this.fit());
    this.button(header, this.t('reset'), () => this.reset());
    this.button(header, this.t('refresh'), () => this.refresh());
    const filters = root.createDiv('ka-filters');
    this.search = filters.createEl('input', { type: 'search', placeholder: this.t('search'), attr: { 'aria-label': this.t('search') } });
    this.search.value = this.filter.query;
    this.search.addEventListener('input', () => {
      this.filter.query = this.search.value;
      if (this.searchTimer !== undefined) window.clearTimeout(this.searchTimer);
      this.searchTimer = window.setTimeout(() => { this.fitPending = true; this.renderGraph(); }, 180);
    });
    this.search.addEventListener('keydown', e => {
      if (e.key === 'Enter' && this.visible.length) this.select(this.visible[0].id);
    });
    this.folders = filters.createEl('select', { attr: { 'aria-label': this.t('allFolders') } });
    this.folders.addEventListener('change', () => { this.filter.folder = this.folders.value; this.fitPending = true; this.renderGraph(); });
    this.tags = filters.createEl('select', { attr: { 'aria-label': this.t('allTags') } });
    this.tags.addEventListener('change', () => { this.filter.tag = this.tags.value; this.fitPending = true; this.renderGraph(); });
    const options = root.createDiv('ka-options');
    this.scopeButton = this.button(options, this.t('global'), () => { this.filter.focus = ''; this.fitPending = true; this.renderGraph(); });
    const label = options.createEl('label');
    this.orphanInput = label.createEl('input', { type: 'checkbox' }); this.orphanInput.checked = this.filter.hideOrphans;
    label.appendText(this.t('orphans'));
    this.orphanInput.addEventListener('change', () => { this.filter.hideOrphans = this.orphanInput.checked; this.fitPending = true; this.renderGraph(); });
    this.status = options.createSpan({ cls: 'ka-stats', attr: { role: 'status' } });
    const body = root.createDiv('ka-body');
    const canvasWrap = body.createDiv('ka-canvas-wrap');
    this.stage = canvasWrap.createDiv({ cls: 'ka-stage', attr: { 'aria-label': this.t('title') } });
    this.empty = canvasWrap.createDiv('ka-empty');
    canvasWrap.createDiv({ cls: 'ka-hint', text: this.t('hint') });
    const noteList = canvasWrap.createEl('details', { cls: 'ka-note-list' });
    noteList.createEl('summary', { text: this.t('resultList') });
    this.list = noteList.createDiv('ka-list-items');
    this.detail = body.createEl('aside', { cls: 'ka-detail', attr: { 'aria-label': this.t('details') } });
    this.detail.createEl('h3', { text: this.t('choose') });
    this.graph = new ForceGraph<AtlasNode, RenderLink>(this.stage)
      .nodeId('id').nodeLabel(() => '').nodeVal(node => 2 + Math.sqrt(node.degree))
      .linkColor(() => 'rgba(151,163,184,0.3)').linkWidth(0.7)
      .d3AlphaDecay(0.035).d3VelocityDecay(0.35).cooldownTicks(150)
      .nodeCanvasObject((node, ctx, scale) => this.drawNode(node, ctx, scale))
      .nodePointerAreaPaint((node, color, ctx, scale) => {
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(node.x ?? 0, node.y ?? 0, Math.max(9, 8 / scale), 0, Math.PI * 2); ctx.fill();
      })
      .onNodeHover(node => { this.hovered = node?.id ?? ''; this.stage.style.cursor = node ? 'pointer' : 'grab'; })
      .onNodeClick((node, event) => {
        const now = Date.now();
        if (event.ctrlKey || event.metaKey || (this.lastClick.id === node.id && now - this.lastClick.time < 350)) void this.openNote(node.id);
        else this.select(node.id);
        this.lastClick = { id: node.id, time: now };
      })
      .onNodeRightClick((node, event) => this.menu(node.id, event))
      .onNodeDragEnd(node => { node.fx = node.x; node.fy = node.y; })
      .onEngineStop(() => { if (this.fitPending) this.fit(); });
    this.graph.d3Force('charge')?.strength(-95);
    this.graph.d3Force('link')?.distance(75);
    // 弱中心引力防止无链接的笔记无限散开，把整体图谱保持在可读范围内。
    this.graph.d3Force('atlas-center', (alpha: number) => {
      for (const node of this.visible) {
        if (node.fx === undefined) node.vx = (node.vx ?? 0) - (node.x ?? 0) * alpha * 0.025;
        if (node.fy === undefined) node.vy = (node.vy ?? 0) - (node.y ?? 0) * alpha * 0.025;
      }
    });
    this.observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      if (!rect || !this.graph) return;
      if (rect.width > 0 && rect.height > 0) {
        this.graph.width(rect.width).height(rect.height).resumeAnimation();
      } else this.graph.pauseAnimation();
    });
    this.observer.observe(this.stage);
    this.updateAppearance(); this.refresh();
  }
  updateAppearance(): void {
    if (!this.graph || this.closed) return;
    const dark = this.plugin.settings.appearance === 'dark';
    this.contentEl.toggleClass('ka-dark', dark);
    const background = dark ? '#10141e' : getComputedStyle(this.contentEl).getPropertyValue('--background-primary').trim() || '#202020';
    this.textColor = dark ? '#dbe5f7' : getComputedStyle(this.contentEl).getPropertyValue('--text-normal').trim() || '#888';
    this.graph.backgroundColor(background);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.graph.linkDirectionalParticles(this.plugin.settings.animation && !reduced ? 1 : 0)
      .linkDirectionalParticleWidth(1.5).linkDirectionalParticleSpeed(0.004).linkDirectionalParticleColor(() => '#93b3ff');
  }
  private drawNode(node: AtlasNode, ctx: CanvasRenderingContext2D, scale: number): void {
    const highlight = node.id === this.selected || node.id === this.hovered;
    const radius = Math.max(3.5 / scale, Math.min(12, 3 + Math.sqrt(node.degree) * 1.6));
    ctx.beginPath(); ctx.arc(node.x ?? 0, node.y ?? 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = node.color; ctx.globalAlpha = this.hovered && !highlight ? 0.55 : 0.95;
    if (highlight) { ctx.shadowBlur = 15; ctx.shadowColor = node.color; }
    ctx.fill(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    if (highlight || node.fx !== undefined) {
      ctx.strokeStyle = '#dbe5ff'; ctx.lineWidth = 1.4 / scale; ctx.stroke();
    }
    if (highlight || (this.plugin.settings.labels && (this.visible.length < 80 || (scale > 0.75 && (this.visible.length < 180 || node.degree > 2))))) {
      ctx.font = `${Math.max(10 / scale, 3)}px sans-serif`; ctx.textAlign = 'center';
      const label = node.title.length > 28 ? node.title.slice(0, 27) + '…' : node.title;
      ctx.fillStyle = this.textColor;
      ctx.fillText(label, node.x ?? 0, (node.y ?? 0) + radius + 13 / scale);
    }
  }
  refresh(): void {
    if (this.closed) return;
    this.data = this.plugin.snapshot();
    const fillOptions = (select: HTMLSelectElement, values: string[], first: string, selected: string) => {
      select.empty(); select.createEl('option', { text: first, value: '' });
      for (const value of values.sort((a, b) => a.localeCompare(b))) select.createEl('option', { text: value, value });
      select.value = selected;
    };
    const folders = new Set<string>();
    for (const node of this.data.nodes) {
      const parts = node.folder.split('/').filter(Boolean);
      for (let i = 1; i <= parts.length; i++) folders.add(parts.slice(0, i).join('/'));
    }
    if (this.filter.folder && !folders.has(this.filter.folder)) this.filter.folder = '';
    const tags = new Set(this.data.nodes.flatMap(n => n.tags));
    if (this.filter.tag && !tags.has(this.filter.tag)) this.filter.tag = '';
    fillOptions(this.folders, [...folders], this.t('allFolders'), this.filter.folder);
    fillOptions(this.tags, [...tags], this.t('allTags'), this.filter.tag);
    if (this.filter.focus && !this.data.nodes.some(n => n.id === this.filter.focus)) this.filter.focus = '';
    if (this.selected && !this.data.nodes.some(n => n.id === this.selected)) this.clearSelection();
    this.renderGraph();
    if (this.selected) void this.renderDetails(this.selected);
  }
  private renderGraph(): void {
    if (!this.graph || this.closed) return;
    this.filter.depth = this.plugin.settings.depth; this.filter.maxNodes = this.plugin.settings.maxNodes;
    const next = filterGraph(this.data, this.filter);
    const old = new Map(this.visible.map(n => [n.id, n]));
    for (const node of next.nodes) {
      const previous = old.get(node.id);
      if (previous) for (const key of ['x', 'y', 'vx', 'vy', 'fx', 'fy'] as const) node[key] = previous[key];
    }
    this.visible = next.nodes;
    this.graph.graphData({ nodes: this.visible, links: next.links });
    this.status.setText(`${next.nodes.length} ${this.t('notes')} · ${next.links.length} ${this.t('links')} · ${this.t('matched')} ${next.matched} / ${this.t('total')} ${this.data.nodes.length}`);
    const limited = next.matched > next.nodes.length;
    this.status.title = limited ? this.t('limited') : '';
    this.status.toggleClass('ka-limited', limited);
    this.empty.setText(!next.nodes.length ? this.t('empty') : limited ? this.t('limited') : '');
    this.empty.toggleClass('ka-limit-banner', next.nodes.length > 0);
    this.empty.hidden = next.nodes.length > 0 && !limited;
    this.scopeButton.setText(this.filter.focus ? `${this.t('neighborhood')}: ${this.filter.focus} ×` : this.t('global'));
    this.scopeButton.title = this.filter.focus; this.list.empty();
    for (const note of [...this.visible].sort((a, b) => a.title.localeCompare(b.title)).slice(0, 100)) {
      const row = this.button(this.list, note.title, () => this.select(note.id));
      row.title = note.id; row.createSpan({ text: note.folder || '/', cls: 'ka-muted' });
    }
    if (this.visible.length > 100) this.list.createEl('p', { text: this.t('listMore') });
    if (this.fitPending) {
      if (this.fitTimer !== undefined) window.clearTimeout(this.fitTimer);
      this.fitTimer = window.setTimeout(() => {
        if (this.fitPending && !this.closed && this.visible.length) this.graph?.zoomToFit(250, 65);
      }, 650);
    }
  }
  private reset(): void {
    this.filter = { ...this.filter, query: '', folder: '', tag: '', focus: '', hideOrphans: false };
    this.search.value = ''; this.folders.value = ''; this.tags.value = ''; this.orphanInput.checked = false;
    this.fitPending = true; this.renderGraph();
  }
  explore(path: string): void {
    this.reset(); this.filter.focus = path; this.fitPending = true; this.renderGraph(); this.select(path);
  }
  onRename(oldPath: string, newPath: string): void {
    const replace = (path: string) => path === oldPath ? newPath : path.startsWith(oldPath + '/') ? newPath + path.slice(oldPath.length) : path;
    this.selected = replace(this.selected); this.filter.focus = replace(this.filter.focus); this.filter.folder = replace(this.filter.folder);
  }
  private fit(): void {
    if (!this.graph || this.closed || !this.visible.length) return;
    this.fitPending = false;
    this.graph.zoomToFit(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 400, 65);
  }
  private select(path: string): void {
    this.selected = path; this.contentEl.addClass('ka-has-selection');
    const node = this.visible.find(n => n.id === path);
    if (node && this.graph) this.graph.centerAt(node.x ?? 0, node.y ?? 0, 350);
    void this.renderDetails(path);
  }
  private clearSelection(): void {
    this.selected = ''; this.previewToken++; this.previewComponent?.unload(); this.previewComponent = undefined;
    this.contentEl.removeClass('ka-has-selection'); this.detail.empty(); this.detail.createEl('h3', { text: this.t('choose') });
  }
  private async renderDetails(path: string): Promise<void> {
    const token = ++this.previewToken;
    this.previewComponent?.unload(); this.previewComponent = undefined;
    this.detail.empty();
    const node = this.data.nodes.find(n => n.id === path);
    if (!node) return;
    this.button(this.detail, '×', () => this.clearSelection()).setAttribute('aria-label', this.t('back'));
    this.detail.createEl('h2', { text: node.title });
    this.detail.createEl('p', { text: path, cls: 'ka-path ka-wrap' });
    const tags = this.detail.createDiv('ka-note-tags');
    for (const tag of node.tags) this.button(tags, tag, () => { this.filter.tag = tag; this.tags.value = tag; this.fitPending = true; this.renderGraph(); });
    this.detail.createEl('p', { text: `${this.t('modified')}: ${new Date(node.modified).toLocaleString()}`, cls: 'ka-muted' });
    const actions = this.detail.createDiv('ka-actions');
    this.button(actions, this.t('open'), () => { void this.openNote(path); }).addClass('mod-cta');
    this.button(actions, this.t('neighborhood'), () => this.explore(path));
    this.button(actions, this.t('rename'), () => this.rename(path));
    this.button(actions, this.t('connect'), () => this.link(path));
    this.button(actions, this.t('trash'), () => this.trash(path));
    this.detail.createEl('h3', { text: this.t('neighbors') });
    const adjacent = new Set(this.data.links.flatMap(l => l.source === path ? [l.target] : l.target === path ? [l.source] : []));
    const neighbors = this.detail.createDiv('ka-neighbors');
    for (const other of [...adjacent].sort().slice(0, 100)) this.button(neighbors, other, () => this.select(other));
    if (!adjacent.size) neighbors.createSpan({ text: '—', cls: 'ka-muted' });
    this.detail.createEl('h3', { text: this.t('preview') });
    const preview = this.detail.createDiv({ cls: 'ka-preview markdown-rendered', text: this.t('loading') });
    try {
      const file = requireNote(this.app, path);
      const text = await this.app.vault.cachedRead(file);
      if (token !== this.previewToken || this.closed) return;
      preview.empty();
      if (!text.trim()) { preview.setText(this.t('noPreview')); return; }
      const component = new Component(); component.load(); this.previewComponent = component;
      await MarkdownRenderer.render(this.app, text, preview, file.path, component);
      if (token !== this.previewToken || this.closed) component.unload();
    } catch (error) { if (token === this.previewToken && !this.closed) preview.setText(errorText(error, this.t)); }
  }
  private async openNote(path: string): Promise<void> {
    try { await this.app.workspace.getLeaf('tab').openFile(requireNote(this.app, path)); }
    catch (error) { new Notice(errorText(error, this.t)); }
  }
  private newNote(): void {
    new PathModal(this.app, this.t, null, this.filter.folder ? this.filter.folder + '/' : '', file => {
      this.refresh(); this.select(file.path); void this.openNote(file.path);
    }).open();
  }
  private rename(path: string): void {
    try { new PathModal(this.app, this.t, requireNote(this.app, path), path, file => { this.selected = file.path; this.refresh(); }).open(); }
    catch (error) { new Notice(errorText(error, this.t)); }
  }
  private link(path: string): void {
    try { new LinkPicker(this.app, requireNote(this.app, path), this.t).open(); }
    catch (error) { new Notice(errorText(error, this.t)); }
  }
  private trash(path: string): void {
    new ActionModal(this.app, this.t, this.t('trash'), this.t('trashHelp'), [path], this.t('confirm'), async () => {
      await this.app.fileManager.trashFile(requireNote(this.app, path));
      this.clearSelection(); this.refresh(); new Notice(this.t('trashed'));
    }, true).open();
  }
  private menu(path: string, event: MouseEvent): void {
    const menu = new Menu();
    menu.addItem(i => i.setTitle(this.t('open')).setIcon('file-text').onClick(() => this.openNote(path)));
    menu.addItem(i => i.setTitle(this.t('neighborhood')).setIcon('network').onClick(() => this.explore(path)));
    menu.addItem(i => i.setTitle(this.t('rename')).setIcon('pencil').onClick(() => this.rename(path)));
    menu.addItem(i => i.setTitle(this.t('connect')).setIcon('link').onClick(() => this.link(path)));
    const node = this.visible.find(n => n.id === path);
    if (node) menu.addItem(i => i.setTitle(this.t(node.fx === undefined ? 'pinned' : 'unpin')).setIcon('pin').onClick(() => {
      if (node.fx === undefined) { node.fx = node.x; node.fy = node.y; }
      else { node.fx = undefined; node.fy = undefined; this.graph?.d3ReheatSimulation(); }
    }));
    menu.addSeparator(); menu.addItem(i => i.setTitle(this.t('trash')).setIcon('trash-2').onClick(() => this.trash(path)));
    menu.showAtMouseEvent(event);
  }
}
