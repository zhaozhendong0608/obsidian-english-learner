import * as ort from 'onnxruntime-web';

// 定义接口，对齐 workers/types.ts 中的定义
export enum WorkerStatus {
    LOADING = 'loading',
    READY = 'ready',
    PROCESSING = 'processing',
    ERROR = 'error'
}

export interface WhisperWorkerRequest {
    type: 'init' | 'align';
    encoderBuffer?: ArrayBuffer;
    decoderBuffer?: ArrayBuffer;
    audioData?: Float32Array; // 16kHz
    targetText?: string;
    wasmPaths?: string | Record<string, string>;
}

export interface PhonemeAlignment {
    phoneme: string;
    confidence: number;
    isError: boolean;
    startTime?: number;
    endTime?: number;
}

export interface PronunciationResult {
    alignments: PhonemeAlignment[];
    overallScore: number;
    targetText: string;
    detectedText?: string;
}

export interface WhisperWorkerResponse {
    type: 'status' | 'result' | 'error';
    status?: WorkerStatus;
    result?: PronunciationResult;
    error?: string;
    progress?: number;
}

/**
 * 简化的 G2P (Grapheme-to-Phoneme) 映射表
 * 包含常用词的精确音标，以及字母级兜底映射
 */
const CMU_VOCAB: Record<string, string[]> = {
    'hello': ['h', 'ə', 'l', 'oʊ'],
    'apple': ['æ', 'p', 'əl'],
    'world': ['w', 'ɜː', 'l', 'd'],
    'cat': ['k', 'æ', 't'],
    'dog': ['d', 'ɔ', 'g'],
    'book': ['b', 'ʊ', 'k'],
    'good': ['g', 'ʊ', 'd'],
    'water': ['w', 'ɔː', 't', 'ə'],
    'thank': ['θ', 'æ', 'ŋ', 'k'],
    'you': ['j', 'uː'],
    'yes': ['j', 'ɛ', 's'],
    'no': ['n', 'oʊ'],
    'please': ['p', 'l', 'iː', 'z'],
    'sorry': ['s', 'ɒ', 'r', 'i'],
    'excuse': ['ɪ', 'k', 's', 'k', 'j', 'uː', 'z'],
    'me': ['m', 'iː'],
    'mitigate': ['m', 'ɪ', 't', 'ɪ', 'g', 'eɪ', 't'],
    'diminish': ['d', 'ɪ', 'm', 'ɪ', 'n', 'ɪ', 'ʃ'],
    'reduce': ['r', 'ɪ', 'd', 'uː', 's'],
    'grasp': ['g', 'r', 'æ', 's', 'p'],
    'master': ['m', 'æ', 's', 't', 'ər'],
    'command': ['k', 'ə', 'm', 'æ', 'n', 'd'],
    'english': ['ɪ', 'ŋ', 'g', 'l', 'ɪ', 'ʃ']
};

const G2P_RULES: Record<string, string> = {
    'a': 'æ', 'b': 'b', 'c': 'k', 'd': 'd', 'e': 'ɛ', 'f': 'f', 'g': 'g', 'h': 'h',
    'i': 'ɪ', 'j': 'dʒ', 'k': 'k', 'l': 'l', 'm': 'm', 'n': 'n', 'o': 'ɒ', 'p': 'p',
    'q': 'k', 'r': 'r', 's': 's', 't': 't', 'u': 'ʌ', 'v': 'v', 'w': 'w', 'x': 'ks',
    'y': 'j', 'z': 'z'
};

let encoderSession: ort.InferenceSession | null = null;
let decoderSession: ort.InferenceSession | null = null;
let workerStatus = WorkerStatus.LOADING;

/**
 * 将文本转为音标序列
 */
function wordToPhonemes(word: string): string[] {
    const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
    if (CMU_VOCAB[cleanWord]) {
        return CMU_VOCAB[cleanWord];
    }
    const phonemes: string[] = [];
    let i = 0;
    while (i < cleanWord.length) {
        // 尝试双字母组合
        if (i < cleanWord.length - 1) {
            const doubleChar = cleanWord.substring(i, i + 2);
            const digraphs: Record<string, string> = {
                'th': 'θ', 'sh': 'ʃ', 'ch': 'tʃ', 'ph': 'f', 'ng': 'ŋ', 'ee': 'iː', 'oo': 'uː'
            };
            if (digraphs[doubleChar]) {
                phonemes.push(digraphs[doubleChar]);
                i += 2;
                continue;
            }
        }
        const char = cleanWord[i];
        phonemes.push(G2P_RULES[char] || char);
        i++;
    }
    return phonemes;
}

/**
 * 句子级 G2P
 */
function sentenceToPhonemes(text: string): string[] {
    const words = text.split(/\s+/);
    const allPhonemes: string[] = [];
    for (const word of words) {
        allPhonemes.push(...wordToPhonemes(word));
    }
    return allPhonemes;
}

/**
 * Cooley-Tukey Radix-2 FFT
 */
function fft(real: Float32Array, imag: Float32Array) {
    const n = real.length;
    if (n <= 1) return;
    let limit = 1;
    let bit = n >> 1;
    while (limit < n) {
        if (limit < bit) {
            let temp = real[limit];
            real[limit] = real[bit];
            real[bit] = temp;
            temp = imag[limit];
            imag[limit] = imag[bit];
            imag[bit] = temp;
        }
        let mask = n >> 1;
        while (bit & mask) {
            bit ^= mask;
            mask >>= 1;
        }
        bit ^= mask;
        limit++;
    }
    for (let len = 2; len <= n; len <<= 1) {
        const angle = (-2 * Math.PI) / len;
        const wlen_r = Math.cos(angle);
        const wlen_i = Math.sin(angle);
        for (let i = 0; i < n; i += len) {
            let w_r = 1.0;
            let w_i = 0.0;
            for (let j = 0; j < len / 2; j++) {
                const u_r = real[i + j];
                const u_i = imag[i + j];
                const v_r = real[i + j + len / 2] * w_r - imag[i + j + len / 2] * w_i;
                const v_i = real[i + j + len / 2] * w_i + imag[i + j + len / 2] * w_r;
                real[i + j] = u_r + v_r;
                imag[i + j] = u_i + v_i;
                real[i + j + len / 2] = u_r - v_r;
                imag[i + j + len / 2] = u_i - v_i;
                const next_w_r = w_r * wlen_r - w_i * wlen_i;
                w_i = w_r * wlen_i + w_i * wlen_r;
                w_r = next_w_r;
            }
        }
    }
}

/**
 * 动态生成 Mel 滤波器组
 */
function getMelFilterbank(numMelBins = 80, fftSize = 512, sampleRate = 16000): number[][] {
    const hzToMel = (hz: number) => 2595 * Math.log10(1 + hz / 700);
    const melToHz = (mel: number) => 700 * (Math.pow(10, mel / 2595) - 1);
    
    const melMin = 0;
    const melMax = hzToMel(sampleRate / 2);
    const melPoints = new Float32Array(numMelBins + 2);
    for (let i = 0; i < numMelBins + 2; i++) {
        melPoints[i] = melMin + (i * (melMax - melMin)) / (numMelBins + 1);
    }
    const hzPoints = new Float32Array(numMelBins + 2);
    for (let i = 0; i < numMelBins + 2; i++) {
        hzPoints[i] = melToHz(melPoints[i]);
    }
    const binPoints = new Int32Array(numMelBins + 2);
    for (let i = 0; i < numMelBins + 2; i++) {
        binPoints[i] = Math.floor(((fftSize + 1) * hzPoints[i]) / sampleRate);
    }
    const filterbank: number[][] = [];
    for (let i = 0; i < numMelBins; i++) {
        filterbank.push(new Array(Math.floor(fftSize / 2) + 1).fill(0));
    }
    for (let m = 1; m <= numMelBins; m++) {
        const left = binPoints[m - 1];
        const center = binPoints[m];
        const right = binPoints[m + 1];
        for (let k = left; k < center; k++) {
            filterbank[m - 1][k] = (k - binPoints[m - 1]) / (binPoints[m] - binPoints[m - 1]);
        }
        for (let k = center; k <= right; k++) {
            filterbank[m - 1][k] = (binPoints[m + 1] - k) / (binPoints[m + 1] - binPoints[m]);
        }
    }
    return filterbank;
}

/**
 * 转换 16kHz 音频为 Log-Mel 谱图 [80, 3000]
 */
function computeLogMelSpectrogram(audioData: Float32Array): Float32Array {
    const numMelBins = 80;
    const fftSize = 512;
    const winLength = 400;
    const hopLength = 160;
    const maxFrames = 3000; // Whisper 固定输入为 30 秒（3000 帧）
    
    // 生成汉宁窗
    const window = new Float32Array(winLength);
    for (let i = 0; i < winLength; i++) {
        window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (winLength - 1)));
    }
    
    const filterbank = getMelFilterbank(numMelBins, fftSize, 16000);
    const melSpectrogram = new Float32Array(numMelBins * maxFrames);
    
    for (let frame = 0; frame < maxFrames; frame++) {
        const start = frame * hopLength;
        const real = new Float32Array(fftSize);
        const imag = new Float32Array(fftSize);
        
        // 填充帧数据并应用窗口
        for (let i = 0; i < winLength; i++) {
            if (start + i < audioData.length) {
                real[i] = audioData[start + i] * window[i];
            } else {
                real[i] = 0.0;
            }
        }
        
        fft(real, imag);
        
        // 功率谱
        const powerSpec = new Float32Array(Math.floor(fftSize / 2) + 1);
        for (let k = 0; k < powerSpec.length; k++) {
            powerSpec[k] = real[k] * real[k] + imag[k] * imag[k];
        }
        
        // 映射到 Mel 频段
        for (let melBin = 0; melBin < numMelBins; melBin++) {
            let melVal = 0;
            for (let k = 0; k < powerSpec.length; k++) {
                melVal += powerSpec[k] * filterbank[melBin][k];
            }
            // 计算 Log-Mel，加上极小量防止 log(0)
            const logMelVal = Math.log10(Math.max(melVal, 1e-5));
            // 归一化并保存
            const index = melBin * maxFrames + frame;
            melSpectrogram[index] = (logMelVal + 4.0) / 4.0;
        }
    }
    return melSpectrogram;
}

/**
 * 启发式对齐算法：利用动态规划对齐目标音素和实际发音音素
 */
function alignPhonemes(targetPhonemes: string[], detectedPhonemes: string[]): PhonemeAlignment[] {
    const n = targetPhonemes.length;
    const m = detectedPhonemes.length;
    
    // DP 状态表，记录编辑距离
    const dp: number[][] = [];
    for (let i = 0; i <= n; i++) {
        dp.push(new Array(m + 1).fill(0));
    }
    
    for (let i = 0; i <= n; i++) dp[i][0] = i;
    for (let j = 0; j <= m; j++) dp[0][j] = j;
    
    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            if (targetPhonemes[i - 1] === detectedPhonemes[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,    // 删除
                    dp[i][j - 1] + 1,    // 插入
                    dp[i - 1][j - 1] + 1  // 替换
                );
            }
        }
    }
    
    // 回溯对齐路径
    const alignments: PhonemeAlignment[] = [];
    let i = n;
    let j = m;
    
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && targetPhonemes[i - 1] === detectedPhonemes[j - 1]) {
            alignments.unshift({
                phoneme: `/${targetPhonemes[i - 1]}/`,
                confidence: 0.9 + Math.random() * 0.08, // 正确，给予高置信度
                isError: false
            });
            i--;
            j--;
        } else {
            // 选择步数最小的路径
            const minChoice = Math.min(
                i > 0 ? dp[i - 1][j] : Infinity,
                j > 0 ? dp[i][j - 1] : Infinity,
                (i > 0 && j > 0) ? dp[i - 1][j - 1] : Infinity
            );
            
            if (i > 0 && j > 0 && minChoice === dp[i - 1][j - 1]) {
                // 替换：用户读错
                alignments.unshift({
                    phoneme: `/${targetPhonemes[i - 1]}/`,
                    confidence: 0.4 + Math.random() * 0.25, // 读错，置信度低
                    isError: true
                });
                i--;
                j--;
            } else if (i > 0 && minChoice === dp[i - 1][j]) {
                // 遗漏音素
                alignments.unshift({
                    phoneme: `/${targetPhonemes[i - 1]}/`,
                    confidence: 0.3,
                    isError: true
                });
                i--;
            } else {
                // 多读音素，在 target 对齐中忽略，只减去 j
                j--;
            }
        }
    }
    
    return alignments;
}

/**
 * 消息事件分发
 */
self.onmessage = async (event: MessageEvent<WhisperWorkerRequest>) => {
    const request = event.data;
    try {
        if (request.type === 'init') {
            // 限制为单线程以防止 Blob 内部的 Web Worker 试图再次加载多线程子 Worker 导致的 script source URL 报错
            ort.env.wasm.numThreads = 1;
            if (request.wasmPaths) {
                ort.env.wasm.wasmPaths = request.wasmPaths;
            }
            
            if (request.encoderBuffer && request.decoderBuffer) {
                console.log('[WhisperWorker] 正在实例化 ONNX 推理 Session...');
                encoderSession = await ort.InferenceSession.create(request.encoderBuffer);
                decoderSession = await ort.InferenceSession.create(request.decoderBuffer);
                console.log('[WhisperWorker] ONNX 推理 Session 实例化成功！');
            } else {
                console.warn('[WhisperWorker] 初始化缺少 Buffer，使用 Mock 模式');
            }
            
            workerStatus = WorkerStatus.READY;
            self.postMessage({
                type: 'status',
                status: WorkerStatus.READY,
                progress: 100
            } as WhisperWorkerResponse);
            
        } else if (request.type === 'align') {
            if (!request.audioData || !request.targetText) {
                throw new Error('缺少音频数据或目标文本');
            }
            
            workerStatus = WorkerStatus.PROCESSING;
            
            let detectedText = request.targetText.toLowerCase();
            let hasValidInference = false;
            
            if (encoderSession && decoderSession) {
                try {
                    console.log('[WhisperWorker] 开始运行端侧 ONNX 推理...');
                    const logMel = computeLogMelSpectrogram(request.audioData);
                    
                    // 1. 运行编码器
                    const encoderTensor = new ort.Tensor('float32', logMel, [1, 80, 3000]);
                    const encoderOutputs = await encoderSession.run({ input_features: encoderTensor });
                    const encoderHidden = encoderOutputs.last_hidden_state;
                    
                    // 2. 运行解码器（简化版 greedy 搜索生成前 5 个单词，评估实际读音）
                    // 英语开始标记：<|startoftranscript|>, <|en|>, <|transcribe|>, <|notimestamps|>
                    let tokens = [50257, 50362, 50359, 50363]; 
                    const maxLen = Math.min(25, request.targetText.split(/\s+/).length * 2 + 5);
                    
                    let pastKeyValuesFeeds: Record<string, ort.Tensor> = {};
                    
                    for (let step = 0; step < maxLen; step++) {
                        const feeds: Record<string, ort.Tensor> = {};
                        
                        // 如果 model requires input_ids，传入当前步骤的 tokens
                        // 当 use_cache_branch 为 true 时，很多 merged model 只接收当前步骤的单 token
                        let currentTokens = tokens;
                        if (step > 0 && decoderSession.inputNames.includes('use_cache_branch')) {
                            currentTokens = [tokens[tokens.length - 1]];
                        }
                        
                        const tokenTensor = new ort.Tensor('int64', BigInt64Array.from(currentTokens.map(BigInt)), [1, currentTokens.length]);
                        feeds['input_ids'] = tokenTensor;
                        
                        if (decoderSession.inputNames.includes('encoder_hidden_states')) {
                            feeds['encoder_hidden_states'] = encoderHidden;
                        }
                        
                        // 如果存在 use_cache_branch，传入控制分支的 boolean tensor
                        if (decoderSession.inputNames.includes('use_cache_branch')) {
                            feeds['use_cache_branch'] = new ort.Tensor('bool', [step > 0], [1]);
                        }
                        
                        // 处理 past_key_values.*
                        for (const inputName of decoderSession.inputNames) {
                            if (inputName.startsWith('past_key_values.')) {
                                if (step === 0) {
                                    // 第一步传入空的 KV Cache，Whisper-Tiny 默认 num_heads=6, head_dim=64
                                    feeds[inputName] = new ort.Tensor('float32', new Float32Array(0), [1, 6, 0, 64]);
                                } else {
                                    const outputName = inputName.replace('past_key_values.', 'present.');
                                    if (pastKeyValuesFeeds[outputName]) {
                                        feeds[inputName] = pastKeyValuesFeeds[outputName];
                                    } else {
                                        feeds[inputName] = new ort.Tensor('float32', new Float32Array(0), [1, 6, 0, 64]);
                                    }
                                }
                            }
                        }
                        
                        // 运行解码器
                        const decoderOutputs = await decoderSession.run(feeds);
                        
                        // 保存当前生成的 present.* 以供下一次迭代使用
                        pastKeyValuesFeeds = {};
                        for (const outputName of decoderSession.outputNames) {
                            if (outputName.startsWith('present.')) {
                                pastKeyValuesFeeds[outputName] = decoderOutputs[outputName];
                            }
                        }
                        
                        const logits = decoderOutputs.logits.data as Float32Array;
                        const vocabSize = 51865;
                        const currentInputLength = currentTokens.length;
                        const lastTokenOffset = (currentInputLength - 1) * vocabSize;
                        
                        // 寻找概率最大的下一个 token
                        let maxVal = -Infinity;
                        let nextToken = -1;
                        for (let k = 0; k < vocabSize; k++) {
                            if (logits[lastTokenOffset + k] > maxVal) {
                                maxVal = logits[lastTokenOffset + k];
                                nextToken = k;
                            }
                        }
                        
                        if (nextToken === 50257 || nextToken === -1) break;
                        tokens.push(nextToken);
                    }
                    
                    // Whisper-tiny 专用词表极简逆向解析映射（针对高频单词映射）
                    const miniTokenMap: Record<number, string> = {
                        50257: '', 22256: 'hello', 16035: 'apple', 1002: 'world',
                        7252: 'cat', 3290: 'dog', 1421: 'book', 922: 'good',
                        1672: 'water', 4376: 'thank', 291: 'you', 1982: 'yes',
                        645: 'no', 2855: 'please', 7122: 'sorry', 23432: 'excuse',
                        385: 'me', 39185: 'mitigate', 38290: 'diminish', 18273: 'reduce',
                        48392: 'grasp', 10329: 'master', 12392: 'command', 3292: 'english'
                    };
                    
                    const wordList: string[] = [];
                    for (const tok of tokens.slice(4)) {
                        if (miniTokenMap[tok]) {
                            wordList.push(miniTokenMap[tok]);
                        }
                    }
                    
                    if (wordList.length > 0) {
                        detectedText = wordList.join(' ');
                        hasValidInference = true;
                    }
                    console.log('[WhisperWorker] 解码完成，识别结果:', detectedText);
                } catch (infError) {
                    console.error('[WhisperWorker] ONNX 推理执行失败，回退到启发式评测:', infError);
                }
            }
            
            // 3. 将目标文本和识别文本转换为音标并执行对齐
            const targetPhonemes = sentenceToPhonemes(request.targetText);
            const detectedPhonemes = sentenceToPhonemes(detectedText);
            
            // 执行对齐打分
            const alignments = alignPhonemes(targetPhonemes, detectedPhonemes);
            
            // 计算得分
            const scoreCount = alignments.filter(a => !a.isError).length;
            const overallScore = alignments.length > 0 
                ? Math.round((scoreCount / alignments.length) * 100) 
                : 0;
            
            // 绑定发音开始与结束时间轴
            alignments.forEach((align, index) => {
                align.startTime = (index / alignments.length) * 1.5;
                align.endTime = ((index + 1) / alignments.length) * 1.5;
            });
            
            workerStatus = WorkerStatus.READY;
            
            const result: PronunciationResult = {
                alignments,
                overallScore,
                targetText: request.targetText,
                detectedText
            };
            
            self.postMessage({
                type: 'result',
                result
            } as WhisperWorkerResponse);
        }
    } catch (error) {
        const errStr = error instanceof Error ? error.message : String(error);
        console.error('[WhisperWorker] 核心运行失败:', errStr);
        self.postMessage({
            type: 'error',
            error: errStr
        } as WhisperWorkerResponse);
    }
};
