import { requestUrl } from 'obsidian';
import { Readability } from '@mozilla/readability';

export interface WebArticle {
    title: string;
    content: string;
    textContent: string;
    length: number;
    excerpt: string;
    byline: string;
    dir: string;
    siteName: string;
    lang: string;
}

export class WebScraperService {
    /**
     * 抓取网页 HTML 内容
     */
    public async fetchWebPage(url: string): Promise<string> {
        try {
            // 优先使用 Obsidian requestUrl 绕过 CORS
            const res = await requestUrl({
                url,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            return res.text || '';
        } catch (e) {
            console.warn('Obsidian requestUrl 获取网页失败，回退到 fetch:', e);
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`网络响应错误，状态码: ${res.status}`);
            }
            return await res.text();
        }
    }

    /**
     * 使用 Mozilla Readability 提取网页正文
     */
    public extractMainContent(html: string, url: string): WebArticle | null {
        // 创建 DOM 解析器
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // 设置文档的 URL（Readability 需要用于解析相对链接）
        const baseElement = doc.createElement('base');
        baseElement.href = url;
        doc.head.appendChild(baseElement);

        // 使用 Readability 提取正文
        const reader = new Readability(doc);
        const article = reader.parse();

        if (!article) {
            return null;
        }

        return {
            title: article.title || '',
            content: article.content || '',
            textContent: article.textContent || '',
            length: article.length || 0,
            excerpt: article.excerpt || '',
            byline: article.byline || '',
            dir: article.dir || '',
            siteName: article.siteName || '',
            lang: article.lang || ''
        };
    }

    /**
     * 将 HTML 正文转换为纯文本段落
     */
    public extractParagraphs(htmlContent: string): string[] {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;

        const paragraphs: string[] = [];

        // 提取所有段落标签
        const pElements = tempDiv.querySelectorAll('p');
        if (pElements.length > 0) {
            pElements.forEach(p => {
                const text = p.textContent?.trim();
                if (text && text.length > 20) { // 过滤过短的段落
                    paragraphs.push(text);
                }
            });
        }

        // 如果没有 <p> 标签，尝试按换行符分割
        if (paragraphs.length === 0) {
            const lines = tempDiv.textContent?.split(/\n+/).map(line => line.trim()).filter(Boolean) || [];
            lines.forEach(line => {
                if (line.length > 20) {
                    paragraphs.push(line);
                }
            });
        }

        return paragraphs;
    }

    /**
     * 格式化为 Markdown 文本
     */
    public formatAsMarkdown(article: WebArticle, sourceUrl: string): string {
        const lines: string[] = [];

        // 标题
        if (article.title) {
            lines.push(`# ${article.title}`);
            lines.push('');
        }

        // 元信息卡片
        lines.push('> [!info] 📰 文章信息');
        if (article.byline) {
            lines.push(`> **作者**: ${article.byline}`);
        }
        if (article.siteName) {
            lines.push(`> **来源**: ${article.siteName}`);
        }
        lines.push(`> **原文链接**: [🔗 点击访问](${sourceUrl})`);
        if (article.length) {
            lines.push(`> **字数**: ${article.length} 词`);
        }
        lines.push('');

        // 摘要（如果有）
        if (article.excerpt && article.excerpt.trim()) {
            lines.push('> [!abstract] 📝 摘要');
            lines.push(`> ${article.excerpt.trim()}`);
            lines.push('');
        }

        lines.push('---');
        lines.push('');

        // 正文段落
        const paragraphs = this.extractParagraphs(article.content);
        paragraphs.forEach((para, index) => {
            // 每个段落独立成行，段落间空行
            lines.push(para);
            lines.push('');
        });

        // 底部标签
        lines.push('---');
        lines.push('');
        lines.push('**标签**: #英语学习 #外文阅读');
        lines.push('');
        lines.push(`**导入时间**: ${new Date().toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        })}`);

        return lines.join('\n');
    }
}
