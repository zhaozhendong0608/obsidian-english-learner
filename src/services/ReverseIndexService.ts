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
        // 存储衍生出英文词的翻译映射 (英文词 -> 中文释义)
        const derivedTranslations = new Map<string, string>();
        // 存储衍生出英文词的学习状态映射 (英文词 -> 状态)
        const derivedStatus = new Map<string, WordStatus>();

        // 1. 优先扫描用户内存影子生词本的中文释义进行逆向匹配
        const userEntries = this.vocabularyManager.getAllEntries();
        userEntries.forEach((info, word) => {
            // 情况 A: 正常的英文生词 (如 word="grasp", trans="掌握")
            if (info.trans) {
                for (const chineseWord of chineseWords) {
                    if (info.trans.includes(chineseWord)) {
                        // 确保 word 是纯英文单词/短语才直接加入
                        if (!/[一-龥]/.test(word)) {
                            lemmaSet.add(word);
                        }
                        break;
                    }
                }
            }

            // 情况 B: 奇特的中文词作为键的生词 (如 word="掌握", trans="grasp; master")
            // 此时我们需要提取其 trans 或 phrases 中的英文单词，并以该中文词作为翻译关联
            if (/[一-龥]/.test(word)) {
                for (const chineseWord of chineseWords) {
                    if (word.includes(chineseWord)) {
                        const bestTrans = word; // 中文键本身就是其推荐出来的英文单词的翻译

                        // 从 trans 中提取英文单词或短语
                        if (info.trans) {
                            const englishMatches = info.trans.match(/[a-zA-Z]+(-[a-zA-Z]+)*(\s+[a-zA-Z]+)*/g) || [];
                            englishMatches.forEach(eng => {
                                const cleanEng = eng.trim().toLowerCase();
                                if (cleanEng && cleanEng.length >= 2) {
                                    lemmaSet.add(cleanEng);
                                    derivedTranslations.set(cleanEng, bestTrans);
                                    derivedStatus.set(cleanEng, info.status);
                                }
                            });
                        }
                        // 从 phrases 中提取英文短语
                        if (info.phrases) {
                            info.phrases.forEach(phrase => {
                                const cleanPhrase = phrase.trim().toLowerCase();
                                if (cleanPhrase && cleanPhrase.length >= 2) {
                                    lemmaSet.add(cleanPhrase);
                                    derivedTranslations.set(cleanPhrase, bestTrans);
                                    derivedStatus.set(cleanPhrase, info.status);
                                }
                            });
                        }
                        break;
                    }
                }
            }
        });

        // 2. 扫描内置的静态反向索引进行映射匹配
        for (const chineseWord of chineseWords) {
            const lemmas = REVERSE_INDEX[chineseWord];
            if (lemmas) {
                lemmas.forEach(lemma => lemmaSet.add(lemma));
            }
        }

        // 构建候选词列表
        const candidates: ReverseSearchCandidate[] = [];
        for (const lemma of lemmaSet) {
            // 优先获取影子生词库里的数据
            const vocabInfo = this.vocabularyManager.getInfo(lemma);
            const status: WordStatus = vocabInfo ? vocabInfo.status : (derivedStatus.get(lemma) || 'UNKNOWN');

            let translation = vocabInfo?.trans || '';
            let phonetic = vocabInfo?.phonetic || '';

            // 如果影子库里没有，查内置离线词典兜底
            if (!translation) {
                const dictEntry = OFFLINE_DICT[lemma];
                if (dictEntry) {
                    translation = dictEntry.trans;
                    phonetic = dictEntry.phonetic || '';
                }
            }

            // 如果依然没有，使用我们从中文生词衍生出的翻译关联
            if (!translation) {
                translation = derivedTranslations.get(lemma) || '';
            }

            // 没有有效翻译的单词条目予以跳过
            if (!translation) {
                continue;
            }

            candidates.push({
                lemma,
                translation,
                phonetic,
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
