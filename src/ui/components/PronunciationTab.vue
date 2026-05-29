<template>
  <div class="lang-learner-pronunciation-tab">
    <!-- 1. 模型下载引导面板 (如果本地未检测到模型) -->
    <div v-if="!modelsExist" class="lang-learner-panel-section lang-learner-download-card">
      <h4 class="lang-learner-section-title">📦 下载离线发音识别模型</h4>
      <p class="lang-learner-download-desc">
        开启端侧发音评测需要加载 <strong>Whisper-Tiny-EN</strong> 离线语音模型（包含 Encoder 和 Decoder 两个量化模型，共约 38MB）。模型文件会被存放在您的本地 Vault 插件目录下，后续可完全离线运行，零费用、高隐私。
      </p>
      
      <button
        @click="downloadModels"
        class="lang-learner-btn lang-learner-btn-primary lang-learner-btn-large"
        :disabled="downloading"
      >
        {{ downloading ? '正在努力下载中...' : '📥 立即下载离线模型' }}
      </button>

      <!-- 下载进度条 -->
      <div v-if="downloading" class="lang-learner-download-progress-container">
        <div class="lang-learner-download-progress-bar">
          <div class="lang-learner-download-progress-fill" :style="{ width: downloadPercent + '%' }"></div>
        </div>
        <div class="lang-learner-download-progress-text">
          <span>正在下载: {{ downloadFilename }}</span>
          <span>{{ downloadPercent }}% ({{ downloadSpeed }})</span>
        </div>
      </div>
    </div>

    <!-- 2. 发音控制区 (模型就绪后显示) -->
    <div v-else class="lang-learner-panel-section">
      <h4 class="lang-learner-section-title">🎤 录音控制</h4>

      <!-- 目标单词输入 -->
      <div class="lang-learner-word-input">
        <label>练习单词/句子:</label>
        <input
          v-model="currentWord"
          type="text"
          placeholder="输入要练习的单词或句子..."
          class="lang-learner-text-input"
          :disabled="isRecording || isProcessing"
        />
      </div>

      <!-- 实时波形 Canvas 绘图区 -->
      <div v-show="isRecording" class="lang-learner-waveform-container">
        <canvas ref="waveformCanvas" class="lang-learner-waveform-canvas"></canvas>
      </div>

      <div class="lang-learner-recording-controls">
        <button
          v-if="!isRecording"
          @click="startRecording"
          class="lang-learner-btn lang-learner-btn-primary"
          :disabled="isProcessing || !currentWord.trim() || !workerReady"
        >
          {{ workerReady ? '🔴 开始录音' : '⏳ 引擎初始化中...' }}
        </button>
        <button
          v-else
          @click="stopRecording"
          class="lang-learner-btn lang-learner-btn-danger"
        >
          ⏹️ 停止录音
        </button>
        <span v-if="isRecording" class="lang-learner-recording-indicator">录音中...</span>
        <span v-if="isProcessing" class="lang-learner-processing-indicator">特征提取与对齐中...</span>
      </div>
      
      <div class="lang-learner-accent-selector">
        <label>发音标准:</label>
        <select v-model="evaluationAccent" class="lang-learner-select" :disabled="isRecording || isProcessing">
          <option value="US">🇺🇸 美式发音</option>
          <option value="UK">🇬🇧 英式发音</option>
        </select>
      </div>

      <!-- 🧩 录音前音节速览卡（实时显示，无需等待评测结果） -->
      <div v-if="currentWord.trim() && previewSyllables.length > 0" class="lang-learner-syllable-preview-card">
        <div class="lang-learner-syllable-preview-title">🧩 音节速览</div>
        <div class="lang-learner-syllable-preview-words">
          <template v-for="(wInfo, wIdx) in previewSyllables" :key="wIdx">
            <span v-if="wInfo.isSpace" class="lang-learner-syllable-space"></span>
            <div v-else class="lang-learner-syllable-preview-word-box" :class="{ 'lang-learner-syllable-preview-english': wInfo.isEnglish }">
              <button
                v-if="wInfo.isEnglish && wInfo.syllables.length > 1"
                @click="speakWord(wInfo.clean)"
                class="lang-learner-syllable-word-speaker"
                title="播放单词"
              >🔊</button>
              <template v-for="(syllable, sIdx) in wInfo.syllables" :key="sIdx">
                <button
                  @click="wInfo.isEnglish ? speakSyllable(syllable) : null"
                  :class="wInfo.isEnglish ? 'lang-learner-syllable-btn' : 'lang-learner-syllable-static'"
                  :title="wInfo.isEnglish ? `点击播放 [ ${syllable} ]` : ''"
                >{{ syllable }}</button>
                <span v-if="sIdx < wInfo.syllables.length - 1" class="lang-learner-syllable-dot">·</span>
              </template>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- 音素对齐结果区 -->
    <div v-if="pronunciationResult" class="lang-learner-panel-section">
      <h4 class="lang-learner-section-title">
        📊 音素对齐结果
      </h4>
      <div class="lang-learner-result-summary">
        <!-- 评分圆环 + 文字信息 并排布局 -->
        <div class="lang-learner-score-layout">
          <!-- SVG 圆形评分环 -->
          <div class="lang-learner-score-ring-wrapper">
            <svg viewBox="0 0 80 80" class="lang-learner-score-ring-svg">
              <!-- 背景轨道圆 -->
              <circle cx="40" cy="40" r="30" fill="none" stroke="var(--background-modifier-border)" stroke-width="7"/>
              <!-- 进度圆弧 -->
              <circle
                cx="40" cy="40" r="30"
                fill="none"
                :stroke="scoreRingColor"
                stroke-width="7"
                stroke-linecap="round"
                :stroke-dasharray="188.5"
                :stroke-dashoffset="188.5 - (pronunciationResult.overallScore / 100) * 188.5"
                transform="rotate(-90 40 40)"
                class="lang-learner-score-ring-arc"
              />
              <!-- 中心分数 -->
              <text x="40" y="38" text-anchor="middle" class="lang-learner-score-ring-number">{{ pronunciationResult.overallScore }}</text>
              <text x="40" y="52" text-anchor="middle" class="lang-learner-score-ring-label">分</text>
            </svg>
            <!-- 星级显示 -->
            <div class="lang-learner-score-stars">
              <span v-for="s in 5" :key="s" :class="s <= scoreStars ? 'lang-learner-star-filled' : 'lang-learner-star-empty'">★</span>
            </div>
          </div>

          <!-- 文字详情 -->
          <div class="lang-learner-result-details">
            <div class="lang-learner-result-item">
              <span class="lang-learner-result-label">目标文本:</span>
              <span class="lang-learner-result-value">{{ pronunciationResult.targetText }}</span>
            </div>
            <div v-if="pronunciationResult.detectedText" class="lang-learner-result-item">
              <span class="lang-learner-result-label">识别文本:</span>
              <span class="lang-learner-result-value" style="font-style: italic; color: var(--text-muted);">
                {{ pronunciationResult.detectedText }}
              </span>
            </div>
            <div class="lang-learner-score-grade-badge" :style="{ background: scoreRingColor + '22', color: scoreRingColor, borderColor: scoreRingColor }">
              {{ scoreGradeLabel }}
            </div>
          </div>
        </div>
      </div>
      
      <!-- 音节拼读与连读助手 -->
      <div class="lang-learner-syllable-section">
        <div class="lang-learner-syllable-section-title">
          <span>🧩 音节拼读连读助手</span>
          <span class="lang-learner-syllable-help" title="点击每个音节进行分步发音练习，点击 🔊 播放整个单词标准音">❔ 使用提示</span>
        </div>
        <div class="lang-learner-syllable-words-container">
          <template v-for="(wInfo, wIdx) in wordSyllables" :key="wIdx">
            <!-- 空格渲染 -->
            <span v-if="wInfo.isSpace" class="lang-learner-syllable-space"></span>
            
            <!-- 单词/符号渲染 -->
            <div v-else class="lang-learner-syllable-word-box" :class="{ 'lang-learner-syllable-word-box-english': wInfo.isEnglish }">
              <!-- 单词整体播放按钮 -->
              <button
                v-if="wInfo.isEnglish && wInfo.syllables.length > 1"
                @click="speakWord(wInfo.clean)"
                class="lang-learner-syllable-word-speaker"
                title="播放单词标准音"
              >
                🔊
              </button>
              
              <!-- 音节列表 -->
              <div class="lang-learner-syllable-list">
                <template v-for="(syllable, sIdx) in wInfo.syllables" :key="sIdx">
                  <button
                    @click="wInfo.isEnglish ? speakSyllable(syllable) : null"
                    :class="{
                      'lang-learner-syllable-btn': wInfo.isEnglish,
                      'lang-learner-syllable-static': !wInfo.isEnglish
                    }"
                    :title="wInfo.isEnglish ? `点击播放音节 [ ${syllable} ] 读音` : ''"
                  >
                    {{ syllable }}
                  </button>
                  <span v-if="sIdx < wInfo.syllables.length - 1" class="lang-learner-syllable-dot">·</span>
                </template>
              </div>
            </div>
          </template>
        </div>
      </div>

      <div class="lang-learner-phoneme-list">
        <span
          v-for="(alignment, index) in pronunciationResult.alignments"
          :key="index"
          class="lang-learner-phoneme"
          :class="{ 'lang-learner-phoneme-active': selectedPhoneme === alignment.phoneme }"
          :style="getPhonemeStyle(alignment.confidence, alignment.isError)"
          :title="`置信度 ${(alignment.confidence * 100).toFixed(1)}% — 点击查看口腔图示`"
          @click="selectPhoneme(alignment.phoneme)"
        >
          {{ alignment.phoneme }}
          <span class="lang-learner-phoneme-conf" :style="{ opacity: alignment.isError ? 1 : 0.75 }">
            {{ (alignment.confidence * 100).toFixed(0) }}%
          </span>
        </span>
      </div>

      <!-- 3. 动态发音口腔剖面图示 (音素学习动画) -->
      <div v-if="selectedPhoneme && visualConfig" class="lang-learner-phoneme-visual-panel">
        <div class="lang-learner-visual-header">
          <span class="lang-learner-visual-title">📢 口型与发音部位解析: <span class="lang-learner-visual-phoneme-text">{{ selectedPhoneme }}</span></span>
          <button @click="selectedPhoneme = null" class="lang-learner-visual-close-btn" title="关闭">✕</button>
        </div>

        <div class="lang-learner-visual-body">
          <!-- 矢状剖面矢量 SVG 区域与操作按钮 -->
          <div class="lang-learner-visual-graphic-wrapper">
            <div class="lang-learner-sagittal-svg-container">
              <svg viewBox="0 0 200 200" class="lang-learner-sagittal-svg">
                <!-- 静态背景: 硬腭、软腭与后喉壁 -->
                <path
                  d="M 30,190 L 30,150 C 30,120 40,80 55,68 C 75,52 95,65 105,80"
                  class="lang-learner-svg-static-wall"
                  fill="none"
                  stroke-width="5"
                  stroke-linecap="round"
                />
                <!-- 上齿龈及静态上齿 -->
                <path
                  d="M 105,80 L 105,95 L 100,95 L 100,80 Z"
                  class="lang-learner-svg-upper-teeth"
                />
                
                <!-- 动态下门齿 (随 jawYOffset 偏移) -->
                <g :style="{ transform: `translateY(${activeJawYOffset}px)` }" class="lang-learner-svg-jaw-group">
                  <!-- 下齿 -->
                  <path
                    d="M 100,105 L 100,120 L 95,120 L 95,105 Z"
                    class="lang-learner-svg-lower-teeth"
                  />
                  <!-- 下颌内壁线 -->
                  <path
                    d="M 95,120 C 95,135 85,170 30,190"
                    class="lang-learner-svg-static-wall"
                    fill="none"
                    stroke-width="5"
                    stroke-linecap="round"
                  />
                </g>

                <!-- 动态气流指示线 -->
                <path
                  :d="activeAirflow"
                  class="lang-learner-svg-airflow"
                  fill="none"
                  stroke-width="3"
                  stroke-dasharray="6,6"
                  stroke-linecap="round"
                />

                <!-- 动态发音器官: 舌头 (Morphing Path) -->
                <path
                  :d="activeTonguePath"
                  class="lang-learner-svg-tongue"
                />

                <!-- 动态发音器官: 上嘴唇 (Morphing Path) -->
                <path
                  :d="activeLips.upper"
                  class="lang-learner-svg-lip-upper"
                />

                <!-- 动态发音器官: 下嘴唇 (Morphing Path) -->
                <path
                  :d="activeLips.lower"
                  :style="{ transform: `translateY(${activeJawYOffset * 0.5}px)` }"
                  class="lang-learner-svg-lip-lower"
                />

                <!-- 标注与指示线 (Labels) -->
                <!-- 1. 上腭 -->
                <text x="75" y="32" text-anchor="middle" class="lang-learner-svg-label">上腭</text>
                <line x1="75" y1="38" x2="75" y2="60" class="lang-learner-svg-label-line" />
                <circle cx="75" cy="60" r="2.5" class="lang-learner-svg-label-dot" />

                <!-- 2. 牙齿 -->
                <text x="175" y="75" text-anchor="middle" class="lang-learner-svg-label">牙齿</text>
                <line x1="160" y1="75" x2="103" y2="87" class="lang-learner-svg-label-line" />
                <circle cx="103" cy="87" r="2.5" class="lang-learner-svg-label-dot" />

                <!-- 3. 嘴唇 -->
                <text x="175" y="110" text-anchor="middle" class="lang-learner-svg-label">嘴唇</text>
                <line x1="160" y1="110" x2="120" y2="100" class="lang-learner-svg-label-line" />
                <circle cx="120" cy="100" r="2.5" class="lang-learner-svg-label-dot" />

                <!-- 4. 舌头 -->
                <text x="175" y="145" text-anchor="middle" class="lang-learner-svg-label">舌头</text>
                <line x1="160" y1="142" x2="80" y2="135" class="lang-learner-svg-label-line" />
                <circle cx="80" cy="135" r="2.5" class="lang-learner-svg-label-dot" />

                <!-- 5. 喉咙 -->
                <text x="12" y="150" text-anchor="middle" class="lang-learner-svg-label">喉咙</text>
                <line x1="22" y1="150" x2="32" y2="170" class="lang-learner-svg-label-line" />
                <circle cx="32" cy="170" r="2.5" class="lang-learner-svg-label-dot" />
              </svg>
            </div>
            <!-- 控制按钮 -->
            <div class="lang-learner-visual-action-buttons">
              <button @click="speakPhoneme(selectedPhoneme)" class="lang-learner-visual-action-btn" title="播放音标读音并触发口型动效">▶ 播放</button>
              <button @click="isZoomed = true" class="lang-learner-visual-action-btn" title="放大口腔剖面大图">🔍 放大</button>
            </div>
          </div>

          <!-- 文字指导 -->
          <div class="lang-learner-visual-details">
            <div class="lang-learner-visual-subtitle">
              {{ visualConfig.name }}
            </div>
            <div class="lang-learner-visual-desc">
              {{ visualConfig.description }}
            </div>
            <ul class="lang-learner-visual-tips">
              <li v-for="(tip, idx) in visualConfig.tips" :key="idx">
                {{ tip }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. 放大后的口腔图片 Modal 弹窗 -->
    <div v-if="isZoomed && selectedPhoneme && visualConfig" class="lang-learner-visual-zoom-overlay" @click.self="isZoomed = false">
      <div class="lang-learner-visual-zoom-modal">
        <div class="lang-learner-zoom-header">
          <span class="lang-learner-zoom-title">👄 发音剖面大图解析: <span class="lang-learner-zoom-phoneme-text">{{ selectedPhoneme }}</span></span>
          <button @click="isZoomed = false" class="lang-learner-zoom-close-btn" title="关闭">✕</button>
        </div>

        <div class="lang-learner-zoom-body">
          <!-- 放大版 SVG -->
          <div class="lang-learner-sagittal-svg-container-zoomed">
            <svg viewBox="0 0 200 200" class="lang-learner-sagittal-svg-zoomed">
              <!-- 静态背景: 硬腭、软腭与后喉壁 -->
              <path
                d="M 30,190 L 30,150 C 30,120 40,80 55,68 C 75,52 95,65 105,80"
                class="lang-learner-svg-static-wall"
                fill="none"
                stroke-width="5"
                stroke-linecap="round"
              />
              <!-- 上齿龈及静态上齿 -->
              <path
                d="M 105,80 L 105,95 L 100,95 L 100,80 Z"
                class="lang-learner-svg-upper-teeth"
              />
              
              <!-- 动态下门齿 (随 jawYOffset 偏移) -->
              <g :style="{ transform: `translateY(${activeJawYOffset}px)` }" class="lang-learner-svg-jaw-group">
                <!-- 下齿 -->
                <path
                  d="M 100,105 L 100,120 L 95,120 L 95,105 Z"
                  class="lang-learner-svg-lower-teeth"
                />
                <!-- 下颌内壁线 -->
                <path
                  d="M 95,120 C 95,135 85,170 30,190"
                  class="lang-learner-svg-static-wall"
                  fill="none"
                  stroke-width="5"
                  stroke-linecap="round"
                />
              </g>

              <!-- 动态气流指示线 -->
              <path
                :d="activeAirflow"
                class="lang-learner-svg-airflow"
                fill="none"
                stroke-width="3"
                stroke-dasharray="6,6"
                stroke-linecap="round"
              />

              <!-- 动态发音器官: 舌头 (Morphing Path) -->
              <path
                :d="activeTonguePath"
                class="lang-learner-svg-tongue"
              />

              <!-- 动态发音器官: 上嘴唇 (Morphing Path) -->
              <path
                :d="activeLips.upper"
                class="lang-learner-svg-lip-upper"
              />

              <!-- 动态发音器官: 下嘴唇 (Morphing Path) -->
              <path
                :d="activeLips.lower"
                :style="{ transform: `translateY(${activeJawYOffset * 0.5}px)` }"
                class="lang-learner-svg-lip-lower"
              />

              <!-- 标注与指示线 (Labels) -->
              <!-- 1. 上腭 -->
              <text x="75" y="32" text-anchor="middle" class="lang-learner-svg-label">上腭</text>
              <line x1="75" y1="38" x2="75" y2="60" class="lang-learner-svg-label-line" />
              <circle cx="75" cy="60" r="2.5" class="lang-learner-svg-label-dot" />

              <!-- 2. 牙齿 -->
              <text x="175" y="75" text-anchor="middle" class="lang-learner-svg-label">牙齿</text>
              <line x1="160" y1="75" x2="103" y2="87" class="lang-learner-svg-label-line" />
              <circle cx="103" cy="87" r="2.5" class="lang-learner-svg-label-dot" />

              <!-- 3. 嘴唇 -->
              <text x="175" y="110" text-anchor="middle" class="lang-learner-svg-label">嘴唇</text>
              <line x1="160" y1="110" x2="120" y2="100" class="lang-learner-svg-label-line" />
              <circle cx="120" cy="100" r="2.5" class="lang-learner-svg-label-dot" />

              <!-- 4. 舌头 -->
              <text x="175" y="145" text-anchor="middle" class="lang-learner-svg-label">舌头</text>
              <line x1="160" y1="142" x2="80" y2="135" class="lang-learner-svg-label-line" />
              <circle cx="80" cy="135" r="2.5" class="lang-learner-svg-label-dot" />

              <!-- 5. 喉咙 -->
              <text x="12" y="150" text-anchor="middle" class="lang-learner-svg-label">喉咙</text>
              <line x1="22" y1="150" x2="32" y2="170" class="lang-learner-svg-label-line" />
              <circle cx="32" cy="170" r="2.5" class="lang-learner-svg-label-dot" />
            </svg>
          </div>

          <!-- 侧边说明与发音播放按钮 -->
          <div class="lang-learner-zoom-details">
            <button @click="speakPhoneme(selectedPhoneme)" class="lang-learner-btn lang-learner-btn-primary lang-learner-zoom-play-btn">
              🔊 播放发音并演示动画
            </button>
            <div class="lang-learner-zoom-subtitle">{{ visualConfig.name }}</div>
            <div class="lang-learner-zoom-desc">{{ visualConfig.description }}</div>
            <ul class="lang-learner-zoom-tips">
              <li v-for="(tip, idx) in visualConfig.tips" :key="idx">{{ tip }}</li>
            </ul>
          </div>
        </div>
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
import { defineComponent, ref, nextTick, onMounted, onUnmounted, inject, computed } from 'vue';
import type { PronunciationResult } from '../../types';
import type { WhisperWorkerRequest, WhisperWorkerResponse } from '../../workers/types';
import { WorkerStatus } from '../../workers/types';
import { AudioCaptureService } from '../../services/AudioCaptureService';
import { ModelDownloadService } from '../../services/ModelDownloadService';
import { requestPronunciationDiagnosisStream } from '../../services/aiService';
import { MarkdownRenderer, Notice } from 'obsidian';
import { eventBus } from '../../event/EventBus';
import { getPhonemeVisualConfig, PHONEME_VISUAL_STATES } from '../../utils/phonemeVisuals';
import createHyphenator from 'hyphen';
import hyphenationPatternsEnUs from 'hyphen/patterns/en-us';

const hyphenator = createHyphenator(hyphenationPatternsEnUs);

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
    const isProcessing = ref(false);

    // 动态发音口腔剖面可视化状态
    const selectedPhoneme = ref<string | null>(null);
    const isZoomed = ref(false);
    
    // 动效状态控制：target (当前音位口型), neutral (放松位), closed (闭合位)
    const animState = ref<'target' | 'neutral' | 'closed'>('target');

    const visualConfig = computed(() => {
      return selectedPhoneme.value ? getPhonemeVisualConfig(selectedPhoneme.value) : null;
    });

    const selectPhoneme = (phoneme: string) => {
      selectedPhoneme.value = phoneme;
      animState.value = 'target'; // 重置为正常状态
    };

    // 动态计算舌头、嘴唇、下颌与气流路径，支持流畅的 Morphing 动效
    const activeTonguePath = computed(() => {
      if (animState.value === 'closed') {
        return PHONEME_VISUAL_STATES.bilabial.tongue;
      }
      if (animState.value === 'neutral') {
        return PHONEME_VISUAL_STATES.default.tongue;
      }
      return visualConfig.value ? visualConfig.value.tongue : PHONEME_VISUAL_STATES.default.tongue;
    });

    const activeLips = computed(() => {
      if (animState.value === 'closed') {
        return PHONEME_VISUAL_STATES.bilabial.lips;
      }
      if (animState.value === 'neutral') {
        return PHONEME_VISUAL_STATES.default.lips;
      }
      return visualConfig.value ? visualConfig.value.lips : PHONEME_VISUAL_STATES.default.lips;
    });

    const activeJawYOffset = computed(() => {
      if (animState.value === 'closed') {
        return 0;
      }
      if (animState.value === 'neutral') {
        return 3;
      }
      return visualConfig.value ? visualConfig.value.jawYOffset : 3;
    });

    const activeAirflow = computed(() => {
      if (animState.value === 'closed' || animState.value === 'neutral') {
        return 'M 0,0'; // 隐藏气流
      }
      return visualConfig.value ? visualConfig.value.airflow : 'M 0,0';
    });

    // 演示口腔开口发音动效流程
    const playPhonemeAnimation = async (): Promise<void> => {
      try {
        // Step 1: 迅速紧闭双唇/扁平放松
        animState.value = 'closed';
        await new Promise(resolve => setTimeout(resolve, 150));
        // Step 2: 张开发音并流动气流
        animState.value = 'target';
        await new Promise(resolve => setTimeout(resolve, 800));
        // Step 3: 放松回到自然中性位置
        animState.value = 'neutral';
        await new Promise(resolve => setTimeout(resolve, 300));
        // Step 4: 恢复默认目标显示
        animState.value = 'target';
      } catch (e) {
        animState.value = 'target';
      }
    };

    // 播放音素读音并模拟开口动效
    const speakPhoneme = async (phoneme: string) => {
      if (!phoneme) return;
      
      // 并发：触发嘴形动效
      playPhonemeAnimation();

      if (audioService && typeof audioService.speak === 'function') {
        try {
          const clean = phoneme.replace(/[\/\s]/g, '');
          const voiceSettings = getVoiceSettings ? getVoiceSettings() : { rate: 0.85 };
          const availableVoices = getAvailableVoices ? getAvailableVoices() : [];
          
          // 强力重置 TTS 合成队列，防止之前由于非标拼写（如 thuh）报错导致的通道死锁与后续播放静音
          if (typeof window !== 'undefined' && window.speechSynthesis) {
              window.speechSynthesis.cancel();
          }

          // 采用 100% 被系统 TTS 支持且极度精简的“首音素+单元音”标准单词，保证 100% 发声，且无尾部多余辅音干扰
          let speakText = clean;
          
          const phonemeSpeechMap: Record<string, string> = {
              // 辅音：单一辅音开头 + 极简元音 (无尾辅音，听觉最干净)
              'p': 'pea', 'b': 'bee', 't': 'tea', 'd': 'day', 'k': 'key', 'g': 'go',
              'f': 'fee', 'v': 'view', 'θ': 'thaw', 'ð': 'they', 's': 'see', 'z': 'zoo',
              'ʃ': 'she', 'ʒ': 'genre', 'h': 'hay', 'tʃ': 'chew', 'dʒ': 'jaw',
              'm': 'me', 'n': 'no', 'ŋ': 'sing', 'l': 'low', 'r': 'ray', 'w': 'way', 'j': 'you',
              // 元音：纯净拟声/感叹词/极简代词
              'æ': 'add', 'ɛ': 'eh', 'ɪ': 'it', 'ɒ': 'ah', 'ʌ': 'up', 'ə': 'a ',
              'iː': 'ee', 'uː': 'oo', 'ɔː': 'aw', 'ɑː': 'ah', 'ɜː': 'err',
              // 双元音
              'aɪ': 'I', 'eɪ': 'a', 'aʊ': 'ow', 'ɔɪ': 'oy', 'oʊ': 'oh',
              'ɪə': 'ear', 'eə': 'air', 'ʊə': 'sure'
          };

          if (phonemeSpeechMap[clean]) {
              speakText = phonemeSpeechMap[clean];
          }
          
          // 给予用户明确且专业的提示，告知其示范发音所借用的代表词
          new Notice(`🔊 正在播放 /${clean}/ 示范音 (代表词: "${speakText}")`, 2000);
          
          await audioService.speak(speakText, voiceSettings, availableVoices);
        } catch (e) {
          console.warn('[PronunciationTab] 音素语音发音播放失败:', e);
        }
      }
    };

    // 音节拼读连读助手逻辑 (评测结果后显示，含不同杨式)
    const wordSyllables = computed(() => {
      const text = currentWord.value || (pronunciationResult.value ? pronunciationResult.value.targetText : '');
      if (!text) return [];
      
      return text.split(/(\s+)/).map(part => {
        if (/^\s+$/.test(part)) {
          return {
            raw: part,
            clean: '',
            isSpace: true,
            isEnglish: false,
            syllables: []
          };
        }
        
        const clean = part.replace(/[^a-zA-Z]/g, '');
        const isEnglish = clean.length > 0;
        
        if (isEnglish && clean.length > 2) {
          try {
            const hyphenated = hyphenator(clean, { hyphenChar: '·' });
            const syllables = hyphenated.split('·');
            return {
              raw: part,
              clean,
              isSpace: false,
              isEnglish: true,
              syllables: syllables.length > 0 ? syllables : [clean]
            };
          } catch (e) {
            return {
              raw: part,
              clean,
              isSpace: false,
              isEnglish: true,
              syllables: [clean]
            };
          }
        } else {
          return {
            raw: part,
            clean,
            isSpace: false,
            isEnglish: false,
            syllables: [part]
          };
        }
      });
    });

    const speakSyllable = async (syllable: string) => {
      if (!syllable || !audioService || typeof audioService.speak !== 'function') return;
      try {
        const clean = syllable.replace(/[^a-zA-Z]/g, '').trim();
        if (!clean) return;
        const voiceSettings = getVoiceSettings ? getVoiceSettings() : { rate: 0.85 };
        const availableVoices = getAvailableVoices ? getAvailableVoices() : [];
        // 慢速朗读音节
        const slowSettings = { ...voiceSettings, rate: Math.max(0.6, voiceSettings.rate - 0.15) };
        await audioService.speak(clean, slowSettings, availableVoices);
      } catch (e) {
        console.warn('[PronunciationTab] 音节播放失败:', e);
      }
    };

    const speakWord = async (word: string) => {
      if (!word || !audioService || typeof audioService.speak !== 'function') return;
      try {
        const clean = word.replace(/[^a-zA-Z]/g, '').trim();
        if (!clean) return;
        const voiceSettings = getVoiceSettings ? getVoiceSettings() : { rate: 0.85 };
        const availableVoices = getAvailableVoices ? getAvailableVoices() : [];
        await audioService.speak(clean, voiceSettings, availableVoices);
      } catch (e) {
        console.warn('[PronunciationTab] 单词播放失败:', e);
      }
    };

    // 🧩 录音前实时预览音节（仅依赖 currentWord，无需评测结果）
    const previewSyllables = computed(() => {
      const text = currentWord.value.trim();
      if (!text) return [];
      return text.split(/(\s+)/).map(part => {
        if (/^\s+$/.test(part)) return { raw: part, clean: '', isSpace: true, isEnglish: false, syllables: [] };
        const clean = part.replace(/[^a-zA-Z]/g, '');
        const isEnglish = clean.length > 0;
        if (isEnglish && clean.length > 2) {
          try {
            const hyphenated = hyphenator(clean, { hyphenChar: '\u00b7' });
            const syllables = hyphenated.split('\u00b7');
            return { raw: part, clean, isSpace: false, isEnglish: true, syllables: syllables.length > 0 ? syllables : [clean] };
          } catch (e) {
            return { raw: part, clean, isSpace: false, isEnglish: true, syllables: [clean] };
          }
        }
        return { raw: part, clean, isSpace: false, isEnglish: false, syllables: [part] };
      });
    });

    // 🌟 评分环相关 computed
    const scoreRingColor = computed(() => {
      const score = pronunciationResult.value?.overallScore ?? 0;
      if (score >= 90) return '#22c55e';   // 绿色 - 优秀
      if (score >= 80) return '#3b82f6';   // 蓝色 - 良好
      if (score >= 60) return '#f59e0b';   // 橙黄 - 一般
      return '#ef4444';                    // 红色 - 需努力
    });

    const scoreStars = computed(() => {
      const score = pronunciationResult.value?.overallScore ?? 0;
      if (score >= 90) return 5;
      if (score >= 80) return 4;
      if (score >= 60) return 3;
      if (score >= 40) return 2;
      return 1;
    });

    const scoreGradeLabel = computed(() => {
      const score = pronunciationResult.value?.overallScore ?? 0;
      if (score >= 90) return '🌟 优秀 - 发音非常准确';
      if (score >= 80) return '👍 良好 - 继续保持练习';
      if (score >= 60) return '👆 一般 - 有进步空间';
      if (score >= 40) return '💪 加油 - 多加练习';
      return '❤️ 加油 - 再接再厠加油';
    });

    // 🌈 音素标签置信度渐变色函数
    const getPhonemeStyle = (confidence: number, isError: boolean) => {
      // 对于错误音素，根据置信度显示渐变红色调
      if (isError) {
        if (confidence < 0.4) {
          return { background: '#ef4444', color: '#ffffff', fontWeight: '700', borderColor: '#ef4444' };
        }
        return { background: '#f97316', color: '#ffffff', fontWeight: '700', borderColor: '#f97316' };
      }
      // 正确音素：按置信度显示绿/黄/橙调
      if (confidence >= 0.85) {
        return { background: 'rgba(34, 197, 94, 0.15)', color: '#16a34a', borderColor: 'rgba(34, 197, 94, 0.4)' };
      }
      if (confidence >= 0.65) {
        return { background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', borderColor: 'rgba(245, 158, 11, 0.35)' };
      }
      return { background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', borderColor: 'rgba(239, 68, 68, 0.3)' };
    };

    // 模型下载与状态
    const modelsExist = ref(false);
    const downloading = ref(false);
    const downloadFilename = ref('');
    const downloadPercent = ref(0);
    const downloadSpeed = ref('');

    // Web Audio 实时波形绘制
    const waveformCanvas = ref<HTMLCanvasElement | null>(null);
    let audioCtx: AudioContext | null = null;
    let analyserNode: AnalyserNode | null = null;
    let animationFrameId: number | null = null;

    // 安全获取发音标准
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

    // 服务与 Worker 实例
    let audioCaptureService: AudioCaptureService | null = null;
    let modelDownloadService: ModelDownloadService | null = null;
    let whisperWorker: Worker | null = null;
    const workerReady = ref(false);

    // 监听全局发音标准切换
    const handleAccentChange = (accent: 'US' | 'UK') => {
      evaluationAccent.value = accent;
    };

    // 初始化检查与 Worker 加载
    onMounted(async () => {
      eventBus.on('lang-learner:accent-changed', handleAccentChange);
      
      if (plugin) {
        modelDownloadService = new ModelDownloadService(plugin.app, plugin.manifest.id);
        audioCaptureService = new AudioCaptureService();
        
        // 检查本地模型是否存在
        modelsExist.value = await modelDownloadService.checkIfModelsExist();
        if (modelsExist.value) {
          await initWorker();
        }
      }
    });

    onUnmounted(() => {
      eventBus.off('lang-learner:accent-changed', handleAccentChange);
      cleanupAudioContext();
      if (whisperWorker) {
        whisperWorker.terminate();
        whisperWorker = null;
      }
      if (audioCaptureService) {
        audioCaptureService.dispose();
        audioCaptureService = null;
      }
    });

    /**
     * 初始化 Web Worker 并将模型数据转移
     */
    const initWorker = async () => {
      if (!plugin || !modelDownloadService) return;
      try {
        console.log('[PronunciationTab] 正在启动离线 Whisper Web Worker...');
        workerReady.value = false;
        
        const pluginPath = plugin.manifest.dir;
        
        // 读取编译后的 whisper-worker.js 文本内容，并包装为 Blob URL 载入以规避同源策略安全限制 (SecurityError)
        const workerCode = await plugin.app.vault.adapter.read(`${pluginPath}/whisper-worker.js`);
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        whisperWorker = new Worker(URL.createObjectURL(blob));

        // 绑定事件处理器
        whisperWorker.onmessage = (event: MessageEvent<WhisperWorkerResponse>) => {
          const response = event.data;
          if (response.type === 'status') {
            if (response.status === WorkerStatus.READY) {
              workerReady.value = true;
              console.log('[PronunciationTab] Whisper 离线评测引擎加载完成！');
              new Notice('发音评测离线模型加载成功！');
            }
          } else if (response.type === 'result') {
            pronunciationResult.value = response.result || null;
            isProcessing.value = false;
            if (response.result) {
              new Notice(`对齐评测完成！总体评分: ${response.result.overallScore}/100`);
              
              // 自动选择第一个错误音素进行可视化引导，若无错误则选择第一个音素
              const alignments = response.result.alignments;
              if (alignments && alignments.length > 0) {
                const firstError = alignments.find(a => a.isError);
                if (firstError) {
                  selectedPhoneme.value = firstError.phoneme;
                } else {
                  selectedPhoneme.value = alignments[0].phoneme;
                }
              }
            }
          } else if (response.type === 'error') {
            new Notice(`评测出错: ${response.error}`);
            isProcessing.value = false;
          }
        };

        // 读取 ONNX 模型二进制流
        const encoderBuffer = await modelDownloadService.loadModelBuffer('encoder_model_quantized.onnx');
        const decoderBuffer = await modelDownloadService.loadModelBuffer('decoder_model_merged_quantized.onnx');

        // 在主线程中读取 Wasm 二进制（主线程不受 blob/CORS 跨域协议限制）
        let wasmBinary: ArrayBuffer | null = null;
        try {
          wasmBinary = await plugin.app.vault.adapter.readBinary(`${pluginPath}/dist/ort-wasm-simd.wasm`);
          console.log('[PronunciationTab] 主线程读取 ort-wasm-simd.wasm 成功，大小:', wasmBinary.byteLength);
        } catch (e) {
          console.warn('[PronunciationTab] 无法预加载 ort-wasm-simd.wasm:', e);
        }

        // 解析 ONNX Wasm 加载的文件夹根路径，并剔除 Cache-Buster 缓存刷新尾缀
        let wasmPaths = plugin.app.vault.adapter.getResourcePath(`${pluginPath}/dist/`);
        if (wasmPaths.includes('?')) {
          wasmPaths = wasmPaths.split('?')[0];
        }
        // 确保以 '/' 结尾作为目录路径
        if (!wasmPaths.endsWith('/')) {
          wasmPaths += '/';
        }

        // 传递初始化指令给 Worker，转移 Buffer 权限
        const transferList = [encoderBuffer, decoderBuffer];
        if (wasmBinary) {
          transferList.push(wasmBinary);
        }

        whisperWorker.postMessage({
          type: 'init',
          encoderBuffer,
          decoderBuffer,
          wasmPaths,
          wasmBinary
        } as WhisperWorkerRequest, transferList);

      } catch (error) {
        console.error('[PronunciationTab] Worker 加载初始化失败:', error);
        new Notice('评测引擎实例化失败，请检查模型文件或控制台。');
      }
    };

    /**
     * 下载离线模型
     */
    const downloadModels = async () => {
      if (!modelDownloadService) return;
      try {
        downloading.value = true;
        downloadPercent.value = 0;
        downloadSpeed.value = '连接中...';

        const encoderUrl = 'https://huggingface.co/Xenova/whisper-tiny.en/resolve/main/onnx/encoder_model_quantized.onnx';
        const decoderUrl = 'https://huggingface.co/Xenova/whisper-tiny.en/resolve/main/onnx/decoder_model_merged_quantized.onnx';

        // 1. 下载 Encoder
        await modelDownloadService.downloadModel('encoder_model_quantized.onnx', encoderUrl, (p) => {
          downloadFilename.value = 'Encoder 模型 (16MB)';
          downloadPercent.value = p.percent;
          downloadSpeed.value = p.speed;
        });

        // 2. 下载 Decoder
        await modelDownloadService.downloadModel('decoder_model_merged_quantized.onnx', decoderUrl, (p) => {
          downloadFilename.value = 'Decoder 模型 (22MB)';
          downloadPercent.value = p.percent;
          downloadSpeed.value = p.speed;
        });

        new Notice('Whisper 模型下载并校验成功！');
        modelsExist.value = true;
        await initWorker();

      } catch (error: any) {
        new Notice(`模型下载异常: ${error.message || String(error)}`);
        console.error(error);
      } finally {
        downloading.value = false;
      }
    };

    /**
     * 设置麦克风波形绘制
     */
    const setupWaveform = (stream: MediaStream) => {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioCtx = new AudioContextClass();
        const source = audioCtx.createMediaStreamSource(stream);
        analyserNode = audioCtx.createAnalyser();
        analyserNode.fftSize = 256;
        source.connect(analyserNode);

        nextTick(() => {
          drawWaveform();
        });
      } catch (e) {
        console.error('[PronunciationTab] 初始化波形绘制失败:', e);
      }
    };

    /**
     * 绘制波形图
     */
    const drawWaveform = () => {
      if (!waveformCanvas.value || !analyserNode) return;

      const canvas = waveformCanvas.value;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const bufferLength = analyserNode.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      // 设置 Canvas 分辨率自适应
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      // 获取 CSS 主题色以应用于 Canvas 渐变（防止直接传 var() 导致 Canvas addColorStop 报错）
      const style = window.getComputedStyle(canvas);
      const accentColor = style.getPropertyValue('--text-accent').trim() || '#3b82f6';

      const draw = () => {
        if (!isRecording.value || !analyserNode) return;
        animationFrameId = requestAnimationFrame(draw);

        analyserNode.getByteTimeDomainData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 渐变色彩设计，提升设计品质感
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        gradient.addColorStop(0, accentColor);
        gradient.addColorStop(0.5, '#ec4899'); // 粉色渐变过渡
        gradient.addColorStop(1, accentColor);

        ctx.lineWidth = 3;
        ctx.strokeStyle = gradient;
        ctx.lineCap = 'round';
        ctx.beginPath();

        const sliceWidth = canvas.width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * canvas.height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
      };

      draw();
    };

    const cleanupAudioContext = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      if (audioCtx) {
        audioCtx.close();
        audioCtx = null;
      }
      analyserNode = null;
    };

    /**
     * 开启麦克风录音
     */
    const startRecording = async () => {
      if (!audioCaptureService) {
        new Notice('音频服务尚未初始化');
        return;
      }
      try {
        isRecording.value = true;
        pronunciationResult.value = null;
        aiDiagnosis.value = null;
        recordingBlob.value = null;
        currentTrack.value = null;
        selectedPhoneme.value = null;

        await audioCaptureService.startRecording();
        
        const stream = audioCaptureService.getStream();
        if (stream) {
          setupWaveform(stream);
        }
      } catch (error: any) {
        isRecording.value = false;
        new Notice(error.message || String(error));
      }
    };

    /**
     * 停止录音并送审
     */
    const stopRecording = async () => {
      if (!audioCaptureService) return;
      try {
        isRecording.value = false;
        isProcessing.value = true;

        cleanupAudioContext();

        // 停止录音获取 Blob
        const blob = await audioCaptureService.stopRecording();
        recordingBlob.value = blob;

        // 转换并重采样为 16kHz Float32Array
        const audioBuffer = await audioCaptureService.blobToAudioBuffer(blob);
        const audioData = await audioCaptureService.resampleTo16kHz(audioBuffer);

        if (whisperWorker && workerReady.value) {
          // 向 Worker 送出特征提取和音素对齐请求
          whisperWorker.postMessage({
            type: 'align',
            audioData,
            targetText: currentWord.value
          } as WhisperWorkerRequest);
        } else {
          throw new Error('离线评测引擎未就绪，请等待。');
        }

      } catch (error: any) {
        isProcessing.value = false;
        new Notice(`录音结算失败: ${error.message || String(error)}`);
        console.error(error);
      }
    };

    const playStandardAudio = async () => {
      currentTrack.value = 'A';
      if (audioService && typeof audioService.speak === 'function') {
        try {
          const voiceSettings = getVoiceSettings ? getVoiceSettings() : { rate: 0.9 };
          const availableVoices = getAvailableVoices ? getAvailableVoices() : [];
          await audioService.speak(currentWord.value, voiceSettings, availableVoices);
        } catch (error) {
          new Notice('示范发音播放失败');
        }
      }
    };

    const playUserAudio = () => {
      currentTrack.value = 'B';
      if (recordingBlob.value) {
        const blobUrl = URL.createObjectURL(recordingBlob.value);
        const audio = new Audio(blobUrl);
        audio.play();
        audio.onended = () => {
          URL.revokeObjectURL(blobUrl);
        };
      }
    };

    /**
     * 获取 AI 肌肉纠偏诊断 (流式实时输出)
     */
    const requestDiagnosis = async () => {
      if (!pronunciationResult.value) return;

      try {
        isProcessing.value = true;
        aiDiagnosis.value = ''; // 清空

        const errorPhonemes = pronunciationResult.value.alignments.filter(a => a.isError);

        let settings = { apiKey: '', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' };
        if (getAiSettings) {
          const s = getAiSettings();
          if (s) {
            settings = {
              apiKey: s.apiKey || '',
              baseUrl: s.baseUrl || 'https://api.deepseek.com/v1',
              model: s.model || 'deepseek-chat'
            };
          }
        }

        // 调用流式接口，实现打字机般渐进式输出
        await requestPronunciationDiagnosisStream(
          {
            targetText: currentWord.value,
            errorPhonemes,
            overallScore: pronunciationResult.value.overallScore,
            accent: evaluationAccent.value
          },
          settings,
          async (chunk) => {
            if (!aiDiagnosis.value) aiDiagnosis.value = '';
            aiDiagnosis.value += chunk;

            // 实时渲染 Markdown 保证平滑展示
            await nextTick();
            if (diagnosisContainer.value) {
              diagnosisContainer.value.innerHTML = '';
              await MarkdownRenderer.renderMarkdown(
                aiDiagnosis.value,
                diagnosisContainer.value,
                '',
                plugin
              );
            }
          }
        );

        isProcessing.value = false;
        new Notice('发音诊断已完成！');

      } catch (error: any) {
        isProcessing.value = false;
        new Notice(error.message || String(error));
        console.error(error);
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
      modelsExist,
      downloading,
      downloadFilename,
      downloadPercent,
      downloadSpeed,
      waveformCanvas,
      workerReady,
      downloadModels,
      startRecording,
      stopRecording,
      playStandardAudio,
      playUserAudio,
      requestDiagnosis,
      selectedPhoneme,
      visualConfig,
      selectPhoneme,
      isZoomed,
      activeTonguePath,
      activeLips,
      activeJawYOffset,
      activeAirflow,
      speakPhoneme,
      playPhonemeAnimation,
      wordSyllables,
      speakSyllable,
      speakWord,
      previewSyllables,
      scoreRingColor,
      scoreStars,
      scoreGradeLabel,
      getPhonemeStyle
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

/* 下载离线模型引导卡片 */
.lang-learner-download-card {
  border: 1px solid var(--background-modifier-border);
  border-radius: 8px;
  background: var(--background-secondary);
  padding: 16px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.lang-learner-download-desc {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.6;
  margin: 12px 0 20px 0;
  text-align: left;
}

.lang-learner-btn-large {
  width: 100%;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
}

/* 下载进度条样式 */
.lang-learner-download-progress-container {
  margin-top: 16px;
  text-align: left;
}

.lang-learner-download-progress-bar {
  height: 6px;
  background: var(--background-modifier-border-focus);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}

.lang-learner-download-progress-fill {
  height: 100%;
  background: var(--text-accent);
  border-radius: 3px;
  transition: width 0.15s ease-out;
}

.lang-learner-download-progress-text {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-muted);
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

/* 录音波形图容器 */
.lang-learner-waveform-container {
  width: 100%;
  height: 48px;
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  margin-bottom: 12px;
  overflow: hidden;
}

.lang-learner-waveform-canvas {
  width: 100%;
  height: 100%;
  display: block;
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
