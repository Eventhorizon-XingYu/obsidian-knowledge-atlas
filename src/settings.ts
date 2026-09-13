import { App, PluginSettingTab, Setting, getLanguage } from 'obsidian';
import { Language, translator } from './i18n';
import type AtlasPlugin from './main';
export interface AtlasSettings {
  language: Language; appearance: 'dark' | 'theme'; animation: boolean;
  labels: boolean; maxNodes: number; excluded: string[]; depth: number;
}
export const DEFAULTS: AtlasSettings = {
  language: 'auto', appearance: 'dark', animation: true, labels: true,
  maxNodes: 1500, excluded: [], depth: 1,
};
export function sanitizeSettings(data: Partial<AtlasSettings> | null): AtlasSettings {
  const d = data ?? {};
  return {
    language: ['en', 'zh', 'auto'].includes(d.language ?? '') ? d.language! : 'auto',
    appearance: d.appearance === 'theme' ? 'theme' : 'dark',
    animation: typeof d.animation === 'boolean' ? d.animation : true,
    labels: typeof d.labels === 'boolean' ? d.labels : true,
    maxNodes: typeof d.maxNodes === 'number' && Number.isFinite(d.maxNodes) ? Math.round(Math.max(100, Math.min(10000, d.maxNodes))) : 1500,
    excluded: Array.isArray(d.excluded) ? d.excluded.filter((v): v is string => typeof v === 'string').map(v => v.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')).filter(Boolean) : [],
    depth: typeof d.depth === 'number' && Number.isFinite(d.depth) ? Math.round(Math.max(1, Math.min(3, d.depth))) : 1,
  };
}
export class AtlasSettingsTab extends PluginSettingTab {
  constructor(app: App, private plugin: AtlasPlugin) { super(app, plugin); }
  display(): void {
    const t = translator(this.plugin.settings.language, getLanguage());
    const el = this.containerEl; el.empty();
    new Setting(el).setName(t('settings')).setHeading();
    new Setting(el).setName(t('language')).setDesc(t('languageHelp')).addDropdown(c => c
      .addOptions({ auto: t('auto'), zh: '简体中文', en: 'English' }).setValue(this.plugin.settings.language)
      .onChange(async value => { this.plugin.settings.language = value as Language; await this.plugin.saveSettings(); this.display(); }));
    new Setting(el).setName(t('appearance')).setDesc(t('appearanceHelp')).addDropdown(c => c
      .addOptions({ dark: t('dark'), theme: t('theme') }).setValue(this.plugin.settings.appearance)
      .onChange(async value => { this.plugin.settings.appearance = value as 'dark' | 'theme'; await this.plugin.saveSettings(); }));
    for (const key of ['animation', 'labels'] as const) {
      const setting = new Setting(el).setName(t(key));
      if (key === 'animation') setting.setDesc(t('animationHelp'));
      setting.addToggle(c => c.setValue(this.plugin.settings[key]).onChange(async v => { this.plugin.settings[key] = v; await this.plugin.saveSettings(); }));
    }
    new Setting(el).setName(t('maxNodes')).setDesc(t('maxHelp')).addText(c => {
      c.setValue(String(this.plugin.settings.maxNodes)); c.inputEl.type = 'number'; c.inputEl.min = '100'; c.inputEl.max = '10000';
      c.inputEl.addEventListener('change', () => {
        this.plugin.settings.maxNodes = Number(c.getValue());
        void this.plugin.saveSettings().then(() => c.setValue(String(this.plugin.settings.maxNodes)));
      });
    });
    new Setting(el).setName(t('depth')).setDesc(t('depthHelp')).addDropdown(c => c.addOptions({ '1': '1', '2': '2', '3': '3' })
      .setValue(String(this.plugin.settings.depth)).onChange(async v => { this.plugin.settings.depth = Number(v); await this.plugin.saveSettings(); }));
    new Setting(el).setName(t('excluded')).setDesc(t('excludedHelp')).addTextArea(c => {
      c.setValue(this.plugin.settings.excluded.join('\n')); c.inputEl.rows = 5;
      c.inputEl.addEventListener('change', () => {
        this.plugin.settings.excluded = c.getValue().split('\n'); void this.plugin.saveSettings();
      });
    });
  }
}
