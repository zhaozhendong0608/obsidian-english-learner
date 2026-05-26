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
 * @param word 单词
 * @param contextSentence 用户当前阅读的上下文
 * @param settings AI 服务配置
 */
export async function fetchAITeacher(
    word: string,
    contextSentence: string | undefined,
    settings: AISettings
): Promise<AIResponse> {
    if (!settings.apiKey) {
        throw new Error('未配置 API Key。请在侧边栏顶部展开 AI 教师配置。');
    }

    const apiUrl = `${settings.baseUrl.replace(/\/$/, '')}/chat/completions`;

    let contextStr = '';
    if (contextSentence && contextSentence.trim()) {
        contextStr = `\\n此单词出现的上下文语境是："${contextSentence}"\\n请结合此语境进行解释和举一反三。`;
    }

    const systemPrompt = `你是一位精通英语词源学、语言学且极具启发性的英语导师。
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

    const userPrompt = `请为我详细讲解单词：${word}${contextStr}`;

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
