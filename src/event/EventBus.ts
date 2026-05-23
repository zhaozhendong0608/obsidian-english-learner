/**
 * 极简类型安全事件总线 (EventBus)
 * 用于解耦 UI 控制层 (Vue 3 Panel) 与表现高亮层 (DOM MarkdownPostProcessor) 之间的状态广播
 */

/**
 * 单词状态变更事件的回调函数类型
 */
type WordChangedCallback = (word: string, status: string, contextSentence?: string) => void;

/**
 * 定义 EventBus 支持的所有事件及其对应的回调函数签名
 */
interface EventMap {
    'lang-learner:word-changed': WordChangedCallback;
    'lang-learner:batch-known': (count: number) => void;       // F5/F8 批量标熟后广播已标记的单词数量
    'lang-learner:estimation-done': (level: number) => void;   // F5 估算完成事件，附带水位线索引
    'lang-learner:word-selected': (word: string) => void;      // 主窗口点击单词后通知侧边栏同步选中
    'lang-learner:analyze-sentence': (sentence: string) => void; // 快捷分析句子事件
    'lang-learner:play-media': (urlOrPath: string, timestamp: number) => void; // 视频播放器跳转事件，包含视频链接或路径及跳转时间点
}

type EventCallback = (...args: any[]) => void;

class EventBus {
    // 使用 EventMap 对应的 Key 作为监听器的键，确保事件名及签名类型安全
    private listeners: Map<keyof EventMap, EventCallback[]> = new Map();

    /**
     * 订阅事件
     * @param event 事件名称
     * @param callback 回调函数
     */
    public on<K extends keyof EventMap>(event: K, callback: EventMap[K]): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(callback as EventCallback);
    }

    /**
     * 取消订阅事件
     * @param event 事件名称
     * @param callback 回调函数
     */
    public off<K extends keyof EventMap>(event: K, callback: EventMap[K]): void {
        const list = this.listeners.get(event);
        if (!list) return;

        const index = list.indexOf(callback as EventCallback);
        if (index !== -1) {
            list.splice(index, 1);
        }
    }

    /**
     * 广播/触发事件
     * @param event 事件名称
     * @param args 传递给回调的参数（会自动推导并强校验对应事件的参数类型）
     */
    public emit<K extends keyof EventMap>(event: K, ...args: Parameters<EventMap[K]>): void {
        const list = this.listeners.get(event);
        if (!list) return;

        // 浅拷贝一份监听列表以防在回调执行中动态修改监听列表导致的问题
        const copied = [...list];
        for (const callback of copied) {
            try {
                callback(...args);
            } catch (err) {
                console.error(`EventBus 广播事件 [${event}] 发生异常:`, err);
            }
        }
    }

    /**
     * 清空所有订阅，通常在插件重置或卸载时调用
     */
    public clear(): void {
        this.listeners.clear();
    }
}

// 导出单例全局总线
export const eventBus = new EventBus();
