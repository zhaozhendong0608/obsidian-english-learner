import { describe, it, expect } from 'vitest';
import { extractSentence, appendContextNote } from '../src/generator/contextNote';
import { App } from 'obsidian';

/**
 * 内存模拟磁盘数据适配器，用于单元测试
 */
class MemoryAdapter {
    public files = new Map<string, string>();
    public dirs = new Set<string>();

    public async read(path: string): Promise<string> {
        return this.files.get(path) || '';
    }

    public async write(path: string, data: string): Promise<void> {
        this.files.set(path, data);
    }

    public async rename(oldPath: string, newPath: string): Promise<void> {
        const data = this.files.get(oldPath)!;
        this.files.set(newPath, data);
        this.files.delete(oldPath);
    }

    public async exists(path: string): Promise<boolean> {
        return this.files.has(path) || this.dirs.has(path);
    }

    public async mkdir(path: string): Promise<void> {
        this.dirs.add(path);
    }
}

describe('F4 语境句子物理截取算法测试', () => {
    it('应在句终标点处精确切分句子', () => {
        const paragraph = 'Hello world. This is a simple test sentence! Is it correct? Yes.';
        
        // "This" 的起始偏置为 13
        const sentence1 = extractSentence(paragraph, 15);
        expect(sentence1).toBe('This is a simple test sentence!');

        // "Is" 的起始偏置为 45
        const sentence2 = extractSentence(paragraph, 46);
        expect(sentence2).toBe('Is it correct?');
    });

    it('能正确应对文本开头和结尾的边界情况', () => {
        const paragraph = 'Hello world. This is end';
        const sentence = extractSentence(paragraph, 3);
        expect(sentence).toBe('Hello world.');

        const sentence2 = extractSentence(paragraph, 20);
        expect(sentence2).toBe('This is end');
    });

    it('能正确处理换行符分割段落的情况', () => {
        const paragraph = 'First line\nSecond line. Third line\rFourth line';
        
        // 匹配 Second line.
        const sentence = extractSentence(paragraph, 15);
        expect(sentence).toBe('Second line.');

        // 匹配 Fourth line
        const sentence2 = extractSentence(paragraph, 38);
        expect(sentence2).toBe('Fourth line');
    });
});

describe('F4 语境卡片建立与追加逻辑测试', () => {
    it('卡片不存在时应能正确新建，并生成正确的 Front Matter 与正文', async () => {
        const adapter = new MemoryAdapter();
        const mockApp = {
            vault: {
                adapter
            }
        } as unknown as App;

        await appendContextNote(
            mockApp,
            'apple',
            'LEARNING',
            '苹果',
            'ˈæpl',
            'I like to eat an apple every day.',
            'My Diary'
        );

        const cardPath = 'LangLearner/Cards/apple.md';
        expect(await adapter.exists(cardPath)).toBe(true);

        const content = await adapter.read(cardPath);
        
        // 验证 Front Matter 字段
        expect(content).toContain('word: apple');
        expect(content).toContain('status: LEARNING');
        expect(content).toContain('added:');
        expect(content).toContain('updated:');

        // 验证正文结构
        expect(content).toContain('# apple');
        expect(content).toContain('- **释义**: 苹果');
        expect(content).toContain('- **音标**: /ˈæpl/');
        expect(content).toContain('## 历史流转语境');
        expect(content).toContain('来源: [[My Diary]]');
        expect(content).toContain('> I like to eat an apple every day.');
    });

    it('卡片已存在时应能正确解析并追加新语境，并防止重复追加相同语境', async () => {
        const adapter = new MemoryAdapter();
        const mockApp = {
            vault: {
                adapter
            }
        } as unknown as App;

        const cardPath = 'LangLearner/Cards/banana.md';
        
        // 事先写入一张旧卡片，其 status 是 UNKNOWN，added 日期是 2020-01-01
        const originalContent = `---
word: banana
status: UNKNOWN
added: 2020-01-01
updated: 2020-01-01
---

# banana

- **释义**: 香蕉
- **音标**: 暂无音标

## 历史流转语境

- [2020-01-01] 来源: [[Fruit Article]]
  > Banana is yellow.
`;
        await adapter.mkdir('LangLearner/Cards');
        await adapter.write(cardPath, originalContent);

        // 1. 追加一条全新语境，并且状态变更为 LEARNING
        await appendContextNote(
            mockApp,
            'banana',
            'LEARNING',
            '香蕉',
            undefined,
            'Monkeys love eating banana.',
            'Animal Guide'
        );

        let content = await adapter.read(cardPath);
        // 验证 added 日期保持为 2020-01-01 不被更新覆盖
        expect(content).toContain('added: 2020-01-01');
        // 验证状态已被变更为 LEARNING
        expect(content).toContain('status: LEARNING');
        // 验证新增了历史语境
        expect(content).toContain('来源: [[Animal Guide]]');
        expect(content).toContain('> Monkeys love eating banana.');
        // 验证旧的历史语境仍然保留
        expect(content).toContain('来源: [[Fruit Article]]');
        expect(content).toContain('> Banana is yellow.');

        // 2. 再次尝试追加完全相同的语境 "Monkeys love eating banana."
        await appendContextNote(
            mockApp,
            'banana',
            'LEARNING',
            '香蕉',
            undefined,
            'Monkeys love eating banana.',
            'Animal Guide'
        );

        content = await adapter.read(cardPath);
        
        // 验证语境并没有被重复追加多次
        const occurrences = (content.match(/Monkeys love eating banana/g) || []).length;
        expect(occurrences).toBe(1);
    });
});
