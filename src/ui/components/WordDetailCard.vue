<template>
  <div class="lang-learner-panel-section lang-learner-word-detail">
    <h4 class="lang-learner-section-title">
      <span class="lang-learner-detail-title-box">
        <button
          v-if="hasSearchResults"
          @click="$emit('back-to-results')"
          class="lang-learner-btn-back"
          title="返回搜索列表"
        >
          ⬅️
        </button>
        <span>📝 单词详情</span>
      </span>
      <div class="lang-learner-detail-actions">
        <button
          class="lang-learner-btn-voice-word"
          title="朗读单词"
          @click="speak(localWordInfo.word)"
        >
          🔊
        </button>
        <button
          class="lang-learner-btn-voice-word"
          title="在系统词典中查看"
          @click="lookupInSystemDict(localWordInfo.word)"
        >
          📖
        </button>
        <button
          class="lang-learner-btn-add-word"
          :title="localWordInfo.status === 'LEARNING' ? '已在生词本，点击移出' : '添加到生词本'"
          @click="toggleAddWord(localWordInfo.word)"
        >
          {{ localWordInfo.status === 'LEARNING' ? '📌' : '➕' }}
        </button>
        <button
          class="lang-learner-btn-icon"
          title="复制卡片内容"
          @click="copyCardContent"
        >📋</button>
      </div>
    </h4>

    <div class="lang-learner-word-info-card">
      <div class="lang-learner-word-detail-header">
        <div class="lang-learner-word-detail-word-box" title="点击切换音节划分" @click="toggleSyllableSplit">
          <span class="lang-learner-word-lemma">{{ displayWord }}</span>
          <span v-if="localWordInfo.phonetic" class="lang-learner-word-phonetic-inline">/{{ localWordInfo.phonetic }}/</span>
        </div>
      </div>

      <div class="lang-learner-word-trans">{{ localWordInfo.trans || '暂无释义' }}</div>
      
      <!-- 词源与记忆法辅助 -->
      <div v-if="localWordInfo.etymology" class="lang-learner-word-etymology-container">
        <div class="lang-learner-etymology-title">
          <span>💡 词源与记忆辅助</span>
        </div>
        <div class="lang-learner-etymology-content">
          {{ localWordInfo.etymology }}
        </div>
      </div>
      
      <!-- 例句联想模块 -->
      <div class="lang-learner-word-examples-container">
        <div class="lang-learner-examples-title">
          💡 例句联想
        </div>
        <div v-if="isLoadingExamples" class="lang-learner-examples-loading">
          正在获取例句...
        </div>
        <ul v-else-if="exampleSentences.length > 0" class="lang-learner-example-list">
          <li v-for="(sentence, idx) in exampleSentences" :key="idx" class="lang-learner-example-item">
            {{ sentence }}
          </li>
        </ul>
        <div v-else class="lang-learner-examples-empty">
          暂无相关例句
        </div>
      </div>

      <!-- 🤖 AI 教师解析模块 -->
      <div class="lang-learner-ai-teacher-container">
        <div class="lang-learner-ai-teacher-header">
          <div class="lang-learner-examples-title">🤖 AI 教师深度解析</div>
          <button 
            @click="askAITeacher" 
            :disabled="isAiLoading"
            class="lang-learner-btn-ask-ai"
          >
            {{ isAiLoading ? '思考中...' : '询问 AI 教师' }}
          </button>
        </div>
        
        <div v-if="aiResponse" class="lang-learner-ai-response-box">
          <!-- 词汇结构展示 -->
          <div v-if="aiResponse.root" class="lang-learner-root-box">
            <span class="lang-learner-root-label">词根枢纽:</span>
            <span class="lang-learner-root-value">{{ aiResponse.root }} ({{ aiResponse.rootMeaning }})</span>
          </div>
          
          <!-- AI 生成的解析渲染 -->
          <div 
            ref="aiMarkdownEl"
            class="lang-learner-ai-markdown markdown-preview-view markdown-rendered"
          >
          </div>
          
          <button 
            @click="exportAIResponse" 
            class="lang-learner-btn-export-ai"
          >
            ✍️ 一键归纳并构建词根网络
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, inject, watch, nextTick } from 'vue';
import { Notice, MarkdownView, MarkdownRenderer } from 'obsidian';
// @ts-ignore
import createHyphenator from 'hyphen';
// @ts-ignore
import hyphenationPatternsEnUs from 'hyphen/patterns/en-us';
import { eventBus } from '../../event/EventBus';
import { fetchAITeacher, type AISettings, type AIResponse } from '../../services/aiService';
import { updateAIContextNote } from '../../generator/contextNote';
import { ensureRootNoteLinked } from '../../generator/rootNote';
import type { VocabularyManager } from '../../db/vocabulary';
import type { WordInfo, WordStatus } from '../../types';
import { OFFLINE_DICT } from '../../data/static_data';

const hyphenator = createHyphenator(hyphenationPatternsEnUs);

export default defineComponent({
  name: 'WordDetailCard',
  props: {
    wordInfo: {
      type: Object as () => WordInfo,
      required: true
    },
    hasSearchResults: {
      type: Boolean,
      required: true
    }
  },
  emits: ['back-to-results'],
  setup(props, { emit }) {
    // 注入核心依赖
    const vocabManager = inject<VocabularyManager>('vocabManager')!;
    const plugin = inject<any>('plugin')!;
    const speak = inject<(text: string) => Promise<void>>('speak')!;
    const getAiSettings = inject<() => AISettings>('getAiSettings')!;

    const localWordInfo = ref<WordInfo>({ ...props.wordInfo });
    const showSyllableSplit = ref(false);
    const exampleSentences = ref<string[]>([]);
    const isLoadingExamples = ref(false);
    let exampleRequestVersion = 0;

    const isAiLoading = ref(false);
    const aiResponse = ref<AIResponse | null>(null);
    const aiMarkdownEl = ref<HTMLElement | null>(null);

    // 监听 props.wordInfo 的改变
    watch(() => props.wordInfo, (newVal) => {
      if (newVal) {
        localWordInfo.value = { ...newVal };
        showSyllableSplit.value = false;
        aiResponse.value = null;
        loadExamples(newVal.word);
        
        // 如果没有本地释义，自动在线异步查询释义
        if (!newVal.trans) {
          fetchOnlineAndUpdate(newVal.word);
        }
      }
    }, { immediate: true });

    // 监听全局单词状态变更事件
    eventBus.on('lang-learner:word-changed', (word: string, status: string) => {
      if (localWordInfo.value && localWordInfo.value.word === word) {
        localWordInfo.value.status = status as WordStatus;
      }
    });

    // 音节划分
    const displayWord = computed(() => {
      const word = localWordInfo.value.word;
      if (showSyllableSplit.value) {
        if (word.includes(' ')) {
          return word.split(' ').map(w => hyphenator(w, { hyphenChar: '·' })).join(' ');
        }
        return hyphenator(word, { hyphenChar: '·' });
      }
      return word;
    });

    function toggleSyllableSplit() {
      showSyllableSplit.value = !showSyllableSplit.value;
    }

    // 唤醒 macOS 系统词典
    function lookupInSystemDict(word: string) {
      const clean = word.trim();
      if (!clean) return;
      window.open(`dict://${encodeURIComponent(clean)}`);
    }

    // 收藏/取消收藏生词
    function toggleAddWord(word: string) {
      const currentStatus = localWordInfo.value.status;
      const newStatus = currentStatus === 'LEARNING' ? 'UNKNOWN' : 'LEARNING';
      
      const trans = localWordInfo.value.trans || OFFLINE_DICT[word]?.trans || '';
      const phonetic = localWordInfo.value.phonetic || OFFLINE_DICT[word]?.phonetic || '';
      const etymology = localWordInfo.value.etymology || '';
      
      vocabManager.set(word, newStatus, trans, phonetic, etymology);
      eventBus.emit('lang-learner:word-changed', word, newStatus);
    }

    // 例句获取链条
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
        console.error('搜索当前文档例句失败:', e);
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
        console.error('读取本地卡片例句失败:', e);
        return [];
      }
    }

    async function fetchOnlineExamples(word: string): Promise<{ examples: string[], phonetic?: string }> {
      const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
      try {
        const res = await requestUrl({ url });
        const data = typeof res.json === 'object' ? res.json : JSON.parse(res.text || '[]');
        
        const sentences: string[] = [];
        let phonetic: string | undefined;
        if (Array.isArray(data)) {
          for (const entry of data) {
            if (!phonetic && entry.phonetic) {
              phonetic = entry.phonetic;
            }
            if (!phonetic && entry.phonetics) {
              for (const ph of entry.phonetics) {
                if (ph.text) {
                  phonetic = ph.text;
                  break;
                }
              }
            }
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
        return { examples: sentences, phonetic };
      } catch (e) {
        console.warn('获取在线例句与音标失败:', e);
        return { examples: [] };
      }
    }

    async function loadExamples(word: string) {
      const currentVersion = ++exampleRequestVersion;
      exampleSentences.value = [];
      isLoadingExamples.value = true;

      try {
        const cleanWord = word.trim().toLowerCase();
        let sentences = await searchCurrentDocSentences(cleanWord);
        
        if (sentences.length < 3) {
          const cardSentences = await loadLocalCardSentences(cleanWord);
          sentences = [...sentences, ...cardSentences];
        }

        sentences = Array.from(new Set(sentences.map(s => s.trim()))).filter(Boolean);

        const needPhonetic = localWordInfo.value && localWordInfo.value.word === word && !localWordInfo.value.phonetic;
        let onlineSentences: string[] = [];
        let fetchedPhonetic: string | undefined;

        if (sentences.length < 2 || needPhonetic) {
          const res = await fetchOnlineExamples(cleanWord);
          onlineSentences = res.examples;
          fetchedPhonetic = res.phonetic;
        }

        sentences = [...sentences, ...onlineSentences];

        const finalSentences = Array.from(new Set(sentences.map(s => s.trim())))
          .filter(s => {
            // 过滤掉 URL 编码的字符串
            if (s.includes('%2F') || s.includes('%3F') || s.includes('%3D')) {
              return false;
            }
            // 过滤掉纯 URL
            if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('www.')) {
              return false;
            }
            // 必须包含目标单词且长度合理
            return (s.toLowerCase().includes(cleanWord) || s.length > 5) && s.length < 200;
          })
          .slice(0, 3);

        if (currentVersion === exampleRequestVersion) {
          exampleSentences.value = finalSentences;

          if (fetchedPhonetic && localWordInfo.value && localWordInfo.value.word === word) {
            const cleanPhonetic = fetchedPhonetic.replace(/^\/|\/$/g, '');
            if (cleanPhonetic) {
              localWordInfo.value.phonetic = cleanPhonetic;
              const currentStatus = vocabManager.get(word);
              const info = vocabManager.getInfo(word);
              const trans = info?.trans || localWordInfo.value.trans || '';
              vocabManager.set(word, currentStatus, trans, cleanPhonetic);
              eventBus.emit('lang-learner:word-changed', word, currentStatus);
            }
          }
        }
      } catch (err) {
        console.error('加载例句失败:', err);
      } finally {
        if (currentVersion === exampleRequestVersion) {
          isLoadingExamples.value = false;
        }
      }
    }

    // 在线拉取释义更新
    async function fetchOnlineAndUpdate(word: string) {
      try {
        const result = await vocabManager.fetchOnlineTranslationAndDetails(word);
        if (result && result.trans) {
          if (localWordInfo.value && localWordInfo.value.word === word) {
            localWordInfo.value.trans = result.trans;
            if (result.phonetic) {
              localWordInfo.value.phonetic = result.phonetic;
            }
            if (result.etymology) {
              localWordInfo.value.etymology = result.etymology;
            }
          }
          const currentStatus = vocabManager.get(word);
          vocabManager.set(word, currentStatus, result.trans, result.phonetic, result.etymology);
        }
      } catch (err) {
        console.error('在线异步更新释义失败:', err);
      }
    }

    // 复制 Markdown 格式
    function copyCardContent() {
      if (!localWordInfo.value) return;
      const lines: string[] = [];
      lines.push(`# ${localWordInfo.value.word}`);
      if (localWordInfo.value.phonetic) {
        lines.push(`**音标**: /${localWordInfo.value.phonetic}/`);
      }
      lines.push(`**释义**: ${localWordInfo.value.trans || '暂无释义'}`);
      if (localWordInfo.value.etymology) {
        lines.push(`**词源**: ${localWordInfo.value.etymology}`);
      }
      if (exampleSentences.value.length > 0) {
        lines.push('');
        lines.push('## 例句');
        exampleSentences.value.forEach(s => lines.push(`> ${s}`));
      }
      const content = lines.join('\n\n');
      navigator.clipboard.writeText(content).then(() => {
        new Notice('📋 已成功复制卡片内容到剪贴板！');
      }).catch(() => {
        new Notice('复制失败，请检查浏览器权限');
      });
    }

    // AI 教师流式渲染逻辑
    watch([aiResponse, aiMarkdownEl], () => {
      if (aiMarkdownEl.value) {
        aiMarkdownEl.value.innerHTML = '';
        if (aiResponse.value && aiResponse.value.markdown) {
          MarkdownRenderer.renderMarkdown(
            aiResponse.value.markdown,
            aiMarkdownEl.value,
            '',
            plugin
          );
        }
      }
    }, { flush: 'post' });

    async function askAITeacher() {
      if (!localWordInfo.value) return;
      const word = localWordInfo.value.word;
      const info = vocabManager.getInfo(word);
      const contextSentence = info?.sentence;

      // 检测是否为中文查询（触发同义词辨析模式）
      const isChinese = /[一-龥]/.test(word);

      isAiLoading.value = true;
      aiResponse.value = null;
      try {
        const settings = getAiSettings();
        const result = await fetchAITeacher(word, contextSentence, settings, isChinese);
        aiResponse.value = result;
      } catch (e: any) {
        new Notice(`AI 教师请求失败: ${e.message}`);
      } finally {
        isAiLoading.value = false;
      }
    }

    async function exportAIResponse() {
      if (!localWordInfo.value || !aiResponse.value) return;
      
      const word = localWordInfo.value.word;
      const { root, rootMeaning, markdown } = aiResponse.value;
      const app = plugin.app;
      
      try {
        vocabManager.updateRootInfo(word, root || '', rootMeaning || '', aiResponse.value.phrases || []);
        
        // @ts-ignore
        await updateAIContextNote(app, word, root || '', rootMeaning || '', markdown);
        
        if (root) {
          await ensureRootNoteLinked(app, root, rootMeaning || '', word);
        }
        
        const activeView = app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView && activeView.editor) {
          const editor = activeView.editor;
          const cursor = editor.getCursor();
          editor.replaceRange(`\n\n### 🤖 AI 教师解析: ${word}\n${markdown}\n`, cursor);
        } else {
          new Notice("提示：未能识别到可编辑的活动文档。仅自动保存到生词本卡片。");
        }
        
        new Notice(`[${word}] AI 解析与词根双链已成功落盘！`);
      } catch (e) {
        console.error("导出AI解析失败:", e);
        new Notice("导出 AI 解析时发生错误，请查看控制台。");
      }
    }

    return {
      localWordInfo,
      showSyllableSplit,
      exampleSentences,
      isLoadingExamples,
      isAiLoading,
      aiResponse,
      aiMarkdownEl,
      displayWord,
      toggleSyllableSplit,
      lookupInSystemDict,
      toggleAddWord,
      speak,
      copyCardContent,
      askAITeacher,
      exportAIResponse
    };
  }
});
</script>

<style scoped>
.lang-learner-detail-title-box {
  display: flex; 
  align-items: center; 
  gap: 6px;
}
.lang-learner-btn-back {
  background: transparent; 
  border: none; 
  cursor: pointer; 
  font-size: 1em; 
  padding: 0 4px; 
  display: inline-flex; 
  align-items: center;
}
.lang-learner-word-detail-header {
  display: flex; 
  justify-content: space-between; 
  align-items: center;
}
.lang-learner-word-detail-word-box {
  display: flex; 
  align-items: baseline; 
  gap: 8px; 
  cursor: pointer; 
  border-radius: 4px; 
  padding: 2px 6px; 
  margin-left: -6px; 
  transition: background-color 0.2s ease;
}
.lang-learner-word-detail-word-box:hover {
  background-color: var(--background-primary-alt);
}
.lang-learner-detail-actions {
  display: flex; 
  align-items: center; 
  gap: 4px;
}
.lang-learner-btn-voice-word, .lang-learner-btn-add-word {
  background: transparent; 
  border: none; 
  cursor: pointer; 
  font-size: 1.1em; 
  padding: 2px 6px; 
  opacity: 0.85;
}
.lang-learner-word-etymology-container {
  margin-top: 10px; 
  padding-top: 10px; 
  border-top: 1px dashed var(--background-modifier-border);
}
.lang-learner-etymology-title {
  font-weight: 500; 
  font-size: 0.85em; 
  color: var(--text-accent); 
  margin-bottom: 4px; 
  display: flex; 
  align-items: center; 
  gap: 4px;
}
.lang-learner-etymology-content {
  font-size: 0.85em; 
  color: var(--text-normal); 
  line-height: 1.4; 
  background-color: var(--background-secondary-alt); 
  padding: 6px 8px; 
  border-radius: 4px; 
  border-left: 3px solid var(--text-accent); 
  white-space: pre-wrap;
}
.lang-learner-ai-teacher-container {
  margin-top: 12px; 
  padding-top: 12px; 
  border-top: 1px solid var(--background-modifier-border);
}
.lang-learner-ai-teacher-header {
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  margin-bottom: 8px;
}
.lang-learner-btn-ask-ai {
  font-size: 0.8em; 
  padding: 4px 8px; 
  border-radius: 4px; 
  background-color: var(--interactive-accent); 
  color: var(--text-on-accent); 
  border: none; 
  cursor: pointer; 
  opacity: 0.9;
}
.lang-learner-ai-response-box {
  margin-top: 8px;
}
.lang-learner-root-box {
  margin-bottom: 8px; 
  display: flex; 
  gap: 8px; 
  align-items: center; 
  background-color: rgba(var(--interactive-accent-rgb, 99, 102, 241), 0.1); 
  padding: 4px 8px; 
  border-radius: 4px;
}
.lang-learner-root-label {
  font-size: 0.8em; 
  color: var(--text-muted);
}
.lang-learner-root-value {
  font-size: 0.85em; 
  font-weight: bold; 
  color: var(--text-accent);
}
.lang-learner-ai-markdown {
  font-size: 0.85em; 
  color: var(--text-normal); 
  line-height: 1.5; 
  background-color: var(--background-secondary); 
  padding: 8px; 
  border-radius: 6px; 
  max-height: 300px; 
  overflow-y: auto;
}
.lang-learner-btn-export-ai {
  margin-top: 8px; 
  width: 100%; 
  padding: 6px; 
  background-color: var(--background-secondary-alt); 
  border: 1px solid var(--interactive-accent); 
  color: var(--interactive-accent); 
  border-radius: 4px; 
  cursor: pointer; 
  font-size: 0.85em;
}
</style>
