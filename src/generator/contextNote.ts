import { App } from 'obsidian';

/**
 * 自动提取包含单词的整句
 * @param paragraphText 单词所在的段落或整篇文本
 * @param wordOffset 单词在文本中的起始偏移位置
 */
export function extractSentence(paragraphText: string, wordOffset: number): string {
    if (!paragraphText || wordOffset < 0 || wordOffset >= paragraphText.length) {
        return '';
    }

    // 向前寻找句子的起始位置（句终标点或文本开头）
    let start = 0;
    for (let i = wordOffset - 1; i >= 0; i--) {
        const char = paragraphText[i];
        if ('.?!。？！\n\r'.includes(char)) {
            start = i + 1;
            break;
        }
    }

    // 向后寻找句子的终止位置（句终标点或文本结尾）
    let end = paragraphText.length;
    for (let i = wordOffset; i < paragraphText.length; i++) {
        const char = paragraphText[i];
        if ('.?!。？！\n\r'.includes(char)) {
            end = i + 1; // 包含该标点
            break;
        }
    }

    // 截取并清洗句子
    const sentence = paragraphText.slice(start, end).trim();
    return sentence;
}

/**
 * 解析 Markdown 里的 Front Matter 和正文内容
 */
function parseFrontMatter(content: string): { data: Record<string, string>; body: string } {
    const data: Record<string, string> = {};
    let body = content;

    const fmRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
    const match = content.match(fmRegex);
    if (match) {
        const fmText = match[1];
        body = content.slice(match[0].length);

        const lines = fmText.split(/\r?\n/);
        for (const line of lines) {
            const index = line.indexOf(':');
            if (index !== -1) {
                const key = line.slice(0, index).trim();
                const val = line.slice(index + 1).trim();
                Object.defineProperty(data, key, {
                    value: val,
                    writable: true,
                    enumerable: true,
                    configurable: true
                });
            }
        }
    }

    return { data, body };
}

/**
 * 重新拼接 Front Matter 和正文
 */
function stringifyFrontMatter(data: Record<string, string>, body: string): string {
    let fmText = '---\n';
    for (const key of Object.keys(data)) {
        fmText += `${key}: ${data[key]}\n`;
    }
    fmText += '---\n';
    return fmText + body.trimStart();
}

/**
 * 生成或追加语境卡片
 * 保存路径默认为 LangLearner/Cards/[word].md
 * @param app Obsidian App 实例
 * @param word 单词原型 (Lemma)
 * @param status 单词的熟悉度状态 (如 LEARNING)
 * @param trans 单词的中文释义
 * @param phonetic 单词音标
 * @param sentence 抓取到的上下文整句
 * @param sourceTitle 语境来源文章标题
 */
export async function appendContextNote(
    app: App,
    word: string,
    status: string,
    trans: string,
    phonetic: string | undefined,
    sentence: string,
    sourceTitle: string
): Promise<void> {
    const cleanWord = word.trim().toLowerCase();
    if (!cleanWord) return;

    const folderPath = 'LangLearner/Cards';
    const filePath = `${folderPath}/${cleanWord}.md`;
    const tempFilePath = `${folderPath}/${cleanWord}.tmp`;
    const today = new Date().toISOString().slice(0, 10);
    const displayPhonetic = phonetic ? `/${phonetic}/` : '暂无音标';

    try {
        const adapter = app.vault.adapter;

        // 1. 确保保存卡片的文件夹目录存在
        const folderExists = await adapter.exists(folderPath);
        if (!folderExists) {
            await adapter.mkdir(folderPath);
        }

        let newContent = '';

        // 2. 检查卡片文件是否已存在
        const fileExists = await adapter.exists(filePath);
        if (!fileExists) {
            // 新建卡片
            const initialFM = {
                word: cleanWord,
                status,
                added: today,
                updated: today
            };

            const initialBody = `
# ${cleanWord}

- **释义**: ${trans || '暂无释义'}
- **音标**: ${displayPhonetic}

## 历史流转语境

- [${today}] 来源: [[${sourceTitle}]]
  > ${sentence}
`;
            newContent = stringifyFrontMatter(initialFM, initialBody);
        } else {
            // 已存在卡片，执行追加逻辑
            const rawContent = await adapter.read(filePath);
            const { data, body } = parseFrontMatter(rawContent);

            // 更新 Front Matter 里的熟悉度状态和更新时间
            data.status = status;
            data.updated = today;

            // 检查句子是否已经包含在已有的历史语境中，防重复追加
            if (body.includes(sentence)) {
                // 如果已有相同的语境，只更新 Front Matter 即可写回
                newContent = stringifyFrontMatter(data, body);
            } else {
                let updatedBody = body;
                const contextSectionHeader = '## 历史流转语境';
                const appendText = `- [${today}] 来源: [[${sourceTitle}]]\n  > ${sentence}\n`;

                if (updatedBody.includes(contextSectionHeader)) {
                    // 追加到 "## 历史流转语境" 的尾部
                    const parts = updatedBody.split(contextSectionHeader);
                    // 最后一个部分追加新的语境
                    parts[parts.length - 1] = parts[parts.length - 1].trimEnd() + '\n' + appendText;
                    updatedBody = parts.join(contextSectionHeader);
                } else {
                    // 如果由于格式异常找不到标头，则直接在文件末尾追加
                    updatedBody = updatedBody.trimEnd() + '\n\n' + contextSectionHeader + '\n\n' + appendText;
                }

                newContent = stringifyFrontMatter(data, updatedBody);
            }
        }

        // 3. 直接覆盖写入目标文件 (Obsidian 底层已包含防损保护)
        await adapter.write(filePath, newContent);
    } catch (err) {
        console.error(`生成/追加 [${cleanWord}] 的语境卡片时发生异常:`, err);
    }
}

/**
 * 导出 AI 教师解析到单词卡片，并自动建立词根图谱双链
 */
export async function updateAIContextNote(
    app: App,
    word: string,
    root: string,
    rootMeaning: string,
    aiMarkdown: string
): Promise<void> {
    const cleanWord = word.trim().toLowerCase();
    if (!cleanWord) return;

    const folderPath = 'LangLearner/Cards';
    const filePath = `${folderPath}/${cleanWord}.md`;
    const today = new Date().toISOString().slice(0, 10);

    try {
        const adapter = app.vault.adapter;
        const folderExists = await adapter.exists(folderPath);
        if (!folderExists) {
            await adapter.mkdir(folderPath);
        }

        let rawContent = '';
        if (await adapter.exists(filePath)) {
            rawContent = await adapter.read(filePath);
        } else {
            // 如果尚不存在，先初始化
            const initialFM = { word: cleanWord, status: 'UNKNOWN', added: today, updated: today };
            const initialBody = `\n# ${cleanWord}\n\n- **释义**: 暂无\n`;
            rawContent = stringifyFrontMatter(initialFM, initialBody);
        }

        const { data, body } = parseFrontMatter(rawContent);
        let updatedBody = body;

        // 1. 更新 Front Matter
        if (root) {
            data.root = root;
            data.rootMeaning = rootMeaning || '';
        }
        data.updated = today;

        // 2. 注入词根双链
        if (root && !updatedBody.includes('**关联词根**:')) {
            const rootLink = `- **关联词根**: [[Root - ${root}|${root} (${rootMeaning})]]\n`;
            // 尝试插在标题之后
            if (updatedBody.includes(`# ${cleanWord}`)) {
                updatedBody = updatedBody.replace(`# ${cleanWord}`, `# ${cleanWord}\n\n${rootLink}`);
            } else {
                updatedBody = rootLink + '\n' + updatedBody;
            }
        }

        // 3. 注入 AI 解析
        const aiSectionHeader = '## AI 教师解析';
        const aiBlock = `> [!tip] AI 解析 (${today})\n${aiMarkdown.split('\n').map(l => '> ' + l).join('\n')}\n`;
        
        if (updatedBody.includes(aiSectionHeader)) {
            // 追加
            const parts = updatedBody.split(aiSectionHeader);
            parts[parts.length - 1] = parts[parts.length - 1].trimEnd() + '\n\n' + aiBlock;
            updatedBody = parts.join(aiSectionHeader);
        } else {
            // 新增节
            updatedBody = updatedBody.trimEnd() + '\n\n' + aiSectionHeader + '\n\n' + aiBlock;
        }

        const newContent = stringifyFrontMatter(data, updatedBody);
        await adapter.write(filePath, newContent);
    } catch (err) {
        console.error(`导出 AI 解析至 [${cleanWord}] 时发生异常:`, err);
    }
}
