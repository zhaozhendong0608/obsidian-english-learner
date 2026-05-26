import { Plugin, MarkdownPostProcessorContext, MarkdownView, Notice } from 'obsidian';
import { VocabularyManager, DataAdapter } from './db/vocabulary';
import { processElement, refreshWordsInDOM } from './renderer/postProcessor';
import { LangLearnerSidebarView, VIEW_TYPE_LANG_LEARNER } from './ui/SidebarView';
import { WordSuggest } from './ui/WordSuggest';
import { eventBus } from './event/EventBus';
import { OFFLINE_DICT } from './data/static_data';
import { appendContextNote } from './generator/contextNote';

/**
 * Obsidian English Learner 插件主类
 */
export default class EnglishLearnerPlugin extends Plugin {
    /** 影子词库管理器实例 */
    public vocabManager!: VocabularyManager;

    /** 发音评测标准（美音/英音） */
    public evaluationAccent: 'US' | 'UK' = 'US';

    /** AI 服务配置 */
    public settings = {
        aiApiKey: '',
        aiBaseUrl: 'https://api.deepseek.com/v1',
        aiModel: 'deepseek-chat'
    };

    /** 音频服务（用于 TTS 播放） */
    public audioService: any = null;

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

        // 注册单词输入联想建议器
        this.registerEditorSuggest(new WordSuggest(this.app, this));

        // 添加侧边栏功能功能入口 Ribbon 图标
        this.addRibbonIcon('book-open', '打开语言学习助手', () => {
            this.activateView();
        });

        // 注册全局快捷命令：分析选中的句子/文本
        this.addCommand({
            id: 'analyze-selection',
            name: '分析当前选中的句子/文本',
            callback: () => {
                const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
                const selection = activeView?.editor?.getSelection();
                if (selection && selection.trim()) {
                    this.activateView();
                    // 稍作延迟以确保 Vue 组件挂载完成并监听了事件，然后广播
                    setTimeout(() => {
                        eventBus.emit('lang-learner:analyze-sentence', selection.trim());
                    }, 200);
                } else {
                    new Notice('请先在文档中选中一段英文文本');
                }
            }
        });

        // 注册全局快捷命令：切换发音评测标准（美音/英音）
        this.addCommand({
            id: 'toggle-pronunciation-accent',
            name: '切换发音评测标准（美音/英音）',
            callback: () => {
                this.evaluationAccent = this.evaluationAccent === 'US' ? 'UK' : 'US';
                const accentName = this.evaluationAccent === 'US' ? '美式发音' : '英式发音';
                new Notice(`发音评测标准已切换为：${accentName}`);
                eventBus.emit('lang-learner:accent-changed', this.evaluationAccent);
            }
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

        // 监听单词点击/选中事件：自动激活侧边栏，确保用户能立即看到单词详情
        // 注意：不能在此 re-emit word-selected，否则会形成无限循环
        // Panel.vue 内部的 handleWordSelected 已经通过 eventBus.on 直接监听了 word-selected
        // 此处只需确保侧边栏可见即可
        eventBus.on('lang-learner:word-selected', (_word: string) => {
            this.activateView();
        });

        // 监听打开笔记事件：若打开的是生词卡片（位于 LangLearner/Cards 目录下），自动同步选中详情展示
        this.registerEvent(
            this.app.workspace.on('file-open', (file) => {
                if (file && file.path.startsWith('LangLearner/Cards/')) {
                    const word = file.basename.toLowerCase().trim();
                    if (word) {
                        eventBus.emit('lang-learner:word-selected', word);
                    }
                }
            })
        );

        // 监听全局编辑器/双击事件：双击单词时提取单词并触发选中展示
        this.registerDomEvent(document, 'dblclick', (evt: MouseEvent) => {
            const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (activeView && activeView.editor) {
                const editor = activeView.editor;
                const selection = editor.getSelection().trim();
                if (selection) {
                    // 如果选中的字串仅包含英文字符、连字符或撇号
                    if (/^[a-zA-Z\s\-'\.]+$/.test(selection)) {
                        const cleanWord = selection.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/gi, '');
                        if (cleanWord) {
                            eventBus.emit('lang-learner:word-selected', cleanWord);
                        }
                    }
                }
            }
        });

        // 监听批量标熟事件：F5 估算完成或 F8 一键学完后，触发全页重渲染
        eventBus.on('lang-learner:batch-known', (_count: number) => {
            // 通知 Obsidian 触发布局变更，让 MarkdownPostProcessor 对可见文档重新渲染
            this.app.workspace.trigger('layout-change');
        });

        // 注册 obsidian://lang-learner-media 协议处理器，用于支持“视频戳笔记”跳转播放
        this.registerObsidianProtocolHandler('lang-learner-media', (params) => {
            const url = params.url;
            const path = params.path;
            const t = parseFloat(params.t || '0');
            const target = url || path;
            if (target) {
                this.activateView();
                // 延迟广播以确保 Vue 实例激活
                setTimeout(() => {
                    eventBus.emit('lang-learner:play-media', target, t);
                }, 300);
            }
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