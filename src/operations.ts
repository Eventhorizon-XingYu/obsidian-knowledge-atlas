import { App, Modal, Setting, TFile, TFolder, FuzzySuggestModal, Notice } from 'obsidian';
import { notePath } from './graph';
import { Translate } from './i18n';

export function requireNote(app: App, path: string): TFile {
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile) || file.extension !== 'md') throw new Error('missing');
  return file;
}
/** 先检查整条目标路径，避免已知冲突导致半途创建文件夹。 */
export async function preparePath(app: App, input: string): Promise<string> {
  const path = notePath(input);
  if (app.vault.getAbstractFileByPath(path)) throw new Error('exists');
  const parts = path.split('/'); parts.pop();
  const parents = parts.map((_, i) => parts.slice(0, i + 1).join('/'));
  for (const parent of parents) {
    const existing = app.vault.getAbstractFileByPath(parent);
    if (existing && !(existing instanceof TFolder)) throw new Error('folderConflict');
  }
  for (const parent of parents) {
    if (!app.vault.getAbstractFileByPath(parent)) await app.vault.createFolder(parent);
  }
  return path;
}
export function errorText(error: unknown, t: Translate): string {
  const message = error instanceof Error ? error.message : String(error);
  if (['missing', 'invalidPath', 'exists', 'folderConflict'].includes(message)) return t(message as 'missing');
  return t('error') + ': ' + message;
}
export class ActionModal extends Modal {
  private busy = false;
  constructor(app: App, private t: Translate, private heading: string, private description: string,
    private details: string[], private label: string, private action: () => Promise<void>, private dangerous = false) { super(app); }
  onOpen(): void {
    this.titleEl.setText(this.heading);
    this.contentEl.createEl('p', { text: this.description });
    for (const detail of this.details) this.contentEl.createEl('p', { text: detail, cls: 'ka-wrap' });
    const error = this.contentEl.createEl('p', { cls: 'ka-error', attr: { role: 'alert' } });
    new Setting(this.contentEl).addButton(c => c.setButtonText(this.t('cancel')).onClick(() => this.close()))
      .addButton(c => {
        c.setButtonText(this.label); if (this.dangerous) c.setWarning(); else c.setCta();
        c.onClick(async () => {
          if (this.busy) return; this.busy = true; c.setDisabled(true);
          try { await this.action(); this.close(); }
          catch (e) { error.setText(errorText(e, this.t)); }
          finally { this.busy = false; c.setDisabled(false); }
        });
      });
  }
}
export class PathModal extends Modal {
  private value: string;
  private busy = false;
  constructor(app: App, private t: Translate, private source: TFile | null, initial: string,
    private done: (file: TFile) => void) { super(app); this.value = initial; }
  onOpen(): void {
    this.titleEl.setText(this.t(this.source ? 'rename' : 'newNote'));
    if (this.source) this.contentEl.createEl('p', { text: this.source.path, cls: 'ka-wrap' });
    this.contentEl.createEl('p', { text: this.t(this.source ? 'renameHelp' : 'pathHelp') });
    const error = this.contentEl.createEl('p', { cls: 'ka-error', attr: { role: 'alert' } });
    let input: HTMLInputElement;
    new Setting(this.contentEl).setName(this.t('path')).addText(c => {
      c.setValue(this.value).onChange(v => this.value = v); c.inputEl.addClass('ka-path-input'); input = c.inputEl;
      c.inputEl.setAttribute('aria-label', this.t('path'));
    });
    new Setting(this.contentEl).addButton(c => c.setButtonText(this.t('cancel')).onClick(() => this.close()))
      .addButton(c => c.setCta().setButtonText(this.t(this.source ? 'confirmRename' : 'create')).onClick(async () => {
        if (this.busy) return;
        this.busy = true; c.setDisabled(true);
        try {
          const target = notePath(this.value);
          if (this.source && this.source.path === target) { this.close(); return; }
          if (this.source) requireNote(this.app, this.source.path);
          const path = await preparePath(this.app, target);
          let file: TFile;
          if (this.source) {
            file = this.source;
            await this.app.fileManager.renameFile(file, path);
          } else file = await this.app.vault.create(path, '');
          new Notice(this.t(this.source ? 'moved' : 'created')); this.done(file); this.close();
        } catch (e) { error.setText(errorText(e, this.t)); }
        finally { this.busy = false; c.setDisabled(false); }
      }));
    input!.focus();
  }
}
export class LinkPicker extends FuzzySuggestModal<TFile> {
  constructor(app: App, private source: TFile, private t: Translate) { super(app); this.setPlaceholder(t('selectTarget')); }
  getItems(): TFile[] { return this.app.vault.getMarkdownFiles().filter(f => f.path !== this.source.path); }
  getItemText(file: TFile): string { return file.path; }
  onChooseItem(target: TFile): void {
    const source = this.source;
    new ActionModal(this.app, this.t, this.t('confirmLink'), this.t('linkHelp'),
      [this.t('source') + ': ' + source.path, this.t('target') + ': ' + target.path], this.t('confirmLink'), async () => {
        requireNote(this.app, source.path); requireNote(this.app, target.path);
        const cached = this.app.metadataCache.resolvedLinks[source.path]?.[target.path];
        if (cached) { new Notice(this.t('alreadyLinked')); return; }
        const link = this.app.fileManager.generateMarkdownLink(target, source.path);
        let inserted = false;
        // process 以最新文本为输入；不使用预览缓存覆盖用户正在编辑的内容。
        await this.app.vault.process(source, text => {
          if (text.split(/\r?\n/).some(line => line.trim() === link)) return text;
          inserted = true; return text + (text.endsWith('\n') ? '\n' : '\n\n') + link + '\n';
        });
        new Notice(this.t(inserted ? 'linked' : 'alreadyLinked'));
      }).open();
  }
}
