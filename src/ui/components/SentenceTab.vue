<template>
  <div class="lang-learner-tab-content">
    <div class="lang-learner-panel-section">
      <h4 class="lang-learner-section-title">🔍 输入待分析句子</h4>
      <textarea
        v-model="sentenceInput"
        class="lang-learner-textarea"
        placeholder="在此输入或粘贴一段英文句子..."
        rows="4"
      ></textarea>
      <div class="lang-learner-sentence-actions">
        <button class="lang-learner-btn lang-learner-btn-primary" @click="analyzeInputSentence" :disabled="isAnalyzing" style="flex: 1;">
          {{ isAnalyzing ? '正在分析...' : '分析句子' }}
        </button>
        <button class="lang-learner-btn lang-learner-btn-secondary" @click="importSelection" style="flex: 1;">
          导入选中文本
        </button>
      </div>
    </div>

    <!-- 分析结果显示区 -->
    <div v-if="hasAnalyzed" class="lang-learner-panel-section lang-learner-analysis-result">
      <h4 class="lang-learner-section-title">📖 分析结果</h4>
      
      <!-- 翻译 -->
      <div class="lang-learner-result-box">
        <div class="lang-learner-box-title" style="display: flex; justify-content: space-between; align-items: center;">
          <span>🌐 机器翻译</span>
          <button 
            v-if="sentenceInput && sentenceInput.trim()"
            class="lang-learner-btn-voice-sentence" 
            title="朗读整句" 
            @click="speak(sentenceInput)"
          >
            🔊
          </button>
        </div>
        <p v-if="isTranslating" class="lang-learner-loading-text">正在翻译中...</p>
        <p v-else class="lang-learner-translation-text">{{ sentenceTranslation || '暂无翻译结果' }}</p>
      </div>

      <!-- 句子高亮交互渲染区 -->
      <div class="lang-learner-result-box">
        <div class="lang-learner-box-title">🎨 句子高亮与交互</div>
        <div class="lang-learner-interactive-sentence">
          <template v-for="(token, index) in analyzedSentenceTokens" :key="index">
            <!-- 未匹配的纯文本 -->
            <span v-if="token.type === 'text'">{{ token.text }}</span>
            <!-- 可交互的单词/短语 -->
            <span
              v-else
              class="lang-learner-word"
              :class="{
                'lang-learner-unknown': token.status === 'UNKNOWN',
                'lang-learner-learning': token.status === 'LEARNING',
                'lang-learner-known': token.status === 'KNOWN',
                'lang-learner-phrase': token.isPhrase,
                'lang-learner-word-speaking': activeTokenIndex === index
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
        </div>
        <p class="lang-learner-hint-text" style="text-align: left; margin-top: 8px;">提示: 单击单词选中，双击单词弹出释义并加入学习。</p>
      </div>

      <!-- 提取出的词汇分析列表 -->
      <div class="lang-learner-result-box">
        <div class="lang-learner-box-title">📊 词汇分析清单 (共 {{ analyzedWordsList.length }} 个)</div>
        <div class="lang-learner-wordlist-container" style="max-height: 250px;">
          <div
            v-for="item in analyzedWordsList"
            :key="item.word"
            class="lang-learner-wordlist-item"
            @click="onWordClick(item.word)"
          >
            <span class="lang-learner-wl-word" :class="{ 'lang-learner-wl-phrase': item.isPhrase }">
              {{ item.word }} <small v-if="item.isPhrase" style="opacity: 0.6; font-size: 0.7em;">(短语)</small>
            </span>
            <span class="lang-learner-wl-trans">{{ item.trans || '—' }}</span>
            <div class="lang-learner-sentence-word-status-btns">
              <button
                class="lang-learner-btn-voice-mini"
                title="发音"
                @click.stop="speak(item.word)"
              >🔊</button>
              <button
                class="lang-learner-btn-status-mini"
                :class="{ active: item.status === 'UNKNOWN' }"
                @click.stop="updateWordStatusInList(item.word, 'UNKNOWN')"
              >生</button>
              <button
                class="lang-learner-btn-status-mini"
                :class="{ active: item.status === 'LEARNING' }"
                @click.stop="updateWordStatusInList(item.word, 'LEARNING')"
              >学</button>
              <button
                class="lang-learner-btn-status-mini"
                :class="{ active: item.status === 'KNOWN' }"
                @click.stop="updateWordStatusInList(item.word, 'KNOWN')"
              >熟</button>
            </div>
          </div>
          <p v-if="analyzedWordsList.length === 0" class="lang-learner-empty-hint">未提取出英文词汇</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, inject, onMounted, onUnmounted } from 'vue';
import { Notice, MarkdownView } from 'obsidian';
import { eventBus } from '../../event/EventBus';
import type { VocabularyManager } from '../../db/vocabulary';
import type { WordStatus } from '../../types';
import { tokenize } from '../../tokenizer/tokenizer';
import { OFFLINE_DICT } from '../../data/static_data';

export default defineComponent({
  name: 'SentenceTab',
  emits: ['select-word'],
  setup(props, { emit }) {
    // 注入核心依赖
    const vocabManager = inject<VocabularyManager>('vocabManager')!;
    const plugin = inject<any>('plugin')!;
    const speak = inject<(text: string, settings?: any, voices?: any, onBoundary?: any, onEnd?: any) => Promise<void>>('speak')!;
    const getVoiceSettings = inject<() => any>('getVoiceSettings')!;
    const getAvailableVoices = inject<() => SpeechSynthesisVoice[]>('getAvailableVoices')!;

    const sentenceInput = ref('');
    const isAnalyzing = ref(false);
    const hasAnalyzed = ref(false);
    const isTranslating = ref(false);
    const sentenceTranslation = ref('');
    const analyzedSentenceTokens = ref<any[]>([]);
    const analyzedWordsList = ref<any[]>([]);
    const activeTokenIndex = ref<number | null>(null);

    // 执行分词分析
    async function analyzeInputSentence() {
      const text = sentenceInput.value.trim();
      if (!text) {
        new Notice('请输入待分析的句子');
        return;
      }

      isAnalyzing.value = true;
      hasAnalyzed.value = true;
      isTranslating.value = true;
      sentenceTranslation.value = '';

      try {
        const tokens = tokenize(text);
        
        // 构建短语包裹区间，防止嵌套高亮
        const phraseRanges: Array<{ start: number; end: number }> = [];
        for (const token of tokens) {
          if (token.isPhrase) {
            phraseRanges.push({ start: token.start, end: token.end });
          }
        }

        const isCoveredByPhrase = (token: any): boolean => {
          if (token.isPhrase) return false;
          for (const range of phraseRanges) {
            if (token.start >= range.start && token.end <= range.end) {
              return true;
            }
          }
          return false;
        };

        let lastIndex = 0;
        const segments: any[] = [];
        const uniqueWords = new Map<string, any>();

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

          const seg = {
            type: 'word',
            text: text.slice(token.start, token.end),
            lemma: token.lemma,
            isPhrase: token.isPhrase,
            status,
            trans,
            phonetic,
            start: token.start,
            end: token.end
          };
          segments.push(seg);

          const existing = uniqueWords.get(token.lemma);
          if (!existing || (!existing.isPhrase && token.isPhrase)) {
            uniqueWords.set(token.lemma, {
              word: token.lemma,
              status,
              trans,
              phonetic,
              isPhrase: !!token.isPhrase
            });
          }

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

        analyzedSentenceTokens.value = segments;
        analyzedWordsList.value = Array.from(uniqueWords.values());

        // 翻译
        const translation = await vocabManager.translateSentence(text);
        sentenceTranslation.value = translation;
      } catch (err) {
        console.error('分析句子过程中发生异常:', err);
        new Notice('分析句子过程中发生错误');
      } finally {
        isAnalyzing.value = false;
        isTranslating.value = false;
      }
    }

    // 导入选中文本
    function importSelection() {
      try {
        let selection = '';
        const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView && activeView.editor) {
          selection = activeView.editor.getSelection();
        }
        
        if (!selection || !selection.trim()) {
          plugin.app.workspace.iterateAllLeaves((leaf: any) => {
            if (leaf.view && leaf.view.editor) {
              const sel = leaf.view.editor.getSelection();
              if (sel && sel.trim()) {
                selection = sel.trim();
              }
            }
          });
        }

        if (selection && selection.trim()) {
          sentenceInput.value = selection.trim();
          analyzeInputSentence();
        } else {
          new Notice('当前活动文档中未检测到选中文本');
        }
      } catch (err) {
        console.error('获取选中文本失败:', err);
        new Notice('无法直接获取选中文本，请使用命令面板或手动粘贴');
      }
    }

    function onWordClick(word: string) {
      emit('select-word', word);
    }

    // 双击加入生词本并弹出释义
    async function onWordDblClick(token: any) {
      const currentStatus = vocabManager.get(token.lemma);
      const displayPhonetic = token.phonetic ? ` /${token.phonetic}/` : '';

      let trans = token.trans;
      let phonetic = token.phonetic;
      let etymology = token.etymology;

      if (trans) {
        new Notice(`📖 ${token.lemma}${displayPhonetic}\n释义: ${trans}`, 3500);
      } else {
        const loadingNotice = new Notice(`📖 ${token.lemma}${displayPhonetic}\n正在从在线词典查询释义...`, 5000);
        try {
          const result = await vocabManager.fetchOnlineTranslationAndDetails(token.lemma);
          loadingNotice.hide();
          if (result && result.trans) {
            new Notice(`📖 ${token.lemma}${result.phonetic ? ` /${result.phonetic}/` : ''}\n释义: ${result.trans}`, 4500);
            trans = result.trans;
            token.trans = result.trans;
            if (result.phonetic) {
              phonetic = result.phonetic;
              token.phonetic = result.phonetic;
            }
            if (result.etymology) {
              etymology = result.etymology;
              token.etymology = result.etymology;
            }
          } else {
            new Notice(`📖 ${token.lemma}${displayPhonetic}\n释义: 暂无释义`, 3500);
          }
        } catch (err) {
          loadingNotice.hide();
          new Notice(`📖 ${token.lemma}${displayPhonetic}\n释义: 暂无释义 (查询失败)`, 3500);
        }
      }

      if (currentStatus !== 'KNOWN') {
        const sentence = sentenceInput.value.trim();
        vocabManager.set(token.lemma, 'LEARNING', trans, phonetic, etymology);
        eventBus.emit('lang-learner:word-changed', token.lemma, 'LEARNING', sentence);
      } else {
        vocabManager.set(token.lemma, 'KNOWN', trans, phonetic, etymology);
      }

      emit('select-word', token.lemma);
    }

    // 在词汇清单里快捷修改熟悉度
    function updateWordStatusInList(word: string, newStatus: WordStatus) {
      const info = vocabManager.getInfo(word);
      const trans = info?.trans || OFFLINE_DICT[word]?.trans || '';
      const phonetic = info?.phonetic || OFFLINE_DICT[word]?.phonetic || '';
      const etymology = info?.etymology;
      vocabManager.set(word, newStatus, trans, phonetic, etymology);

      eventBus.emit('lang-learner:word-changed', word, newStatus);
    }

    // 播放整句，支持高亮定位
    function playSentence(text: string) {
      const settings = getVoiceSettings();
      const voices = getAvailableVoices();
      
      speak(
        text,
        settings,
        voices,
        (charIndex: number) => {
          // 查找 boundary 边界定位到哪个分词 token
          const tokenIndex = analyzedSentenceTokens.value.findIndex(token => {
            return charIndex >= token.start && charIndex < token.end;
          });
          if (tokenIndex !== -1) {
            activeTokenIndex.value = tokenIndex;
          }
        },
        () => {
          activeTokenIndex.value = null;
        }
      );
    }

    // 接收全局的 word-changed 并同步刷新 UI 上的状态显示
    function handleWordChanged(word: string, status: string) {
      analyzedSentenceTokens.value.forEach(token => {
        if (token.lemma === word) {
          token.status = status;
        }
      });
      analyzedWordsList.value.forEach(item => {
        if (item.word === word) {
          item.status = status;
        }
      });
    }

    onMounted(() => {
      eventBus.on('lang-learner:word-changed', handleWordChanged);
      // 监听来自全局的快捷命令整句分析唤醒
      eventBus.on('lang-learner:analyze-sentence', (sentence: string) => {
        sentenceInput.value = sentence;
        analyzeInputSentence();
      });
    });

    onUnmounted(() => {
      eventBus.off('lang-learner:word-changed', handleWordChanged);
      eventBus.off('lang-learner:analyze-sentence');
    });

    return {
      sentenceInput,
      isAnalyzing,
      hasAnalyzed,
      isTranslating,
      sentenceTranslation,
      analyzedSentenceTokens,
      analyzedWordsList,
      activeTokenIndex,
      analyzeInputSentence,
      importSelection,
      onWordClick,
      onWordDblClick,
      updateWordStatusInList,
      playSentence,
      speak
    };
  }
});
</script>

<style scoped>
.lang-learner-btn-voice-mini {
  background: transparent; 
  border: none; 
  cursor: pointer; 
  font-size: 0.9em; 
  padding: 2px 4px; 
  opacity: 0.8;
}
.lang-learner-btn-voice-sentence {
  background: transparent; 
  border: none; 
  cursor: pointer; 
  font-size: 1.1em; 
  padding: 2px 6px; 
  opacity: 0.85;
}
</style>
