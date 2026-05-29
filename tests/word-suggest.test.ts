import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WordSuggest } from '../src/ui/WordSuggest';
import { VocabularyManager, DataAdapter } from '../src/db/vocabulary';

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

describe('WordSuggest (写作联想建议器) 核心优化逻辑测试', () => {
    let mockApp: any;
    let mockPlugin: any;
    let adapter: MemoryAdapter;
    let vocabManager: VocabularyManager;
    let suggest: WordSuggest;

    beforeEach(async () => {
        mockApp = {
            vault: {
                adapter: {
                    exists: async () => false,
                    read: async () => "{}",
                    write: async () => {},
                }
            }
        };

        adapter = new MemoryAdapter();
        vocabManager = new VocabularyManager(adapter, 'vocabulary.json');
        await vocabManager.load();

        mockPlugin = {
            app: mockApp,
            vocabManager: vocabManager
        };

        // 实例化 WordSuggest
        suggest = new WordSuggest(mockApp, mockPlugin);
    });

    describe('onTrigger (输入拦截触发规则)', () => {
        // 模拟 Editor 对象
        const makeMockEditor = (textBefore: string) => {
            return {
                getLine: () => textBefore,
            } as any;
        };

        it('输入 :: 应该触发中译英模式且中文查询为空', () => {
            const editor = makeMockEditor('::');
            const result = suggest.onTrigger({ line: 0, ch: 2 }, editor, {} as any);
            expect(result).not.toBeNull();
            expect(result?.query).toBe('::'); // this.CHINESE_PREFIX (::) + chineseQuery ("")
            expect(result?.start.ch).toBe(0);
        });

        it('输入 ::掌握 应该触发中译英模式且提取中文查询 掌握', () => {
            const editor = makeMockEditor('::掌握');
            const result = suggest.onTrigger({ line: 0, ch: 4 }, editor, {} as any);
            expect(result).not.toBeNull();
            expect(result?.query).toBe('::掌握');
            expect(result?.start.ch).toBe(0);
        });

        it('输入 :n 应该触发中译英模式且中文查询为空', () => {
            const editor = makeMockEditor(':n');
            const result = suggest.onTrigger({ line: 0, ch: 2 }, editor, {} as any);
            expect(result).not.toBeNull();
            expect(result?.query).toBe('::');
            expect(result?.start.ch).toBe(0);
        });

        it('输入 ~n掌握 应该触发中译英模式且提取中文查询 掌握', () => {
            const editor = makeMockEditor('~n掌握');
            const result = suggest.onTrigger({ line: 0, ch: 4 }, editor, {} as any);
            expect(result).not.toBeNull();
            expect(result?.query).toBe('::掌握');
            expect(result?.start.ch).toBe(0);
        });

        it('无任何前缀直接输入中文（如 "我们"），应该绝对不被匹配为中译英，避免日常写作污染', () => {
            const editor = makeMockEditor('光标处');
            const result = suggest.onTrigger({ line: 0, ch: 3 }, editor, {} as any);
            expect(result).toBeNull();
        });

        it('在中译英拼音输入未上屏状态下（如 "::zh" 或 "::zhang"），不应匹配英文联想', () => {
            const editor1 = makeMockEditor('::zh');
            const result1 = suggest.onTrigger({ line: 0, ch: 4 }, editor1, {} as any);
            expect(result1).toBeNull();

            const editor2 = makeMockEditor('::zhangwo');
            const result2 = suggest.onTrigger({ line: 0, ch: 9 }, editor2, {} as any);
            expect(result2).toBeNull();
        });

        it('正常英文单词前缀（如 "ms"），应该可以正确匹配为英文联想模式', () => {
            const editor = makeMockEditor('ms');
            const result = suggest.onTrigger({ line: 0, ch: 2 }, editor, {} as any);
            expect(result).not.toBeNull();
            expect(result?.query).toBe('ms');
            expect(result?.start.ch).toBe(0);
        });
    });

    describe('getSuggestions (联想候选词获取)', () => {
        it('在空中文检索模式下，应能智能推荐 LEARNING 状态且紧迫度高的生词', () => {
            // 写入几个生词数据
            const now = Date.now();
            
            // 词 A: 还有 2 小时到期
            vocabManager.set('mitigate', 'LEARNING', '减轻');
            const infoA = vocabManager.getInfo('mitigate')!;
            infoA.nextReview = now + 2 * 60 * 60 * 1000;
            infoA.repetitions = 1;

            // 词 B: 已经逾期 1 小时
            vocabManager.set('leverage', 'LEARNING', '杠杆');
            const infoB = vocabManager.getInfo('leverage')!;
            infoB.nextReview = now - 1 * 60 * 60 * 1000;
            infoB.repetitions = 2;

            // 词 C: 还有 3 天到期
            vocabManager.set('languish', 'LEARNING', '凋零');
            const infoC = vocabManager.getInfo('languish')!;
            infoC.nextReview = now + 3 * 24 * 60 * 60 * 1000;
            infoC.repetitions = 1;

            // 词 D: 已掌握的词 (不应推荐)
            vocabManager.set('grasp', 'KNOWN', '掌握');

            const context = {
                query: '::', // 空中文前缀模式
            } as any;

            const list = suggest.getSuggestions(context) as string[];
            
            // 预期的推荐顺序: leverage (已逾期，最紧迫) > mitigate (未逾期，更近) > languish (还有3天，较远)
            expect(list.length).toBe(3);
            expect(list[0]).toBe('leverage');
            expect(list[1]).toBe('mitigate');
            expect(list[2]).toBe('languish');
            expect(list).not.toContain('grasp');
        });

        it('输入具体的中文（如 "这"），应能通过 ReverseIndexService 获取正确的英文候选词', () => {
            const context = {
                query: '::这',
            } as any;

            const list = suggest.getSuggestions(context) as string[];
            // "这" 在静态 offlineDict 中映射为 "the", "this"
            expect(list).toContain('the');
            expect(list).toContain('this');
        });

        it('输入生词本才有的词（如 "::掌"），应能成功反向检索到生词本里的对应单词（如 "grasp"）', () => {
            vocabManager.set('grasp', 'LEARNING', '掌握词汇');
            const context = {
                query: '::掌',
            } as any;

            const list = suggest.getSuggestions(context) as string[];
            expect(list).toContain('grasp');
        });

        it('输入生词本中的中文键词汇（如 "::掌"），应能成功提取翻译中的英文单词（如 "grasp" 和 "master"）并推荐', () => {
            // 模拟用户生词本里中文作为键的异常/特殊数据结构
            vocabManager.set('掌握', 'LEARNING', 'grasp; master');
            const context = {
                query: '::掌',
            } as any;

            const list = suggest.getSuggestions(context) as string[];
            expect(list).toContain('grasp');
            expect(list).toContain('master');
        });
    });
});
