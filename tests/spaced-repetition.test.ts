import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VocabularyManager, DataAdapter } from '../src/db/vocabulary';

/**
 * 内存模拟磁盘数据适配器，用于单元测试
 */
class MemoryAdapter implements DataAdapter {
    public files = new Map<string, string>();

    public async read(path: string): Promise<string> {
        if (!this.files.has(path)) {
            throw new Error(`File not found: ${path}`);
        }
        return this.files.get(path)!;
    }

    public async write(path: string, data: string): Promise<void> {
        this.files.set(path, data);
    }

    public async rename(oldPath: string, newPath: string): Promise<void> {
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

describe('间隔复习算法 (SM-2) 及到期过滤逻辑测试', () => {
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

    it('生词在第一次复习时若评分为忘记 (grade: 0)，间隔应为 1 天且 reps 为 0，ease 降低', async () => {
        await manager.load();
        
        manager.reviewWord('forgotten', 0);

        const info = manager.getInfo('forgotten');
        expect(info).toBeDefined();
        expect(info!.interval).toBe(1);
        expect(info!.repetitions).toBe(0);
        expect(info!.ease).toBe(2.3); // 2.5 - 0.2
        expect(info!.status).toBe('LEARNING');
    });

    it('生词在第一次复习时若评分为模糊 (grade: 1)，间隔应为 1 天且 reps 为 1，ease 降低', async () => {
        await manager.load();
        
        manager.reviewWord('vague', 1);

        const info = manager.getInfo('vague');
        expect(info).toBeDefined();
        expect(info!.interval).toBe(1);
        expect(info!.repetitions).toBe(1);
        expect(info!.ease).toBe(2.35); // 2.5 - 0.15
        expect(info!.status).toBe('LEARNING');
    });

    it('生词在第一次复习时若评分为记得 (grade: 2)，间隔为 1 天且 reps 为 1，ease 不变', async () => {
        await manager.load();
        
        manager.reviewWord('remembered', 2);

        const info = manager.getInfo('remembered');
        expect(info).toBeDefined();
        expect(info!.interval).toBe(1);
        expect(info!.repetitions).toBe(1);
        expect(info!.ease).toBe(2.5);
        expect(info!.status).toBe('LEARNING');
    });

    it('生词在第一次复习时若评分为熟练 (grade: 3)，间隔为 2 天且 reps 为 1，ease 增加', async () => {
        await manager.load();
        
        manager.reviewWord('mastered', 3);

        const info = manager.getInfo('mastered');
        expect(info).toBeDefined();
        expect(info!.interval).toBe(2);
        expect(info!.repetitions).toBe(1);
        expect(info!.ease).toBe(2.65); // 2.5 + 0.15
        expect(info!.status).toBe('LEARNING');
    });

    it('重复复习评分为记得 (grade: 2)，间隔与次数应递增', async () => {
        await manager.load();

        // 第一次复习：记得
        manager.reviewWord('apple', 2);
        let info = manager.getInfo('apple')!;
        expect(info.repetitions).toBe(1);
        expect(info.interval).toBe(1);

        // 第二次复习：记得
        manager.reviewWord('apple', 2);
        info = manager.getInfo('apple')!;
        expect(info.repetitions).toBe(2);
        expect(info.interval).toBe(3);

        // 第三次复习：记得
        manager.reviewWord('apple', 2);
        info = manager.getInfo('apple')!;
        expect(info.repetitions).toBe(3);
        expect(info.interval).toBe(Math.round(3 * 2.5)); // 8 天
    });

    it('重复复习评分为熟练 (grade: 3)，间隔与次数应加速递增', async () => {
        await manager.load();

        // 第一次复习：熟练
        manager.reviewWord('banana', 3);
        let info = manager.getInfo('banana')!;
        expect(info.repetitions).toBe(1);
        expect(info.interval).toBe(2);
        expect(info.ease).toBe(2.65);

        // 第二次复习：熟练
        manager.reviewWord('banana', 3);
        info = manager.getInfo('banana')!;
        expect(info.repetitions).toBe(2);
        expect(info.interval).toBe(6);
        expect(info.ease).toBe(2.8);

        // 第三次复习：熟练
        manager.reviewWord('banana', 3);
        info = manager.getInfo('banana')!;
        expect(info.repetitions).toBe(3);
        // interval = round(6 * 2.8 * 1.2) = round(20.16) = 20 天
        expect(info.interval).toBe(20);
        expect(info.ease).toBe(2.95);
    });

    it('到期时间计算应正确影响复习判定', async () => {
        await manager.load();
        
        const now = Date.now();
        manager.reviewWord('orange', 2); // 第一次记得，interval = 1，到期时间 24 小时后
        
        let info = manager.getInfo('orange')!;
        expect(info.nextReview).toBe(now + 1 * 24 * 60 * 60 * 1000);

        // 时间向前推进 12 小时，尚未到期
        vi.advanceTimersByTime(12 * 60 * 60 * 1000);
        expect(Date.now() < info.nextReview!).toBe(true);

        // 时间再推进 13 小时（累计 25 小时），已到期
        vi.advanceTimersByTime(13 * 60 * 60 * 1000);
        expect(Date.now() >= info.nextReview!).toBe(true);
    });
});
