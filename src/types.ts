/**
 * 单词熟悉度状态类型
 * UNKNOWN: 未知/生词
 * LEARNING: 学习中
 * KNOWN: 已掌握
 */
export type WordStatus = 'UNKNOWN' | 'LEARNING' | 'KNOWN';

/**
 * 影子词库中存储的单词详细信息数据结构
 */
export interface WordInfo {
    /** 单词原型 (Lemma) */
    word: string;
    /** 熟悉度状态 */
    status: WordStatus;
    /** 离线释义 */
    trans: string;
    /** 音标 (可选) */
    phonetic?: string;
    /** 首次添加的时间戳 */
    added: number;
    /** 最后更新的时间戳 */
    updated: number;
    /** 词源与记忆法辅助信息 (可选) */
    etymology?: string;
    /** 复习间隔天数 (可选) */
    interval?: number;
    /** E-Factor 易度因子 (可选) */
    ease?: number;
    /** 连续成功复习的次数 (可选) */
    repetitions?: number;
    /** 下一次复习的时间戳 (可选) */
    nextReview?: number;
    
    // ======= AI 教师词根衍生扩展 =======
    /** 词根（如 "spect"） */
    root?: string;
    /** 词根含义（如 "看"） */
    rootMeaning?: string;
    /** 衍生常用词组列表 */
    phrases?: string[];
}

/**
 * 文本分词提取出的 Token 结构
 */
export interface Token {
    /** 提取出来的原始文本（保持原大小写及标点） */
    text: string;
    /** 净化后的文本（去除前后标点、特殊符号，并转化为小写） */
    cleanText: string;
    /** 还原后的词原型 (Lemma)，若是短语则为短语原型 */
    lemma: string;
    /** 在 Markdown 原始文本中的起始物理字符索引 */
    start: number;
    /** 在 Markdown 原始文本中的结束物理字符索引 */
    end: number;
    /** 是否属于合并后的词组短语 */
    isPhrase?: boolean;
    /** 若是词组 Token，其包含的子单词 Token 列表 */
    originalTokens?: Token[];
}

/**
 * 词干还原算法返回的结果结构
 */
export interface LemmatizerResult {
    /** 还原后的单词原型 (Lemma) */
    lemma: string;
    /** 是否触发了拼写重定向（如英美音转换：colour -> color） */
    redirected: boolean;
    /** 是否通过编辑距离匹配出来的模糊匹配词 */
    isFuzzy?: boolean;
}

// ======= V4.0 口语评测与主动伴写扩展 =======

/**
 * 音素对齐结果（单个音素）
 */
export interface PhonemeAlignment {
    /** 音素符号 (如 /æ/, /r/, /ð/) */
    phoneme: string;
    /** 置信度 0-1 */
    confidence: number;
    /** 是否为错误音素（置信度低于阈值） */
    isError: boolean;
    /** 开始时间（秒，可选） */
    startTime?: number;
    /** 结束时间（秒，可选） */
    endTime?: number;
}

/**
 * 完整的发音评测结果
 */
export interface PronunciationResult {
    /** 音素对齐列表 */
    alignments: PhonemeAlignment[];
    /** 总体评分 0-100 */
    overallScore: number;
    /** 目标文本 */
    targetText: string;
    /** 识别出的文本（可选） */
    detectedText?: string;
}

/**
 * 主动伴写倒排映射条目
 */
export interface SuggestionMapping {
    /** 常用词（用户输入的触发词） */
    commonWord: string;
    /** 目标生词（推荐替换的临界复习词） */
    targetWord: string;
    /** 优先级（基于 SM-2 复习紧迫度计算） */
    priority: number;
    /** 目标词的释义（用于补全提示） */
    translation?: string;
}

/**
 * 中译英反向检索候选词结果
 */
export interface ReverseSearchCandidate {
    /** 英文单词原型 (Lemma) */
    lemma: string;
    /** 中文释义 */
    translation: string;
    /** 音标 */
    phonetic?: string;
    /** 熟悉度状态 */
    status: WordStatus;
    /** 是否在高频词表中 */
    isHighFrequency: boolean;
}
