import { describe, it, expect } from 'vitest';
import { tokenize } from '../src/tokenizer/tokenizer';

describe('分词与短语匹配模块 (Tokenizer) 测试', () => {
    it('应能正确对普通文本进行分词，并净化文本与计算物理偏移量', () => {
        const text = 'Hello, world! Welcome to Obsidian.';
        const tokens = tokenize(text, { enablePhrases: false });

        // 验证 Token 数量
        expect(tokens.length).toBe(5);

        // 验证 Hello Token
        const helloToken = tokens[0];
        expect(helloToken.text).toBe('Hello');
        expect(helloToken.cleanText).toBe('hello');
        expect(helloToken.lemma).toBe('hello'); // 还原原型
        expect(helloToken.start).toBe(0);
        expect(helloToken.end).toBe(5);

        // 验证 world Token (跳过了逗号和空格)
        const worldToken = tokens[1];
        expect(worldToken.text).toBe('world');
        expect(worldToken.cleanText).toBe('world');
        expect(worldToken.start).toBe(7);
        expect(worldToken.end).toBe(12);

        // 验证最后一个 Token Obsidian
        const obsToken = tokens[4];
        expect(obsToken.text).toBe('Obsidian');
        expect(obsToken.cleanText).toBe('obsidian');
        expect(obsToken.start).toBe(25);
        expect(obsToken.end).toBe(33);
    });

    it('应能剥离 Markdown 粗体与斜体标记，并准确记录物理偏移量', () => {
        const text = 'This is **bold** and *italic* text.';
        const tokens = tokenize(text, { enablePhrases: false });

        // bold Token: 应该跳过前面的 ** 并且偏移位置对应原始文本
        // "This is **bold** ..." 的 "bold" 开始于索引 10，结束于 14
        const boldToken = tokens.find(t => t.cleanText === 'bold');
        expect(boldToken).toBeDefined();
        expect(boldToken!.text).toBe('bold');
        expect(boldToken!.start).toBe(10);
        expect(boldToken!.end).toBe(14);
        // 原文中:
        // Index 8,9 是 "**"
        // Index 10,11,12,13 是 "bold" (长度 4, 所以 start:10, end:14)
        // Index 14,15 是 "**"

        // italic Token: 应该跳过 *
        // "This is **bold** and *italic*..." 的 "italic" 开始于索引 22，结束于 28
        const italicToken = tokens.find(t => t.cleanText === 'italic');
        expect(italicToken).toBeDefined();
        expect(italicToken!.text).toBe('italic');
        expect(italicToken!.start).toBe(22);
        expect(italicToken!.end).toBe(28);
    });

    it('应能剥离 Wiki 双链和常规 Markdown 链接', () => {
        const text = 'Read [[learning methods|methods]] in [my blog](http://example.com).';
        const tokens = tokenize(text, { enablePhrases: false });

        // Wiki 链接: 应该剥离双括号和别名管道线前半部，只分词 "methods"
        // "Read [[learning methods|methods]]" 中的 "methods"
        // "Read " 占 5 个字符 (0-4)
        // "[[learning methods|" 占 19 个字符 (5-23)
        // "methods" 占 7 个字符 (24-31)
        // "]]" 占 2 个字符 (32-33)
        const methodsToken = tokens.find(t => t.cleanText === 'methods');
        expect(methodsToken).toBeDefined();
        expect(methodsToken!.text).toBe('methods');
        expect(methodsToken!.lemma).toBe('method'); // 复数还原为单数
        expect(methodsToken!.start).toBe(24);
        expect(methodsToken!.end).toBe(31);

        // 如果 Wiki 双链没有别名，如 [[learning]]，分词为 "learning" -> lemma: "learn"
        const noAliasText = 'Link [[learning]].';
        const noAliasTokens = tokenize(noAliasText, { enablePhrases: false });
        const learnToken = noAliasTokens.find(t => t.cleanText === 'learning');
        expect(learnToken).toBeDefined();
        expect(learnToken!.lemma).toBe('learn');
        expect(learnToken!.start).toBe(7); // "Link [[" 长度为 7 (0-6)
        expect(learnToken!.end).toBe(15);  // "learning" 长度 8

        // 常规 MD 链接: 应该剥离方括号后面的 (url) 并且提取方括号里的文本
        // "in [my blog](http://example.com)" -> 提取 "my" (start:38, end:40), "blog" (start:41, end:45)
        const blogToken = tokens.find(t => t.cleanText === 'blog');
        expect(blogToken).toBeDefined();
        expect(blogToken!.start).toBe(41);
        expect(blogToken!.end).toBe(45);
    });

    it('基于滑动窗口 (N=4) 进行高频短语词组优先匹配合并', () => {
        // "look forward to" 属于常用短语库
        const text = 'I will look forward to your reply.';
        const tokens = tokenize(text, { enablePhrases: true });

        // "I", "will", "look forward to", "your", "reply"
        // 应该合并出一个短语 Token，长度为 5 个 Token，而不是被切开
        expect(tokens.length).toBe(5);

        const phraseToken = tokens[2];
        expect(phraseToken.text).toBe('look forward to');
        expect(phraseToken.cleanText).toBe('look forward to');
        expect(phraseToken.lemma).toBe('look forward to');
        expect(phraseToken.isPhrase).toBe(true);
        expect(phraseToken.start).toBe(7);  // 'I will ' 长度为 7
        expect(phraseToken.end).toBe(22);   // 'I will look forward to' 长度为 22
        expect(phraseToken.originalTokens?.length).toBe(3);
    });

    it('即使短语中单词有变形，也应能成功匹配合并并还原原型', () => {
        // "looking forward to" 含有动词变形 "looking"
        const text = 'He is looking forward to the match.';
        const tokens = tokenize(text, { enablePhrases: true });

        const phraseToken = tokens.find(t => t.isPhrase);
        expect(phraseToken).toBeDefined();
        expect(phraseToken!.text).toBe('looking forward to');
        expect(phraseToken!.lemma).toBe('look forward to'); // 还原出短语原型
        expect(phraseToken!.start).toBe(6);  // 'He is ' 长度为 6
        expect(phraseToken!.end).toBe(24);   // 'He is looking forward to' 长度为 24
    });
});
