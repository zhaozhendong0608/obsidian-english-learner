import { REVERSE_INDEX, OFFLINE_DICT, HIGH_FREQUENCY_WORDS } from '../data/static_data';
import type { ReverseSearchCandidate, WordStatus } from '../types';
import type { VocabularyManager } from '../db/vocabulary';

/**
 * 中译英反向检索服务
 * 负责根据中文输入查找对应的英文单词候选
 */
export class ReverseIndexService {
    private vocabularyManager: VocabularyManager;
    private highFreqSet: Set<string>;

    constructor(vocabularyManager: VocabularyManager) {
        this.vocabularyManager = vocabularyManager;
        this.highFreqSet = new Set(HIGH_FREQUENCY_WORDS);
    }

    /**
     * 检测输入是否包含中文字符
     */
    public containsChinese(text: string): boolean {
        return /[一-龥]/.test(text);
    }

    /**
     * 根据中文输入查找英文候选词
     * @param chineseInput 中文输入（可以是单个词或多个词）
     * @returns 候选词列表，按优先级排序
     */
    public search(chineseInput: string): ReverseSearchCandidate[] {
        const trimmed = chineseInput.trim();
        if (!trimmed || !this.containsChinese(trimmed)) {
            return [];
        }

        // 提取所有中文词汇
        const chineseWords = trimmed.match(/[一-龥]+/g) || [];
        if (chineseWords.length === 0) {
            return [];
        }

        // 收集所有匹配的英文单词（去重）
        const lemmaSet = new Set<string>();
        for (const chineseWord of chineseWords) {
            const lemmas = REVERSE_INDEX[chineseWord];
            if (lemmas) {
                lemmas.forEach(lemma => lemmaSet.add(lemma));
            }
        }

        // 构建候选词列表
        const candidates: ReverseSearchCandidate[] = [];
        for (const lemma of lemmaSet) {
            const dictEntry = OFFLINE_DICT[lemma];
            if (!dictEntry) continue;

            // 获取用户词库中的状态
            const status: WordStatus = this.vocabularyManager.get(lemma);

            candidates.push({
                lemma,
                translation: dictEntry.trans,
                phonetic: dictEntry.phonetic,
                status,
                isHighFrequency: this.highFreqSet.has(lemma)
            });
        }

        // 排序优先级：
        // 1. 学习中 (LEARNING) 优先
        // 2. 生词 (UNKNOWN) 次之
        // 3. 已掌握 (KNOWN) 最后
        // 4. 同状态下，高频词优先
        candidates.sort((a, b) => {
            const statusPriority = { 'LEARNING': 0, 'UNKNOWN': 1, 'KNOWN': 2 };
            const priorityA = statusPriority[a.status];
            const priorityB = statusPriority[b.status];

            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }

            // 同状态下，高频词优先
            if (a.isHighFrequency !== b.isHighFrequency) {
                return a.isHighFrequency ? -1 : 1;
            }

            // 最后按字母顺序
            return a.lemma.localeCompare(b.lemma);
        });

        return candidates;
    }

    /**
     * 获取反向索引统计信息
     */
    public getStats() {
        return {
            totalChineseWords: Object.keys(REVERSE_INDEX).length,
            totalEnglishWords: Object.keys(OFFLINE_DICT).length
        };
    }
}
