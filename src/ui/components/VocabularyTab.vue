<template>
  <div class="lang-learner-tab-content">
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

    <!-- 生词本列表区 -->
    <div class="lang-learner-panel-section lang-learner-wordlist-area">
      <h4 class="lang-learner-section-title">
        <span>📋 生词本</span>
        <button
          class="lang-learner-btn-refresh"
          @click="refreshData"
          title="刷新生词本"
        >
          🔄
        </button>
      </h4>
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
          @click="emit('select-word', item)"
        >
          <span class="lang-learner-wl-word">{{ item.word }}</span>
          <span class="lang-learner-wl-trans">{{ item.trans || '—' }}</span>
          <div class="lang-learner-wordlist-actions">
            <button
              class="lang-learner-btn-voice-mini"
              title="发音"
              @click.stop="speak(item.word)"
            >🔊</button>
            <button
              class="lang-learner-btn-icon"
              :title="item.status === 'UNKNOWN' ? '标为学习中' : '标为已掌握'"
              @click.stop="quickAdvance(item)"
            >{{ item.status === 'UNKNOWN' ? '📌' : '✅' }}</button>
          </div>
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
import { eventBus } from '../../event/EventBus';
import type { VocabularyManager } from '../../db/vocabulary';
import type { WordInfo, WordStatus } from '../../types';
import { HIGH_FREQUENCY_WORDS, OFFLINE_DICT } from '../../data/static_data';

export default defineComponent({
  name: 'VocabularyTab',
  emits: ['select-word'],
  setup(props, { emit }) {
    // 注入核心依赖
    const vocabManager = inject<VocabularyManager>('vocabManager')!;
    const plugin = inject<any>('plugin')!;
    const speak = inject<(text: string) => Promise<void>>('speak')!;

    const highFreqSet = new Set<string>(HIGH_FREQUENCY_WORDS);

    const stats = ref({ total: 0, unknown: 0, learning: 0, known: 0 });
    const activeTab = ref<'UNKNOWN' | 'LEARNING'>('UNKNOWN');
    const wordListCache = ref<WordInfo[]>([]);

    // 刷新状态与生词列表缓存
    function refreshData() {
      // 1. 刷新统计数据
      const count = vocabManager.getCount();
      if (count) {
        stats.value = count;
      }
      
      // 2. 刷新生词列表缓存
      const entries = vocabManager.getAllEntries();
      const list: WordInfo[] = [];
      entries.forEach((info) => {
        if (info.status === 'UNKNOWN' || info.status === 'LEARNING') {
          list.push(info);
        }
      });
      // 按更新时间倒序排列
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

    // 快速提升单词状态：UNKNOWN -> LEARNING，LEARNING -> KNOWN
    function quickAdvance(info: WordInfo) {
      const nextStatus: WordStatus = info.status === 'UNKNOWN' ? 'LEARNING' : 'KNOWN';
      const word = info.word;
      
      const trans = info.trans || OFFLINE_DICT[word]?.trans || '';
      const phonetic = info.phonetic || OFFLINE_DICT[word]?.phonetic || '';
      const etymology = info.etymology;
      
      vocabManager.set(word, nextStatus, trans, phonetic, etymology);
      eventBus.emit('lang-learner:word-changed', word, nextStatus);
    }

    // 一键学完当前文章
    function learnArticle() {
      try {
        const activeFile = plugin.app.workspace.getActiveFile();
        if (!activeFile) {
          new Notice('请先打开一篇文章再使用此功能');
          return;
        }

        plugin.app.vault.cachedRead(activeFile).then((articleText: string) => {
          if (!articleText) return;

          const wordRegex = /[a-zA-Z]+(?:[''][a-zA-Z]+)*(?:-[a-zA-Z]+)*/g;
          const articleWordsSet = new Set<string>();
          let match: RegExpExecArray | null;
          while ((match = wordRegex.exec(articleText)) !== null) {
            articleWordsSet.add(match[0].toLowerCase());
          }

          const wordsToMark: string[] = [];
          articleWordsSet.forEach(word => {
            if (!highFreqSet.has(word)) return;
            const currentStatus = vocabManager.get(word);
            if (currentStatus === 'KNOWN' || currentStatus === 'LEARNING') return;
            wordsToMark.push(word);
          });

          if (wordsToMark.length === 0) {
            new Notice('当前文章中没有需要批量标记的高频词');
            return;
          }

          vocabManager.batchSetKnown(wordsToMark);
          eventBus.emit('lang-learner:batch-known', wordsToMark.length);
          new Notice(`一键学完：已将 ${wordsToMark.length} 个高频词标记为已掌握`);
          refreshData();
        });
      } catch (err) {
        console.error('一键学完操作异常:', err);
      }
    }

    // 事件总线同步监听
    function handleSyncEvents() {
      refreshData();
    }

    onMounted(() => {
      refreshData();
      eventBus.on('lang-learner:word-changed', handleSyncEvents);
      eventBus.on('lang-learner:batch-known', handleSyncEvents);
      eventBus.on('lang-learner:estimation-done', handleSyncEvents);
    });

    onUnmounted(() => {
      eventBus.off('lang-learner:word-changed', handleSyncEvents);
      eventBus.off('lang-learner:batch-known', handleSyncEvents);
      eventBus.off('lang-learner:estimation-done', handleSyncEvents);
    });

    return {
      emit,
      stats,
      activeTab,
      unknownList,
      learningList,
      currentTabList,
      speak,
      quickAdvance,
      learnArticle,
      refreshData
    };
  }
});
</script>

<style scoped>
.lang-learner-btn-refresh {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 1.1em;
  padding: 2px 6px;
  opacity: 0.7;
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.lang-learner-btn-refresh:hover {
  opacity: 1;
  transform: rotate(90deg);
}
.lang-learner-wordlist-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.lang-learner-btn-voice-mini {
  background: transparent;
  border: none;
  cursor: pointer; 
  font-size: 0.9em; 
  padding: 2px 4px; 
  opacity: 0.8;
}
</style>
