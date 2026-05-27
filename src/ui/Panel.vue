<template>
  <div class="lang-learner-panel">
    <!-- 全局自主查词输入框 -->
    <div class="lang-learner-search-bar">
      <input
        v-model="searchQuery"
        @keyup.enter="performSearch"
        placeholder="输入单词/中文查询..."
        class="lang-learner-search-input"
      />
      <button @click="performSearch" class="lang-learner-btn lang-learner-btn-primary lang-learner-search-btn">🔍 查询</button>
      <button 
        v-if="searchQuery && searchQuery.trim()"
        @click="lookupInSystemDict(searchQuery)" 
        class="lang-learner-btn" 
        title="在 macOS 系统词典中查询"
      >
        📖 系统
      </button>
    </div>

    <!-- 顶部配置折叠栏 -->
    <SettingsHeader 
      :available-voices="availableVoices"
      @voice-settings-changed="onVoiceSettingsChanged"
      @ai-settings-changed="onAiSettingsChanged"
    />

    <!-- 查词搜索结果列表 -->
    <div v-if="searchResultsList && searchResultsList.length > 0 && !selectedWord" class="lang-learner-panel-section lang-learner-search-results">
      <h4 class="lang-learner-section-title">
        <span>🔍 搜索结果 ({{ searchResultsList ? searchResultsList.length : 0 }} 个)</span>
        <div class="lang-learner-results-actions">
          <button
            @click="toggleSelectAll"
            class="lang-learner-btn lang-learner-btn-sm"
            title="全选/取消全选"
          >
            {{ selectedCandidates.size === searchResultsList.length ? '取消全选' : '全选' }}
          </button>
          <button
            @click="batchAddToVocabulary"
            class="lang-learner-btn lang-learner-btn-primary lang-learner-btn-sm"
            :disabled="selectedCandidates.size === 0"
            :title="selectedCandidates.size === 0 ? '请先勾选要收藏的单词' : `批量收藏 ${selectedCandidates.size} 个单词`"
          >
            ➕ 批量收藏 ({{ selectedCandidates.size }})
          </button>
          <button
            @click="clearSearchResults"
            class="lang-learner-btn-close-results"
            title="关闭列表"
          >
            ✕
          </button>
        </div>
      </h4>
      <div class="lang-learner-search-results-list">
        <div
          v-for="candidate in (searchResultsList || [])"
          :key="candidate.lemma"
          class="lang-learner-search-result-item"
        >
          <input
            type="checkbox"
            :checked="selectedCandidates.has(candidate.lemma)"
            @change="toggleCandidate(candidate.lemma)"
            @click.stop
            class="lang-learner-candidate-checkbox"
          />
          <div class="lang-learner-result-content" @click="selectResultWord(candidate.lemma)">
            <span class="lang-learner-result-word-span">
              {{ candidate.lemma }}
              <span
                class="lang-learner-status-badge"
                :class="`lang-learner-status-${candidate.status.toLowerCase()}`"
              >
                {{ getStatusLabel(candidate.status) }}
              </span>
            </span>
            <span
              class="lang-learner-result-trans-span"
              :title="candidate.translation"
            >
              {{ candidate.translation }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 单词详情与熟悉度微调区 (全局共享，当有选中单词时浮现) -->
    <WordDetailCard 
      v-if="selectedWord"
      :word-info="selectedWord"
      :has-search-results="searchResultsList && searchResultsList.length > 0"
      @back-to-results="backToSearchResults"
    />

    <!-- 顶部主导航 Tab -->
    <div class="lang-learner-main-tabs">
      <button
        class="lang-learner-main-tab-btn"
        :class="{ 'lang-learner-active': mainTab === 'vocabulary' }"
        @click="setTab('vocabulary')"
      >
        📋 词汇本
      </button>
      <button
        class="lang-learner-main-tab-btn"
        :class="{ 'lang-learner-active': mainTab === 'estimate' }"
        @click="setTab('estimate')"
      >
        🎯 词汇量测试
      </button>
      <button
        class="lang-learner-main-tab-btn"
        :class="{ 'lang-learner-active': mainTab === 'sentence' }"
        @click="setTab('sentence')"
      >
        🔍 整句分析
      </button>
      <button
        class="lang-learner-main-tab-btn"
        :class="{ 'lang-learner-active': mainTab === 'review' }"
        @click="setTab('review')"
      >
        📅 间隔复习
      </button>
      <button
        class="lang-learner-main-tab-btn"
        :class="{ 'lang-learner-active': mainTab === 'media' }"
        @click="setTab('media')"
      >
        🎬 视频笔记
      </button>
      <button
        class="lang-learner-main-tab-btn"
        :class="{ 'lang-learner-active': mainTab === 'reader' }"
        @click="setTab('reader')"
      >
        📰 RSS 阅读
      </button>
      <button
        class="lang-learner-main-tab-btn"
        :class="{ 'lang-learner-active': mainTab === 'webimport' }"
        @click="setTab('webimport')"
      >
        🌐 网页导入
      </button>
      <button
        class="lang-learner-main-tab-btn"
        :class="{ 'lang-learner-active': mainTab === 'pronunciation' }"
        @click="setTab('pronunciation')"
      >
        🎤 口语评测
      </button>
    </div>

    <!-- Tab 视图 -->
    <VocabularyTab v-show="mainTab === 'vocabulary'" @select-word="onWordSelected" />
    <EstimateTab v-show="mainTab === 'estimate'" />
    <SentenceTab v-show="mainTab === 'sentence'" @select-word="onWordSelectedByString" />
    <ReviewTab v-show="mainTab === 'review'" @select-word="onWordSelectedByString" />
    <MediaTab v-show="mainTab === 'media'" @select-word="onWordSelectedByString" />
    <ReaderTab v-show="mainTab === 'reader'" @select-word="onWordSelectedByString" />
    <WebImportTab v-show="mainTab === 'webimport'" />
    <PronunciationTab v-show="mainTab === 'pronunciation'" />
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, provide, inject, onMounted, onUnmounted } from 'vue';
import { Notice, requestUrl } from 'obsidian';
import { eventBus } from '../event/EventBus';
import { lemmatize } from '../tokenizer/lemmatizer';
import { OFFLINE_DICT } from '../data/static_data';
import type { VocabularyManager } from '../db/vocabulary';
import type { WordInfo, ReverseSearchCandidate } from '../types';

// 服务与子组件引入
import { AudioService, type VoiceSettings } from '../services/AudioService';
import type { AISettings } from '../services/aiService';
import { ReverseIndexService } from '../services/ReverseIndexService';
import SettingsHeader from './components/SettingsHeader.vue';
import WordDetailCard from './components/WordDetailCard.vue';
import VocabularyTab from './components/VocabularyTab.vue';
import EstimateTab from './components/EstimateTab.vue';
import SentenceTab from './components/SentenceTab.vue';
import ReviewTab from './components/ReviewTab.vue';
import MediaTab from './components/MediaTab.vue';
import ReaderTab from './components/ReaderTab.vue';
import WebImportTab from './components/WebImportTab.vue';
import PronunciationTab from './components/PronunciationTab.vue';

export default defineComponent({
  name: 'Panel',
  components: {
    SettingsHeader,
    WordDetailCard,
    VocabularyTab,
    EstimateTab,
    SentenceTab,
    ReviewTab,
    MediaTab,
    ReaderTab,
    WebImportTab,
    PronunciationTab
  },
  setup() {
    // 注入核心全局依赖
    const vocabManager = inject<VocabularyManager>('vocabManager')!;
    const plugin = inject<any>('plugin')!;

    console.log("EIR DEBUG: Panel setup running!");
    console.log("EIR DEBUG: vocabManager is", vocabManager);
    console.log("EIR DEBUG: plugin is", plugin);

    // 实例化专职服务层
    const audioService = new AudioService();
    const reverseIndexService = new ReverseIndexService(vocabManager);

    // ========== 共享与状态变量 ==========
    const mainTab = ref<'vocabulary' | 'estimate' | 'sentence' | 'review' | 'media' | 'reader' | 'webimport' | 'pronunciation'>('vocabulary');
    const searchQuery = ref('');
    const selectedWord = ref<WordInfo | null>(null);
    const searchResultsList = ref<ReverseSearchCandidate[]>([]);
    const selectedCandidates = ref<Set<string>>(new Set()); // 多选候选词状态
    const availableVoices = ref<SpeechSynthesisVoice[]>([]);

    // 发音与 AI 设置（由 SettingsHeader 同步更新）
    const voiceSettings = ref<VoiceSettings>({
      engine: 'online',
      onlineAccent: 2,
      voiceName: '',
      rate: 0.9,
      pitch: 1.0
    });

    const aiSettings = ref<AISettings>({
      apiKey: '',
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat'
    });

    const onlineTransCache = new Map<string, string>();

    // ========== Provide 依赖向下游提供 ==========
    async function speak(
      text: string, 
      customSettings?: any, 
      customVoices?: any, 
      onBoundary?: (charIndex: number) => void, 
      onEnd?: () => void
    ) {
      const settings = customSettings || voiceSettings.value;
      const voices = customVoices || availableVoices.value;
      await audioService.speak(text, settings, voices, onBoundary, onEnd);
    }

    provide('speak', speak);
    provide('getAiSettings', () => aiSettings.value);
    provide('getVoiceSettings', () => voiceSettings.value);
    provide('getAvailableVoices', () => availableVoices.value);
    provide('audioService', audioService);
    provide('plugin', plugin);

    // ========== 自主查词与搜索逻辑 ==========

    function onVoiceSettingsChanged(settings: VoiceSettings) {
      voiceSettings.value = settings;
    }

    function onAiSettingsChanged(settings: AISettings) {
      aiSettings.value = settings;
    }

    function onWordSelected(wordInfo: WordInfo) {
      selectedWord.value = wordInfo;
    }

    function onWordSelectedByString(word: string) {
      handleWordSelected(word);
    }

    function selectResultWord(word: string) {
      handleWordSelected(word, true);
    }

    function backToSearchResults() {
      selectedWord.value = null;
    }

    function setTab(tab: 'vocabulary' | 'estimate' | 'sentence' | 'review' | 'media' | 'reader') {
      mainTab.value = tab;
    }

    function clearSearchResults() {
      searchResultsList.value = [];
      selectedCandidates.value.clear();
    }

    // 切换单个候选词的选中状态
    function toggleCandidate(lemma: string) {
      if (selectedCandidates.value.has(lemma)) {
        selectedCandidates.value.delete(lemma);
      } else {
        selectedCandidates.value.add(lemma);
      }
    }

    // 全选/取消全选
    function toggleSelectAll() {
      if (selectedCandidates.value.size === searchResultsList.value.length) {
        // 当前全选，执行取消全选
        selectedCandidates.value.clear();
      } else {
        // 执行全选
        selectedCandidates.value.clear();
        searchResultsList.value.forEach(c => selectedCandidates.value.add(c.lemma));
      }
    }

    function lookupInSystemDict(query: string) {
      const clean = query.trim();
      if (!clean) return;
      window.open(`dict://${encodeURIComponent(clean)}`);
    }

    function getWordTranslation(word: string): string {
      const info = vocabManager.getInfo(word);
      if (info && info.trans) return info.trans;
      
      const cached = onlineTransCache.get(word);
      if (cached) return cached;
      
      const dictEntry = OFFLINE_DICT[word];
      if (dictEntry) return dictEntry.trans;
      
      return '暂无释义';
    }

    // 异步在线获取建议词
    async function fetchOnlineChineseSuggestions(query: string): Promise<Array<{ word: string, trans: string }>> {
      const url = `https://dict.youdao.com/suggest?q=${encodeURIComponent(query)}&num=20&doctype=json`;
      try {
        const res = await requestUrl({ url });
        const data = typeof res.json === 'object' ? res.json : JSON.parse(res.text || '{}');
        if (data?.data?.entries) {
          return data.data.entries
            .filter((e: any) => e.entry && e.explain)
            .map((e: any) => ({ word: e.entry, trans: e.explain }));
        }
      } catch (e) {
        console.error('获取在线推荐失败:', e);
      }
      return [];
    }

    async function performSearch() {
      const query = searchQuery.value.trim();
      if (!query) return;

      const hasChinese = reverseIndexService.containsChinese(query);

      if (hasChinese) {
        // \u4f7f\u7528\u53cd\u5411\u7d22\u5f15\u68c0\u7d22
        const candidates = reverseIndexService.search(query);

        if (candidates.length > 0) {
          // \u4f7f\u7528\u53cd\u5411\u7d22\u5f15\u7ed3\u679c
          if (candidates.length === 1) {
            searchResultsList.value = [];
            handleWordSelected(candidates[0].lemma);
          } else {
            new Notice(`\u627e\u5230 ${candidates.length} \u4e2a\u5339\u914d\u7684\u82f1\u6587\u5355\u8bcd`);
            selectedWord.value = null;
            searchResultsList.value = candidates;
          }
          searchQuery.value = '';
          return;
        }

      } else {
        // 降级：反向索引未找到，尝试在线推荐
        const onlineResults = await fetchOnlineChineseSuggestions(query);
        const onlineCandidates: ReverseSearchCandidate[] = [];
        for (const item of onlineResults) {
          const wordLower = item.word.toLowerCase();
          const isEnglishWord = /^[a-zA-Z\s\-'\.]+$/.test(wordLower);
          if (isEnglishWord) {
            const status = vocabManager.get(wordLower);
            onlineCandidates.push({
              lemma: wordLower,
              translation: item.trans,
              status,
              isHighFrequency: false
            });
            onlineTransCache.set(wordLower, item.trans);
          }
        }

        if (onlineCandidates.length === 0) {
          new Notice(`未找到包含 "${query}" 释义的英文单词`);
          return;
        }

        if (onlineCandidates.length === 1) {
          searchResultsList.value = [];
          handleWordSelected(onlineCandidates[0].lemma);
        } else {
          let totalMatches = onlineCandidates.length;
          if (totalMatches > 100) {
            onlineCandidates.splice(100);
            new Notice(`找到 ${totalMatches} 个在线结果，仅展示前 100 个`);
          } else {
            new Notice(`找到 ${totalMatches} 个在线匹配结果`);
          }
          selectedWord.value = null;
          searchResultsList.value = onlineCandidates;
        }
        searchQuery.value = '';
        return;
      }

      // 英文单词直接查询
      searchResultsList.value = [];
      const result = lemmatize(query.toLowerCase());
      handleWordSelected(result.lemma);
      searchQuery.value = '';
    }

    // 统一展示所选单词详情的路由方法
    function handleWordSelected(word: string, keepSearchResults = false) {
      if (!keepSearchResults) {
        searchResultsList.value = [];
      }
      
      const info = vocabManager.getInfo(word);
      if (info) {
        selectedWord.value = { ...info };
      } else {
        // 初始化未标记词 (UNKNOWN)
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
      }
    }

    // ========== 宿主离线发音人列表获取 ==========
    function updateVoices() {
      if (typeof window === 'undefined' || !window.speechSynthesis) return;
      const allVoices = window.speechSynthesis.getVoices();
      availableVoices.value = allVoices.filter(v => v.lang.toLowerCase().startsWith('en'));
    }

    // 获取状态标签
    function getStatusLabel(status: string): string {
      const labels: Record<string, string> = {
        'KNOWN': '已掌握',
        'LEARNING': '学习中',
        'UNKNOWN': '生词'
      };
      return labels[status] || status;
    }

    // 批量添加未掌握的词到生词本
    function batchAddToVocabulary() {
      if (selectedCandidates.value.size === 0) {
        new Notice('请先勾选要收藏的单词');
        return;
      }

      // 仅收藏勾选的候选词
      let addedCount = 0;
      for (const lemma of selectedCandidates.value) {
        const candidate = searchResultsList.value.find(c => c.lemma === lemma);
        if (candidate && candidate.status === 'UNKNOWN') {
          vocabManager.set(lemma, 'LEARNING');
          addedCount++;
        }
      }

      if (addedCount === 0) {
        new Notice('勾选的单词都已在词汇本中');
      } else {
        new Notice(`已添加 ${addedCount} 个生词到词汇本`);
        // 触发词汇变更事件，通知生词本刷新
        eventBus.emit('lang-learner:word-changed');
      }

      // 刷新搜索结果状态
      searchResultsList.value = searchResultsList.value.map(c => ({
        ...c,
        status: vocabManager.get(c.lemma)
      }));

      // 清空选中状态
      selectedCandidates.value.clear();
    }

    // ========== 生命周期 ==========
    onMounted(() => {
      eventBus.on('lang-learner:word-selected', (word: string) => {
        handleWordSelected(word);
      });
      
      updateVoices();
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = updateVoices;
      }
    });

    onUnmounted(() => {
      audioService.stopAllAudio();
      eventBus.off('lang-learner:word-selected');
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    });

    return {
      mainTab,
      searchQuery,
      selectedWord,
      searchResultsList,
      selectedCandidates,
      availableVoices,
      voiceSettings,
      aiSettings,
      speak,
      onVoiceSettingsChanged,
      onAiSettingsChanged,
      onWordSelected,
      onWordSelectedByString,
      selectResultWord,
      backToSearchResults,
      setTab,
      clearSearchResults,
      toggleCandidate,
      toggleSelectAll,
      lookupInSystemDict,
      getWordTranslation,
      performSearch,
      getStatusLabel,
      batchAddToVocabulary
    };
  }
});
</script>

<style scoped>
.lang-learner-results-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}
.lang-learner-btn-sm {
  font-size: 0.85em;
  padding: 4px 8px;
}
.lang-learner-btn-close-results {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 1.1em;
  color: var(--text-muted);
  padding: 2px 6px;
}
.lang-learner-search-results-list {
  max-height: 250px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 2px;
}
.lang-learner-search-result-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  background-color: var(--background-secondary);
  border: 1px solid var(--border-color);
  transition: all 0.2s ease;
}
.lang-learner-search-result-item:hover {
  background-color: var(--background-modifier-hover);
  border-color: var(--text-accent);
}

/* Checkbox 样式 */
.lang-learner-candidate-checkbox {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  cursor: pointer;
  margin: 0;
}

/* 候选词内容区（可点击查看详情） */
.lang-learner-result-content {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  min-width: 0;
}

.lang-learner-result-word-span {
  font-weight: 600;
  color: var(--text-accent);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.lang-learner-result-trans-span {
  color: var(--text-muted);
  font-size: 0.85em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-left: 12px;
  flex: 1;
  text-align: right;
}
.lang-learner-status-badge {
  font-size: 0.7em;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}
.lang-learner-status-known {
  background-color: var(--color-green);
  color: white;
}
.lang-learner-status-learning {
  background-color: var(--color-yellow);
  color: var(--text-normal);
}
.lang-learner-status-unknown {
  background-color: var(--color-red);
  color: white;
}
.lang-learner-result-trans-span {
  font-size: 0.85em;
  color: var(--text-muted);
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 60%;
}
</style>
