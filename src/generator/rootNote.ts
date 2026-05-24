import { App } from 'obsidian';

/**
 * 确保为某个词根生成聚合图谱节点，并将当前单词的双链挂载在下层
 * @param app Obsidian App 实例
 * @param root 词根（如 "spect"）
 * @param meaning 词根含义
 * @param word 触发本次操作的单词
 */
export async function ensureRootNoteLinked(
    app: App,
    root: string,
    meaning: string,
    word: string
): Promise<void> {
    const cleanRoot = root.trim().toLowerCase();
    const cleanWord = word.trim().toLowerCase();
    
    if (!cleanRoot || !cleanWord) return;

    const folderPath = 'LangLearner/Roots';
    const filePath = `${folderPath}/Root - ${cleanRoot}.md`;

    try {
        const adapter = app.vault.adapter;

        // 1. 确保保存卡片的文件夹目录存在
        const folderExists = await adapter.exists(folderPath);
        if (!folderExists) {
            await adapter.mkdir(folderPath);
        }

        // 2. 检查词根节点文件是否已存在
        const fileExists = await adapter.exists(filePath);
        if (!fileExists) {
            // 新建词根节点
            const initialBody = `
# 词根: ${cleanRoot}

- **含义**: ${meaning || '暂无释义'}

## 包含此词根的生词库

- [[${cleanWord}]]
`.trimStart();
            await adapter.write(filePath, initialBody);
        } else {
            // 已存在，执行追加逻辑
            let rawContent = await adapter.read(filePath);
            const wordLink = `- [[${cleanWord}]]`;

            // 检查是否已经包含了这个单词的链接，防重复追加
            if (!rawContent.includes(wordLink)) {
                const listSectionHeader = '## 包含此词根的生词库';

                if (rawContent.includes(listSectionHeader)) {
                    // 追加到 "## 包含此词根的生词库" 的末尾
                    const parts = rawContent.split(listSectionHeader);
                    parts[1] = parts[1].trimEnd() + '\n' + wordLink + '\n';
                    rawContent = parts.join(listSectionHeader + '\n\n');
                } else {
                    // 如果由于格式异常找不到标头，则直接在文件末尾追加
                    rawContent = rawContent.trimEnd() + '\n\n' + listSectionHeader + '\n\n' + wordLink + '\n';
                }

                await adapter.write(filePath, rawContent);
            }
        }
    } catch (err) {
        console.error(`确保词根图谱节点 [Root - ${cleanRoot}] 连线时发生异常:`, err);
    }
}
