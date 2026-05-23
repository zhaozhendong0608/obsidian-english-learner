/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { eventBus } from '../src/event/EventBus';
import { processElement, refreshWordsInDOM } from '../src/renderer/postProcessor';
import { VocabularyManager, DataAdapter } from '../src/db/vocabulary';

class MemoryAdapter implements DataAdapter {
    public files = new Map<string, string>();
    async read(path: string) { return this.files.get(path) || '{}'; }
    async write(path: string, data: string) { this.files.set(path, data); }
    async rename(o: string, n: string) {
        const d = this.files.get(o)!;
        this.files.set(n, d);
        this.files.delete(o);
    }
    async exists(path: string) { return this.files.has(path); }
}

describe('EventBus 与 UI 渲染层联动集成测试', () => {
    let adapter: MemoryAdapter;
    let manager: VocabularyManager;

    beforeEach(async () => {
        adapter = new MemoryAdapter();
        manager = new VocabularyManager(adapter);
        await manager.load();
        eventBus.clear();
    });

    it('应能通过 EventBus 触发并增量修改 DOM 上的单词状态高亮样式', () => {
        // 模拟订阅：在主插件加载时，我们会这样把 EventBus 和 DOM 刷新函数连接起来
        eventBus.on('lang-learner:word-changed', (word: string, status: string) => {
            refreshWordsInDOM(word, status);
        });

        // 渲染测试 DOM
        const div = document.createElement('div');
        div.innerHTML = '<p>Amazing day for learning</p>';
        
        // 假定 "learning" 为初始单词，经 lemmatizer 还原为 "learn"
        processElement(div, manager);
        document.body.appendChild(div);

        const span = document.querySelector('[data-lemma="learn"]');
        expect(span).not.toBeNull();
        expect(span!.classList.contains('lang-learner-unknown')).toBe(true);

        // 触发事件总线广播
        eventBus.emit('lang-learner:word-changed', 'learn', 'LEARNING');

        // 验证样式已经瞬间刷新为 learning
        expect(span!.classList.contains('lang-learner-learning')).toBe(true);
        expect(span!.classList.contains('lang-learner-unknown')).toBe(false);

        // 再次广播标熟
        eventBus.emit('lang-learner:word-changed', 'learn', 'KNOWN');
        expect(span!.classList.contains('lang-learner-known')).toBe(true);
        expect(span!.classList.contains('lang-learner-learning')).toBe(false);

        document.body.removeChild(div);
    });
});
