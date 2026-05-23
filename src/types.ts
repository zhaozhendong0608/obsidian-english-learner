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
