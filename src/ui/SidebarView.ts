import { ItemView, WorkspaceLeaf, Plugin } from 'obsidian';
import { createApp, App as VueApp } from 'vue';
import Panel from './Panel.vue';
import { VocabularyManager } from '../db/vocabulary';

export const VIEW_TYPE_LANG_LEARNER = 'lang-learner-sidebar';

/**
 * Obsidian 侧边栏 Vue 3 容器视图
 */
export class LangLearnerSidebarView extends ItemView {
    private vueApp: VueApp | null = null;
    private vocabManager: VocabularyManager;
    private plugin: Plugin;

    constructor(leaf: WorkspaceLeaf, vocabManager: VocabularyManager, plugin: Plugin) {
        super(leaf);
        this.vocabManager = vocabManager;
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_LANG_LEARNER;
    }

    getDisplayText(): string {
        return '语言学习助手';
    }

    getIcon(): string {
        // 使用 Obsidian 内置的图书图标
        return 'book-open';
    }

    async onOpen(): Promise<void> {
        const container = this.contentEl;
        container.empty();

        // 挂载 Vue 3 应用
        this.vueApp = createApp(Panel);
        
        // 使用 provide 机制向下游 Vue 组件注入核心依赖
        this.vueApp.provide('vocabManager', this.vocabManager);
        this.vueApp.provide('plugin', this.plugin);
        
        this.vueApp.mount(container);
    }

    async onClose(): Promise<void> {
        // F6 / ADR-006: 显式销毁 Vue 实例，防范内存泄露
        if (this.vueApp) {
            this.vueApp.unmount();
            this.vueApp = null;
        }
    }
}
