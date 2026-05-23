import { WordInfo, WordStatus } from '../types';
import { OFFLINE_DICT } from '../data/static_data';

/**
 * 极简跨平台文件数据适配器接口
 * 兼容 Obsidian 官方 App.vault.adapter 与测试 Mock 适配器
 */
export interface DataAdapter {
    read(path: string): Promise<string>;
    write(path: string, data: string): Promise<void>;
    rename(oldPath: string, newPath: string): Promise<void>;
    exists(path: string): Promise<boolean>;
}

/**
 * 本地影子词库与数据存储管理器
 */
export class VocabularyManager {
    private adapter: DataAdapter;
    private dbPath: string;
    private cache: Map<string, WordInfo> = new Map();
    
    // 并发控制状态锁与排队队列
    private isSaving: boolean = false;
    private saveQueue: Array<{ resolve: () => void; reject: (err: any) => void }> = [];
    
    // 2000ms 异步落盘节流定时器
    private saveTimer: NodeJS.Timeout | null = null;

    constructor(adapter: DataAdapter, dbPath: string = 'vocabulary.json') {
        this.adapter = adapter;
        this.dbPath = dbPath;
    }

    /**
     * 从本地存储加载词库文件进入内存影子 Map 缓存
     */
    public async load(): Promise<void> {
        try {
            if (await this.adapter.exists(this.dbPath)) {
                const data = await this.adapter.read(this.dbPath);
                if (data && data.trim()) {
                    const parsed = JSON.parse(data) as Record<string, WordInfo>;
                    this.cache.clear();
                    for (const key of Object.keys(parsed)) {
                        this.cache.set(key.toLowerCase().trim(), parsed[key]);
                    }
                }
            }
        } catch (err) {
            console.error('加载影子词库 JSON 失败，可能存在格式损坏:', err);
            throw err;
        }
    }

    /**
     * 获取单词的熟悉度状态，未标记单词默认返回 UNKNOWN
     * @param word 单词原型
     */
    public get(word: string): WordStatus {
        if (!word) return 'UNKNOWN';
        const cleanWord = word.trim().toLowerCase();
        const info = this.cache.get(cleanWord);
        return info ? info.status : 'UNKNOWN';
    }

    /**
     * 获取单词的完整记录信息
     * @param word 单词原型
     */
    public getInfo(word: string): WordInfo | undefined {
        if (!word) return undefined;
        const cleanWord = word.trim().toLowerCase();
        return this.cache.get(cleanWord);
    }

    /**
     * 设置/更新单词状态，并触发 2000ms 异步节流合并落盘
     * @param word 单词原型
     * @param status 熟悉度状态
     * @param trans 汉化释义 (若为空，则自动检索内置离线字典)
     * @param phonetic 音标 (可选，若为空且内置字典有则自动填充)
     */
    public set(word: string, status: WordStatus, trans: string, phonetic?: string): void {
        if (!word) return;
        const cleanWord = word.trim().toLowerCase();
        
        let finalTrans = trans ? trans.trim() : '';
        let finalPhonetic = phonetic ? phonetic.trim() : '';

        // F11: 词典本地化离线 fallback 机制
        if (!finalTrans) {
            const dictEntry = OFFLINE_DICT[cleanWord];
            if (dictEntry) {
                finalTrans = dictEntry.trans;
                if (!finalPhonetic && dictEntry.phonetic) {
                    finalPhonetic = dictEntry.phonetic;
                }
            }
        }

        const now = Date.now();
        const existing = this.cache.get(cleanWord);

        if (existing) {
            // 更新已有单词数据
            existing.status = status;
            if (finalTrans) existing.trans = finalTrans;
            if (finalPhonetic) existing.phonetic = finalPhonetic;
            existing.updated = now;
        } else {
            // 新增单词数据
            this.cache.set(cleanWord, {
                word: cleanWord,
                status,
                trans: finalTrans,
                phonetic: finalPhonetic || undefined,
                added: now,
                updated: now
            });
        }

        // 触发合并写节流 (每 2 秒最多发生一次物理 I/O 写入)
        this.triggerSave();
    }

    /**
     * 立即同步保存内存影子缓存至物理磁盘 (跳过 2 秒延迟，支持并发锁排队)
     */
    public async saveImmediately(): Promise<void> {
        // 并发独占锁：若当前有物理 I/O 写入，则将本次 Promise 存入排队队列
        if (this.isSaving) {
            return new Promise<void>((resolve, reject) => {
                this.saveQueue.push({ resolve, reject });
            });
        }

        // 加锁，锁定物理落盘通道
        this.isSaving = true;

        try {
            const tempPath = this.dbPath + '.tmp';
            // 将内存 Map 转换为普通 JSON 记录键值对
            const obj: Record<string, WordInfo> = {};
            this.cache.forEach((value, key) => {
                obj[key] = value;
            });
            const dataStr = JSON.stringify(obj, null, 2);

            // Step 1: 直接安全覆盖写入目标路径 (Obsidian 底层已包含防损保护)
            await this.adapter.write(this.dbPath, dataStr);

        } catch (err) {
            console.error('影子词库落盘 I/O 异常:', err);
            throw err;
        } finally {
            // 解锁
            this.isSaving = false;

            // 队列并发批处理优化：对排队中的写操作执行一并解决
            const queue = this.saveQueue;
            this.saveQueue = [];

            if (queue.length > 0) {
                // 用最新的内存快照只执行最后一次落盘，并驱动链条中的所有 Promise 解决
                this.saveImmediately()
                    .then(() => {
                        queue.forEach(item => item.resolve());
                    })
                    .catch((err) => {
                        queue.forEach(item => item.reject(err));
                    });
            }
        }
    }

    /**
     * 触发异步落盘节流 (严格 Throttle，首个操作发生后的 2000ms 必有一次物理写入)
     */
    private triggerSave(): void {
        if (this.saveTimer) {
            // 节流阀开启中，不阻断并合并时间窗内的修改
            return;
        }

        this.saveTimer = setTimeout(async () => {
            this.saveTimer = null;
            try {
                await this.saveImmediately();
            } catch (err) {
                console.error('节流落盘异步任务错误:', err);
            }
        }, 2000);
    }

    /**
     * 获取内存影子缓存的全量只读引用，供 UI 层遍历生词列表和差集计算使用
     * ⚠️ 外部严禁直接修改返回的 Map，状态变更必须通过 set() 或 batchSetKnown()
     */
    public getAllEntries(): Map<string, WordInfo> {
        return this.cache;
    }

    /**
     * 获取词库各状态的统计计数，供仪表盘渲染
     */
    public getCount(): { total: number; unknown: number; learning: number; known: number } {
        let unknown = 0;
        let learning = 0;
        let known = 0;
        this.cache.forEach((info) => {
            switch (info.status) {
                case 'UNKNOWN': unknown++; break;
                case 'LEARNING': learning++; break;
                case 'KNOWN': known++; break;
            }
        });
        return { total: this.cache.size, unknown, learning, known };
    }

    /**
     * 在线异步拉取单词释义 (网易有道 Suggest API)
     */
    public async fetchOnlineTranslation(word: string): Promise<string> {
        try {
            const cleanWord = word.trim().toLowerCase();
            const url = `https://dict.youdao.com/suggest?q=${encodeURIComponent(cleanWord)}&num=1&doctype=json`;
            
            // 尝试使用 Obsidian requestUrl 绕过 CORS
            try {
                // @ts-ignore
                if (typeof window !== 'undefined' && (window.ObsidianApp || window.app)) {
                    const obsidian = require('obsidian');
                    if (obsidian && obsidian.requestUrl) {
                        const res = await obsidian.requestUrl({ url });
                        if (res.json?.data?.entries?.[0]?.explain) {
                            return res.json.data.entries[0].explain;
                        }
                    }
                }
            } catch (obsError) {
                console.warn('使用 Obsidian requestUrl 失败，回退到 fetch:', obsError);
            }

            const res = await fetch(url);
            if (!res.ok) return '';
            const data = await res.json();
            if (data?.data?.entries?.[0]?.explain) {
                return data.data.entries[0].explain;
            }
        } catch (e) {
            console.error('在线获取释义失败:', e);
        }
        return '';
    }


    /**
     * 批量将一组词标记为 KNOWN，内部仅触发一次节流落盘
     * 用于 F5 词汇量估算后的批量初始化和 F8 一键学完
     * @param words 需要标记为 KNOWN 的单词原型列表
     */
    public batchSetKnown(words: string[]): void {
        if (!words || words.length === 0) return;

        const now = Date.now();
        for (const word of words) {
            const cleanWord = word.trim().toLowerCase();
            if (!cleanWord) continue;

            const existing = this.cache.get(cleanWord);
            if (existing) {
                // 仅当状态非 KNOWN 时才更新，避免无意义的写入
                if (existing.status !== 'KNOWN') {
                    existing.status = 'KNOWN';
                    existing.updated = now;
                }
            } else {
                // 新增条目，自动从离线字典获取释义
                let trans = '';
                let phonetic: string | undefined;
                const dictEntry = OFFLINE_DICT[cleanWord];
                if (dictEntry) {
                    trans = dictEntry.trans;
                    phonetic = dictEntry.phonetic || undefined;
                }
                this.cache.set(cleanWord, {
                    word: cleanWord,
                    status: 'KNOWN',
                    trans,
                    phonetic,
                    added: now,
                    updated: now
                });
            }
        }

        // 整批操作仅触发一次节流写入
        this.triggerSave();
    }

    /**
     * 销毁管理器实例并清理残留定时器，防测试与插件卸载时的内存泄露
     */
    public destroy(): void {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
    }
}
