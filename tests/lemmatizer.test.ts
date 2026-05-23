import { describe, it, expect } from 'vitest';
import { lemmatize, getLevenshteinDistance, getFuzzySuggestions } from '../src/tokenizer/lemmatizer';
import { HIGH_FREQUENCY_WORDS } from '../src/data/static_data';

describe('词形还原算法 (Lemmatizer) 测试', () => {
    it('应能正确还原不规则动词原型', () => {
        expect(lemmatize('went').lemma).toBe('go');
        expect(lemmatize('gone').lemma).toBe('go');
        expect(lemmatize('was').lemma).toBe('be');
        expect(lemmatize('were').lemma).toBe('be');
        expect(lemmatize('had').lemma).toBe('have');
    });

    it('应能正确还原不规则名词和形容词原型', () => {
        expect(lemmatize('children').lemma).toBe('child');
        expect(lemmatize('men').lemma).toBe('man');
        expect(lemmatize('better').lemma).toBe('good');
        expect(lemmatize('best').lemma).toBe('good');
    });

    it('应能根据规则逆推并用高频词表校验还原常规 -ing 变形', () => {
        // 规则去掉 -ing
        expect(lemmatize('studying').lemma).toBe('study');
        // 双写辅音还原
        expect(lemmatize('running').lemma).toBe('run');
        // 去掉 ing 并加 e
        expect(lemmatize('loving').lemma).toBe('love');
    });

    it('应能正确还原常规 -ed 变形', () => {
        // 规则去掉 -ed
        expect(lemmatize('started').lemma).toBe('start');
        // 变 y 为 i 加 ed 还原
        expect(lemmatize('carried').lemma).toBe('carry');
        // 双写辅音还原
        expect(lemmatize('stopped').lemma).toBe('stop');
        // 去掉 d 还原 (如 love + d)
        expect(lemmatize('loved').lemma).toBe('love');
    });

    it('应能正确还原名词复数与动词单三变形', () => {
        // 变 y 为 i 加 es 还原
        expect(lemmatize('flies').lemma).toBe('fly');
        // 加 es 还原
        expect(lemmatize('boxes').lemma).toBe('box');
        // 直接加 s 还原
        expect(lemmatize('cats').lemma).toBe('cat');
    });

    it('应能正确进行英美音拼写重定向', () => {
        const colourResult = lemmatize('colour');
        expect(colourResult.lemma).toBe('color');
        expect(colourResult.redirected).toBe(true);

        const analyseResult = lemmatize('analyse');
        expect(analyseResult.lemma).toBe('analyze');
        expect(analyseResult.redirected).toBe(true);
    });

    it('应能正确计算 Levenshtein 编辑距离', () => {
        expect(getLevenshteinDistance('cat', 'cat')).toBe(0);
        expect(getLevenshteinDistance('cat', 'bat')).toBe(1);
        expect(getLevenshteinDistance('cat', 'cats')).toBe(1);
        expect(getLevenshteinDistance('kitten', 'sitting')).toBe(3);
    });

    it('应能基于编辑距离为 1 推荐拼写相近词', () => {
        const dict = ['fort', 'form', 'frame', 'some'];
        const suggestions = getFuzzySuggestions('form', dict);
        expect(suggestions).toContain('fort');
        expect(suggestions).not.toContain('some');
    });
});
