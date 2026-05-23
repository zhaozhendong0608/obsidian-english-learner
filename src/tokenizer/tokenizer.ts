import { Token } from '../types';
import { lemmatize } from './lemmatizer';
import { COMMON_PHRASES } from '../data/static_data';

// 使用 Set 存储高频短语词库，实现 O(1) 速度匹配
const phraseSet = new Set<string>(COMMON_PHRASES.map(p => p.toLowerCase().trim()));

/**
 * 分词配置项接口
 */
export interface TokenizeOptions {
    /** 是否开启多词滑动窗口短语匹配，默认值为 true */
    enablePhrases?: boolean;
    /** 是否将 cleanText 转化为小写，默认值为 true */
    lowerCase?: boolean;
}

/**
 * 递归或线性提取不含 Markdown 格式的纯文字片段的 Token 列表
 * @param segmentText 子段纯文本
 * @param baseOffset 该子段在原始 Markdown 中的起始物理偏移
 */
function tokenizeSegment(segmentText: string, baseOffset: number): Token[] {
    let subIndex = 0;
    const subTokens: Token[] = [];
    const len = segmentText.length;

    while (subIndex < len) {
        const remaining = segmentText.slice(subIndex);
        
        // 匹配英文单词，允许带单引号或连字符 (如 don't, self-evident)
        const wordReg = /^[a-zA-Z]+(?:['’][a-zA-Z]+)*(?:-[a-zA-Z]+)*/;
        const wordMatch = remaining.match(wordReg);
        
        if (wordMatch) {
            const wordText = wordMatch[0];
            const clean = wordText.toLowerCase();
            const lemResult = lemmatize(wordText);
            
            subTokens.push({
                text: wordText,
                cleanText: clean,
                lemma: lemResult.lemma,
                start: baseOffset + subIndex,
                end: baseOffset + subIndex + wordText.length
            });
            
            subIndex += wordText.length;
        } else {
            // 跳过空格及标点
            subIndex += 1;
        }
    }
    
    return subTokens;
}

/**
 * 对 Token 列表进行 N=4 滑动窗口短语合并
 * @param tokens 拆分后的单字 Token 列表
 * @param rawText 原始 Markdown 文本
 */
function mergePhrases(tokens: Token[], rawText: string): Token[] {
    const merged: Token[] = [];
    let i = 0;
    const n = tokens.length;
    
    while (i < n) {
        let matched = false;
        
        // 限制窗口大小为 4, 依次向下递减到 2 (短语至少 2 个单词)
        for (let len = Math.min(4, n - i); len >= 2; len--) {
            const slice = tokens.slice(i, i + len);
            
            // 将子序列的词干 Lemma 拼接成空格分隔的短语原型进行匹配
            const phraseLemma = slice.map(t => t.lemma).join(' ');
            
            if (phraseSet.has(phraseLemma)) {
                // 匹配到短语！执行 Token 合并
                const start = slice[0].start;
                const end = slice[slice.length - 1].end;
                const phraseText = rawText.slice(start, end);
                const phraseClean = slice.map(t => t.cleanText).join(' ');
                
                merged.push({
                    text: phraseText,
                    cleanText: phraseClean,
                    lemma: phraseLemma,
                    start,
                    end,
                    isPhrase: true,
                    originalTokens: slice
                });
                
                i += len;
                matched = true;
                break;
            }
        }
        
        if (!matched) {
            merged.push(tokens[i]);
            i += 1;
        }
    }
    
    return merged;
}

/**
 * 对 Markdown/纯文本进行分词，并剥离标签与计算物理偏移量
 * @param text 输入的原始 Markdown 文本
 * @param options 分词配置项
 * @returns 提取完的 Token 列表
 */
export function tokenize(text: string, options: TokenizeOptions = {}): Token[] {
    if (!text) {
        return [];
    }

    const { enablePhrases = true } = options;
    let index = 0;
    const rawTokens: Token[] = [];
    const len = text.length;

    while (index < len) {
        const remaining = text.slice(index);

        // 1. 跳过图片链接 (防止解析图片 alt 中的无效单词)
        // A. 常规图片: ![alt](url)
        const imgReg = /^!\[([^\]\n]*)\]\(([^)\n]+)\)/;
        const imgMatch = remaining.match(imgReg);
        if (imgMatch) {
            index += imgMatch[0].length;
            continue;
        }
        // B. Wiki图片: ![[wiki-img]]
        const wikiImgReg = /^!\[\[([^\]\n]+)\]\]/;
        const wikiImgMatch = remaining.match(wikiImgReg);
        if (wikiImgMatch) {
            index += wikiImgMatch[0].length;
            continue;
        }

        // 2. 跳过行内代码和代码块
        // A. 代码块 ```js ... ```
        const codeBlockReg = /^```[\s\S]*?```/;
        const codeBlockMatch = remaining.match(codeBlockReg);
        if (codeBlockMatch) {
            index += codeBlockMatch[0].length;
            continue;
        }
        // B. 行内代码 `code`
        const inlineCodeReg = /^`[^`\n]*`/;
        const inlineCodeMatch = remaining.match(inlineCodeReg);
        if (inlineCodeMatch) {
            index += inlineCodeMatch[0].length;
            continue;
        }

        // 3. 跳过 HTML 标签
        const htmlReg = /^<[^>]+>/;
        const htmlMatch = remaining.match(htmlReg);
        if (htmlMatch) {
            index += htmlMatch[0].length;
            continue;
        }

        // 4. 解析 Wiki 带别名链接 [[link|alias]]
        const wikiAliasReg = /^\[\[([^\]|\n]+)\|([^\]\n]+)\]\]/;
        const wikiAliasMatch = remaining.match(wikiAliasReg);
        if (wikiAliasMatch) {
            const fullText = wikiAliasMatch[0];
            const linkText = wikiAliasMatch[1];
            const aliasText = wikiAliasMatch[2];
            
            // 别名部分的物理偏移计算：[ [ link | -> index + 2 + link长度 + 1
            const aliasStart = index + 2 + linkText.length + 1;
            const subTokens = tokenizeSegment(aliasText, aliasStart);
            rawTokens.push(...subTokens);
            
            index += fullText.length;
            continue;
        }

        // 5. 解析 Wiki 无别名链接 [[link]]
        const wikiReg = /^\[\[([^\]\n]+)\]\]/;
        const wikiMatch = remaining.match(wikiReg);
        if (wikiMatch) {
            const fullText = wikiMatch[0];
            const linkText = wikiMatch[1];
            
            const linkStart = index + 2;
            const subTokens = tokenizeSegment(linkText, linkStart);
            rawTokens.push(...subTokens);
            
            index += fullText.length;
            continue;
        }

        // 6. 解析普通 Markdown 链接 [text](url)
        const mdLinkReg = /^\[([^\]\n]+)\]\(([^)\n]+)\)/;
        const mdLinkMatch = remaining.match(mdLinkReg);
        if (mdLinkMatch) {
            const fullText = mdLinkMatch[0];
            const linkText = mdLinkMatch[1];
            
            const linkStart = index + 1;
            const subTokens = tokenizeSegment(linkText, linkStart);
            rawTokens.push(...subTokens);
            
            index += fullText.length;
            continue;
        }

        // 7. 跳过 Markdown 粗体/斜体格式符
        const formatReg = /^(\*\*\*|\*\*|\*|___|__|__|_)/;
        const formatMatch = remaining.match(formatReg);
        if (formatMatch) {
            index += formatMatch[0].length;
            continue;
        }

        // 8. 提取常规英文单词
        const wordReg = /^[a-zA-Z]+(?:['’][a-zA-Z]+)*(?:-[a-zA-Z]+)*/;
        const wordMatch = remaining.match(wordReg);
        if (wordMatch) {
            const wordText = wordMatch[0];
            const clean = wordText.toLowerCase();
            const lemResult = lemmatize(wordText);
            
            rawTokens.push({
                text: wordText,
                cleanText: clean,
                lemma: lemResult.lemma,
                start: index,
                end: index + wordText.length
            });
            
            index += wordText.length;
            continue;
        }

        // 9. 空格、标点符号等无害字符，推进游标
        index += 1;
    }

    // 若开启短语合并，执行滑动窗口匹配归并
    if (enablePhrases) {
        return mergePhrases(rawTokens, text);
    }

    return rawTokens;
}
