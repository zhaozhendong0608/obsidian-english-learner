<template>
  <div class="lang-learner-panel">
    <!-- 统计仪表盘 -->
    <div class="lang-learner-panel-dashboard">
      <h3 class="lang-learner-panel-title">📖 语言学习助手</h3>
      <div class="lang-learner-stats-grid">
        <div class="lang-learner-stat-item lang-learner-stat-total">
          <span class="lang-learner-stat-value">{{ stats.total }}</span>
          <span class="lang-learner-stat-label">总词量</span>
        </div>
        <div class="lang-learner-stat-item lang-learner-stat-known">
          <span class="lang-learner-stat-value">{{ stats.known }}</span>
          <span class="lang-learner-stat-label">已掌握</span>
        </div>
        <div class="lang-learner-stat-item lang-learner-stat-learning">
          <span class="lang-learner-stat-value">{{ stats.learning }}</span>
          <span class="lang-learner-stat-label">学习中</span>
        </div>
        <div class="lang-learner-stat-item lang-learner-stat-unknown">
          <span class="lang-learner-stat-value">{{ stats.unknown }}</span>
          <span class="lang-learner-stat-label">生词</span>
        </div>
      </div>
    </div>

    <!-- F5 词汇量估算区 -->
    <div v-if="estimationState === 'idle'" class="lang-learner-panel-section">
      <button class="lang-learner-btn lang-learner-btn-primary lang-learner-btn-full" @click="startEstimation">
        🎯 开始词汇量估算
      </button>
      <p class="lang-learner-hint-text">通过约 20 道题快速测定你的英语词汇水位线</p>
    </div>

    <div v-if="estimationState === 'running'" class="lang-learner-panel-section lang-learner-estimation-area">
      <div class="lang-learner-estimation-header">
        <span class="lang-learner-estimation-progress">第 {{ currentQuestionIndex + 1 }} / {{ totalQuestions }} 题</span>
        <div class="lang-learner-progress-bar">
          <div class="lang-learner-progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
      </div>
      <div class="lang-learner-estimation-word">
        <span class="lang-learner-big-word">{{ currentTestWord }}</span>
      </div>
      <p class="lang-learner-estimation-prompt">你认识这个单词吗？</p>
      <div class="lang-learner-estimation-actions">
        <button class="lang-learner-btn lang-learner-btn-yes" @click="answerEstimation(true)">✅ 认识</button>
        <button class="lang-learner-btn lang-learner-btn-no" @click="answerEstimation(false)">❌ 不认识</button>
      </div>
    </div>

    <div v-if="estimationState === 'done'" class="lang-learner-panel-section lang-learner-estimation-result">
      <p class="lang-learner-result-title">🎉 估算完成！</p>
      <p class="lang-learner-result-value">你的词汇量约为 <strong>{{ estimatedLevel }}</strong> 词</p>
      <p class="lang-learner-result-detail">已将水位线以下的 {{ batchMarkedCount }} 个高频词标记为已掌握</p>
      <button class="lang-learner-btn lang-learner-btn-secondary" @click="estimationState = 'idle'">关闭</button>
    </div>

    <!-- 单词详情与熟悉度微调区 -->
    <div v-if="selectedWord" class="lang-learner-panel-section lang-learner-word-detail">
      <h4 class="lang-learner-section-title">📝 单词详情</h4>
      <div class="lang-learner-word-info-card">
        <div class="lang-learner-word-lemma">{{ selectedWord.word }}</div>
        <div v-if="selectedWord.phonetic" class="lang-learner-word-phonetic">/{{ selectedWord.phonetic }}/</div>
        <div class="lang-learner-word-trans">{{ selectedWord.trans || '暂无释义' }}</div>
      </div>
      <div class="lang-learner-status-actions">
        <button
          class="lang-learner-btn lang-learner-btn-status"
          :class="{ 'lang-learner-active': selectedWord.status === 'UNKNOWN' }"
          @click="changeWordStatus(selectedWord.word, 'UNKNOWN')"
        >生词</button>
        <button
          class="lang-learner-btn lang-learner-btn-status"
          :class="{ 'lang-learner-active': selectedWord.status === 'LEARNING' }"
          @click="changeWordStatus(selectedWord.word, 'LEARNING')"
        >学习中</button>
        <button
          class="lang-learner-btn lang-learner-btn-status"
          :class="{ 'lang-learner-active': selectedWord.status === 'KNOWN' }"
          @click="changeWordStatus(selectedWord.word, 'KNOWN')"
        >已掌握</button>
      </div>
    </div>

    <!-- 生词本列表区 -->
    <div class="lang-learner-panel-section lang-learner-wordlist-area">
      <h4 class="lang-learner-section-title">📋 生词本</h4>
      <div class="lang-learner-tab-bar">
        <button
          class="lang-learner-tab-btn"
          :class="{ 'lang-learner-active': activeTab === 'UNKNOWN' }"
          @click="activeTab = 'UNKNOWN'"
        >生词 ({{ unknownList.length }})</button>
        <button
          class="lang-learner-tab-btn"
          :class="{ 'lang-learner-active': activeTab === 'LEARNING' }"
          @click="activeTab = 'LEARNING'"
        >学习中 ({{ learningList.length }})</button>
      </div>
      <div class="lang-learner-wordlist-container">
        <div
          v-for="item in currentTabList"
          :key="item.word"
          class="lang-learner-wordlist-item"
          @click="selectWord(item)"
        >
          <span class="lang-learner-wl-word">{{ item.word }}</span>
          <span class="lang-learner-wl-trans">{{ item.trans || '—' }}</span>
          <button
            class="lang-learner-btn-icon"
            :title="item.status === 'UNKNOWN' ? '标为学习中' : '标为已掌握'"
            @click.stop="quickAdvance(item)"
          >{{ item.status === 'UNKNOWN' ? '📌' : '✅' }}</button>
        </div>
        <p v-if="currentTabList.length === 0" class="lang-learner-empty-hint">暂无数据</p>
      </div>
    </div>

    <!-- F8 一键学完 -->
    <div class="lang-learner-panel-section">
      <button class="lang-learner-btn lang-learner-btn-accent lang-learner-btn-full" @click="learnArticle">
        ⚡ 一键学完当前文章
      </button>
      <p class="lang-learner-hint-text">将当前文章中高频词表内的未标记词批量标为已掌握</p>
    </div>
  </div>
</template>


<script lang="ts">
import { defineComponent, ref, computed, inject, onMounted, onUnmounted } from 'vue';
import { Notice } from 'obsidian';
import { eventBus } from '../event/EventBus';
import { HIGH_FREQUENCY_WORDS, OFFLINE_DICT } from '../data/static_data';
import type { VocabularyManager } from '../db/vocabulary';
import type { WordInfo, WordStatus } from '../types';

export default defineComponent({
  name: 'LangLearnerPanel',
  setup() {
    // 通过 provide/inject 获取核心依赖
    const vocabManager = inject<VocabularyManager>('vocabManager')!;
    const plugin = inject<any>('plugin')!;

    // 使用 Set 加速高频词查询 (O(1))
    const highFreqSet = new Set<string>(HIGH_FREQUENCY_WORDS);

    // ========== 统计仪表盘 ==========
    const stats = ref({ total: 0, unknown: 0, learning: 0, known: 0 });

    /** 刷新统计数据 */
    function refreshStats() {
        console.log('refreshStats: vocabManager =', vocabManager);
        const count = vocabManager?.getCount?.();
        console.log('refreshStats: getCount() returned =', count);
        if (count) {
            stats.value = count;
        }
    }

    // ========== 生词本列表 ==========
    const activeTab = ref<'UNKNOWN' | 'LEARNING'>('UNKNOWN');
    const wordListCache = ref<WordInfo[]>([]);

    /** 刷新生词列表缓存 */
    function refreshWordList() {
        const entries = vocabManager.getAllEntries();
        const list: WordInfo[] = [];
        entries.forEach((info) => {
            if (info.status === 'UNKNOWN' || info.status === 'LEARNING') {
                list.push(info);
            }
        });
        // 按更新时间倒序排列（最新的在前面）
        list.sort((a, b) => b.updated - a.updated);
        wordListCache.value = list;
    }

    const unknownList = computed(() =>
        wordListCache.value.filter(w => w.status === 'UNKNOWN')
    );

    const learningList = computed(() =>
        wordListCache.value.filter(w => w.status === 'LEARNING')
    );

    const currentTabList = computed(() =>
        activeTab.value === 'UNKNOWN' ? unknownList.value : learningList.value
    );

    // ========== 单词详情 ==========
    const selectedWord = ref<WordInfo | null>(null);

    /** 选中一个单词以展示详情 */
    function selectWord(info: WordInfo) {
        selectedWord.value = { ...info };
    }

    /** 修改单词熟悉度状态 */
    function changeWordStatus(word: string, newStatus: WordStatus) {
        const info = vocabManager.getInfo(word);
        const trans = info?.trans || '';
        const phonetic = info?.phonetic || '';
        vocabManager.set(word, newStatus, trans, phonetic);

        // 通过 EventBus 广播，驱动 DOM 增量刷新
        eventBus.emit('lang-learner:word-changed', word, newStatus);

        // 更新本地 UI 状态
        if (selectedWord.value && selectedWord.value.word === word) {
            selectedWord.value.status = newStatus;
        }
        refreshStats();
        refreshWordList();
    }

    /** 快速推进单词状态：UNKNOWN -> LEARNING，LEARNING -> KNOWN */
    function quickAdvance(info: WordInfo) {
        const nextStatus: WordStatus = info.status === 'UNKNOWN' ? 'LEARNING' : 'KNOWN';
        changeWordStatus(info.word, nextStatus);
    }

    // ========== F5 词汇量二分估算 ==========
    const estimationState = ref<'idle' | 'running' | 'done'>('idle');
    const currentQuestionIndex = ref(0);
    const totalQuestions = ref(20);
    const currentTestWord = ref('');
    const estimatedLevel = ref(0);
    const batchMarkedCount = ref(0);

    // 二分查找状态
    let bsLow = 0;
    let bsHigh = HIGH_FREQUENCY_WORDS.length - 1;
    let bsRound = 0;
    const maxRounds = 20;

    const progressPercent = computed(() =>
        Math.round(((currentQuestionIndex.value + 1) / totalQuestions.value) * 100)
    );

    /** 启动词汇量估算 */
    function startEstimation() {
        bsLow = 0;
        bsHigh = HIGH_FREQUENCY_WORDS.length - 1;
        bsRound = 0;
        currentQuestionIndex.value = 0;
        estimationState.value = 'running';
        pickNextWord();
    }

    /** 从当前二分区间的中点取出测试词 */
    function pickNextWord() {
        const mid = Math.floor((bsLow + bsHigh) / 2);
        currentTestWord.value = HIGH_FREQUENCY_WORDS[mid];
    }

    /** 用户回答"认识/不认识" */
    function answerEstimation(known: boolean) {
        const mid = Math.floor((bsLow + bsHigh) / 2);

        if (known) {
            // 认识 -> 水位线可能更高，向右搜索
            bsLow = mid + 1;
        } else {
            // 不认识 -> 水位线更低，向左搜索
            bsHigh = mid - 1;
        }

        bsRound++;
        currentQuestionIndex.value = bsRound;

        // 判断是否终止
        if (bsRound >= maxRounds || bsLow > bsHigh) {
            finishEstimation();
        } else {
            pickNextWord();
        }
    }

    /** 完成估算，批量标记水位线以下词汇 */
    function finishEstimation() {
        // 水位线 = bsLow（第一个"不认识"的词的索引位置）
        const waterLevel = bsLow;
        estimatedLevel.value = waterLevel;

        // 获取水位线以下的全部高频词
        const wordsToMark = HIGH_FREQUENCY_WORDS.slice(0, waterLevel);

        // 过滤掉已经是 LEARNING 状态的词（用户主动标记的生词不应被覆盖）
        const safeWords = wordsToMark.filter(w => {
            const status = vocabManager.get(w);
            return status !== 'LEARNING';
        });

        vocabManager.batchSetKnown(safeWords);
        batchMarkedCount.value = safeWords.length;

        // 广播事件
        eventBus.emit('lang-learner:batch-known', safeWords.length);
        eventBus.emit('lang-learner:estimation-done', waterLevel);

        estimationState.value = 'done';
        refreshStats();
        refreshWordList();
    }

    // ========== F8 一键学完 ==========

    /** 一键将当前文章中高频词表内的未标记词批量标为 KNOWN */
    function learnArticle() {
        try {
            // 获取当前活动文档的原始文本
            const activeFile = plugin.app.workspace.getActiveFile();
            if (!activeFile) {
                new Notice('请先打开一篇文章再使用此功能');
                return;
            }

            // 从 Obsidian 缓存中读取文本
            const cachedRead = plugin.app.vault.cachedRead(activeFile);
            if (!cachedRead) {
                console.log('无法读取当前文章内容');
                return;
            }

            cachedRead.then((articleText: string) => {
                if (!articleText) return;

                // 提取文章中的所有英文单词并进行 lemma 还原
                const wordRegex = /[a-zA-Z]+(?:[''][a-zA-Z]+)*(?:-[a-zA-Z]+)*/g;
                const articleWordsSet = new Set<string>();
                let match: RegExpExecArray | null;
                while ((match = wordRegex.exec(articleText)) !== null) {
                    articleWordsSet.add(match[0].toLowerCase());
                }

                // F8 差集公式: (文章全量词集 ∩ 20000高频词表) - 用户标记生词集
                const wordsToMark: string[] = [];
                articleWordsSet.forEach(word => {
                    // 只处理高频词表内的词（防污染白名单过滤）
                    if (!highFreqSet.has(word)) return;
                    // 跳过用户主动标记为 LEARNING 的词
                    const currentStatus = vocabManager.get(word);
                    if (currentStatus === 'KNOWN' || currentStatus === 'LEARNING') return;
                    wordsToMark.push(word);
                });

                if (wordsToMark.length === 0) {
                    console.log('当前文章中没有需要批量标记的高频词');
                    return;
                }

                vocabManager.batchSetKnown(wordsToMark);

                // 广播批量标熟事件
                eventBus.emit('lang-learner:batch-known', wordsToMark.length);

                console.log(`一键学完：已将 ${wordsToMark.length} 个高频词标记为已掌握`);
                refreshStats();
                refreshWordList();
            });
        } catch (err) {
            console.error('一键学完操作异常:', err);
        }
    }

    // ========== 生命周期 ==========

    /** 处理事件总线广播的刷新 */
    function handleWordChanged() {
        refreshStats();
        refreshWordList();
    }

    /** 响应主窗口的单词单击选中事件，更新侧边栏详情 */
    function handleWordSelected(word: string) {
        const info = vocabManager.getInfo(word);
        if (info) {
            selectedWord.value = { ...info };
            if (!info.trans) {
                fetchOnlineAndUpdate(word);
            }
        } else {
            // 词库中未记录的单词（即 UNKNOWN），从离线词典中拉取释义音标做初始化展示
            let trans = '';
            let phonetic: string | undefined;
            const dictEntry = OFFLINE_DICT[word];
            if (dictEntry) {
                trans = dictEntry.trans;
                phonetic = dictEntry.phonetic || undefined;
            }
            selectedWord.value = {
                word,
                status: 'UNKNOWN',
                trans,
                phonetic,
                added: Date.now(),
                updated: Date.now()
            };
            if (!trans) {
                fetchOnlineAndUpdate(word);
            }
        }
    }

    /** 在线异步查询释义并更新状态与 UI */
    async function fetchOnlineAndUpdate(word: string) {
        try {
            const onlineTrans = await vocabManager.fetchOnlineTranslation(word);
            if (onlineTrans) {
                // 如果用户仍处于当前选中的单词上，实时更新详情释义
                if (selectedWord.value && selectedWord.value.word === word) {
                    selectedWord.value.trans = onlineTrans;
                }
                // 更新保存到内存影子词库中，使得高亮和缓存生效
                const currentStatus = vocabManager.get(word);
                const info = vocabManager.getInfo(word);
                vocabManager.set(word, currentStatus, onlineTrans, info?.phonetic);
            }
        } catch (err) {
            console.error('在线异步更新释义失败:', err);
        }
    }

    onMounted(() => {
        refreshStats();
        refreshWordList();
        eventBus.on('lang-learner:word-changed', handleWordChanged);
        eventBus.on('lang-learner:word-selected', handleWordSelected);
    });

    onUnmounted(() => {
        eventBus.off('lang-learner:word-changed', handleWordChanged);
        eventBus.off('lang-learner:word-selected', handleWordSelected);
    });

    return {
      stats,
      activeTab,
      wordListCache,
      unknownList,
      learningList,
      currentTabList,
      selectedWord,
      estimationState,
      currentQuestionIndex,
      totalQuestions,
      currentTestWord,
      estimatedLevel,
      batchMarkedCount,
      progressPercent,
      selectWord,
      changeWordStatus,
      quickAdvance,
      startEstimation,
      answerEstimation,
      learnArticle
    };
  }
});
</script>

<style>
/* ========================================================================
   Obsidian English Learner - 侧边栏控制面板专属样式表
   设计要点：
   1. 所有选择器均以 `.lang-learner-` 开头，避免污染 Obsidian 全局应用样式。
   2. 不带 scoped 属性以确保与 esbuild 构建输出完全匹配。
   ======================================================================== */

/* ---- 1. 面板基础容器 ---- */
.lang-learner-panel {
    padding: 14px;
    font-family: var(--font-interface, sans-serif);
    color: var(--text-normal);
    overflow-y: auto;
    height: 100%;
}

/* ---- 2. 统计仪表盘 Card ---- */
.lang-learner-panel-dashboard {
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    padding: 12px 14px;
    margin-bottom: 16px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.04);
}

.lang-learner-panel-title {
    margin: 0 0 12px 0;
    color: var(--text-accent);
    font-size: 1.1em;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 6px;
}

.lang-learner-stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
}

.lang-learner-stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 10px 8px;
    border-radius: 8px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.lang-learner-stat-item:hover {
    transform: translateY(-1.5px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
    border-color: var(--interactive-accent);
}

.lang-learner-stat-value {
    font-size: 1.4em;
    font-weight: 800;
    line-height: 1.1;
    transition: color 0.2s ease;
}

.lang-learner-stat-label {
    font-size: 0.75em;
    color: var(--text-muted);
    margin-top: 4px;
    font-weight: 500;
}

/* 单词状态着色 */
.lang-learner-stat-known .lang-learner-stat-value {
    color: var(--text-success, #27ae60);
}
.lang-learner-stat-learning .lang-learner-stat-value {
    color: var(--text-warning, #f1c40f);
}
.lang-learner-stat-unknown .lang-learner-stat-value {
    color: var(--text-error, #e74c3c);
}
.lang-learner-stat-total .lang-learner-stat-value {
    color: var(--text-accent);
}

/* ---- 3. 通用面板区块 ---- */
.lang-learner-panel-section {
    margin-bottom: 16px;
    padding: 14px;
    border-radius: 10px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
}

.lang-learner-section-title {
    margin: 0 0 12px 0;
    font-size: 0.95em;
    font-weight: 700;
    color: var(--text-normal);
    border-bottom: 1px solid var(--background-modifier-border);
    padding-bottom: 6px;
}

/* ---- 4. 按钮系统 ---- */
.lang-learner-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border: none;
    border-radius: 6px;
    padding: 8px 16px;
    font-size: 0.85em;
    font-weight: 600;
    text-align: center;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    outline: none;
    line-height: 1.4;
}

.lang-learner-btn:hover {
    filter: brightness(1.12);
    transform: translateY(-1px);
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.08);
}

.lang-learner-btn:active {
    transform: translateY(0);
    scale: 0.98;
    box-shadow: none;
}

.lang-learner-btn-full {
    width: 100%;
}

.lang-learner-btn-primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
}

.lang-learner-btn-secondary {
    background: var(--background-primary);
    color: var(--text-normal);
    border: 1px solid var(--background-modifier-border);
}

.lang-learner-btn-accent {
    background: linear-gradient(135deg, var(--interactive-accent) 0%, #8c7ae6 100%);
    color: #fff;
    border: none;
}

.lang-learner-btn-yes {
    background: #27ae60;
    color: #fff;
    flex: 1;
}

.lang-learner-btn-no {
    background: #e74c3c;
    color: #fff;
    flex: 1;
}

.lang-learner-btn-status {
    background: var(--background-primary);
    color: var(--text-muted);
    border: 1px solid var(--background-modifier-border);
    flex: 1;
    font-size: 0.8em;
    padding: 6px 4px;
    font-weight: 500;
}

.lang-learner-btn-status.lang-learner-active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
    font-weight: 700;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.lang-learner-btn-icon {
    cursor: pointer;
    background: none;
    border: none;
    font-size: 1.1em;
    padding: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    opacity: 0.45;
    transition: opacity 0.2s ease, transform 0.2s ease;
}

.lang-learner-btn-icon:hover {
    opacity: 1;
    transform: scale(1.2);
}

.lang-learner-hint-text {
    margin: 8px 0 0 0;
    font-size: 0.75em;
    color: var(--text-muted);
    text-align: center;
    line-height: 1.4;
}

/* ---- 5. F5 词汇量估算面板 ---- */
.lang-learner-estimation-header {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 14px;
}

.lang-learner-estimation-progress {
    font-size: 0.8em;
    color: var(--text-muted);
    font-weight: 500;
}

.lang-learner-progress-bar {
    width: 100%;
    height: 6px;
    background: var(--background-primary);
    border-radius: 3px;
    overflow: hidden;
    border: 1px solid var(--background-modifier-border);
}

.lang-learner-progress-fill {
    height: 100%;
    background: var(--interactive-accent);
    border-radius: 3px;
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.lang-learner-estimation-word {
    text-align: center;
    padding: 24px 10px;
    background: var(--background-primary);
    border-radius: 8px;
    border: 1px solid var(--background-modifier-border);
    margin-bottom: 12px;
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.02);
}

.lang-learner-big-word {
    font-size: 1.9em;
    font-weight: 800;
    color: var(--text-accent);
    letter-spacing: 0.5px;
}

.lang-learner-estimation-prompt {
    text-align: center;
    color: var(--text-muted);
    font-size: 0.85em;
    margin: 0 0 14px 0;
}

.lang-learner-estimation-actions {
    display: flex;
    gap: 10px;
}

/* ---- 6. 估算完成结果 ---- */
.lang-learner-estimation-result {
    text-align: center;
}

.lang-learner-result-title {
    font-size: 1.2em;
    font-weight: 800;
    color: var(--text-accent);
    margin: 0 0 8px 0;
}

.lang-learner-result-value {
    font-size: 0.95em;
    margin: 0 0 6px 0;
    color: var(--text-normal);
}

.lang-learner-result-value strong {
    color: var(--text-accent);
    font-size: 1.35em;
    font-weight: 800;
}

.lang-learner-result-detail {
    font-size: 0.8em;
    color: var(--text-muted);
    margin: 0 0 14px 0;
    line-height: 1.45;
}

/* ---- 7. 单词详情与状态微调 ---- */
.lang-learner-word-info-card {
    background: var(--background-primary);
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 12px;
    border: 1px solid var(--background-modifier-border);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
}

.lang-learner-word-lemma {
    font-size: 1.3em;
    font-weight: 800;
    color: var(--text-accent);
}

.lang-learner-word-phonetic {
    font-size: 0.85em;
    color: var(--text-muted);
    font-family: var(--font-monospace, monospace);
    margin: 4px 0;
}

.lang-learner-word-trans {
    font-size: 0.9em;
    color: var(--text-normal);
    margin-top: 8px;
    line-height: 1.45;
    border-top: 1px dashed var(--background-modifier-border);
    padding-top: 8px;
}

.lang-learner-status-actions {
    display: flex;
    gap: 8px;
}

/* ---- 8. 胶囊风格 Tab 栏 ---- */
.lang-learner-tab-bar {
    display: flex;
    background: var(--background-primary);
    border-radius: 8px;
    padding: 3px;
    border: 1px solid var(--background-modifier-border);
    margin-bottom: 10px;
}

.lang-learner-tab-btn {
    flex: 1;
    cursor: pointer;
    background: transparent;
    border: none;
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 0.8em;
    font-weight: 700;
    color: var(--text-muted);
    transition: all 0.2s ease;
    outline: none;
}

.lang-learner-tab-btn.lang-learner-active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* ---- 9. 生词列表与滚动条 ---- */
.lang-learner-wordlist-container {
    max-height: 300px;
    overflow-y: auto;
    padding-right: 2px;
}

.lang-learner-wordlist-container::-webkit-scrollbar {
    width: 4px;
}

.lang-learner-wordlist-container::-webkit-scrollbar-thumb {
    background: var(--background-modifier-border);
    border-radius: 2px;
}

.lang-learner-wordlist-item {
    display: flex;
    align-items: center;
    padding: 8px 10px;
    border-radius: 6px;
    cursor: pointer;
    margin-bottom: 4px;
    background: var(--background-primary);
    border: 1px solid transparent;
    transition: all 0.15s ease;
}

.lang-learner-wordlist-item:hover {
    background: var(--background-primary-alt);
    border-color: var(--background-modifier-border);
}

.lang-learner-wl-word {
    font-weight: 700;
    font-size: 0.88em;
    min-width: 85px;
    color: var(--text-normal);
}

.lang-learner-wl-trans {
    flex: 1;
    font-size: 0.78em;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin: 0 8px;
}

.lang-learner-empty-hint {
    text-align: center;
    color: var(--text-muted);
    font-size: 0.8em;
    padding: 24px 0;
    margin: 0;
    opacity: 0.7;
    font-style: italic;
}
</style>

