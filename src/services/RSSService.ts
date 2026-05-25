import { requestUrl } from 'obsidian';

export interface RSSFeed {
    name: string;
    url: string;
}

export interface RSSArticle {
    title: string;
    link: string;
    date: string;
    content: string;
    description: string;
}

export class RSSService {
    private static readonly RSS_FEEDS_KEY = 'lang-learner-rss-feeds';

    /**
     * 加载已订阅的 RSS 源列表
     */
    public loadFeeds(): RSSFeed[] {
        try {
            const saved = localStorage.getItem(RSSService.RSS_FEEDS_KEY);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error('加载 RSS 源失败:', e);
        }
        
        // 默认内置源
        const defaultFeeds: RSSFeed[] = [
            { name: 'Hacker News', url: 'https://news.ycombinator.com/rss' },
            { name: 'BBC Global News', url: 'http://feeds.bbci.co.uk/news/world/rss.xml' }
        ];
        this.saveFeeds(defaultFeeds);
        return defaultFeeds;
    }

    /**
     * 保存 RSS 订阅源列表
     */
    public saveFeeds(feeds: RSSFeed[]): void {
        try {
            localStorage.setItem(RSSService.RSS_FEEDS_KEY, JSON.stringify(feeds));
        } catch (e) {
            console.error('保存 RSS 源失败:', e);
        }
    }

    /**
     * 跨域拉取订阅源 XML 数据
     */
    public async fetchFeedXml(url: string): Promise<string> {
        // 优先使用 Obsidian requestUrl 绕过 CORS
        try {
            const res = await requestUrl({ url });
            return res.text || '';
        } catch (e) {
            console.warn('Obsidian requestUrl 获取 RSS 失败，回退到 fetch:', e);
        }
        
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`网络响应错误，状态码: ${res.status}`);
        }
        return await res.text();
    }

    /**
     * 解析 RSS/Atom XML 字符串，转换为标准文章格式
     */
    public parseRssXml(xmlText: string): RSSArticle[] {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        const items = xmlDoc.querySelectorAll('item');
        const parsedItems: RSSArticle[] = [];
        
        items.forEach(item => {
            const title = item.querySelector('title')?.textContent || '';
            const link = item.querySelector('link')?.textContent || '';
            const date = item.querySelector('pubDate')?.textContent || item.querySelector('date')?.textContent || '';
            
            let content = '';
            const contentEncoded = item.getElementsByTagName('content:encoded');
            if (contentEncoded && contentEncoded.length > 0) {
                content = contentEncoded[0].textContent || '';
            }
            if (!content) {
                content = item.querySelector('description')?.textContent || '';
            }
            
            parsedItems.push({
                title: title.trim(),
                link: link.trim(),
                date: date.trim(),
                content: content,
                description: item.querySelector('description')?.textContent || ''
            });
        });
        
        // 兼容 Atom 订阅格式
        if (parsedItems.length === 0) {
            const entries = xmlDoc.querySelectorAll('entry');
            entries.forEach(entry => {
                const title = entry.querySelector('title')?.textContent || '';
                const link = entry.querySelector('link')?.getAttribute('href') || entry.querySelector('link')?.textContent || '';
                const date = entry.querySelector('updated')?.textContent || entry.querySelector('published')?.textContent || '';
                const content = entry.querySelector('content')?.textContent || entry.querySelector('summary')?.textContent || '';
                parsedItems.push({
                    title: title.trim(),
                    link: link.trim(),
                    date: date.trim(),
                    content: content,
                    description: entry.querySelector('summary')?.textContent || ''
                });
            });
        }
        
        return parsedItems;
    }

    /**
     * 解析文章正文段落
     */
    public extractParagraphs(article: RSSArticle): string[] {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = article.content || article.description || '';
        
        let paragraphs: string[] = [];
        const pEls = tempDiv.querySelectorAll('p');
        if (pEls.length > 0) {
            pEls.forEach(p => {
                const txt = p.textContent?.trim();
                if (txt) paragraphs.push(txt);
            });
        } else {
            paragraphs = tempDiv.textContent?.split(/\n+/).map(p => p.trim()).filter(Boolean) || [];
        }

        if (paragraphs.length === 0 && tempDiv.textContent?.trim()) {
            paragraphs.push(tempDiv.textContent.trim());
        }
        return paragraphs;
    }
}
