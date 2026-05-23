import { LemmatizerResult } from '../types';
import { HIGH_FREQUENCY_WORDS, IRREGULAR_MAP } from '../data/static_data';

// 使用 Set 提高高频白名单查找的响应速度 (O(1) 复杂度)
const wordSet = new Set<string>(HIGH_FREQUENCY_WORDS);

/**
 * 判断字符串是否以双写辅音字母结尾
 */
function isDoubleConsonant(str: string): boolean {
    if (str.length < 2) return false;
    const last = str[str.length - 1];
    const prev = str[str.length - 2];
    if (last !== prev) return false;
    return 'bdfglmnprstvz'.includes(last);
}

/**
 * 内部还原逻辑 (不带拼写重定向)
 * 用于判断普通单词或重定向后的单词是否能找到原型
 */
function innerLemmatize(word: string): string | null {
    // 1. 不规则对照表直接查找
    if (IRREGULAR_MAP[word]) {
        return IRREGULAR_MAP[word];
    }

    const len = word.length;

    // 2. 规则形态逆推
    // A. 动词进行时 (-ing 结尾，至少 5 字符如 doing)
    if (word.endsWith('ing') && len > 4) {
        const base = word.slice(0, -3);
        // 规则 1: studying -> study
        if (wordSet.has(base)) return base;
        // 规则 2: loving -> love
        const baseWithE = base + 'e';
        if (wordSet.has(baseWithE)) return baseWithE;
        // 规则 3: running -> run (双写辅音还原)
        if (isDoubleConsonant(base)) {
            const singleBase = base.slice(0, -1);
            if (wordSet.has(singleBase)) return singleBase;
        }
    }

    // B. 动词过去式/过去分词 (-ed 结尾，至少 4 字符如 used)
    if (word.endsWith('ed') && len > 3) {
        const base = word.slice(0, -2);
        // 规则 1: started -> start
        if (wordSet.has(base)) return base;
        // 规则 2: carried -> carry (变 y 为 i 加 ed)
        if (word.endsWith('ied') && len > 4) {
            const yBase = word.slice(0, -3) + 'y';
            if (wordSet.has(yBase)) return yBase;
        }
        // 规则 3: stopped -> stop (双写辅音还原)
        if (isDoubleConsonant(base)) {
            const singleBase = base.slice(0, -1);
            if (wordSet.has(singleBase)) return singleBase;
        }
        // 规则 4: loved -> love (只需去掉 d)
        if (word.endsWith('d')) {
            const dBase = word.slice(0, -1);
            if (wordSet.has(dBase)) return dBase;
        }
    }

    // C. 复数或单三 (-s 结尾，至少 3 字符如 cats)
    if (word.endsWith('s') && len > 2) {
        // 规则 1: flies -> fly (变 y 为 i 加 es)
        if (word.endsWith('ies') && len > 4) {
            const yBase = word.slice(0, -3) + 'y';
            if (wordSet.has(yBase)) return yBase;
        }
        // 规则 2: boxes -> box
        if (word.endsWith('es') && len > 3) {
            const base = word.slice(0, -2);
            if (wordSet.has(base)) return base;
        }
        // 规则 3: cats -> cat
        const base = word.slice(0, -1);
        if (wordSet.has(base)) return base;
    }

    // D. 比较级/最高级 (-er 或 -est 结尾，至少 4 字符)
    if (word.endsWith('est') && len > 4) {
        const base = word.slice(0, -3);
        if (wordSet.has(base)) return base;
        const baseWithE = base + 'e';
        if (wordSet.has(baseWithE)) return baseWithE;
        if (word.endsWith('iest') && len > 5) {
            const yBase = word.slice(0, -4) + 'y';
            if (wordSet.has(yBase)) return yBase;
        }
    }
    if (word.endsWith('er') && len > 3) {
        const base = word.slice(0, -2);
        if (wordSet.has(base)) return base;
        const baseWithE = base + 'e';
        if (wordSet.has(baseWithE)) return baseWithE;
        if (word.endsWith('ier') && len > 4) {
            const yBase = word.slice(0, -3) + 'y';
            if (wordSet.has(yBase)) return yBase;
        }
    }

    // 3. 高频词白名单判断 (形态规则均无法还原出其他高频词时，如果单词本身已是高频词原型，则直接返回其自身)
    if (wordSet.has(word)) {
        return word;
    }

    return null;
}

/**
 * 尝试对英美音及拼写进行转换重定向
 */
function redirectSpelling(word: string): string | null {
    let temp = word;
    let changed = false;

    // 1. -our -> -or (colour -> color)
    if (temp.endsWith('our') && temp.length > 3) {
        temp = temp.slice(0, -3) + 'or';
        changed = true;
    }
    // 2. -yse -> -yze (analyse -> analyze)
    else if (temp.endsWith('yse') && temp.length > 3) {
        temp = temp.slice(0, -3) + 'yze';
        changed = true;
    }
    // 3. -ise -> -ize (organise -> organize)
    else if (temp.endsWith('ise') && temp.length > 3) {
        temp = temp.slice(0, -3) + 'ize';
        changed = true;
    }
    // 4. -re -> -er (centre -> center)
    else if (temp.endsWith('re') && temp.length > 3 && 'bdfgklmnprstz'.includes(temp[temp.length - 3])) {
        temp = temp.slice(0, -2) + 'er';
        changed = true;
    }

    // 5. 英式双写 l 转换为美式单写 l (travelling -> traveling)
    if (temp.endsWith('lling') && temp.length > 5) {
        temp = temp.slice(0, -5) + 'ling';
        changed = true;
    } else if (temp.endsWith('lled') && temp.length > 4) {
        temp = temp.slice(0, -4) + 'led';
        changed = true;
    }

    return changed ? temp : null;
}

/**
 * 单词原型还原核心函数 (Lemmatizer)
 * @param word 待还原的单词
 * @returns 还原后的原型信息
 */
export function lemmatize(word: string): LemmatizerResult {
    if (!word) {
        return { lemma: '', redirected: false };
    }

    const cleanWord = word.trim().toLowerCase();

    // 1. 优先尝试重定向拼写 (英美音/拼写差异规整)
    const redirectedWord = redirectSpelling(cleanWord);
    if (redirectedWord) {
        const redirectedLemma = innerLemmatize(redirectedWord);
        if (redirectedLemma) {
            return { lemma: redirectedLemma, redirected: true };
        }
    }

    // 2. 正常尝试常规/规则还原
    const directLemma = innerLemmatize(cleanWord);
    if (directLemma) {
        return { lemma: directLemma, redirected: false };
    }

    // 3. 均未匹配，兜底返回自身
    return {
        lemma: cleanWord,
        redirected: false
    };
}

/**
 * 计算两个字符串的 Levenshtein 编辑距离
 */
export function getLevenshteinDistance(a: string, b: string): number {
    const distanceMatrix = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null));

    for (let i = 0; i <= a.length; i += 1) {
        distanceMatrix[i][0] = i;
    }

    for (let j = 0; j <= b.length; j += 1) {
        distanceMatrix[0][j] = j;
    }

    for (let i = 1; i <= a.length; i += 1) {
        for (let j = 1; j <= b.length; j += 1) {
            const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
            distanceMatrix[i][j] = Math.min(
                distanceMatrix[i - 1][j] + 1, // 删除
                distanceMatrix[i][j - 1] + 1, // 插入
                distanceMatrix[i - 1][j - 1] + indicator // 替换
            );
        }
    }

    return distanceMatrix[a.length][b.length];
}

/**
 * 高效判断两个字符串的编辑距离是否恰好为 1 (O(N) 时间，O(1) 空间，零内存分配)
 * 用于在海量词典模糊匹配时提供最高性能的过滤防线
 */
function isEditDistanceOne(a: string, b: string): boolean {
    const lenA = a.length;
    const lenB = b.length;
    if (Math.abs(lenA - lenB) > 1) return false;

    if (lenA > lenB) {
        return isEditDistanceOne(b, a);
    }

    let i = 0;
    let j = 0;
    let diff = 0;

    while (i < lenA && j < lenB) {
        if (a[i] !== b[j]) {
            diff++;
            if (diff > 1) return false;
            
            if (lenA === lenB) {
                i++;
                j++;
            } else {
                j++;
            }
        } else {
            i++;
            j++;
        }
    }

    if (j < lenB) {
        diff += (lenB - j);
    }

    return diff === 1;
}

/**
 * 获取拼写模糊容错推荐单词列表
 * @param word 错误/待查单词
 * @param dictKeys 用于检索匹配的词典列表
 * @returns 编辑距离为 1 的相近单词推荐列表 (最大限制为 5 个)
 */
export function getFuzzySuggestions(word: string, dictKeys: string[]): string[] {
    if (!word || word.length <= 2) {
        return [];
    }

    const cleanWord = word.trim().toLowerCase();
    const suggestions: string[] = [];
    const targetLen = cleanWord.length;

    for (const key of dictKeys) {
        // 性能过滤优化: 只有当长度差距在 1 以内才进行编辑距离计算
        if (Math.abs(key.length - targetLen) > 1) {
            continue;
        }

        if (key === cleanWord) {
            continue;
        }

        // 使用 O(N) 的高效判断方法替代原有的 Levenshtein 二维矩阵计算，建立性能防线
        if (isEditDistanceOne(cleanWord, key)) {
            suggestions.push(key);
            // 建议词数量封顶，防止内存暴增与页面排版卡顿
            if (suggestions.length >= 5) {
                break;
            }
        }
    }

    return suggestions;
}
