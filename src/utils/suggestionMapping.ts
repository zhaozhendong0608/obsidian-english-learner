/**
 * 临界复习生词倒排映射生成器
 * 用于主动催化伴写功能
 */

import type { VocabularyManager } from '../db/vocabulary';
import type { SuggestionMapping } from '../types';
import { OFFLINE_DICT } from '../data/static_data';

/**
 * 生成临界复习生词倒排映射表
 * @param vocabManager 词汇管理器
 * @returns 常用词 -> 临界生词的映射表
 */
export function generateSuggestionMapping(vocabManager: VocabularyManager): Map<string, SuggestionMapping[]> {
    const mappingTable = new Map<string, SuggestionMapping[]>();

    // 1. 提取临界复习生词（SM-2 阶段靠前且到期）
    const criticalWords = extractCriticalWords(vocabManager);

    if (criticalWords.length === 0) {
        console.log('[SuggestionMapping] 无临界复习生词，跳过映射生成');
        return mappingTable;
    }

    console.log(`[SuggestionMapping] 提取到 ${criticalWords.length} 个临界复习生词`);

    // 2. 为每个临界生词查找常用近义词
    for (const criticalWord of criticalWords) {
        const commonSynonyms = findCommonSynonyms(criticalWord.word);

        for (const synonym of commonSynonyms) {
            if (!mappingTable.has(synonym)) {
                mappingTable.set(synonym, []);
            }

            mappingTable.get(synonym)!.push({
                commonWord: synonym,
                targetWord: criticalWord.word,
                priority: criticalWord.priority,
                translation: criticalWord.translation
            });
        }
    }

    // 3. 按优先级排序每个常用词的建议列表
    for (const [commonWord, suggestions] of mappingTable.entries()) {
        suggestions.sort((a, b) => b.priority - a.priority);
    }

    console.log(`[SuggestionMapping] 生成映射表，覆盖 ${mappingTable.size} 个常用词`);

    return mappingTable;
}

/**
 * 提取临界复习生词
 * @param vocabManager 词汇管理器
 * @returns 临界生词列表（带优先级）
 */
function extractCriticalWords(vocabManager: VocabularyManager): Array<{
    word: string;
    priority: number;
    translation: string;
}> {
    const now = Date.now();
    const criticalWords: Array<{ word: string; priority: number; translation: string }> = [];

    const allEntries = vocabManager.getAllEntries();

    for (const [word, info] of allEntries) {
        // 只处理学习中的单词
        if (info.status !== 'LEARNING') continue;

        // 检查是否有 SM-2 数据
        if (!info.nextReview || !info.repetitions) continue;

        // 计算复习紧迫度
        const daysUntilReview = (info.nextReview - now) / (1000 * 60 * 60 * 24);

        // 临界条件：
        // 1. 复习次数 <= 3（记忆不牢固）
        // 2. 距离下次复习 <= 2 天（即将到期或已过期）
        if (info.repetitions <= 3 && daysUntilReview <= 2) {
            // 优先级计算：越接近到期时间，优先级越高
            const priority = Math.max(0, 100 - daysUntilReview * 10);

            criticalWords.push({
                word,
                priority,
                translation: info.trans || '暂无释义'
            });
        }
    }

    // 按优先级降序排序，最多返回 50 个
    criticalWords.sort((a, b) => b.priority - a.priority);
    return criticalWords.slice(0, 50);
}

/**
 * 查找常用近义词
 * @param targetWord 目标生词
 * @returns 常用近义词列表
 */
function findCommonSynonyms(targetWord: string): string[] {
    // 简化版：基于词义相似度的启发式匹配
    // 实际项目中可以使用更复杂的同义词词典或词向量相似度

    const synonymMap: Record<string, string[]> = {
        // 常见替换示例（可扩展）
        'reduce': ['mitigate', 'diminish', 'alleviate'],
        'important': ['crucial', 'vital', 'paramount'],
        'show': ['demonstrate', 'illustrate', 'manifest'],
        'use': ['utilize', 'employ', 'leverage'],
        'help': ['facilitate', 'assist', 'aid'],
        'make': ['create', 'generate', 'produce'],
        'get': ['obtain', 'acquire', 'procure'],
        'big': ['substantial', 'considerable', 'significant'],
        'small': ['minimal', 'negligible', 'trivial'],
        'good': ['beneficial', 'advantageous', 'favorable'],
        'bad': ['detrimental', 'adverse', 'unfavorable'],
        'think': ['contemplate', 'ponder', 'deliberate'],
        'say': ['articulate', 'express', 'convey'],
        'see': ['perceive', 'observe', 'discern'],
        'know': ['comprehend', 'understand', 'grasp']
    };

    // 反向查找：如果 targetWord 是某个常用词的同义词
    for (const [commonWord, synonyms] of Object.entries(synonymMap)) {
        if (synonyms.includes(targetWord)) {
            return [commonWord];
        }
    }

    // 如果没有找到，返回空数组
    return [];
}

/**
 * 查询倒排映射表
 * @param mappingTable 映射表
 * @param commonWord 用户输入的常用词
 * @returns 推荐的临界生词列表
 */
export function querySuggestionMapping(
    mappingTable: Map<string, SuggestionMapping[]>,
    commonWord: string
): SuggestionMapping[] {
    return mappingTable.get(commonWord.toLowerCase()) || [];
}
