<template>
  <div class="lang-learner-tab-content">
    <div class="lang-learner-panel-dashboard">
      <h3 class="lang-learner-panel-title">📰 RSS 订阅阅读</h3>
      <p style="font-size: 0.82em; color: var(--text-muted); margin: -4px 0 12px 0;">
        在此处订阅英语文章源，享受即读即划、纳米级查词与发音的阅读体验。
      </p>
    </div>

    <!-- RSS 订阅源管理器 -->
    <div class="lang-learner-panel-section lang-learner-rss-config-box">
      <div 
        class="lang-learner-voice-settings-header" 
        @click="showRssConfig = !showRssConfig"
      >
        <span class="lang-learner-rss-config-title">➕ 管理 RSS 订阅源</span>
        <span class="lang-learner-rss-config-arrow">{{ showRssConfig ? '▼ 收起' : '▶ 展开' }}</span>
      </div>
      
      <div v-show="showRssConfig" class="lang-learner-rss-config-body">
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <input 
            v-model="newFeedName" 
            placeholder="订阅源名称 (如: Hacker News)"
            class="lang-learner-rss-input"
          />
          <div style="display: flex; gap: 6px;">
            <input 
              v-model="newFeedUrl" 
              placeholder="订阅源 RSS URL"
              class="lang-learner-rss-input"
              style="flex: 1;"
            />
            <button 
              @click="addRssFeed" 
              class="lang-learner-btn lang-learner-btn-primary" 
            >
              添加
            </button>
          </div>
        </div>
        
        <!-- 已有订阅源列表 -->
        <div class="lang-learner-rss-list-container">
          <label>已订阅源列表:</label>
          <div class="lang-learner-rss-feeds-list">
            <div 
              v-for="(feed, idx) in rssFeeds" 
              :key="idx"
              class="lang-learner-rss-feed-item"
            >
              <span class="lang-learner-feed-name-span">{{ feed.name }}</span>
              <button 
                @click="removeRssFeed(idx)" 
                class="lang-learner-btn-icon" 
                title="删除该源"
              >
                ❌
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 选择订阅源 -->
    <div class="lang-learner-panel-section lang-learner-rss-selector-box">
      <label>📰 选择订阅源进行阅读</label>
      <select 
        v-model="selectedFeedUrl" 
        @change="handleSelectFeed"
      >
        <option value="">-- 请选择 RSS 订阅源 --</option>
        <option v-for="feed in rssFeeds" :key="feed.url" :value="feed.url">
          {{ feed.name }}
        </option>
      </select>
    </div>

    <!-- 文章阅读与列表层 -->
    <div class="lang-learner-panel-section" style="min-height: 200px;">
      <!-- 加载中提示 -->
      <div v-if="isLoadingFeeds" class="lang-learner-loading-text" style="padding: 30px 0; text-align: center;">
        正在拉取 RSS 数据并分词高亮，请稍候...
      </div>

      <!-- 详情阅读模式 -->
      <div v-else-if="selectedArticle" class="lang-learner-rss-article-detail">
        <div class="lang-learner-rss-detail-header">
          <button 
            @click="selectedArticle = null" 
            class="lang-learner-btn" 
            style="padding: 4px 10px; font-size: 0.8em; display: flex; align-items: center; gap: 4px;"
          >
            ⬅️ 返回文章列表
          </button>
          <a 
            :href="selectedArticle.link" 
            target="_blank" 
            class="lang-learner-btn-icon" 
            title="在浏览器中打开原文" 
            style="text-decoration: none;"
          >
            🌐
          </a>
        </div>

        <h3 class="lang-learner-rss-title">
          {{ selectedArticle.title }}
        </h3>
        <p class="lang-learner-rss-date-label">
          发布日期: {{ selectedArticle.date }}
        </p>

        <!-- 文章正文段落列表 -->
        <div class="lang-learner-rss-article-body">
          <p 
            v-for="(p, pIdx) in selectedArticleParagraphs" 
            :key="pIdx" 
            class="lang-learner-rss-para"
          >
            <template v-for="(token, index) in p.segments" :key="index">
              <span v-if="token.type === 'text'">{{ token.text }}</span>
              <span
                v-else
                class="lang-learner-word"
                :class="{
                  'lang-learner-unknown': token.status === 'UNKNOWN',
                  'lang-learner-learning': token.status === 'LEARNING',
                  'lang-learner-known': token.status === 'KNOWN',
                  'lang-learner-phrase': token.isPhrase
                }"
                :data-lemma="token.lemma"
                :data-trans="token.trans"
                :data-phonetic="token.phonetic ? '/' + token.phonetic + '/' : ''"
                @click="onWordClick(token.lemma)"
                @dblclick="onWordDblClick(token)"
              >
                {{ token.text }}
              </span>
            </template>
          </p>
        </div>
      </div>

      <!-- 列表展示模式 -->
      <div v-else-if="feedItems.length > 0" class="lang-learner-rss-items-list">
        <div 
          v-for="(item, idx) in feedItems" 
          :key="idx" 
          @click="readArticle(item)"
          class="lang-learner-wordlist-item"
          style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 10px; cursor: pointer;"
        >
          <span style="font-weight: 600; font-size: 0.95em; color: var(--text-normal); line-height: 1.3; text-align: left;">{{ item.title }}</span>
          <span style="font-size: 0.75em; color: var(--text-muted);">{{ item.date }}</span>
        </div>
      </div>

      <!-- 空状态提示 -->
      <div v-else class="lang-learner-empty-hint">
        <div style="font-size: 2.5em; margin-bottom: 8px;">📰</div>
        <p style="margin: 0; font-size: 0.85em; color: var(--text-muted); padding: 0 16px;">
          未拉取到文章列表。请在上方选择或添加 RSS 订阅源并载入。
        </p>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, inject, onMounted, onUnmounted } from 'vue';
import { Notice } from 'obsidian';
import { eventBus } from '../../event/EventBus';
import { RSSService, type RSSFeed, type RSSArticle } from '../../services/RSSService';
import type { VocabularyManager } from '../../db/vocabulary';
import { tokenize } from '../../tokenizer/tokenizer';
import { OFFLINE_DICT } from '../../data/static_data';

export default defineComponent({
  name: 'ReaderTab',
  emits: ['select-word'],
  setup(props, { emit }) {


    const vocabManager = inject<VocabularyManager>('vocabManager')!;

    const rssService = new RSSService();

    const showRssConfig = ref(false);
    const newFeedName = ref('');
    const newFeedUrl = ref('');
    const rssFeeds = ref<RSSFeed[]>([]);
    const selectedFeedUrl = ref('');
    const isLoadingFeeds = ref(false);
    const feedItems = ref<RSSArticle[]>([]);

    const selectedArticle = ref<RSSArticle | null>(null);
    const selectedArticleParagraphs = ref<{ text: string; segments: any[] }[]>([]);

    function loadFeeds() {
      rssFeeds.value = rssService.loadFeeds();
    }

    function addRssFeed() {
      const name = newFeedName.value.trim();
      const url = newFeedUrl.value.trim();
      if (!name || !url) {
        new Notice('请输入完整的订阅源名称和链接');
        return;
      }
      if (rssFeeds.value.some(f => f.url === url)) {
        new Notice('该订阅源已存在');
        return;
      }
      rssFeeds.value.push({ name, url });
      rssService.saveFeeds(rssFeeds.value);
      newFeedName.value = '';
      newFeedUrl.value = '';
      new Notice('订阅源添加成功');
    }

    function removeRssFeed(idx: number) {
      rssFeeds.value.splice(idx, 1);
      rssService.saveFeeds(rssFeeds.value);
      new Notice('订阅源已删除');
    }

    async function handleSelectFeed() {
      if (!selectedFeedUrl.value) {
        feedItems.value = [];
        return;
      }
      isLoadingFeeds.value = true;
      selectedArticle.value = null;
      try {
        const xmlText = await rssService.fetchFeedXml(selectedFeedUrl.value);
        feedItems.value = rssService.parseRssXml(xmlText);
        new Notice(`成功拉取 ${feedItems.value.length} 篇文章`);
      } catch (e) {
        console.error(e);
        new Notice('RSS 订阅源拉取或解析失败');
      } finally {
        isLoadingFeeds.value = false;
      }
    }

    function processTextToSegments(text: string): any[] {
      if (!text) return [];
      const tokens = tokenize(text);
      const phraseRanges: Array<{ start: number; end: number }> = [];
      for (const token of tokens) {
        if (token.isPhrase) {
          phraseRanges.push({ start: token.start, end: token.end });
        }
      }
      const isCoveredByPhrase = (token: any): boolean => {
        if (token.isPhrase) return false;
        for (const range of phraseRanges) {
          if (token.start >= range.start && token.end <= range.end) return true;
        }
        return false;
      };
      const segments: any[] = [];
      let lastIndex = 0;
      for (const token of tokens) {
        if (isCoveredByPhrase(token)) continue;
        if (token.start > lastIndex) {
          segments.push({
            type: 'text',
            text: text.slice(lastIndex, token.start),
            lemma: '',
            start: lastIndex,
            end: token.start
          });
        }
        const status = vocabManager.get(token.lemma);
        const info = vocabManager.getInfo(token.lemma);
        let trans = info?.trans || '';
        let phonetic = info?.phonetic || '';
        if (!trans) {
          const dictEntry = OFFLINE_DICT[token.lemma];
          if (dictEntry) {
            trans = dictEntry.trans;
            phonetic = phonetic || dictEntry.phonetic || '';
          }
        }
        segments.push({
          type: 'word',
          text: text.slice(token.start, token.end),
          lemma: token.lemma,
          isPhrase: token.isPhrase,
          status,
          trans,
          phonetic,
          start: token.start,
          end: token.end
        });
        lastIndex = token.end;
      }
      if (lastIndex < text.length) {
        segments.push({
          type: 'text',
          text: text.slice(lastIndex),
          lemma: '',
          start: lastIndex,
          end: text.length
        });
      }
      return segments;
    }

    function readArticle(item: RSSArticle) {
      selectedArticle.value = item;
      const paragraphs = rssService.extractParagraphs(item);
      selectedArticleParagraphs.value = paragraphs.map(pText => {
        return {
          text: pText,
          segments: processTextToSegments(pText)
        };
      });
    }

    function onWordClick(word: string) {
      emit('select-word', word);
    }

    async function onWordDblClick(token: any) {
      const currentStatus = vocabManager.get(token.lemma);
      const displayPhonetic = token.phonetic ? ` /${token.phonetic}/` : '';
      let trans = token.trans;
      let phonetic = token.phonetic;

      if (trans) {
        new Notice(`📖 ${token.lemma}${displayPhonetic}\n释义: ${trans}`, 3500);
      } else {
        try {
          const result = await vocabManager.fetchOnlineTranslationAndDetails(token.lemma);
          if (result && result.trans) {
            new Notice(`📖 ${token.lemma}${result.phonetic ? ` /${result.phonetic}/` : ''}\n释义: ${result.trans}`, 4500);
            trans = result.trans;
            token.trans = result.trans;
            if (result.phonetic) {
              phonetic = result.phonetic;
              token.phonetic = result.phonetic;
            }
          }
        } catch (err) {}
      }

      if (currentStatus !== 'KNOWN') {
        vocabManager.set(token.lemma, 'LEARNING', trans, phonetic);
        eventBus.emit('lang-learner:word-changed', token.lemma, 'LEARNING', token.text);
      }

      emit('select-word', token.lemma);
    }

    function handleWordChanged(word: string, status: string) {
      selectedArticleParagraphs.value.forEach(p => {
        p.segments.forEach(tok => {
          if (tok.lemma === word) tok.status = status;
        });
      });
    }

    onMounted(() => {
      loadFeeds();
      eventBus.on('lang-learner:word-changed', handleWordChanged);
    });

    onUnmounted(() => {
      eventBus.off('lang-learner:word-changed', handleWordChanged);
    });

    return {
      showRssConfig,
      newFeedName,
      newFeedUrl,
      rssFeeds,
      selectedFeedUrl,
      isLoadingFeeds,
      feedItems,
      selectedArticle,
      selectedArticleParagraphs,
      addRssFeed,
      removeRssFeed,
      handleSelectFeed,
      readArticle,
      onWordClick,
      onWordDblClick
    };
  }
});
</script>

<style scoped>
.lang-learner-rss-config-box {
  padding: 12px; 
  border-radius: 8px; 
  border: 1px solid var(--background-modifier-border); 
  background: var(--background-secondary);
}
.lang-learner-rss-config-header {
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  cursor: pointer; 
  padding: 4px 0;
}
.lang-learner-rss-config-title {
  font-weight: 600; 
  font-size: 0.85em; 
  color: var(--text-muted);
}
.lang-learner-rss-config-arrow {
  font-size: 0.75em; 
  color: var(--text-muted);
}
.lang-learner-rss-config-body {
  padding-top: 10px; 
  display: flex; 
  flex-direction: column; 
  gap: 8px;
}
.lang-learner-rss-input {
  width: 100%; 
  padding: 6px 8px; 
  border-radius: 4px; 
  background: var(--background-modifier-form-field); 
  border: 1px solid var(--background-modifier-border); 
  color: var(--text-normal); 
  font-size: 0.85em;
}
.lang-learner-rss-list-container {
  border-top: 1px dashed var(--background-modifier-border); 
  padding-top: 8px; 
  margin-top: 4px;
}
.lang-learner-rss-list-container label {
  font-size: 0.75em; 
  color: var(--text-muted); 
  font-weight: 600; 
  display: block; 
  margin-bottom: 4px;
}
.lang-learner-rss-feeds-list {
  display: flex; 
  flex-direction: column; 
  gap: 4px; 
  max-height: 120px; 
  overflow-y: auto;
}
.lang-learner-rss-feed-item {
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  padding: 4px 6px; 
  border-radius: 4px; 
  background: var(--background-primary); 
  border: 1px solid var(--background-modifier-border);
}
.lang-learner-feed-name-span {
  font-size: 0.8em; 
  color: var(--text-normal); 
  font-weight: 500; 
  overflow: hidden; 
  text-overflow: ellipsis; 
  white-space: nowrap; 
  max-width: 150px;
}
.lang-learner-rss-selector-box {
  margin-bottom: 12px; 
  display: flex; 
  flex-direction: column; 
  gap: 6px;
}
.lang-learner-rss-selector-box label {
  font-size: 0.85em; 
  font-weight: 600; 
  color: var(--text-muted);
}
.lang-learner-rss-selector-box select {
  width: 100%; 
  padding: 6px 8px; 
  border-radius: 4px; 
  background: var(--background-modifier-form-field); 
  border: 1px solid var(--background-modifier-border); 
  color: var(--text-normal); 
  font-size: 0.85em; 
  cursor: pointer;
}
.lang-learner-rss-detail-header {
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  margin-bottom: 10px; 
  border-bottom: 1px solid var(--background-modifier-border); 
  padding-bottom: 8px;
}
.lang-learner-rss-title {
  font-size: 1.2em; 
  font-weight: bold; 
  margin: 0 0 6px 0; 
  line-height: 1.3; 
  color: var(--text-normal);
}
.lang-learner-rss-date-label {
  font-size: 0.75em; 
  color: var(--text-muted); 
  margin: 0 0 16px 0;
}
.lang-learner-rss-article-body {
  line-height: 1.6; 
  font-size: 0.95em; 
  color: var(--text-normal); 
  display: flex; 
  flex-direction: column; 
  gap: 14px;
}
.lang-learner-rss-para {
  margin: 0; 
  text-indent: 0; 
  text-align: justify; 
  white-space: pre-wrap;
  line-height: 1.6;
  letter-spacing: 0.01em;
}
</style>
