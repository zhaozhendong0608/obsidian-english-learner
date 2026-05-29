/**
 * WASM Worker 消息契约类型定义
 * 用于主线程与 Whisper Worker 之间的通信
 */

/**
 * Worker 状态枚举
 */
export enum WorkerStatus {
  LOADING = 'loading',      // 模型加载中
  READY = 'ready',          // 就绪，可接受任务
  PROCESSING = 'processing', // 处理中
  ERROR = 'error'           // 错误状态
}

/**
 * 主线程发送给 Worker 的请求消息
 */
export interface WhisperWorkerRequest {
  type: 'init' | 'align';   // init: 初始化模型, align: 执行音素对齐
  audioData?: Float32Array; // 16kHz 单声道音频数据
  targetText?: string;      // 目标文本（用于强制对齐）
  modelPath?: string;       // WASM 模型路径（仅 init 时需要）
  wasmPaths?: string | Record<string, string>;
  encoderBuffer?: ArrayBuffer;
  decoderBuffer?: ArrayBuffer;
}

/**
 * Worker 返回给主线程的响应消息
 */
export interface WhisperWorkerResponse {
  type: 'status' | 'result' | 'error';
  status?: WorkerStatus;
  result?: PronunciationResult;
  error?: string;
  progress?: number;        // 加载进度 0-100
}

/**
 * 音素对齐结果（单个音素）
 */
export interface PhonemeAlignment {
  phoneme: string;          // 音素符号 (如 /æ/, /r/, /ð/)
  confidence: number;       // 置信度 0-1
  isError: boolean;         // 是否为错误音素（置信度低于阈值）
  startTime?: number;       // 开始时间（秒）
  endTime?: number;         // 结束时间（秒）
}

/**
 * 完整的发音评测结果
 */
export interface PronunciationResult {
  alignments: PhonemeAlignment[];  // 音素对齐列表
  overallScore: number;            // 总体评分 0-100
  targetText: string;              // 目标文本
  detectedText?: string;           // 识别出的文本（可选）
}
