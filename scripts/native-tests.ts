/* Native integration checks. Bundled only into the disposable test vault, never shipped. */
import { Plugin, TFile, apiVersion } from 'obsidian';
import { PathModal, LinkPicker, preparePath } from '../src/operations';
import { translator } from '../src/i18n';
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
function check(condition: unknown, label: string): asserts condition { if (!condition) throw new Error(label); }
export default class NativeTests extends Plugin {
  async onload() {
    if (this.app.vault.getName() !== 'Atlas-test-vault') return;
    this.app.workspace.onLayoutReady(() => { void this.run(); });
  }
  async run() {
    const results: { name: string; passed: boolean; error?: string }[] = [];
    const test = async (name: string, fn: () => unknown) => {
      try { await fn(); results.push({ name, passed: true }); }
      catch (error) { results.push({ name, passed: false, error: String(error) }); }
      await this.app.vault.adapter.write('native-test-results.json', JSON.stringify({ results, finished: false }, null, 2));
    };
    let atlas: any; let view: any;
    const t = translator('zh', 'zh');
    const clickModal = (text: string) => {
      const buttons = [...activeDocument.querySelectorAll<HTMLButtonElement>('.modal-container button')];
      const button = buttons.find(button => button.textContent === text);
      check(button, `Modal button missing: ${text}`); button.click();
    };
    const inputPath = (value: string) => {
      const input = activeDocument.querySelector<HTMLInputElement>('.modal-container input.ka-path-input');
      check(input, 'Path input missing'); input.value = value; input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    await delay(1200);
    await test('Plugin loads in native Obsidian and registers both commands', async () => {
      atlas = (this.app as any).plugins.plugins['knowledge-atlas']; check(atlas, 'Plugin did not load');
      check((this.app as any).commands.commands['knowledge-atlas:open-atlas'], 'Open command missing');
      check((this.app as any).commands.commands['knowledge-atlas:explore-note'], 'Local command missing');
      await atlas.openAtlas(); view = this.app.workspace.getLeavesOfType('knowledge-atlas-view')[0]?.view;
      check(view?.getViewType() === 'knowledge-atlas-view', 'Native view missing');
    });
    if (atlas && view) {
      await delay(1600);
      await test('Real canvas renders the full fixture graph and metadata links', () => {
        check(view.contentEl.querySelector('canvas')?.width > 0, 'Canvas missing or zero width');
        check(view.visible.length >= 12, 'Fixture notes missing');
        check(atlas.snapshot().links.length >= 12, 'Native resolved links missing');
        check(view.graph.getGraphBbox()?.x[1] > view.graph.getGraphBbox()?.x[0], 'Graph collapsed');
      });
      await test('Search input resolves Chinese aliases and tags using native metadata', async () => {
        view.search.value = '中文别名'; view.search.dispatchEvent(new Event('input', { bubbles: true })); await delay(350);
        check(view.visible.length === 1 && view.visible[0].id === 'Learning/中文笔记.md', 'Alias filter failed');
        view.reset();
      });
      await test('Folder and tag selectors filter the real graph', () => {
        view.folders.value = 'Projects'; view.folders.dispatchEvent(new Event('change'));
        check(view.visible.length === 2, 'Folder filtering failed');
        view.tags.value = '#project'; view.tags.dispatchEvent(new Event('change'));
        check(view.visible.length === 1, 'Tag filtering failed'); view.reset();
      });
      await test('Preview renders markdown from the current native vault', async () => {
        view.select('Learning/中文笔记.md'); await delay(250);
        check(view.detail.querySelector('.ka-preview h1')?.textContent === '中文笔记', 'Markdown rendering failed');
      });
      await test('Native file opening keeps the atlas tab available', async () => {
        await view.openNote('Learning/中文笔记.md');
        check(this.app.workspace.getActiveFile()?.path === 'Learning/中文笔记.md', 'File open failed');
        await atlas.openAtlas();
      });
      await test('Local neighborhoods include incoming and outgoing links', () => {
        view.explore('Ideas/Offline.md'); check(view.visible.length === 2, 'Neighborhood failed'); view.reset();
      });
      await test('New-note modal creates a Chinese path with missing parents and refreshes the graph', async () => {
        new PathModal(this.app, t, null, '', () => {}).open(); await delay(250); inputPath('QA/新建/原始笔记.md'); clickModal(t('create')); await delay(600);
        check(this.app.vault.getAbstractFileByPath('QA/新建/原始笔记.md') instanceof TFile, 'Create failed');
        check(view.data.nodes.some((n: any) => n.id === 'QA/新建/原始笔记.md'), 'Live create update failed');
      });
      await test('Create rejects a collision without changing original content', async () => {
        const before = await this.app.vault.adapter.read('Welcome.md');
        new PathModal(this.app, t, null, '', () => {}).open(); await delay(250); inputPath('Welcome.md'); clickModal(t('create')); await delay(200);
        check(activeDocument.querySelector('.modal-container .ka-error')?.textContent === t('exists'), 'Collision error missing');
        check(await this.app.vault.adapter.read('Welcome.md') === before, 'Existing file overwritten'); clickModal(t('cancel'));
      });
      await test('Create rejects path traversal before touching the vault', async () => {
        new PathModal(this.app, t, null, '', () => {}).open(); await delay(250); inputPath('../escaped.md'); clickModal(t('create')); await delay(150);
        check(activeDocument.querySelector('.modal-container .ka-error')?.textContent === t('invalidPath'), 'Traversal rejection missing'); clickModal(t('cancel'));
      });
      await test('Link dialog appends a native internal link and metadata catches up', async () => {
        const source = this.app.vault.getAbstractFileByPath('QA/新建/原始笔记.md') as TFile;
        const target = this.app.vault.getAbstractFileByPath('Welcome.md') as TFile;
        const picker = new LinkPicker(this.app, source, t); picker.onChooseItem(target); await delay(250); clickModal(t('confirmLink')); await delay(750);
        check(this.app.metadataCache.resolvedLinks[source.path]?.[target.path] > 0, 'Resolved added link missing');
        const before = await this.app.vault.read(source);
        picker.onChooseItem(target); await delay(250); clickModal(t('confirmLink')); await delay(150);
        check(await this.app.vault.read(source) === before, 'Duplicate link appended');
      });
      await test('Rename/move modal updates the native file and selected graph node', async () => {
        const source = this.app.vault.getAbstractFileByPath('QA/新建/原始笔记.md') as TFile;
        view.select(source.path);
        new PathModal(this.app, t, source, source.path, () => {}).open(); await delay(250); inputPath('QA/已移动.md'); clickModal(t('confirmRename')); await delay(600);
        check(this.app.vault.getAbstractFileByPath('QA/已移动.md') instanceof TFile, 'Rename failed');
        check(!this.app.vault.getAbstractFileByPath('QA/新建/原始笔记.md'), 'Old path still exists');
        check(view.selected === 'QA/已移动.md', 'Selection not migrated');
      });
      await test('Preview follows modifications and deletion confirmation is cancellable', async () => {
        const file = this.app.vault.getAbstractFileByPath('QA/已移动.md') as TFile;
        await this.app.vault.process(file, text => text + '\n## Live update marker\n'); await delay(650);
        check(view.detail.querySelector('.ka-preview')?.textContent.includes('Live update marker'), 'Preview not updated');
        view.trash(file.path); await delay(250); clickModal(t('cancel')); await delay(100);
        check(this.app.vault.getAbstractFileByPath(file.path), 'Cancel deleted file');
      });
      await test('Confirmed trash uses the native local trash, and removes node from graph', async () => {
        view.trash('QA/已移动.md'); await delay(250); clickModal(t('confirm')); await delay(600);
        check(!this.app.vault.getAbstractFileByPath('QA/已移动.md'), 'Trash failed');
        check(!view.data.nodes.some((n: any) => n.id === 'QA/已移动.md'), 'Deleted node still visible');
        check(await this.app.vault.adapter.exists('.trash/已移动.md'), 'Recoverable trash file not found');
      });
      await test('Excluded folders, English UI, theme mode and animation off apply without restart', async () => {
        atlas.settings.excluded = ['Journal']; atlas.settings.language = 'en'; atlas.settings.appearance = 'theme'; atlas.settings.animation = false;
        await atlas.saveSettings();
        check(!view.data.nodes.some((n: any) => n.folder === 'Journal'), 'Exclusion failed');
        check(view.search.placeholder.startsWith('Search'), 'Language failed');
        check(!view.contentEl.classList.contains('ka-dark'), 'Theme setting failed');
        check(view.graph.linkDirectionalParticles() === 0, 'Animation setting failed');
        atlas.settings.excluded = []; atlas.settings.language = 'zh'; atlas.settings.appearance = 'dark'; atlas.settings.animation = true;
        await atlas.saveSettings();
      });
      await test('Closing native view releases graph, observer and preview components; reopening works', async () => {
        const old = view; await old.leaf.detach(); await delay(100);
        check(old.graph === undefined && old.observer === undefined && old.previewComponent === undefined, 'Resources leaked');
        await atlas.openAtlas(); view = this.app.workspace.getLeavesOfType('knowledge-atlas-view')[0]?.view;
        check(view?.graph, 'Reopen failed'); await delay(500); view.select('Projects/Atlas.md');
      });
    }
    await this.app.vault.adapter.write('native-test-results.json', JSON.stringify({
      finished: true, passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length,
      hostVersion: apiVersion,
      results,
    }, null, 2));
  }
}
