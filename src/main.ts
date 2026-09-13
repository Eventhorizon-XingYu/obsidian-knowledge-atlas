import { Plugin, TFile, getAllTags, parseFrontMatterAliases, getLanguage } from 'obsidian';
import { AtlasSettings, AtlasSettingsTab, DEFAULTS, sanitizeSettings } from './settings';
import { buildGraph, folderContains, Note } from './graph';
import { AtlasView, VIEW_TYPE } from './view';
import { translator } from './i18n';

export default class AtlasPlugin extends Plugin {
  settings: AtlasSettings = DEFAULTS;
  private timer: number | undefined;
  async onload(): Promise<void> {
    this.settings = sanitizeSettings(await this.loadData());
    const t = translator(this.settings.language, getLanguage());
    this.registerView(VIEW_TYPE, leaf => new AtlasView(leaf, this));
    this.addRibbonIcon('network', t('openGraph'), () => { void this.openAtlas(); });
    this.addCommand({ id: 'open-atlas', name: t('openGraph'), callback: () => this.openAtlas() });
    this.addCommand({ id: 'explore-note', name: t('localGraph'), checkCallback: checking => {
      const file = this.app.workspace.getActiveFile();
      if (!(file instanceof TFile) || file.extension !== 'md') return false;
      if (!checking) void this.openAtlas(file.path);
      return true;
    } });
    this.addSettingTab(new AtlasSettingsTab(this.app, this));
    this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
      if (file instanceof TFile && file.extension === 'md') menu.addItem(item => item.setTitle(t('localGraph')).setIcon('network').onClick(() => this.openAtlas(file.path)));
    }));
    // 文件变动和 metadata resolve 分别触发：先更新节点，解析完后再更新边。
    this.registerEvent(this.app.vault.on('create', () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on('delete', () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on('modify', () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      for (const view of this.views()) view.onRename(oldPath, file.path);
      this.scheduleRefresh();
    }));
    this.registerEvent(this.app.metadataCache.on('resolved', () => this.scheduleRefresh()));
    this.registerEvent(this.app.metadataCache.on('changed', () => this.scheduleRefresh()));
    this.registerEvent(this.app.workspace.on('css-change', () => { for (const view of this.views()) view.updateAppearance(); }));
    this.app.workspace.onLayoutReady(() => this.scheduleRefresh());
    this.register(() => { if (this.timer !== undefined) window.clearTimeout(this.timer); });
  }
  views(): AtlasView[] {
    return this.app.workspace.getLeavesOfType(VIEW_TYPE).map(leaf => leaf.view).filter((view): view is AtlasView => view instanceof AtlasView);
  }
  scheduleRefresh(): void {
    if (this.timer !== undefined) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => { this.timer = undefined; for (const view of this.views()) view.refresh(); }, 250);
  }
  snapshot() {
    const notes: Note[] = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (this.settings.excluded.some(folder => folderContains(file.path, folder))) continue;
      const cache = this.app.metadataCache.getFileCache(file);
      notes.push({ id: file.path, title: file.basename, folder: file.parent?.path === '/' ? '' : file.parent?.path ?? '',
        tags: cache ? getAllTags(cache) ?? [] : [], aliases: cache ? parseFrontMatterAliases(cache.frontmatter) ?? [] : [], modified: file.stat.mtime });
    }
    return buildGraph(notes, this.app.metadataCache.resolvedLinks);
  }
  async openAtlas(path?: string): Promise<void> {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) { leaf = this.app.workspace.getLeaf('tab'); await leaf.setViewState({ type: VIEW_TYPE, active: true }); }
    await this.app.workspace.revealLeaf(leaf);
    if (leaf.view instanceof AtlasView && path) leaf.view.explore(path);
  }
  async saveSettings(): Promise<void> {
    this.settings = sanitizeSettings(this.settings);
    await this.saveData(this.settings);
    for (const view of this.views()) await view.rebuild();
  }
  onunload(): void { for (const view of this.views()) view.dispose(); }
}
