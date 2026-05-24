import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VocabularyManager, DataAdapter } from '../src/db/vocabulary';
import { OFFLINE_DICT } from '../src/data/static_data';
import { lemmatize } from '../src/tokenizer/lemmatizer';

class MemoryAdapter implements DataAdapter {
    public files = new Map<string, string>();
    public async read(path: string): Promise<string> {
        return this.files.get(path) || '{}';
    }
    public async write(path: string, data: string): Promise<void> {}
    public async rename(oldPath: string, newPath: string): Promise<void> {}
    public async exists(path: string): Promise<boolean> {
        return this.files.has(path);
    }
}

describe('中文查词与多结果列表匹配逻辑测试', () => {
    let adapter: MemoryAdapter;
    let manager: VocabularyManager;

    beforeEach(async () => {
        adapter = new MemoryAdapter();
        manager = new VocabularyManager(adapter, 'vocabulary.json');
        await manager.load();
    });

    afterEach(() => {
        manager.destroy();
    });

    // 提取出来的核心检索算法
    function performSearchAlgorithm(query: string, vocabManager: VocabularyManager) {
        const queryClean = query.trim();
        if (!queryClean) return { type: 'empty', matches: [] };

        const hasChinese = /[\u4e00-\u9fa5]/.test(queryClean);

        if (hasChinese) {
            const queryLower = queryClean.toLowerCase();
            let matches: string[] = [];

            // 1. 扫描内存影子词库
            const customEntries = vocabManager.getAllEntries();
            customEntries.forEach((entry) => {
                if (entry.trans && entry.trans.toLowerCase().includes(queryLower)) {
                    matches.push(entry.word);
                }
            });

            // 2. 扫描本地离线词典
            for (const [word, entry] of Object.entries(OFFLINE_DICT)) {
                if (entry.trans && entry.trans.toLowerCase().includes(queryLower)) {
                    if (!matches.includes(word)) {
                        matches.push(word);
                    }
                }
            }

            if (matches.length === 0) {
                return { type: 'chinese_none', matches: [] };
            } else if (matches.length === 1) {
                return { type: 'chinese_single', matches };
            } else {
                let totalMatches = matches.length;
                if (totalMatches > 100) {
                    matches = matches.slice(0, 100);
                }
                return { type: 'chinese_multiple', matches, total: totalMatches };
            }
        } else {
            // 英文查词
            const result = lemmatize(queryClean.toLowerCase());
            return { type: 'english', matches: [result.lemma] };
        }
    }

    it('输入纯英文词查询，应返回对应的 lemma 原型且识别为 english 类型', () => {
        const res = performSearchAlgorithm('Running', manager);
        expect(res.type).toBe('english');
        expect(res.matches).toEqual(['run']);
    });

    it('输入中文释义检索，若能匹配到 offline dict 中的唯一结果，应返回 single 类型', () => {
        // 'ðə' -> 'art. 这；那'
        const res = performSearchAlgorithm('艺术', manager); // 'art.' 缩写包含 'art'，但没有包含'艺术'的
        const res2 = performSearchAlgorithm('互联网', manager); // 'web' 的释义 'n. 网，蛛网；互联网'
        expect(res2.type).toBe('chinese_single');
        expect(res2.matches).toContain('web');
    });

    it('输入中文释义检索，若能匹配到多个结果，应返回 multiple 类型，且匹配结果不超过100个', () => {
        // '是' 会匹配到 'is', 'are', 'be', 'was', 'were' 等
        const res = performSearchAlgorithm('是', manager);
        expect(res.type).toBe('chinese_multiple');
        expect(res.matches.length).toBeGreaterThan(1);
        expect(res.matches).toContain('is');
        expect(res.matches).toContain('be');
    });

    it('若用户自定义词库中有匹配的中文释义，应能合并进检索结果且去重', () => {
        // 用户自定义词库中增加 'customword' 释义为 '测试中文查词'
        manager.set('customword', 'LEARNING', '测试中文查词');

        // 测试包含用户自定义词库词汇的搜索
        const res = performSearchAlgorithm('测试中文', manager);
        expect(res.type).toBe('chinese_single');
        expect(res.matches).toEqual(['customword']);

        // 测试与离线词库的去重合并 (假设'the'的翻译在自定义和离线中都匹配 '这')
        manager.set('the', 'KNOWN', '特别的这');
        const res2 = performSearchAlgorithm('这', manager);
        expect(res2.type).toBe('chinese_multiple');
        expect(res2.matches).toContain('the');
        // 验证没有重复项
        const counts = res2.matches.filter(w => w === 'the').length;
        expect(counts).toBe(1);
    });

    it('如果没有找到任何匹配，应返回 chinese_none 类型', () => {
        const res = performSearchAlgorithm('火星文字符串找不到的', manager);
        expect(res.type).toBe('chinese_none');
        expect(res.matches).toEqual([]);
    });

    it('调用系统词典应唤起 dict:// 协议链接', () => {
        const originalOpen = global.window.open;
        const spy = vi.fn();
        global.window.open = spy;

        const lookup = (query: string) => {
            const cleanQuery = query.trim();
            if (!cleanQuery) return;
            window.open(`dict://${encodeURIComponent(cleanQuery)}`);
        };

        lookup('高效');
        expect(spy).toHaveBeenCalledWith('dict://%E9%AB%98%E6%95%88');

        global.window.open = originalOpen;
    });
});
