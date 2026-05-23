import { Token } from '../types';
import { tokenize } from '../tokenizer/tokenizer';
import { VocabularyManager } from '../db/vocabulary';
import { OFFLINE_DICT } from '../data/static_data';
import { eventBus } from '../event/EventBus';
import { extractSentence } from '../generator/contextNote';
import { Notice } from 'obsidian';

/**
 * 受保护标签黑名单（大写）
 * 这些标签内的文本节点不应被拦截高亮，以防破坏原有交互与排版
 */
const PROTECTED_TAGS = new Set([
    'CODE', 'PRE', 'A', 'SCRIPT', 'STYLE', 'SVG', 'IMG',
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'INPUT', 'TEXTAREA', 'BUTTON',
    'MATH', 'MJX-CONTAINER',   // MathJax 数学公式
]);

/**
 * 检测某个 DOM 节点是否处于受保护标签的子树内
 * @param node 目标节点
 * @param root 文章容器根节点 (遍历终止边界)
 */
export function isInsideProtectedTag(node: Node, root: HTMLElement): boolean {
    let current = node.parentElement;
    while (current && current !== root) {
        if (PROTECTED_TAGS.has(current.tagName)) {
            return true;
        }
        // 若父元素已经是我们自己的高亮 span，也需跳过防止二次包裹
        if (current.classList?.contains('lang-learner-word')) {
            return true;
        }
        current = current.parentElement;
    }
    return false;
}

/**
 * 收集容器内所有安全的 Text 节点（跳过受保护标签子树）
 * @param root 文章容器根节点
 */
export function collectSafeTextNodes(root: HTMLElement): Text[] {
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node: Text): number {
            // 跳过纯空白节点
            if (!node.textContent || !node.textContent.trim()) {
                return NodeFilter.FILTER_REJECT;
            }
            // 跳过受保护标签
            if (isInsideProtectedTag(node, root)) {
                return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
        }
    });

    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
        textNodes.push(node);
    }
    return textNodes;
}

/**
 * 将单个 TextNode 中的英文单词/短语包裹为高亮 <span>
 * @param textNode 目标文本节点
 * @param vocabManager 词库管理器实例
 */
export function wrapTextNode(textNode: Text, vocabManager: VocabularyManager): void {
    const text = textNode.textContent;
    if (!text) return;

    // 对文本内容进行分词
    const tokens = tokenize(text);
    if (tokens.length === 0) return;

    // 构建偏移范围索引：记录被短语覆盖的字符位置，防止单字嵌套
    const phraseRanges: Array<{ start: number; end: number }> = [];
    for (const token of tokens) {
        if (token.isPhrase) {
            phraseRanges.push({ start: token.start, end: token.end });
        }
    }

    // 检查某个 Token 是否被短语覆盖
    function isCoveredByPhrase(token: Token): boolean {
        if (token.isPhrase) return false;
        for (const range of phraseRanges) {
            if (token.start >= range.start && token.end <= range.end) {
                return true;
            }
        }
        return false;
    }

    // 构建 DocumentFragment 替换原始 TextNode
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    for (const token of tokens) {
        // 跳过被短语覆盖的单字 Token
        if (isCoveredByPhrase(token)) continue;

        // 补充 Token 之前的纯文本
        if (token.start > lastIndex) {
            fragment.appendChild(document.createTextNode(text.slice(lastIndex, token.start)));
        }

        // 查询词汇状态
        const status = vocabManager.get(token.lemma);
        const info = vocabManager.getInfo(token.lemma);

        // 创建高亮 span
        const span = document.createElement('span');
        span.className = 'lang-learner-word';
        span.textContent = text.slice(token.start, token.end);

        // 添加状态类名
        if (status === 'KNOWN') {
            span.classList.add('lang-learner-known');
        } else if (status === 'LEARNING') {
            span.classList.add('lang-learner-learning');
        } else {
            span.classList.add('lang-learner-unknown');
        }

        // 添加短语标记
        if (token.isPhrase) {
            span.classList.add('lang-learner-phrase');
        }

        // 设置 data 属性供 CSS 伪元素悬浮气泡使用
        span.setAttribute('data-lemma', token.lemma);

        // 从词库或内置字典获取释义与音标
        let trans = info?.trans || '';
        let phonetic = info?.phonetic || '';
        if (!trans) {
            const dictEntry = OFFLINE_DICT[token.lemma];
            if (dictEntry) {
                trans = dictEntry.trans;
                phonetic = phonetic || dictEntry.phonetic || '';
            }
        }

        // 绑定单击事件以同步选中
        span.addEventListener('click', (e) => {
            e.stopPropagation();
            eventBus.emit('lang-learner:word-selected', token.lemma);
        });

        // 绑定双击事件以自动标记为生词并提取语境
        span.addEventListener('dblclick', async (e) => {
            e.stopPropagation();
            const currentStatus = vocabManager.get(token.lemma);

            // 直接弹出屏幕 Notice 展示翻译，即使是 KNOWN 单词也直接提示翻译
            const displayPhonetic = phonetic ? ` /${phonetic}/` : '';
            
            if (trans) {
                new Notice(`📖 ${token.lemma}${displayPhonetic}\n释义: ${trans}`, 3500);
            } else {
                // 如果没有内置释义，通过有道词典 API 异步获取
                const loadingNotice = new Notice(`📖 ${token.lemma}${displayPhonetic}\n正在从在线词典查询释义...`, 5000);
                try {
                    const onlineTrans = await vocabManager.fetchOnlineTranslation(token.lemma);
                    loadingNotice.hide();
                    if (onlineTrans) {
                        new Notice(`📖 ${token.lemma}${displayPhonetic}\n释义: ${onlineTrans}`, 4500);
                        trans = onlineTrans; // 更新局部变量
                        span.setAttribute('data-trans', onlineTrans); // 更新 DOM data 属性
                        
                        // 更新至影子词库内存并持久化，确保下次无需重新网络查询
                        vocabManager.set(token.lemma, currentStatus === 'UNKNOWN' ? 'UNKNOWN' : currentStatus, onlineTrans, phonetic);
                    } else {
                        new Notice(`📖 ${token.lemma}${displayPhonetic}\n释义: 暂无释义`, 3500);
                    }
                } catch (err) {
                    loadingNotice.hide();
                    new Notice(`📖 ${token.lemma}${displayPhonetic}\n释义: 暂无释义 (查询失败)`, 3500);
                }
            }

            if (currentStatus !== 'KNOWN') {
                // 计算当前单词在段落中的物理偏移，精确抓取上下文整句
                const paragraphText = span.parentElement?.textContent || '';
                let offset = 0;
                let prev = span.previousSibling;
                while (prev) {
                    offset += prev.textContent?.length || 0;
                    prev = prev.previousSibling;
                }

                const sentence = extractSentence(paragraphText, offset);

                // 更新影子词库为学习中，并使用最新释义
                vocabManager.set(token.lemma, 'LEARNING', trans, phonetic);

                // 广播事件更新高亮，并附带语境与句子，供 main.ts 触发卡片生成
                eventBus.emit('lang-learner:word-changed', token.lemma, 'LEARNING', sentence);
            }

            // 同步选中侧边栏
            eventBus.emit('lang-learner:word-selected', token.lemma);
        });

        if (phonetic) span.setAttribute('data-phonetic', `/${phonetic}/`);
        if (trans) span.setAttribute('data-trans', trans);

        fragment.appendChild(span);
        lastIndex = token.end;
    }

    // 补充末尾残余的纯文本
    if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    // 如果没有生成 any 高亮 span，则不进行替换
    if (!fragment.querySelector('.lang-learner-word')) return;

    // 替换原始 TextNode
    textNode.parentNode?.replaceChild(fragment, textNode);
}


/**
 * DOM 拦截核心入口：遍历安全 TextNode 并执行单词/短语包裹
 * @param el 渲染完成的文章容器元素
 * @param vocabManager 词库管理器实例
 */
export function processElement(el: HTMLElement, vocabManager: VocabularyManager): void {
    const textNodes = collectSafeTextNodes(el);
    for (const textNode of textNodes) {
        wrapTextNode(textNode, vocabManager);
    }
}

/**
 * 微秒级增量局部刷新函数
 * 当用户在侧边栏修改单词状态时，只需修改已有 span 的 CSS 类名，
 * 无需触发全文 DOM 重建
 * @param word 单词原型 (lemma)
 * @param newStatus 新的熟悉度状态
 */
export function refreshWordsInDOM(word: string, newStatus: string): void {
    const spans = document.querySelectorAll<HTMLSpanElement>(
        `.lang-learner-word[data-lemma="${word}"]`
    );

    spans.forEach(span => {
        // 移除旧状态类名
        span.classList.remove('lang-learner-unknown', 'lang-learner-learning', 'lang-learner-known');

        // 添加新状态类名
        switch (newStatus) {
            case 'KNOWN':
                span.classList.add('lang-learner-known');
                break;
            case 'LEARNING':
                span.classList.add('lang-learner-learning');
                break;
            default:
                span.classList.add('lang-learner-unknown');
                break;
        }
    });
}
