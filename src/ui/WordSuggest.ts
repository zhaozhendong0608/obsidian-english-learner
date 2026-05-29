import { App, Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, TFile } from 'obsidian';
import { HIGH_FREQUENCY_WORDS, OFFLINE_DICT, REVERSE_INDEX } from '../data/static_data';
import type EnglishLearnerPlugin from '../main';
import type { WordInfo, SuggestionMapping } from '../types';
import { generateSuggestionMapping, querySuggestionMapping } from '../utils/suggestionMapping';
import { ReverseIndexService } from '../services/ReverseIndexService';

/**
 * 单词输入补全建议器（支持主动催化伴写 + 中译英写作联想）
 */
export class WordSuggest extends EditorSuggest<string> {
    private plugin: EnglishLearnerPlugin;
    private suggestionMappingTable: Map<string, SuggestionMapping[]> = new Map();
    private lastMappingUpdateTime: number = 0;
    private readonly MAPPING_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 分钟更新一次映射表
    private readonly CHINESE_PREFIX = '::'; // 中译英联想前缀
    private reverseIndexService: ReverseIndexService;

    constructor(app: App, plugin: EnglishLearnerPlugin) {
        super(app);
        this.plugin = plugin;
        // 限制最多显示 8 个建议
        this.limit = 8;

        // 初始化时生成倒排映射表
        this.updateSuggestionMapping();
        this.reverseIndexService = new ReverseIndexService(this.plugin.vocabManager);
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

        console.log('[WordSuggest] onTrigger called - textBefore:', JSON.stringify(textBefore), 'length:', textBefore.length);

        // 输出每个字符的编码（仅用于调试）
        if (textBefore.length <= 10) {
            for (let i = 0; i < textBefore.length; i++) {
                console.log(`  Char ${i}: "${textBefore[i]}" Code: 0x${textBefore.charCodeAt(i).toString(16)}`);
            }
        }

        // 模式 1: 中译英写作联想 (仅通过前缀 ::, :n, ~n 触发，防范中文日常写作污染)
        // 使用 Unicode 属性 \p{Unified_Ideograph} 支持所有 CJK 汉字，且允许前缀后有 0 个或多个汉字 (实现空查询支持)
        const chineseMatch = textBefore.match(/(::|:n|~n)([\p{Unified_Ideograph}]*)$/u);

        console.log('[WordSuggest] chineseMatch:', chineseMatch);

        if (chineseMatch) {
            const chineseQuery = chineseMatch[2];
            const prefixStartCh = cursor.ch - chineseMatch[0].length;

            console.log('[WordSuggest] ✅ 中译英模式触发 - chineseQuery:', chineseQuery);

            return {
                start: { line: cursor.line, ch: prefixStartCh },
                end: cursor,
                query: `${this.CHINESE_PREFIX}${chineseQuery}` // 保留前缀标记
            };
        }

        // 模式 2: 英文单词联想 (纯英文前缀，长度至少为 2)
        const englishMatch = textBefore.match(/[a-zA-Z]{2,}$/);
        if (!englishMatch) {
            console.log('[WordSuggest] ❌ 未匹配任何模式');
            return null;
        }

        const query = englishMatch[0];
        const wordStartCh = cursor.ch - query.length;

        // 避免干扰中译英输入拼音时的英文联想 (如 ::zhang 期间不触发英文联想)
        if (wordStartCh >= 2) {
            const preStr = textBefore.substring(0, wordStartCh);
            if (preStr.endsWith('::') || preStr.endsWith(':n') || preStr.endsWith('~n')) {
                console.log('[WordSuggest] ❌ 检测到中译英前缀，忽略拼音过程的英文联想');
                return null;
            }
        }

        // 避免干扰 Markdown 的其他语法，如链接 [[word]] 或标签 #word
        if (wordStartCh > 0) {
            const charBefore = textBefore.charAt(wordStartCh - 1);
            if (charBefore === '#' || charBefore === '[' || charBefore === '@' || charBefore === '^' || charBefore === '/') {
                console.log('[WordSuggest] ❌ 被 Markdown 语法拦截');
                return null;
            }
        }

        console.log('[WordSuggest] ✅ 英文模式触发 - query:', query);

        return {
            start: { line: cursor.line, ch: wordStartCh },
            end: cursor,
            query: query
        };
    }

    /**
     * 检索匹配的单词建议（支持主动催化伴写 + 中译英写作联想）
     */
    getSuggestions(context: EditorSuggestContext): string[] | Promise<string[]> {
        const query = context.query.trim();
        if (!query) {
            return [];
        }

        // 检测是否为中译英写作联想模式
        if (query.startsWith(this.CHINESE_PREFIX)) {
            const chineseQuery = query.substring(this.CHINESE_PREFIX.length);
            return this.getChineseToEnglishSuggestions(chineseQuery);
        }

        // 英文单词联想模式
        return this.getEnglishWordSuggestions(query.toLowerCase());
    }

    /**
     * 当中译英前缀输入为空时，智能推荐当前亟需复习的生词
     */
    private getEmptyQuerySuggestions(): string[] {
        const vocabManager = this.plugin.vocabManager;
        const entries = vocabManager.getAllEntries();
        const learningWords: Array<{ word: string; priority: number }> = [];
        const now = Date.now();

        entries.forEach((info, word) => {
            if (info.status === 'LEARNING') {
                let score = 0;
                if (info.nextReview) {
                    if (info.nextReview <= now) {
                        // 已过期，逾期时间越长，紧迫度分值越高
                        score = 1000 + (now - info.nextReview) / (1000 * 60);
                    } else {
                        // 未过期，距离现在越近，紧迫度分值越高
                        score = 500 - (info.nextReview - now) / (1000 * 60);
                    }
                } else {
                    score = 100;
                }
                learningWords.push({ word, priority: score });
            }
        });

        // 优先推荐紧迫度高的，相同紧迫度按字母表排序
        learningWords.sort((a, b) => {
            if (a.priority !== b.priority) {
                return b.priority - a.priority;
            }
            return a.word.localeCompare(b.word);
        });

        return learningWords.slice(0, this.limit).map(item => item.word);
    }

    /**
     * 中译英写作联想：复用 ReverseIndexService 进行高效排序过滤
     */
    private getChineseToEnglishSuggestions(chineseQuery: string): string[] {
        if (!chineseQuery) {
            return this.getEmptyQuerySuggestions();
        }

        // 直接复用 ReverseIndexService 的检索排序逻辑，避免全表模糊遍历卡顿
        const candidates = this.reverseIndexService.search(chineseQuery);
        return candidates.slice(0, this.limit).map(c => c.lemma);
    }

    /**
     * 英文单词联想：原有逻辑
     */
    private getEnglishWordSuggestions(query: string): string[] {
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
     * 渲染建议选项的 HTML（支持临界生词高亮 + 中译英标记）
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

        // 检测是否为中译英联想模式（通过 context.query 判断）
        const isChineseMode = this.context?.query?.startsWith(this.CHINESE_PREFIX) || false;

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

        // 中译英联想标签（最高优先级）
        if (isChineseMode) {
            if (isCriticalWord) {
                const tag = topRow.createSpan({ cls: 'lang-learner-suggest-tag suggest-tag-critical', text: '🔥 临界复习' });
                tag.style.fontSize = '0.75em';
                tag.style.padding = '2px 4px';
                tag.style.borderRadius = '3px';
                tag.style.backgroundColor = 'rgba(255, 87, 34, 0.15)';
                tag.style.color = 'var(--text-accent, #ff5722)';
                tag.style.fontWeight = '600';
            } else {
                const tag = topRow.createSpan({ cls: 'lang-learner-suggest-tag suggest-tag-chinese', text: '🌐 中译英' });
                tag.style.fontSize = '0.75em';
                tag.style.padding = '2px 4px';
                tag.style.borderRadius = '3px';
                tag.style.backgroundColor = 'rgba(52, 152, 219, 0.15)';
                tag.style.color = 'var(--text-accent, #3498db)';
                tag.style.fontWeight = '600';
            }
        }
        // 临界复习生词标签
        else if (isCriticalWord) {
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
