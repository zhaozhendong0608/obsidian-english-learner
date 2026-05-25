<template>
  <div class="lang-learner-tab-content">
    <div class="lang-learner-panel-dashboard">
      <h3 class="lang-learner-panel-title">📅 间隔复习</h3>
      <div class="lang-learner-stats-grid">
        <div class="lang-learner-stat-item lang-learner-stat-learning" style="grid-column: span 2;">
          <span class="lang-learner-stat-value">{{ dueWords.length }}</span>
          <span class="lang-learner-stat-label">今日待复习</span>
        </div>
      </div>
    </div>

    <div v-if="currentReviewWord" class="lang-learner-review-card-container">
      <!-- 单词展示区 -->
      <div class="lang-learner-estimation-word">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0 10px 10px 10px;">
          <span class="lang-learner-big-word" @click="$emit('select-word', currentReviewWord.word)" style="cursor: pointer;" title="点击在详情面板查看">{{ currentReviewWord.word }}</span>
          <button 
            class="lang-learner-btn-voice-word" 
            title="朗读单词" 
            @click="speak(currentReviewWord.word)"
            style="background: transparent; border: none; cursor: pointer; font-size: 1.2em; opacity: 0.85;"
          >
            🔊
          </button>
        </div>
        <div v-if="currentReviewWord.phonetic" class="lang-learner-word-phonetic" style="margin-top: 4px;">
          /{{ currentReviewWord.phonetic }}/
        </div>
      </div>

      <!-- 答面详情 -->
      <div v-if="showReviewAnswer" class="lang-learner-panel-section lang-learner-review-answer-section" style="margin-top: 12px;">
        <div class="lang-learner-word-trans" style="border-top: none; padding-top: 0; font-size: 0.95em;">
          {{ currentReviewWord.trans || '暂无释义' }}
        </div>

        <!-- 词源 -->
        <div v-if="currentReviewWord.etymology" class="lang-learner-word-etymology-container" style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--background-modifier-border);">
          <div class="lang-learner-etymology-title" style="font-weight: 500; font-size: 0.85em; color: var(--text-accent); margin-bottom: 4px;">
            💡 词源记忆
          </div>
          <div class="lang-learner-etymology-content" style="font-size: 0.85em; color: var(--text-normal); line-height: 1.4; background-color: var(--background-secondary-alt); padding: 6px 8px; border-radius: 4px; border-left: 3px solid var(--text-accent);">
            {{ currentReviewWord.etymology }}
          </div>
        </div>

        <!-- 例句 -->
        <div class="lang-learner-word-examples-container" style="margin-top: 12px;">
          <div class="lang-learner-examples-title" style="font-size: 0.85em; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">
            💡 例句上下文
          </div>
          <div v-if="isLoadingReviewExamples" class="lang-learner-examples-loading" style="font-size: 0.8em; color: var(--text-muted);">
            正在获取例句...
          </div>
          <ul v-else-if="reviewExampleSentences.length > 0" class="lang-learner-example-list" style="margin: 0; padding-left: 14px; font-size: 0.85em; line-height: 1.4;">
            <li v-for="(sentence, idx) in reviewExampleSentences" :key="idx" class="lang-learner-example-item" style="margin-bottom: 4px;">
              {{ sentence }}
            </li>
          </ul>
          <div v-else class="lang-learner-examples-empty" style="font-size: 0.8em; color: var(--text-muted); font-style: italic;">
            暂无例句
          </div>
        </div>
      </div>

      <!-- 底部控制按钮 -->
      <div style="margin-top: 16px;">
        <button 
          v-if="!showReviewAnswer" 
          @click="showReviewAnswer = true" 
          class="lang-learner-btn lang-learner-btn-primary lang-learner-btn-full"
          style="font-size: 0.95em; padding: 10px;"
        >
          显示释义
        </button>
        
        <div v-else style="display: flex; gap: 8px;">
          <button @click="submitReviewGrade(0)" class="lang-learner-btn lang-learner-btn-no" style="font-size: 0.85em; padding: 8px 4px; flex: 1;">
            🔴 忘记
          </button>
          <button @click="submitReviewGrade(1)" class="lang-learner-btn" style="background: #f39c12; color: #fff; font-size: 0.85em; padding: 8px 4px; flex: 1;">
            🟡 模糊
          </button>
          <button @click="submitReviewGrade(2)" class="lang-learner-btn lang-learner-btn-yes" style="font-size: 0.85em; padding: 8px 4px; flex: 1;">
            🟢 记得
          </button>
          <button @click="submitReviewGrade(3)" class="lang-learner-btn lang-learner-btn-accent" style="font-size: 0.85em; padding: 8px 4px; flex: 1;">
            ⚡ 熟练
          </button>
        </div>
      </div>
    </div>

    <div v-else class="lang-learner-empty-hint" style="padding: 40px 0; text-align: center;">
      <div style="font-size: 3em; margin-bottom: 12px;">🎉</div>
      <p style="font-weight: 600; color: var(--text-success, #27ae60); margin: 0 0 4px 0;">已完成今日复习！</p>
      <p style="font-size: 0.85em; color: var(--text-muted); margin: 0;">太棒了，目前没有待复习的到期单词。</p>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, inject, watch, onMounted, onUnmounted } from 'vue';
import { Notice, requestUrl } from 'obsidian';
import { eventBus } from '../../event/EventBus';
import type { VocabularyManager } from '../../db/vocabulary';
import type { WordInfo } from '../../types';

export default defineComponent({
  name: 'ReviewTab',
  emits: ['select-word'],
  setup(props, { emit }) {
    // 注入核心依赖
    const vocabManager = inject<VocabularyManager>('vocabManager')!;
    const plugin = inject<any>('plugin')!;
    const speak = inject<(text: string) => Promise<void>>('speak')!;

    const wordListCache = ref<WordInfo[]>([]);
    const showReviewAnswer = ref(false);
    const reviewExampleSentences = ref<string[]>([]);
    const isLoadingReviewExamples = ref(false);
    let reviewExampleVersion = 0;

    // 刷新复习单词列表
    function refreshDueWords() {
      const entries = vocabManager.getAllEntries();
      const list: WordInfo[] = [];
      entries.forEach((info) => {
        if (info.status === 'LEARNING') {
          list.push(info);
        }
      });
      wordListCache.value = list;
    }

    const dueWords = computed(() => {
      const now = Date.now();
      return wordListCache.value
        .filter(w => w.status === 'LEARNING' && (!w.nextReview || w.nextReview <= now))
        .sort((a, b) => (a.nextReview || 0) - (b.nextReview || 0));
    });

    const currentReviewWord = computed(() => {
      return dueWords.value[0] || null;
    });

    // 级联获取例句
    async function searchCurrentDocSentences(word: string): Promise<string[]> {
      try {
        const activeFile = plugin.app.workspace.getActiveFile();
        if (!activeFile) return [];
        const content = await plugin.app.vault.cachedRead(activeFile);
        if (!content) return [];
        
        const sentences: string[] = [];
        const paragraphs = content.split(/\n+/);
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        
        for (const para of paragraphs) {
          if (!regex.test(para)) continue;
          const segments = para.split(/[.?!。？！]/);
          for (const seg of segments) {
            const cleanSeg = seg.trim();
            if (regex.test(cleanSeg)) {
              sentences.push(cleanSeg);
            }
          }
        }
        return sentences;
      } catch (e) {
        return [];
      }
    }

    async function loadLocalCardSentences(word: string): Promise<string[]> {
      try {
        const filePath = `LangLearner/Cards/${word}.md`;
        const exists = await plugin.app.vault.adapter.exists(filePath);
        if (!exists) return [];
        
        const content = await plugin.app.vault.adapter.read(filePath);
        const lines = content.split('\n');
        const sentences: string[] = [];
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('>') && trimmed.length > 1) {
            sentences.push(trimmed.slice(1).trim());
          }
        }
        return sentences;
      } catch (e) {
        return [];
      }
    }

    async function fetchOnlineExamples(word: string): Promise<{ examples: string[] }> {
      const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
      try {
        const res = await requestUrl({ url });
        const data = typeof res.json === 'object' ? res.json : JSON.parse(res.text || '[]');
        
        const sentences: string[] = [];
        if (Array.isArray(data)) {
          for (const entry of data) {
            if (entry.meanings) {
              for (const meaning of entry.meanings) {
                if (meaning.definitions) {
                  for (const def of meaning.definitions) {
                    if (def.example) {
                      sentences.push(def.example);
                    }
                  }
                }
              }
            }
          }
        }
        return { examples: sentences };
      } catch (e) {
        return { examples: [] };
      }
    }

    async function loadReviewExamples(word: string) {
      const currentVersion = ++reviewExampleVersion;
      reviewExampleSentences.value = [];
      isLoadingReviewExamples.value = true;

      try {
        const cleanWord = word.trim().toLowerCase();
        let sentences = await searchCurrentDocSentences(cleanWord);
        if (sentences.length < 3) {
          const cardSentences = await loadLocalCardSentences(cleanWord);
          sentences = [...sentences, ...cardSentences];
        }
        sentences = Array.from(new Set(sentences.map(s => s.trim()))).filter(Boolean);

        if (sentences.length < 2) {
          const res = await fetchOnlineExamples(cleanWord);
          sentences = [...sentences, ...res.examples];
        }

        const finalSentences = Array.from(new Set(sentences.map(s => s.trim())))
          .filter(s => s.toLowerCase().includes(cleanWord) || s.length > 5)
          .slice(0, 3);

        if (currentVersion === reviewExampleVersion) {
          reviewExampleSentences.value = finalSentences;
        }
      } catch (e) {
        console.error('加载复习例句失败:', e);
      } finally {
        if (currentVersion === reviewExampleVersion) {
          isLoadingReviewExamples.value = false;
        }
      }
    }

    watch(currentReviewWord, (newWord) => {
      showReviewAnswer.value = false;
      if (newWord) {
        loadReviewExamples(newWord.word);
      }
    }, { immediate: true });

    function submitReviewGrade(grade: number) {
      const wordObj = currentReviewWord.value;
      if (!wordObj) return;

      vocabManager.reviewWord(wordObj.word, grade);
      refreshDueWords();
      
      const labels = ['忘记', '模糊', '记得', '熟练'];
      new Notice(`已记录复习：${wordObj.word} (${labels[grade]})`);
    }

    onMounted(() => {
      refreshDueWords();
      // 监听状态改变更新待复习数量
      eventBus.on('lang-learner:word-changed', refreshDueWords);
    });

    onUnmounted(() => {
      eventBus.off('lang-learner:word-changed', refreshDueWords);
    });

    return {
      dueWords,
      currentReviewWord,
      showReviewAnswer,
      reviewExampleSentences,
      isLoadingReviewExamples,
      speak,
      submitReviewGrade
    };
  }
});
</script>

<style scoped>
/* 内联样式交由全局 styles.css */
</style>
