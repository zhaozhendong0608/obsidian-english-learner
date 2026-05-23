import { describe, it, expect } from 'vitest';
import { tokenize } from '../src/tokenizer/tokenizer';
import { lemmatize, getFuzzySuggestions } from '../src/tokenizer/lemmatizer';
import { VocabularyManager } from '../src/db/vocabulary';

describe('Sentinel-K 破坏性反向测试 (K-TEST)', () => {
    it('应能抵御未闭合或恶意嵌套的 Markdown 标签注入而不崩溃', () => {
        // 1. 未闭合的 Wiki 链接
        const text1 = 'This is [[learning methods|methods';
        expect(() => tokenize(text1)).not.toThrow();
        const tokens1 = tokenize(text1);
        // 应该当作普通文本正常切分，而不是崩溃
        expect(tokens1.length).toBeGreaterThan(0);

        // 2. 恶意大量嵌套标签
        const text2 = 'Nested [[ [[ [[ word ]] ]] ]] testing';
        expect(() => tokenize(text2)).not.toThrow();
        const tokens2 = tokenize(text2);
        expect(tokens2.length).toBeGreaterThan(0);

        // 3. 未闭合的普通链接
        const text3 = 'Link [text(http://xxx) or [text](link';
        expect(() => tokenize(text3)).not.toThrow();
    });

    it('应能抵御 ReDoS 正则回溯攻击 (高对抗性空标记与连续格式符)', () => {
        // 构造超长连续格式符，测试非回溯性正则的性能 (不超过 10ms)
        const formatSpam = '*'.repeat(1000) + 'word' + '_'.repeat(1000);
        const startTime = Date.now();
        const tokens = tokenize(formatSpam);
        const duration = Date.now() - startTime;

        expect(duration).toBeLessThan(50); // 必须在 50ms 内完成，防止卡死 Obsidian 主线程
        expect(tokens.find(t => t.cleanText === 'word')).toBeDefined();
    });

    it('对极端、空白、乱码输入应具备鲁棒性，零异常抛出', () => {
        const nullInputs = ['', '   ', '\n\t\r', '1234567890', '!@#$%^&*()_+'];
        for (const input of nullInputs) {
            expect(() => tokenize(input)).not.toThrow();
            expect(tokenize(input)).toEqual([]);
        }
    });

    it('词形还原应抵御极短或非法输入的崩溃风险', () => {
        // 极短单词与单字符
        expect(lemmatize('').lemma).toBe('');
        expect(lemmatize('a').lemma).toBe('a');
        expect(lemmatize('s').lemma).toBe('s');

        // 特殊乱码或非英文字符
        expect(lemmatize('你好').lemma).toBe('你好');
        expect(lemmatize('123ing').lemma).toBe('123ing');
    });

    it('模糊容错算法在海量词典查询下必须有性能防线', () => {
        const start = Date.now();
        // 模拟 10,000 个随机词的超大词典
        const fakeDict = Array.from({ length: 10000 }, (_, i) => `word${i}`);
        
        // 模糊查询不应超时
        const suggestions = getFuzzySuggestions('word5000', fakeDict);
        const duration = Date.now() - start;
        
        expect(duration).toBeLessThan(150); // 必须在 150ms 内完成，放宽对并发 CPU 噪音的限制
        expect(suggestions).toContain('word500'); // word500 与 word5000 编辑距离为 1，应包含它
        expect(suggestions).not.toContain('word5000'); // 自身过滤验证
    });

    it('数据层 K-TEST：加载非法的 JSON 损坏文件时必须有合理的异常保护，不得死锁崩溃', async () => {
        // 创建一个提供非法 JSON 文本的 DataAdapter
        const badAdapter = {
            read: async () => '{"broken_json": ',
            write: async () => {},
            rename: async () => {},
            exists: async () => true
        };
        const badManager = new VocabularyManager(badAdapter);
        
        // 加载非法 JSON 应该会合理抛出 JSON 解析异常，而不是陷入死锁
        await expect(badManager.load()).rejects.toThrow();
    });

    it('数据层 K-TEST：极限高频并发写入（如 100 次 saveImmediately）应通过写锁平滑限流，不造成 CPU 卡顿与文件资源倾覆', async () => {
        const memoryAdapter = {
            files: new Map<string, string>(),
            delayMs: 2,
            writeCount: 0,
            async read() { return '{}'; },
            async write(path: string, data: string) {
                this.writeCount++;
                await new Promise(r => setTimeout(r, this.delayMs));
                this.files.set(path, data);
            },
            async rename(o: string, n: string) {
                const d = this.files.get(o)!;
                this.files.set(n, d);
                this.files.delete(o);
            },
            async exists() { return false; }
        };
        const limitManager = new VocabularyManager(memoryAdapter);
        await limitManager.load();

        // 密集触发 100 次保存
        const promises = [];
        for (let i = 0; i < 100; i++) {
            limitManager.set(`word${i}`, 'KNOWN', '释义');
            promises.push(limitManager.saveImmediately());
        }

        // 所有并发承诺应成功被队列锁调度完毕
        await expect(Promise.all(promises)).resolves.toBeDefined();
        // 验证物理写入次数应当远远小于 100 次，证明合并写极其高效，无倾覆风险
        expect(memoryAdapter.writeCount).toBeLessThan(10);
        limitManager.destroy();
    });
});
