import { Plugin, MarkdownPostProcessorContext } from 'obsidian';
import { VocabularyManager, DataAdapter } from './db/vocabulary';
import { processElement, refreshWordsInDOM } from './renderer/postProcessor';
import { LangLearnerSidebarView, VIEW_TYPE_LANG_LEARNER } from './ui/SidebarView';
import { eventBus } from './event/EventBus';
import { OFFLINE_DICT } from './data/static_data';
import { appendContextNote } from './generator/contextNote';

/**
 * Obsidian English Learner 插件主类
 */
export default class EnglishLearnerPlugin extends Plugin {
    /** 影子词库管理器实例 */
    public vocabManager!: VocabularyManager;

    async onload() {
        console.log('🚀 Obsidian English Learner 插件加载中...');

        // 初始化词库管理器，使用 Obsidian Vault Adapter 作为数据适配器
        const adapter: DataAdapter = {
            read: (path: string) => this.app.vault.adapter.read(path),
            write: (path: string, data: string) => this.app.vault.adapter.write(path, data),
            rename: (oldPath: string, newPath: string) =>
                this.app.vault.adapter.rename(oldPath, newPath),
            exists: async (path: string) => {
                return await this.app.vault.adapter.exists(path);
            }
        };

        this.vocabManager = new VocabularyManager(adapter);
        await this.vocabManager.load();

        // 注册侧边栏视图
        this.registerView(
            VIEW_TYPE_LANG_LEARNER,
            (leaf) => new LangLearnerSidebarView(leaf, this.vocabManager, this)
        );

        // 添加侧边栏功能功能入口 Ribbon 图标
        this.addRibbonIcon('book-open', '打开语言学习助手', () => {
            this.activateView();
        });

        // 注册 Markdown 后置处理器 (DOM 拦截器)
        this.registerMarkdownPostProcessor(
            (el: HTMLElement, _ctx: MarkdownPostProcessorContext) => {
                processElement(el, this.vocabManager);
            }
        );

        // 监听事件总线：当侧边栏等处修改单词状态时瞬间更新 DOM 高亮样式，实现增量刷新
        eventBus.on('lang-learner:word-changed', (word: string, status: string, contextSentence?: string) => {
            refreshWordsInDOM(word, status);

            // F4 语境卡片自动生成/追加逻辑
            if (status === 'LEARNING' && contextSentence) {
                // 获取当前活动文档的标题
                const activeFile = this.app.workspace.getActiveFile();
                const sourceTitle = activeFile ? activeFile.basename : '未命名文档';

                // 获取单词释义与音标
                const info = this.vocabManager.getInfo(word);
                let trans = info?.trans || '';
                let phonetic = info?.phonetic || '';
                if (!trans) {
                    const dictEntry = OFFLINE_DICT[word];
                    if (dictEntry) {
                        trans = dictEntry.trans;
                        phonetic = phonetic || dictEntry.phonetic || '';
                    }
                }

                // 异步在后台静默生成或追加卡片，避免阻塞高亮渲染主线程
                appendContextNote(this.app, word, status, trans, phonetic, contextSentence, sourceTitle).catch(err => {
                    console.error('生成语境卡片异常:', err);
                });
            }
        });

        // 监听批量标熟事件：F5 估算完成或 F8 一键学完后，触发全页重渲染
        eventBus.on('lang-learner:batch-known', (_count: number) => {
            // 通知 Obsidian 触发布局变更，让 MarkdownPostProcessor 对可见文档重新渲染
            this.app.workspace.trigger('layout-change');
        });

        console.log('🚀 Obsidian English Learner 插件加载完毕！');
    }

    async onunload() {
        // 在插件卸载时立即落盘残余数据并清理资源
        try {
            await this.vocabManager.saveImmediately();
        } catch (err) {
            console.error('插件卸载时词库落盘异常:', err);
        }
        
        this.vocabManager.destroy();
        eventBus.clear();
        
        console.log('⚡ Obsidian English Learner 插件已安全卸载。');
    }

    /**
     * 激活并展示侧边栏视图
     */
    async activateView() {
        const { workspace } = this.app;

        let leaf = workspace.getLeavesOfType(VIEW_TYPE_LANG_LEARNER)[0];
        if (!leaf) {
            // 获取右侧辅助侧边栏叶子节点
            const rightLeaf = workspace.getRightLeaf(false);
            if (rightLeaf) {
                await rightLeaf.setViewState({
                    type: VIEW_TYPE_LANG_LEARNER,
                    active: true,
                });
                leaf = rightLeaf;
            }
        }

        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }
}

// 导出增量刷新函数供外部模块使用
export { refreshWordsInDOM };