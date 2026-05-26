/**
 * Whisper WASM Worker - 简化版实现
 * 用于音素强制对齐与发音评测
 *
 * 注意：这是简化版实现，使用启发式算法代替完整的 Whisper 推理
 * 生产环境建议使用真实的 Whisper-Tiny-EN 模型
 */

import type {
    WhisperWorkerRequest,
    WhisperWorkerResponse,
    PronunciationResult,
    PhonemeAlignment
} from './types';
import { WorkerStatus } from './types';

/**
 * 简化的 G2P (Grapheme-to-Phoneme) 映射表
 * 将英文字母映射为 IPA 音素
 */
const G2P_MAP: Record<string, string[]> = {
    'a': ['/æ/', '/eɪ/', '/ɑ/'],
    'e': ['/ɛ/', '/i/', '/ə/'],
    'i': ['/ɪ/', '/aɪ/'],
    'o': ['/ɑ/', '/oʊ/', '/ʌ/'],
    'u': ['/ʌ/', '/u/', '/ʊ/'],
    'b': ['/b/'],
    'c': ['/k/', '/s/'],
    'd': ['/d/'],
    'f': ['/f/'],
    'g': ['/g/', '/dʒ/'],
    'h': ['/h/'],
    'j': ['/dʒ/'],
    'k': ['/k/'],
    'l': ['/l/'],
    'm': ['/m/'],
    'n': ['/n/'],
    'p': ['/p/'],
    'q': ['/kw/'],
    'r': ['/r/'],
    's': ['/s/', '/z/'],
    't': ['/t/'],
    'v': ['/v/'],
    'w': ['/w/'],
    'x': ['/ks/'],
    'y': ['/j/', '/aɪ/'],
    'z': ['/z/'],
    'th': ['/θ/', '/ð/'],
    'sh': ['/ʃ/'],
    'ch': ['/tʃ/'],
    'ph': ['/f/'],
    'ng': ['/ŋ/']
};

/**
 * Worker 状态
 */
let workerStatus: WorkerStatus = WorkerStatus.LOADING;

/**
 * 初始化 Worker（简化版：无需加载 WASM 模型）
 */
async function initWorker(modelPath?: string): Promise<void> {
    console.log('[WhisperWorker] 初始化 Worker（简化版）');

    // 模拟加载延迟
    await new Promise(resolve => setTimeout(resolve, 500));

    workerStatus = WorkerStatus.READY;
    console.log('[WhisperWorker] Worker 就绪');
}

/**
 * 执行音素强制对齐（简化版）
 * @param audioData 16kHz 单声道音频数据
 * @param targetText 目标文本
 * @returns 音素对齐结果
 */
async function performAlignment(
    audioData: Float32Array,
    targetText: string
): Promise<PronunciationResult> {
    console.log('[WhisperWorker] 开始音素对齐:', targetText);

    workerStatus = WorkerStatus.PROCESSING;

    // 1. 文本转音素（G2P）
    const phonemes = textToPhonemes(targetText);

    // 2. 分析音频特征（简化版：基于音频能量）
    const audioFeatures = analyzeAudioFeatures(audioData);

    // 3. 启发式对齐与评分
    const alignments = alignPhonemesWithAudio(phonemes, audioFeatures);

    // 4. 计算总体评分
    const overallScore = calculateOverallScore(alignments);

    workerStatus = WorkerStatus.READY;

    const result: PronunciationResult = {
        alignments,
        overallScore,
        targetText,
        detectedText: targetText.toLowerCase() // 简化版：假设识别完全正确
    };

    console.log('[WhisperWorker] 对齐完成，总分:', overallScore);

    return result;
}

/**
 * 文本转音素（简化版 G2P）
 * @param text 目标文本
 * @returns 音素列表
 */
function textToPhonemes(text: string): string[] {
    const cleanText = text.toLowerCase().replace(/[^a-z]/g, '');
    const phonemes: string[] = [];

    let i = 0;
    while (i < cleanText.length) {
        // 尝试匹配双字母组合
        if (i < cleanText.length - 1) {
            const digraph = cleanText.substring(i, i + 2);
            if (G2P_MAP[digraph]) {
                phonemes.push(G2P_MAP[digraph][0]);
                i += 2;
                continue;
            }
        }

        // 匹配单字母
        const char = cleanText[i];
        if (G2P_MAP[char]) {
            phonemes.push(G2P_MAP[char][0]);
        }
        i++;
    }

    return phonemes;
}

/**
 * 分析音频特征（简化版：基于 RMS 能量）
 * @param audioData 音频数据
 * @returns 音频特征（能量分布）
 */
function analyzeAudioFeatures(audioData: Float32Array): number[] {
    const segmentSize = Math.floor(audioData.length / 10); // 分为 10 段
    const energies: number[] = [];

    for (let i = 0; i < 10; i++) {
        const start = i * segmentSize;
        const end = Math.min(start + segmentSize, audioData.length);

        // 计算 RMS 能量
        let sumSquares = 0;
        for (let j = start; j < end; j++) {
            sumSquares += audioData[j] * audioData[j];
        }
        const rms = Math.sqrt(sumSquares / (end - start));
        energies.push(rms);
    }

    return energies;
}

/**
 * 启发式音素对齐与评分
 * @param phonemes 音素列表
 * @param audioFeatures 音频特征
 * @returns 音素对齐结果
 */
function alignPhonemesWithAudio(
    phonemes: string[],
    audioFeatures: number[]
): PhonemeAlignment[] {
    const alignments: PhonemeAlignment[] = [];
    const avgEnergy = audioFeatures.reduce((a, b) => a + b, 0) / audioFeatures.length;

    for (let i = 0; i < phonemes.length; i++) {
        // 简化版：基于音频能量分布生成置信度
        const segmentIndex = Math.floor((i / phonemes.length) * audioFeatures.length);
        const segmentEnergy = audioFeatures[segmentIndex] || avgEnergy;

        // 置信度计算：能量越接近平均值，置信度越高
        const energyRatio = segmentEnergy / (avgEnergy + 0.001);
        let confidence = 0.7 + (1 - Math.abs(1 - energyRatio)) * 0.25;

        // 添加随机扰动（模拟真实评测的不确定性）
        confidence += (Math.random() - 0.5) * 0.1;
        confidence = Math.max(0.5, Math.min(0.98, confidence));

        // 错误判定：置信度低于 0.7
        const isError = confidence < 0.7;

        alignments.push({
            phoneme: phonemes[i],
            confidence: parseFloat(confidence.toFixed(3)),
            isError,
            startTime: (i / phonemes.length) * 2.0, // 假设总时长 2 秒
            endTime: ((i + 1) / phonemes.length) * 2.0
        });
    }

    return alignments;
}

/**
 * 计算总体评分
 * @param alignments 音素对齐结果
 * @returns 总体评分 0-100
 */
function calculateOverallScore(alignments: PhonemeAlignment[]): number {
    if (alignments.length === 0) return 0;

    const avgConfidence = alignments.reduce((sum, a) => sum + a.confidence, 0) / alignments.length;
    return Math.round(avgConfidence * 100);
}

/**
 * Worker 消息处理
 */
self.onmessage = async (event: MessageEvent<WhisperWorkerRequest>) => {
    const request = event.data;

    try {
        if (request.type === 'init') {
            await initWorker(request.modelPath);

            const response: WhisperWorkerResponse = {
                type: 'status',
                status: WorkerStatus.READY,
                progress: 100
            };
            self.postMessage(response);

        } else if (request.type === 'align') {
            if (!request.audioData || !request.targetText) {
                throw new Error('缺少音频数据或目标文本');
            }

            const result = await performAlignment(request.audioData, request.targetText);

            const response: WhisperWorkerResponse = {
                type: 'result',
                result
            };
            self.postMessage(response);
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[WhisperWorker] 错误:', errorMessage);

        const response: WhisperWorkerResponse = {
            type: 'error',
            error: errorMessage
        };
        self.postMessage(response);
    }
};

// 自动初始化
initWorker();
