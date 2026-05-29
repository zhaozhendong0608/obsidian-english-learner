import { requestUrl } from 'obsidian';
import type { PhonemeAlignment } from '../types';

export interface AISettings {
    apiKey: string;
    baseUrl: string;
    model: string;
}

export interface AIResponse {
    root?: string;
    rootMeaning?: string;
    phrases?: string[];
    markdown: string;
}

/**
 * 发音评测诊断请求参数
 */
export interface PronunciationDiagnosisRequest {
    targetText: string;           // 目标文本
    errorPhonemes: PhonemeAlignment[]; // 错误音素列表
    overallScore: number;         // 总体评分
    accent: 'US' | 'UK';          // 发音标准（美音/英音）
}

/**
 * 询问 AI 教师获取单词的详细解析、词根与词组
 * @param word 单词或中文词汇
 * @param contextSentence 用户当前阅读的上下文
 * @param settings AI 服务配置
 * @param isChinese 是否为中文查询（触发同义词辨析模式）
 */
export async function fetchAITeacher(
    word: string,
    contextSentence: string | undefined,
    settings: AISettings,
    isChinese: boolean = false
): Promise<AIResponse> {
    if (!settings.apiKey) {
        throw new Error('未配置 API Key。请在侧边栏顶部展开 AI 教师配置。');
    }

    const apiUrl = `${settings.baseUrl.replace(/\/$/, '')}/chat/completions`;

    let contextStr = '';
    if (contextSentence && contextSentence.trim()) {
        contextStr = `\\n此单词出现的上下文语境是："${contextSentence}"\\n请结合此语境进行解释和举一反三。`;
    }

    // 根据是否为中文查询，使用不同的 System Prompt
    let systemPrompt: string;
    let userPrompt: string;

    if (isChinese) {
        // 中文查询模式：同义词精细语境辨析
        systemPrompt = `你是一位精通中英翻译、语境辨析且极具启发性的英语写作导师。
你的任务是为用户提供中文词汇对应的英文表达的精细辨析和场景造句。

分析要求：
1. 列出该中文词汇对应的 3-5 个常用英文表达（按使用频率排序）
2. 对每个英文表达进行精细的语境辨析：
   - 适用场景（正式/非正式、口语/书面、学术/日常）
   - 语义侧重点（强调什么方面）
   - 搭配习惯（常见的前后搭配词）
3. 为每个英文表达提供 1-2 个真实场景下的地道造句
4. 给出选词建议：在什么情况下优先使用哪个表达

【强制格式要求】
你的回答必须分为两部分：
第一部分：一个纯 JSON 块，用于程序提取数据。
第二部分：一段详细的 Markdown 讲解。

格式如下：
\`\`\`json
{
  "root": "",
  "rootMeaning": "",
  "phrases": ["英文表达1", "英文表达2", "英文表达3"]
}
\`\`\`
接下来是你任意发挥的详细 Markdown 讲解（包含语境辨析、造句示例、选词建议等）。`;

        userPrompt = `请为我详细辨析中文词汇"${word}"对应的英文表达，并提供场景造句和选词建议。${contextStr}`;
    } else {
        // 英文查询模式：词根词源解析
        systemPrompt = `你是一位精通英语词源学、语言学且极具启发性的英语导师。
你的任务是为用户提供极度深度的单词解析。
分析要求：
1. 请给出该词的核心词根（Root）和词缀拆解，并指出词根的基本含义。
2. 请给出该词的常用词组/固定搭配（至少2-3个）。
3. 结合用户提供的语境（如果有），深入剖析这个词在当前语境下的精妙用法。
4. 举一反三：给出 2 个不同生活/学术场景下的精巧造句。

【强制格式要求】
你的回答必须分为两部分：
第一部分：一个纯 JSON 块，用于程序提取数据。
第二部分：一段详细的 Markdown 讲解。

格式如下：
\`\`\`json
{
  "root": "提取出的核心英文词根，比如 spect，如果没有或不可拆则为空",
  "rootMeaning": "该词根的中文含义，比如 看",
  "phrases": ["词组1", "词组2"]
}
\`\`\`
接下来是你任意发挥的详细 Markdown 讲解（可以包含粗体、代码块、引用等格式）。`;

        userPrompt = `请为我详细讲解单词：${word}${contextStr}`;
    }

    const payload = {
        model: settings.model || 'deepseek-chat',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
    };

    try {
        const response = await requestUrl({
            url: apiUrl,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (response.status !== 200) {
            throw new Error(`API 响应错误: ${response.status} - ${response.text}`);
        }

        const data = typeof response.json === 'object' ? response.json : JSON.parse(response.text);
        const content = data.choices?.[0]?.message?.content || '';

        // 尝试解析 JSON 块
        let root = '';
        let rootMeaning = '';
        let phrases: string[] = [];
        let markdown = content;

        const jsonBlockRegex = /\`\`\`json\s*([\s\S]*?)\s*\`\`\`/;
        const match = content.match(jsonBlockRegex);
        if (match) {
            try {
                const parsed = JSON.parse(match[1]);
                root = parsed.root || '';
                rootMeaning = parsed.rootMeaning || '';
                phrases = parsed.phrases || [];
                // 从 Markdown 显示中移除 JSON 块
                markdown = content.replace(jsonBlockRegex, '').trim();
            } catch (e) {
                console.warn('AI 返回的 JSON 块解析失败', e);
            }
        }

        return { root, rootMeaning, phrases, markdown };
    } catch (err: any) {
        console.error('fetchAITeacher failed:', err);
        throw new Error(`AI 请求失败: ${err.message || String(err)}`);
    }
}

/**
 * 请求 DeepSeek 发音肌肉纠偏诊断
 * @param request 诊断请求参数
 * @param settings AI 服务配置
 * @returns Markdown 格式的诊断报告
 */
export async function requestPronunciationDiagnosis(
    request: PronunciationDiagnosisRequest,
    settings: AISettings
): Promise<string> {
    if (!settings.apiKey) {
        throw new Error('未配置 API Key。请在侧边栏顶部展开 AI 教师配置。');
    }

    const apiUrl = `${settings.baseUrl.replace(/\/$/, '')}/chat/completions`;

    // 构建错误音素描述
    const errorPhonemesDesc = request.errorPhonemes
        .map(p => `- **${p.phoneme}** (置信度: ${(p.confidence * 100).toFixed(1)}%)`)
        .join('\n');

    // 根据发音标准构建 System Prompt
    const accentDesc = request.accent === 'US'
        ? '美式发音 (General American)'
        : '英式发音 (Received Pronunciation)';

    const systemPrompt = `你是一位专业的英语发音教练，精通语音学、音素学和中式英语发音纠正。
你的任务是基于用户的发音评测结果，提供个性化的肌肉纠偏诊断和改进建议。

【分析要求】
1. **错误音素分析**: 针对每个错误音素，解释其正确的发音方式（舌位、唇形、气流）
2. **中式发音习惯**: 分析中国学习者在这些音素上的常见错误原因（母语干扰、肌肉记忆）
3. **肌肉纠偏练习**: 提供具体的舌位调整、口腔肌肉训练方法（如含水练习、镜子对照）
4. **循序渐进方案**: 给出从慢速到正常语速的练习步骤

【发音标准】
本次诊断基于 **${accentDesc}** 标准。

【输出格式】
请使用 Markdown 格式输出，包含以下章节：
- ## 🎯 发音诊断报告
- ### 总体评分
- ### 错误音素分析
- ### 💡 改进建议
  - #### 舌位调整
  - #### 练习方法
- ### 📚 推荐资源`;

    const userPrompt = `请为我诊断以下发音问题：

**目标文本**: ${request.targetText}
**总体评分**: ${request.overallScore}/100
**错误音素**:
${errorPhonemesDesc || '无明显错误音素'}

请提供详细的肌肉纠偏诊断和改进建议。`;

    const payload = {
        model: settings.model || 'deepseek-chat',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        stream: false // 暂不使用流式响应，简化实现
    };

    try {
        const response = await requestUrl({
            url: apiUrl,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (response.status !== 200) {
            throw new Error(`API 响应错误: ${response.status} - ${response.text}`);
        }

        const data = typeof response.json === 'object' ? response.json : JSON.parse(response.text);
        const content = data.choices?.[0]?.message?.content || '';

        if (!content) {
            throw new Error('AI 返回内容为空');
        }

        console.log('[aiService] 发音诊断请求成功');
        return content;
    } catch (err: any) {
        console.error('[aiService] requestPronunciationDiagnosis failed:', err);
        throw new Error(`发音诊断请求失败: ${err.message || String(err)}`);
    }
}

/**
 * 流式请求 DeepSeek 发音肌肉纠偏诊断
 * 优先使用标准 fetch 实现 SSE，失败后自动退避至 requestUrl
 */
export async function requestPronunciationDiagnosisStream(
    request: PronunciationDiagnosisRequest,
    settings: AISettings,
    onChunk: (chunk: string) => void
): Promise<string> {
    if (!settings.apiKey) {
        throw new Error('未配置 API Key。请在侧边栏顶部展开 AI 教师配置。');
    }

    const apiUrl = `${settings.baseUrl.replace(/\/$/, '')}/chat/completions`;

    // 构建错误音素描述
    const errorPhonemesDesc = request.errorPhonemes
        .map(p => `- **${p.phoneme}** (置信度: ${(p.confidence * 100).toFixed(1)}%)`)
        .join('\n');

    // 根据发音标准构建 System Prompt
    const accentDesc = request.accent === 'US'
        ? '美式发音 (General American)'
        : '英式发音 (Received Pronunciation)';

    const systemPrompt = `你是一位专业的英语发音教练，精通语音学、音素学和中式英语发音纠正。
你的任务是基于用户的发音评测结果，提供个性化的肌肉纠偏诊断和改进建议。

【分析要求】
1. **错误音素分析**: 针对每个错误音素，解释其正确的发音方式（舌位、唇形、气流）
2. **中式发音习惯**: 分析中国学习者在这些音素上的常见错误原因（母语干扰、肌肉记忆）
3. **肌肉纠偏练习**: 提供具体的舌位调整、口腔肌肉训练方法（如含水练习、镜子对照）
4. **循序渐进方案**: 给出从慢速到正常语速的练习步骤

【发音标准】
本次诊断基于 **${accentDesc}** 标准。

【输出格式】
请使用 Markdown 格式输出，包含以下章节：
- ## 🎯 发音诊断报告
- ### 总体评分
- ### 错误音素分析
- ### 💡 改进建议
  - #### 舌位调整
  - #### 练习方法
- ### 📚 推荐资源`;

    const userPrompt = `请为我诊断以下发音问题：

**目标文本**: ${request.targetText}
**总体评分**: ${request.overallScore}/100
**错误音素**:
${errorPhonemesDesc || '无明显错误音素'}

请提供详细的肌肉纠偏诊断和改进建议。`;

    console.log('[aiService] 尝试启动 SSE 流式诊断请求...');

    try {
        // 首选：使用标准 fetch 实现 SSE
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.apiKey}`
            },
            body: JSON.stringify({
                model: settings.model || 'deepseek-chat',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.7,
                stream: true
            })
        });

        if (!response.ok) {
            throw new Error(`SSE 状态错误: ${response.status} ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder('utf-8');
        if (!reader) {
            throw new Error('无法创建流式读取器');
        }

        let fullContent = '';
        let partialLine = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = (partialLine + chunk).split('\n');
            partialLine = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                if (trimmed === 'data: [DONE]') continue;

                if (trimmed.startsWith('data: ')) {
                    try {
                        const jsonStr = trimmed.slice(6);
                        const parsed = JSON.parse(jsonStr);
                        const content = parsed.choices?.[0]?.delta?.content || '';
                        if (content) {
                            fullContent += content;
                            onChunk(content);
                        }
                    } catch (e) {
                        // 忽略半包或解析错误行
                    }
                }
            }
        }
        
        console.log('[aiService] SSE 流式请求已顺利完成');
        return fullContent;

    } catch (sseError) {
        console.warn('[aiService] SSE 流式下载失败，退避为 requestUrl 兜底:', sseError);
        
        // 兜底：使用 requestUrl 全量拉取
        const fullContent = await requestPronunciationDiagnosis(request, settings);
        onChunk(fullContent);
        return fullContent;
    }
}
