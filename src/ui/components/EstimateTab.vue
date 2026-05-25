<template>
  <div class="lang-learner-tab-content">
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
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, inject } from 'vue';
import { eventBus } from '../../event/EventBus';
import type { VocabularyManager } from '../../db/vocabulary';
import { HIGH_FREQUENCY_WORDS } from '../../data/static_data';
import { getNextBinarySearchIndex, updateBinarySearch, type BinarySearchState } from '../../utils/algorithms';

export default defineComponent({
  name: 'EstimateTab',
  setup() {
    // 注入依赖
    const vocabManager = inject<VocabularyManager>('vocabManager')!;

    const estimationState = ref<'idle' | 'running' | 'done'>('idle');
    const currentQuestionIndex = ref(0);
    const totalQuestions = ref(20);
    const currentTestWord = ref('');
    const estimatedLevel = ref(0);
    const batchMarkedCount = ref(0);

    // 二分状态变量
    let bsState: BinarySearchState = {
      low: 0,
      high: HIGH_FREQUENCY_WORDS.length - 1,
      round: 0
    };

    const progressPercent = computed(() =>
      Math.round(((currentQuestionIndex.value + 1) / totalQuestions.value) * 100)
    );

    // 挑选下一个词
    function pickNextWord() {
      const mid = getNextBinarySearchIndex(bsState);
      currentTestWord.value = HIGH_FREQUENCY_WORDS[mid];
    }

    // 启动测试
    function startEstimation() {
      bsState = {
        low: 0,
        high: HIGH_FREQUENCY_WORDS.length - 1,
        round: 0
      };
      currentQuestionIndex.value = 0;
      estimationState.value = 'running';
      pickNextWord();
    }

    // 回答问题
    function answerEstimation(known: boolean) {
      bsState = updateBinarySearch(bsState, known);
      currentQuestionIndex.value = bsState.round;

      // 判断是否终止 (最大20题，或者搜索重合)
      if (bsState.round >= totalQuestions.value || bsState.low > bsState.high) {
        finishEstimation();
      } else {
        pickNextWord();
      }
    }

    // 结束测试并进行批量处理
    function finishEstimation() {
      const waterLevel = bsState.low;
      estimatedLevel.value = waterLevel;

      const wordsToMark = HIGH_FREQUENCY_WORDS.slice(0, waterLevel);
      // 只标记不是 LEARNING 状态的单词，防脏数据覆盖
      const safeWords = wordsToMark.filter(w => {
        const status = vocabManager.get(w);
        return status !== 'LEARNING';
      });

      vocabManager.batchSetKnown(safeWords);
      batchMarkedCount.value = safeWords.length;

      eventBus.emit('lang-learner:batch-known', safeWords.length);
      eventBus.emit('lang-learner:estimation-done', waterLevel);

      estimationState.value = 'done';
    }

    return {
      estimationState,
      currentQuestionIndex,
      totalQuestions,
      currentTestWord,
      estimatedLevel,
      batchMarkedCount,
      progressPercent,
      startEstimation,
      answerEstimation
    };
  }
});
</script>

<style scoped>
/* 内联样式均由通用 class 处理 */
</style>
