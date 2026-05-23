import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VocabularyManager, DataAdapter } from '../src/db/vocabulary';
import { HIGH_FREQUENCY_WORDS } from '../src/data/static_data';

/**
 * 内存模拟磁盘数据适配器，用于单元测试
 */
class MemoryAdapter implements DataAdapter {
    public files = new Map<string, string>();
    public writeCount = 0;

    public async read(path: string): Promise<string> {
        return this.files.get(path) || '{}';
    }

    public async write(path: string, data: string): Promise<void> {
        this.writeCount++;
        this.files.set(path, data);
    }

    public async rename(oldPath: string, newPath: string): Promise<void> {
        const data = this.files.get(oldPath)!;
        this.files.set(newPath, data);
        this.files.delete(oldPath);
    }

    public async exists(path: string): Promise<boolean> {
        return this.files.has(path);
    }
}

describe('Vue 3 侧边栏与交互控制 (F5 & F8) 核心逻辑测试', () => {
    let adapter: MemoryAdapter;
    let manager: VocabularyManager;

    beforeEach(async () => {
        adapter = new MemoryAdapter();
        manager = new VocabularyManager(adapter, 'vocabulary.json');
        await manager.load();
        vi.useFakeTimers();
    });

    afterEach(() => {
        manager.destroy();
        vi.useRealTimers();
    });

    it('getAllEntries() 和 getCount() 应能正确反应词库状态', () => {
        manager.set('apple', 'UNKNOWN', '苹果');
        manager.set('banana', 'LEARNING', '香蕉');
        manager.set('orange', 'KNOWN', '橙子');

        // 测试 getAllEntries
        const entries = manager.getAllEntries();
        expect(entries.size).toBe(3);
        expect(entries.get('apple')?.status).toBe('UNKNOWN');
        expect(entries.get('banana')?.status).toBe('LEARNING');
        expect(entries.get('orange')?.status).toBe('KNOWN');

        // 测试 getCount
        const count = manager.getCount();
        expect(count.total).toBe(3);
        expect(count.unknown).toBe(1);
        expect(count.learning).toBe(1);
        expect(count.known).toBe(1);
    });

    it('batchSetKnown() 应能正确批量标记为 KNOWN 并节流落盘', async () => {
        // 设置一个生词
        manager.set('apple', 'LEARNING', '苹果');
        
        // 批量标记三个单词为 KNOWN
        const words = ['apple', 'banana', 'orange'];
        manager.batchSetKnown(words);

        // 内存中应该瞬间变更
        expect(manager.get('apple')).toBe('KNOWN');
        expect(manager.get('banana')).toBe('KNOWN');
        expect(manager.get('orange')).toBe('KNOWN');

        // 验证节流落盘，此时应该还没有发生物理磁盘写入
        expect(adapter.writeCount).toBe(0);

        // 推进 2000ms 触发物理落盘
        await vi.advanceTimersByTimeAsync(2000);
        expect(adapter.writeCount).toBe(1);

        const fileContent = JSON.parse(adapter.files.get('vocabulary.json')!);
        expect(fileContent.apple.status).toBe('KNOWN');
        expect(fileContent.banana.status).toBe('KNOWN');
        expect(fileContent.orange.status).toBe('KNOWN');
    });

    it('F5 二分查找估算逻辑应正确收敛，且批量标熟水位线以下单词', () => {
        // 模拟一个用户，他的实际词汇量水位位于第 500 个单词
        // 即，第 0 到 499 个单词他都认识，500 及以后的单词都不认识
        const actualUserLimit = 500; 

        // 模拟 Vue 组件中的二分逻辑
        let bsLow = 0;
        let bsHigh = HIGH_FREQUENCY_WORDS.length - 1;
        let bsRound = 0;
        const maxRounds = 20;

        while (bsRound < maxRounds && bsLow <= bsHigh) {
            const mid = Math.floor((bsLow + bsHigh) / 2);
            
            // 判断用户是否认识
            const isKnown = mid < actualUserLimit;
            if (isKnown) {
                bsLow = mid + 1;
            } else {
                bsHigh = mid - 1;
            }
            bsRound++;
        }

        // 估算出来的水位线索引应该是 bsLow
        const estimatedLevel = bsLow;
        expect(estimatedLevel).toBe(500); // 确切收敛到 500
        
        // 此时我们模拟批量更新，水位线以下的词标记为 KNOWN
        const wordsToMark = HIGH_FREQUENCY_WORDS.slice(0, estimatedLevel);
        
        // 事先设置一个用户标记为学习中的词，用来测试不被覆盖
        manager.set('the', 'LEARNING', '这/那个'); // highFreqWords 索引 0 是 'the'
        
        const safeWords = wordsToMark.filter(w => {
            const status = manager.get(w);
            return status !== 'LEARNING';
        });

        manager.batchSetKnown(safeWords);

        // 验证 index 1 的单词和 index 499 的单词状态是 KNOWN
        // 并且 'the' 的状态依然是 LEARNING（不被批量 KNOWN 覆盖）
        expect(manager.get('the')).toBe('LEARNING'); 
        expect(manager.get(HIGH_FREQUENCY_WORDS[1])).toBe('KNOWN');
        expect(manager.get(HIGH_FREQUENCY_WORDS[499])).toBe('KNOWN');
        // 水位线以上的词应该依然是 UNKNOWN
        expect(manager.get(HIGH_FREQUENCY_WORDS[500])).toBe('UNKNOWN');
    });
    it('F8 一键学完差集过滤逻辑应计算正确', () => {
        // 模拟一篇包含高频词、低频词（不在白名单）的文章
        // 用户已经将 'banana' 标为学习中 (LEARNING)
        const articleWords = ['the', 'apple', 'nonexistentwordxyz', 'webpackconfig', 'banana'];
        const highFreqSet = new Set(HIGH_FREQUENCY_WORDS);

        manager.set('banana', 'LEARNING', '香蕉');

        // 计算差集: (文章全量词集 ∩ 20000高频词表) - 用户标记生词集
        const wordsToMark: string[] = [];
        articleWords.forEach(word => {
            // 只处理高频词表内的词
            if (!highFreqSet.has(word)) return;
            // 跳过用户标记为 KNOWN 或 LEARNING 的词
            const currentStatus = manager.get(word);
            if (currentStatus === 'KNOWN' || currentStatus === 'LEARNING') return;
            wordsToMark.push(word);
        });

        // 验证差集计算是否准确（排除非白名单词和已标记词）
        expect(wordsToMark).toContain('the');
        expect(wordsToMark).toContain('apple');
        expect(wordsToMark).not.toContain('banana');
        expect(wordsToMark).not.toContain('webpackconfig');
        expect(wordsToMark).not.toContain('nonexistentwordxyz');

        // 执行批量更新
        manager.batchSetKnown(wordsToMark);
        expect(manager.get('the')).toBe('KNOWN');
        expect(manager.get('apple')).toBe('KNOWN');
        expect(manager.get('banana')).toBe('LEARNING'); // 仍旧保持学习中状态
    });
});
