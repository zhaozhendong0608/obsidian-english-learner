/**
 * Mock WASM Worker - 用于 S2-Stub 阶段验证 UI 交互
 * 返回假音素对齐结果，模拟真实 Whisper 引擎的输出
 */

import type { PronunciationResult, PhonemeAlignment } from '../types';

/**
 * 生成 Mock 音素对齐结果
 * @param targetText 目标文本（用于生成对应数量的音素）
 * @returns Mock 的发音评测结果
 */
export function generateMockPronunciationResult(targetText: string): PronunciationResult {
    // 模拟音素列表（根据目标文本长度生成 3-8 个音素）
    const phonemeCount = Math.min(Math.max(3, Math.floor(targetText.length / 2)), 8);
    const mockPhonemes = ['/æ/', '/p/', '/əl/', '/r/', '/ɪ/', '/d/', '/ð/', '/ʌ/'];

    const alignments: PhonemeAlignment[] = [];
    let totalConfidence = 0;

    for (let i = 0; i < phonemeCount; i++) {
        // 随机生成置信度 0.6-0.95
        const confidence = 0.6 + Math.random() * 0.35;
        totalConfidence += confidence;

        // 置信度低于 0.7 标记为错误
        const isError = confidence < 0.7;

        alignments.push({
            phoneme: mockPhonemes[i % mockPhonemes.length],
            confidence: parseFloat(confidence.toFixed(3)),
            isError,
            startTime: i * 0.15,
            endTime: (i + 1) * 0.15
        });
    }

    // 计算总体评分（基于平均置信度）
    const avgConfidence = totalConfidence / phonemeCount;
    const overallScore = Math.round(avgConfidence * 100);

    return {
        alignments,
        overallScore,
        targetText,
        detectedText: targetText.toLowerCase() // Mock: 假设识别完全正确
    };
}

/**
 * 模拟异步处理延迟（模拟 WASM 推理耗时）
 * @param ms 延迟毫秒数
 */
export function mockDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
