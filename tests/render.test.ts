/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
    processElement,
    collectSafeTextNodes,
    refreshWordsInDOM
} from '../src/renderer/postProcessor';
import { VocabularyManager, DataAdapter } from '../src/db/vocabulary';

/**
 * 内存模拟适配器
 */
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

describe('DOM 渲染拦截器 (PostProcessor) 测试', () => {
    let adapter: MemoryAdapter;
    let manager: VocabularyManager;

    beforeEach(async () => {
        adapter = new MemoryAdapter();
        manager = new VocabularyManager(adapter);
        await manager.load();
    });

    it('应能对 <p> 内的英文单词生成高亮 span 包裹', () => {
        const div = document.createElement('div');
        div.innerHTML = '<p>Hello world</p>';

        processElement(div, manager);

        const spans = div.querySelectorAll('.lang-learner-word');
        expect(spans.length).toBeGreaterThan(0);

        // 验证每个 span 都有 data-lemma 属性
        spans.forEach(span => {
            expect(span.getAttribute('data-lemma')).toBeTruthy();
        });
    });

    it('不应对 <code> 和 <pre> 内的文本进行高亮包裹（防代码污染）', () => {
        const div = document.createElement('div');
        div.innerHTML = '<p>Normal text</p><pre><code>const hello = "world";</code></pre>';

        processElement(div, manager);

        // <p> 中的文本应被高亮
        const pSpans = div.querySelector('p')?.querySelectorAll('.lang-learner-word');
        expect(pSpans!.length).toBeGreaterThan(0);

        // <pre><code> 中的文本不应被高亮
        const codeSpans = div.querySelector('code')?.querySelectorAll('.lang-learner-word');
        expect(codeSpans?.length ?? 0).toBe(0);
    });

    it('不应对 <a> 链接和 <h1-h6> 标题内的文本进行高亮包裹', () => {
        const div = document.createElement('div');
        div.innerHTML = '<h2>Title Here</h2><p>Click <a href="#">this link</a> please</p>';

        processElement(div, manager);

        // <h2> 内不应有高亮
        const h2Spans = div.querySelector('h2')?.querySelectorAll('.lang-learner-word');
        expect(h2Spans?.length ?? 0).toBe(0);

        // <a> 内不应有高亮
        const aSpans = div.querySelector('a')?.querySelectorAll('.lang-learner-word');
        expect(aSpans?.length ?? 0).toBe(0);

        // <p> 中非链接部分应有高亮
        const pSpans = div.querySelector('p')?.querySelectorAll('.lang-learner-word');
        expect(pSpans!.length).toBeGreaterThan(0);
    });

    it('已掌握 (KNOWN) 的单词不应被高亮包裹', () => {
        // 将 "hello" 标记为已掌握
        manager.set('hello', 'KNOWN', '你好');

        const div = document.createElement('div');
        div.innerHTML = '<p>Hello world</p>';

        processElement(div, manager);

        // "hello" 不应被包裹
        const helloSpan = div.querySelector('[data-lemma="hello"]');
        expect(helloSpan).toBeNull();

        // "world" 应被包裹（状态为 UNKNOWN）
        const worldSpan = div.querySelector('[data-lemma="world"]');
        expect(worldSpan).not.toBeNull();
    });

    it('学习中 (LEARNING) 的单词应显示 lang-learner-learning 类名', () => {
        manager.set('beautiful', 'LEARNING', '美丽的');

        const div = document.createElement('div');
        div.innerHTML = '<p>Beautiful day</p>';

        processElement(div, manager);

        const span = div.querySelector('[data-lemma="beautiful"]');
        expect(span).not.toBeNull();
        expect(span!.classList.contains('lang-learner-learning')).toBe(true);
    });

    it('refreshWordsInDOM 应能微秒级修改已有 span 的状态类名', () => {
        // 先渲染一个包含高亮的段落
        const div = document.createElement('div');
        div.innerHTML = '<p>Beautiful world</p>';
        processElement(div, manager);
        document.body.appendChild(div);

        // "beautiful" 经 lemmatizer 还原后为 "beautiful"（自身即词干）
        const span = document.querySelector('[data-lemma="beautiful"]');
        expect(span).not.toBeNull();
        expect(span!.classList.contains('lang-learner-unknown')).toBe(true);

        // 调用增量刷新，将状态切换为 LEARNING
        refreshWordsInDOM('beautiful', 'LEARNING');
        expect(span!.classList.contains('lang-learner-learning')).toBe(true);
        expect(span!.classList.contains('lang-learner-unknown')).toBe(false);

        // 再次切换为 KNOWN
        refreshWordsInDOM('beautiful', 'KNOWN');
        expect(span!.classList.contains('lang-learner-known')).toBe(true);
        expect(span!.classList.contains('lang-learner-learning')).toBe(false);

        // 清理
        document.body.removeChild(div);
    });

    it('collectSafeTextNodes 应只收集安全容器内的文本节点', () => {
        const div = document.createElement('div');
        div.innerHTML = `
            <p>Safe text here</p>
            <code>unsafe code</code>
            <pre>unsafe pre</pre>
            <a href="#">unsafe link</a>
            <h3>unsafe heading</h3>
            <li>Safe list item</li>
        `;

        const nodes = collectSafeTextNodes(div);
        const texts = nodes.map(n => n.textContent?.trim()).filter(Boolean);

        // 应包含 <p> 和 <li> 中的文本
        expect(texts).toContain('Safe text here');
        expect(texts).toContain('Safe list item');

        // 不应包含受保护标签中的文本
        expect(texts).not.toContain('unsafe code');
        expect(texts).not.toContain('unsafe pre');
        expect(texts).not.toContain('unsafe link');
        expect(texts).not.toContain('unsafe heading');
    });
});
