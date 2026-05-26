import { App, Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, TFile } from 'obsidian';
import { HIGH_FREQUENCY_WORDS, OFFLINE_DICT } from '../data/static_data';
import type EnglishLearnerPlugin from '../main';
import type { WordInfo, SuggestionMapping } from '../types';
import { generateSuggestionMapping, querySuggestionMapping } from '../utils/suggestionMapping';

/**
 * 单词输入补全建议器（支持主动催化伴写）
 */
export class WordSuggest extends EditorSuggest<string> {
    private plugin: EnglishLearnerPlugin;
    private suggestionMappingTable: Map<string, SuggestionMapping[]> = new Map();
    private lastMappingUpdateTime: number = 0;
    private readonly MAPPING_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 分钟更新一次映射表

    constructor(app: App, plugin: EnglishLearnerPlugin) {
        super(app);
        this.plugin = plugin;
        // 限制最多显示 8 个建议
        this.limit = 8;

        // 初始化时生成倒排映射表
        this.updateSuggestionMapping();
    }

    /**
     * 更新临界复习生词倒排映射表
     */
    private updateSuggestionMapping(): void {
        const now = Date.now();

        // 避免频繁更新，最多 5 分钟更新一次
        if (now - this.lastMappingUpdateTime < this.MAPPING_UPDATE_INTERVAL) {
            return;
        }

        try {
            this.suggestionMappingTable = generateSuggestionMapping(this.plugin.vocabManager);
            this.lastMappingUpdateTime = now;
            console.log('[WordSuggest] 倒排映射表已更新');
        } catch (error) {
            console.error('[WordSuggest] 映射表更新失败:', error);
        }
    }

    /**
     * 拦截编辑器输入并触发联想提示
     */
    onTrigger(cursor: EditorPosition, editor: Editor, file: TFile): EditorSuggestTriggerInfo | null {
        // 获取当前行光标前的文本
        const line = editor.getLine(cursor.line);
        const textBefore = line.substring(0, cursor.ch);

        // 提取光标前紧挨着的纯英文字符前缀 (长度至少为 2，避免单个字母频繁联想干扰打字)
        const match = textBefore.match(/[a-zA-Z]{2,}$/);
        if (!match) {
            return null;
        }

        const query = match[0];
        const wordStartCh = cursor.ch - query.length;

        // 避免干扰 Markdown 的其他语法，如链接 [[word]] 或标签 #word
        if (wordStartCh > 0) {
            const charBefore = textBefore.charAt(wordStartCh - 1);
            if (charBefore === '#' || charBefore === '[' || charBefore === '@' || charBefore === '^' || charBefore === '/') {
                return null;
            }
        }

        return {
            start: { line: cursor.line, ch: wordStartCh },
            end: cursor,
            query: query
        };
    }

    /**
     * 检索匹配的单词建议（支持主动催化伴写）
     */
    getSuggestions(context: EditorSuggestContext): string[] | Promise<string[]> {
        const query = context.query.toLowerCase().trim();
        if (!query) {
            return [];
        }

        // 定期更新映射表
        this.updateSuggestionMapping();

        const vocabManager = this.plugin.vocabManager;
        const entries = vocabManager.getAllEntries();

        // 建立三个优先级的匹配队列
        const criticalMatches: string[] = []; // 临界复习生词（最高优先级）
        const unknownMatches: string[] = [];
        const learningMatches: string[] = [];
        const otherMatches: string[] = [];
        const matchedSet = new Set<string>();

        // 0. 主动催化伴写：检查是否输入了常用词，推荐临界复习生词
        const criticalSuggestions = querySuggestionMapping(this.suggestionMappingTable, query);
        if (criticalSuggestions.length > 0) {
            // 将临界生词加入最高优先级队列
            criticalSuggestions.forEach(mapping => {
                if (!matchedSet.has(mapping.targetWord)) {
                    matchedSet.add(mapping.targetWord);
                    criticalMatches.push(mapping.targetWord);
                }
            });
        }

        // 1. 扫描本地影子词库 (生词 UNKNOWN & 学习中 LEARNING)
        entries.forEach((info, wordKey) => {
            if (wordKey.startsWith(query) && !matchedSet.has(wordKey)) {
                matchedSet.add(wordKey);
                if (info.status === 'UNKNOWN') {
                    unknownMatches.push(wordKey);
                } else if (info.status === 'LEARNING') {
                    learningMatches.push(wordKey);
                } else {
                    otherMatches.push(wordKey);
                }
            }
        });

        // 2. 扫描高频词表 (补充兜底)
        for (const word of HIGH_FREQUENCY_WORDS) {
            const lowerWord = word.toLowerCase();
            if (lowerWord.startsWith(query) && !matchedSet.has(lowerWord)) {
                matchedSet.add(lowerWord);
                otherMatches.push(lowerWord);
            }
        }

        // 排序规则: 每个类别内按字符长度升序 (优先展示短单词)，再按字母表排序
        const sortFunc = (a: string, b: string) => {
            if (a.length !== b.length) {
                return a.length - b.length;
            }
            return a.localeCompare(b);
        };

        criticalMatches.sort(sortFunc);
        unknownMatches.sort(sortFunc);
        learningMatches.sort(sortFunc);
        otherMatches.sort(sortFunc);

        // 合并建议并截取 limit 个结果（临界生词优先）
        const allSuggestions = [
            ...criticalMatches,
            ...unknownMatches,
            ...learningMatches,
            ...otherMatches
        ];

        return allSuggestions.slice(0, this.limit);
    }

    /**
     * 渲染建议选项的 HTML（支持临界生词高亮）
     */
    renderSuggestion(word: string, el: HTMLElement): void {
        el.addClass('lang-learner-suggest-item');
        el.style.display = 'flex';
        el.style.flexDirection = 'column';
        el.style.gap = '2px';
        el.style.padding = '6px 8px';

        // 获取释义与音标
        const vocabManager = this.plugin.vocabManager;
        const info = vocabManager.getInfo(word);
        let trans = info?.trans || '';
        let phonetic = info?.phonetic || '';
        let status = info?.status;

        // 如果影子词库没有，查离线字典兜底
        if (!trans) {
            const dictEntry = OFFLINE_DICT[word];
            if (dictEntry) {
                trans = dictEntry.trans;
                phonetic = dictEntry.phonetic || '';
            }
        }

        // 检查是否为临界复习生词（用于特殊标记）
        const isCriticalWord = this.isCriticalReviewWord(word);

        // 限制翻译文本长度，保持下拉菜单整洁
        if (trans && trans.length > 50) {
            trans = trans.substring(0, 48) + '...';
        }

        // 第一行: 单词 + 音标 + 状态标签
        const topRow = el.createDiv({ cls: 'lang-learner-suggest-top-row' });
        topRow.style.display = 'flex';
        topRow.style.alignItems = 'center';
        topRow.style.justifyContent = 'space-between';

        const leftBox = topRow.createDiv();
        leftBox.style.display = 'flex';
        leftBox.style.alignItems = 'center';
        leftBox.style.gap = '6px';

        const wordSpan = leftBox.createSpan({ cls: 'lang-learner-suggest-word', text: word });
        wordSpan.style.fontWeight = 'bold';
        wordSpan.style.color = 'var(--text-normal)';

        if (phonetic) {
            const phoneticSpan = leftBox.createSpan({ cls: 'lang-learner-suggest-phonetic', text: `/${phonetic}/` });
            phoneticSpan.style.fontSize = '0.85em';
            phoneticSpan.style.color = 'var(--text-muted)';
        }

        // 临界复习生词标签（最高优先级）
        if (isCriticalWord) {
            const tag = topRow.createSpan({ cls: 'lang-learner-suggest-tag suggest-tag-critical', text: '🔥 临界复习' });
            tag.style.fontSize = '0.75em';
            tag.style.padding = '2px 4px';
            tag.style.borderRadius = '3px';
            tag.style.backgroundColor = 'rgba(255, 87, 34, 0.15)';
            tag.style.color = 'var(--text-accent, #ff5722)';
            tag.style.fontWeight = '600';
        }
        // 状态标签
        else if (status === 'UNKNOWN') {
            const tag = topRow.createSpan({ cls: 'lang-learner-suggest-tag suggest-tag-unknown', text: '📌 生词' });
            tag.style.fontSize = '0.75em';
            tag.style.padding = '2px 4px';
            tag.style.borderRadius = '3px';
            tag.style.backgroundColor = 'rgba(231, 76, 60, 0.15)';
            tag.style.color = 'var(--text-error, #e74c3c)';
        } else if (status === 'LEARNING') {
            const tag = topRow.createSpan({ cls: 'lang-learner-suggest-tag suggest-tag-learning', text: '⚡ 学习中' });
            tag.style.fontSize = '0.75em';
            tag.style.padding = '2px 4px';
            tag.style.borderRadius = '3px';
            tag.style.backgroundColor = 'rgba(241, 196, 15, 0.15)';
            tag.style.color = 'var(--text-warning, #f1c40f)';
        } else if (status === 'KNOWN') {
            const tag = topRow.createSpan({ cls: 'lang-learner-suggest-tag suggest-tag-known', text: '✅ 已掌握' });
            tag.style.fontSize = '0.75em';
            tag.style.padding = '2px 4px';
            tag.style.borderRadius = '3px';
            tag.style.backgroundColor = 'rgba(46, 204, 113, 0.15)';
            tag.style.color = 'var(--text-success, #2ecc71)';
        }

        // 第二行: 释义
        if (trans) {
            const bottomRow = el.createDiv({ cls: 'lang-learner-suggest-bottom-row' });
            bottomRow.style.fontSize = '0.85em';
            bottomRow.style.color = 'var(--text-muted)';
            bottomRow.style.whiteSpace = 'nowrap';
            bottomRow.style.overflow = 'hidden';
            bottomRow.style.textOverflow = 'ellipsis';
            bottomRow.setText(trans.replace(/\n/g, ' '));
        }
    }

    /**
     * 检查单词是否为临界复习生词
     */
    private isCriticalReviewWord(word: string): boolean {
        const info = this.plugin.vocabManager.getInfo(word);
        if (!info || info.status !== 'LEARNING') {
            return false;
        }

        if (!info.nextReview || !info.repetitions) {
            return false;
        }

        const now = Date.now();
        const daysUntilReview = (info.nextReview - now) / (1000 * 60 * 60 * 24);

        // 临界条件：复习次数 <= 3 且距离下次复习 <= 2 天
        return info.repetitions <= 3 && daysUntilReview <= 2;
    }

    /**
     * 选择建议项后插入到编辑器
     */
    selectSuggestion(word: string, evt: MouseEvent | KeyboardEvent): void {
        const { context } = this;
        if (!context) {
            return;
        }

        const editor = context.editor;
        
        // 用选中的单词替换原有的前缀，并附加一个空格，方便直接输入下一个单词
        editor.replaceRange(word + ' ', context.start, context.end);
        
        // 自动将光标移至插入词及空格之后
        const newCursorCh = context.start.ch + word.length + 1;
        editor.setCursor({ line: context.start.line, ch: newCursorCh });
    }
}
