<template>
  <div class="lang-learner-pronunciation-tab">
    <!-- 录音控制区 -->
    <div class="lang-learner-panel-section">
      <h4 class="lang-learner-section-title">🎤 录音控制</h4>

      <!-- 目标单词输入 -->
      <div class="lang-learner-word-input">
        <label>练习单词/句子:</label>
        <input
          v-model="currentWord"
          type="text"
          placeholder="输入要练习的单词或句子..."
          class="lang-learner-text-input"
          :disabled="isRecording"
        />
      </div>

      <div class="lang-learner-recording-controls">
        <button
          v-if="!isRecording"
          @click="startRecording"
          class="lang-learner-btn lang-learner-btn-primary"
          :disabled="isProcessing || !currentWord.trim()"
        >
          🔴 开始录音
        </button>
        <button
          v-else
          @click="stopRecording"
          class="lang-learner-btn lang-learner-btn-danger"
        >
          ⏹️ 停止录音
        </button>
        <span v-if="isRecording" class="lang-learner-recording-indicator">录音中...</span>
        <span v-if="isProcessing" class="lang-learner-processing-indicator">处理中...</span>
      </div>
      <div class="lang-learner-accent-selector">
        <label>发音标准:</label>
        <select v-model="evaluationAccent" class="lang-learner-select">
          <option value="US">🇺🇸 美式发音</option>
          <option value="UK">🇬🇧 英式发音</option>
        </select>
      </div>
    </div>

    <!-- 音素对齐结果区 -->
    <div v-if="pronunciationResult" class="lang-learner-panel-section">
      <h4 class="lang-learner-section-title">
        📊 音素对齐结果
      </h4>
      <div class="lang-learner-result-summary">
        <div class="lang-learner-result-item">
          <span class="lang-learner-result-label">目标文本:</span>
          <span class="lang-learner-result-value">{{ pronunciationResult.targetText }}</span>
        </div>
        <div class="lang-learner-result-item">
          <span class="lang-learner-result-label">总体评分:</span>
          <span class="lang-learner-result-value lang-learner-score">{{ pronunciationResult.overallScore }}/100</span>
        </div>
      </div>
      <div class="lang-learner-phoneme-list">
        <span
          v-for="(alignment, index) in pronunciationResult.alignments"
          :key="index"
          :class="{
            'lang-learner-phoneme': true,
            'lang-learner-phoneme-error': alignment.isError
          }"
          :title="`置信度: ${(alignment.confidence * 100).toFixed(1)}%`"
        >
          {{ alignment.phoneme }}
        </span>
      </div>
    </div>

    <!-- A/B 轨道播放器区 -->
    <div v-if="recordingBlob" class="lang-learner-panel-section">
      <h4 class="lang-learner-section-title">🔊 A/B 轨道对比</h4>
      <div class="lang-learner-ab-player">
        <button
          @click="playStandardAudio"
          class="lang-learner-btn"
          :class="{ 'lang-learner-btn-active': currentTrack === 'A' }"
        >
          🅰️ 标准音
        </button>
        <button
          @click="playUserAudio"
          class="lang-learner-btn"
          :class="{ 'lang-learner-btn-active': currentTrack === 'B' }"
        >
          🅱️ 我的录音
        </button>
      </div>
    </div>

    <!-- AI 诊断区 -->
    <div v-if="pronunciationResult" class="lang-learner-panel-section">
      <h4 class="lang-learner-section-title">🤖 AI 肌肉纠偏诊断</h4>
      <button
        v-if="!aiDiagnosis"
        @click="requestDiagnosis"
        class="lang-learner-btn lang-learner-btn-primary"
        :disabled="isProcessing"
      >
        💡 获取诊断建议
      </button>
      <div v-else class="lang-learner-ai-diagnosis" ref="diagnosisContainer">
        <!-- AI 诊断内容将通过 MarkdownRenderer 渲染到这里 -->
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, nextTick, onMounted, onUnmounted, inject } from 'vue';
import type { PronunciationResult } from '../../types';
import type { WhisperWorkerRequest, WhisperWorkerResponse } from '../../workers/types';
import { WorkerStatus } from '../../workers/types';
import { AudioCaptureService } from '../../services/AudioCaptureService';
import { requestPronunciationDiagnosis } from '../../services/aiService';
import { MarkdownRenderer, Notice } from 'obsidian';
import { eventBus } from '../../event/EventBus';

export default defineComponent({
  name: 'PronunciationTab',
  setup() {
    // 注入依赖
    const plugin = inject<any>('plugin');
    const audioService = inject<any>('audioService');
    const getAiSettings = inject<() => any>('getAiSettings');
    const getVoiceSettings = inject<() => any>('getVoiceSettings');
    const getAvailableVoices = inject<() => any>('getAvailableVoices');

    // 响应式状态
    const isRecording = ref(false);
    const recordingBlob = ref<Blob | null>(null);
    const pronunciationResult = ref<PronunciationResult | null>(null);
    const aiDiagnosis = ref<string | null>(null);
    const currentTrack = ref<'A' | 'B' | null>(null);
    const diagnosisContainer = ref<HTMLElement | null>(null);
    const currentWord = ref(''); // 目标单词（用户输入）

    // 安全获取发音标准，添加多层防护
    let initialAccent: 'US' | 'UK' = 'US';
    try {
      if (plugin && typeof plugin === 'object' && 'evaluationAccent' in plugin) {
        const accent = plugin.evaluationAccent;
        if (accent === 'US' || accent === 'UK') {
          initialAccent = accent;
        }
      }
    } catch (e) {
      console.warn('[PronunciationTab] 无法读取 evaluationAccent，使用默认值 US');
    }
    const evaluationAccent = ref<'US' | 'UK'>(initialAccent);
    const isProcessing = ref(false); // 处理中状态

    // 服务实例
    let audioCaptureService: AudioCaptureService | null = null;
    let whisperWorker: Worker | null = null;
    let workerReady = false;

    // 监听全局发音标准切换事件
    const handleAccentChange = (accent: 'US' | 'UK') => {
      evaluationAccent.value = accent;
      console.log('[PronunciationTab] 发音标准已切换为:', accent);
    };

    // 初始化 Whisper Worker
    onMounted(() => {
      // 监听全局发音标准切换
      eventBus.on('lang-learner:accent-changed', handleAccentChange);

      try {
        // 由于 Obsidian 环境限制，暂时禁用 Worker
        // Worker 需要在生产环境中通过其他方式加载
        console.warn('[PronunciationTab] Worker 功能暂时禁用（开发中）');
        workerReady = false;

        // TODO: 在生产环境中启用 Worker
        // whisperWorker = new Worker(
        //   new URL('../../workers/whisper-worker.ts', import.meta.url),
        //   { type: 'module' }
        // );

      } catch (error) {
        console.error('[PronunciationTab] Worker 创建失败:', error);
        new Notice('发音评测功能初始化失败');
      }

      // 初始化音频采集服务
      audioCaptureService = new AudioCaptureService();
    });

    // 清理资源
    onUnmounted(() => {
      eventBus.off('lang-learner:accent-changed', handleAccentChange);

      if (whisperWorker) {
        whisperWorker.terminate();
        whisperWorker = null;
      }
      if (audioCaptureService) {
        audioCaptureService.dispose();
        audioCaptureService = null;
      }
    });

    // 简化版 G2P：根据单词生成音素（启发式规则）
    function generateMockPhonemes(word: string): string[] {
      // 简单的字母到音素映射（仅用于 Mock 测试）
      const phonemeMap: Record<string, string[]> = {
        'hello': ['h', 'ɛ', 'l', 'oʊ'],
        'apple': ['æ', 'p', 'əl'],
        'world': ['w', 'ɜː', 'l', 'd'],
        'cat': ['k', 'æ', 't'],
        'dog': ['d', 'ɔ', 'g'],
        'book': ['b', 'ʊ', 'k'],
        'good': ['g', 'ʊ', 'd'],
        'water': ['w', 'ɔː', 't', 'ə'],
        'thank': ['θ', 'æ', 'ŋ', 'k'],
        'you': ['j', 'uː'],
        'yes': ['j', 'ɛ', 's'],
        'no': ['n', 'oʊ'],
        'please': ['p', 'l', 'iː', 'z'],
        'sorry': ['s', 'ɒ', 'r', 'i'],
        'excuse': ['ɪ', 'k', 's', 'k', 'j', 'uː', 'z'],
        'me': ['m', 'iː']
      };

      // 如果有预定义的音素，直接返回
      if (phonemeMap[word]) {
        return phonemeMap[word];
      }

      // 否则使用简单的字母分割（回退方案）
      return word.split('').map(char => {
        const vowels: Record<string, string> = {
          'a': 'æ', 'e': 'ɛ', 'i': 'ɪ', 'o': 'ɒ', 'u': 'ʌ'
        };
        return vowels[char] || char;
      });
    }

    // 真实录音逻辑
    const startRecording = async () => {
      if (!audioCaptureService) {
        new Notice('音频采集服务未初始化');
        return;
      }

      try {
        console.log('[PronunciationTab] 开始录音');
        isRecording.value = true;
        pronunciationResult.value = null;
        aiDiagnosis.value = null;
        recordingBlob.value = null;
        currentTrack.value = null;

        await audioCaptureService.startRecording();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        new Notice(`录音启动失败: ${errorMessage}`);
        isRecording.value = false;
        console.error('[PronunciationTab] 录音启动失败:', error);
      }
    };

    const stopRecording = async () => {
      if (!audioCaptureService) {
        new Notice('音频采集服务未初始化');
        return;
      }

      try {
        console.log('[PronunciationTab] 停止录音');
        isRecording.value = false;
        isProcessing.value = true;

        // 停止录音并获取 Blob
        const blob = await audioCaptureService.stopRecording();
        recordingBlob.value = blob;

        console.log('[PronunciationTab] 录音完成，Blob 大小:', blob.size);

        // 由于 Worker 暂时禁用，使用 Mock 数据进行测试
        console.log('[PronunciationTab] 使用 Mock 数据生成评测结果');

        // 模拟处理延迟
        await new Promise(resolve => setTimeout(resolve, 500));

        // 简化版 G2P：根据单词生成音素（启发式规则）
        const mockPhonemes = generateMockPhonemes(currentWord.value.toLowerCase());
        const mockAlignments = mockPhonemes.map((phoneme, index) => {
          const confidence = 0.6 + Math.random() * 0.3; // 0.6-0.9
          return {
            phoneme: `/${phoneme}/`,
            confidence: parseFloat(confidence.toFixed(3)),
            isError: confidence < 0.7,
            startTime: (index / mockPhonemes.length) * 2.0,
            endTime: ((index + 1) / mockPhonemes.length) * 2.0
          };
        });

        const avgConfidence = mockAlignments.reduce((sum, a) => sum + a.confidence, 0) / mockAlignments.length;
        const overallScore = Math.round(avgConfidence * 100);

        pronunciationResult.value = {
          alignments: mockAlignments,
          overallScore,
          targetText: currentWord.value,
          detectedText: currentWord.value.toLowerCase()
        };

        isProcessing.value = false;
        console.log('[PronunciationTab] Mock 评测结果:', pronunciationResult.value);

        new Notice(`录音完成！评分: ${overallScore}/100`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        new Notice(`录音处理失败: ${errorMessage}`);
        isProcessing.value = false;
        console.error('[PronunciationTab] 录音处理失败:', error);
      }
    };

    const playStandardAudio = async () => {
      console.log('[PronunciationTab] 播放标准音');
      currentTrack.value = 'A';

      // 使用注入的 audioService 和 voice settings
      if (audioService && typeof audioService.speak === 'function') {
        try {
          const voiceSettings = getVoiceSettings ? getVoiceSettings() : { engine: 'online', onlineAccent: 2, voiceName: '', rate: 0.9, pitch: 1.0 };
          const availableVoices = getAvailableVoices ? getAvailableVoices() : [];

          await audioService.speak(currentWord.value, voiceSettings, availableVoices);
        } catch (error) {
          console.error('[PronunciationTab] 播放标准音失败:', error);
          new Notice('播放失败');
        }
      } else {
        new Notice('音频服务未初始化');
        console.warn('[PronunciationTab] audioService 未找到');
      }
    };

    const playUserAudio = () => {
      console.log('[PronunciationTab] 播放用户录音');
      currentTrack.value = 'B';

      // 播放用户录音 Blob
      if (recordingBlob.value) {
        const blobUrl = URL.createObjectURL(recordingBlob.value);
        const audio = new Audio(blobUrl);
        audio.play();

        // 播放结束后释放 Blob URL
        audio.onended = () => {
          URL.revokeObjectURL(blobUrl);
        };
      }
    };

    const requestDiagnosis = async () => {
      if (!pronunciationResult.value) return;

      try {
        console.log('[PronunciationTab] 请求 AI 诊断');
        isProcessing.value = true;

        // 提取错误音素
        const errorPhonemes = pronunciationResult.value.alignments.filter(a => a.isError);

        // 获取 AI 服务配置（使用注入的 getAiSettings）
        let settings = {
          apiKey: '',
          baseUrl: 'https://api.deepseek.com/v1',
          model: 'deepseek-chat'
        };

        if (getAiSettings && typeof getAiSettings === 'function') {
          const aiSettings = getAiSettings();
          if (aiSettings) {
            settings = {
              apiKey: aiSettings.apiKey || '',
              baseUrl: aiSettings.baseUrl || 'https://api.deepseek.com/v1',
              model: aiSettings.model || 'deepseek-chat'
            };
          }
        }

        // 调用 aiService 请求诊断
        const diagnosisMarkdown = await requestPronunciationDiagnosis(
          {
            targetText: currentWord.value,
            errorPhonemes,
            overallScore: pronunciationResult.value.overallScore,
            accent: evaluationAccent.value
          },
          settings
        );

        aiDiagnosis.value = diagnosisMarkdown;
        isProcessing.value = false;

        // 等待 DOM 更新后渲染 Markdown
        await nextTick();

        if (diagnosisContainer.value) {
          diagnosisContainer.value.innerHTML = '';
          await MarkdownRenderer.renderMarkdown(
            diagnosisMarkdown,
            diagnosisContainer.value,
            '',
            plugin
          );
        }

        console.log('[PronunciationTab] AI 诊断完成');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        new Notice(`AI 诊断失败: ${errorMessage}`);
        isProcessing.value = false;
        console.error('[PronunciationTab] AI 诊断失败:', error);
      }
    };

    return {
      isRecording,
      recordingBlob,
      pronunciationResult,
      aiDiagnosis,
      currentTrack,
      diagnosisContainer,
      currentWord,
      evaluationAccent,
      isProcessing,
      startRecording,
      stopRecording,
      playStandardAudio,
      playUserAudio,
      requestDiagnosis
    };
  }
});
</script>

<style scoped>
.lang-learner-pronunciation-tab {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.lang-learner-word-input {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 14px;
}

.lang-learner-text-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  background: var(--background-primary);
  color: var(--text-normal);
  font-size: 14px;
}

.lang-learner-text-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.lang-learner-recording-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.lang-learner-recording-indicator {
  color: var(--text-error);
  font-weight: 600;
  animation: pulse 1.5s ease-in-out infinite;
}

.lang-learner-processing-indicator {
  color: var(--text-accent);
  font-weight: 600;
  animation: pulse 1.5s ease-in-out infinite;
}

.lang-learner-accent-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.lang-learner-select {
  padding: 4px 8px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  background: var(--background-primary);
  color: var(--text-normal);
  cursor: pointer;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.lang-learner-result-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--background-secondary);
  border-radius: 6px;
  margin-bottom: 12px;
}

.lang-learner-result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.lang-learner-result-label {
  font-weight: 600;
  color: var(--text-muted);
  font-size: 13px;
}

.lang-learner-result-value {
  color: var(--text-normal);
  font-size: 14px;
}

.lang-learner-score {
  font-weight: 700;
  font-size: 16px;
  color: var(--text-accent);
}

.lang-learner-phoneme-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px;
  background: var(--background-secondary);
  border-radius: 6px;
}

.lang-learner-phoneme {
  padding: 4px 8px;
  background: var(--interactive-normal);
  border-radius: 4px;
  font-family: monospace;
  font-size: 14px;
  cursor: help;
}

.lang-learner-phoneme-error {
  background: var(--text-error);
  color: var(--text-on-accent);
  font-weight: 600;
}

.lang-learner-ab-player {
  display: flex;
  gap: 12px;
}

.lang-learner-btn-active {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
}

.lang-learner-ai-diagnosis {
  padding: 12px;
  background: var(--background-secondary);
  border-radius: 6px;
  max-height: 400px;
  overflow-y: auto;
}
</style>
