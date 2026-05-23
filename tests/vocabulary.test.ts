import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VocabularyManager, DataAdapter } from '../src/db/vocabulary';

/**
 * 内存模拟磁盘数据适配器，用于单元测试
 */
class MemoryAdapter implements DataAdapter {
    public files = new Map<string, string>();
    public delayMs = 0;
    public writeCount = 0; // 记录物理 write 触发次数

    public async read(path: string): Promise<string> {
        if (this.delayMs > 0) {
            await new Promise(r => setTimeout(r, this.delayMs));
        }
        if (!this.files.has(path)) {
            throw new Error(`File not found: ${path}`);
        }
        return this.files.get(path)!;
    }

    public async write(path: string, data: string): Promise<void> {
        this.writeCount++;
        if (this.delayMs > 0) {
            await new Promise(r => setTimeout(r, this.delayMs));
        }
        this.files.set(path, data);
    }

    public async rename(oldPath: string, newPath: string): Promise<void> {
        if (this.delayMs > 0) {
            await new Promise(r => setTimeout(r, this.delayMs));
        }
        if (!this.files.has(oldPath)) {
            throw new Error(`File not found: ${oldPath}`);
        }
        const data = this.files.get(oldPath)!;
        this.files.set(newPath, data);
        this.files.delete(oldPath);
    }

    public async exists(path: string): Promise<boolean> {
        return this.files.has(path);
    }
}

describe('本地影子词库管理器 (VocabularyManager) 测试', () => {
    let adapter: MemoryAdapter;
    let manager: VocabularyManager;

    beforeEach(() => {
        adapter = new MemoryAdapter();
        manager = new VocabularyManager(adapter, 'vocabulary.json');
        vi.useFakeTimers();
    });

    afterEach(() => {
        manager.destroy();
        vi.useRealTimers();
    });

    it('应能正确从存储介质中加载 JSON 并建立内存影子副本', async () => {
        const mockData = {
            hello: {
                word: 'hello',
                status: 'KNOWN',
                trans: '你好',
                phonetic: 'həˈləʊ',
                added: 123456,
                updated: 123456
            }
        };
        adapter.files.set('vocabulary.json', JSON.stringify(mockData));

        await manager.load();

        expect(manager.get('hello')).toBe('KNOWN');
        expect(manager.getInfo('hello')).toBeDefined();
        expect(manager.getInfo('hello')!.trans).toBe('你好');
        expect(manager.get('world')).toBe('UNKNOWN'); // 未标记词默认返回 UNKNOWN
    });

    it('写入单词状态应立刻更新内存影子，但推迟物理磁盘落盘 (2000ms 节流落盘)', async () => {
        await manager.load();

        // 改变状态，内存应该立刻变
        manager.set('apple', 'LEARNING', '苹果', 'ˈæpl');
        expect(manager.get('apple')).toBe('LEARNING');

        // 但此时物理文件还没有更新 (处于 2000ms 节流中)
        expect(adapter.files.has('vocabulary.json')).toBe(false);

        // 时间流逝 1000ms，仍然未写入
        await vi.advanceTimersByTimeAsync(1000);
        expect(adapter.files.has('vocabulary.json')).toBe(false);

        // 时间流逝达到 2000ms，触发物理落盘
        await vi.advanceTimersByTimeAsync(1000);
        expect(adapter.files.has('vocabulary.json')).toBe(true);

        const fileContent = JSON.parse(adapter.files.get('vocabulary.json')!);
        expect(fileContent.apple).toBeDefined();
        expect(fileContent.apple.status).toBe('LEARNING');
    });

    it('在 2000ms 节流区间内多次修改状态，应只触发一次物理落盘并合并结果', async () => {
        await manager.load();

        manager.set('apple', 'LEARNING', '苹果');
        await vi.advanceTimersByTimeAsync(500);

        manager.set('banana', 'KNOWN', '香蕉');
        await vi.advanceTimersByTimeAsync(500);

        manager.set('orange', 'LEARNING', '橙子');
        // 还没到 2000ms
        expect(adapter.writeCount).toBe(0);

        // 时间满 2000ms (距离第一次 set 过去了 2000ms，即再推进 1000ms)
        await vi.advanceTimersByTimeAsync(1000);
        
        expect(adapter.writeCount).toBe(1); // 物理写入次数仅为 1 且合并了结果
        const fileContent = JSON.parse(adapter.files.get('vocabulary.json')!);
        expect(fileContent.apple).toBeDefined();
        expect(fileContent.banana).toBeDefined();
        expect(fileContent.orange).toBeDefined();
    });

    it('在执行异步 I/O 期间触发多次立即保存，并发锁应保证串行化不冲突', async () => {
        await manager.load();
        adapter.delayMs = 20; // 开启 20ms 磁碟延迟

        manager.set('apple', 'LEARNING', '苹果');

        // 发起两个相互抢占的保存 promise
        const p1 = manager.saveImmediately();
        const p2 = manager.saveImmediately();

        // 推进时钟以推进 MemoryAdapter 中由于 delayMs 导致的异步 setTimeout 延迟
        await vi.advanceTimersByTimeAsync(100);

        // 两个 Promise 应该都正常解决
        await expect(Promise.all([p1, p2])).resolves.toBeDefined();
        expect(adapter.files.has('vocabulary.json')).toBe(true);
    });

    it('当传入设置不含释义音标时，能自动检索内置静态字典填充 fallback 释义音标', async () => {
        await manager.load();
        
        // "the" 属于 static_data.ts 中前 200 个内置有汉化释义的高频词 (the: 定冠词/这)
        // 且它也是高频词
        manager.set('the', 'KNOWN', ''); 

        const info = manager.getInfo('the');
        expect(info).toBeDefined();
        expect(info!.trans).not.toBe(''); // 应该被内置词典自动填充了释义
        expect(info!.phonetic).toBeDefined(); // 应该填充了音标
    });
});
