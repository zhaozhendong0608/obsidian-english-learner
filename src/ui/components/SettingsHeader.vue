<template>
  <div class="lang-learner-settings-row">
    <!-- 语音发音配置区 -->
    <div class="lang-learner-panel-section lang-learner-voice-settings-section">
      <div 
        class="lang-learner-voice-settings-header" 
        @click="showVoiceConfig = !showVoiceConfig"
      >
        <span class="lang-learner-settings-title-text">⚙️ 发音配置</span>
        <span class="lang-learner-settings-arrow-text">{{ showVoiceConfig ? '▼' : '▶' }}</span>
      </div>
      <div v-show="showVoiceConfig" class="lang-learner-voice-settings-body">
        <!-- 引擎选择 -->
        <div class="lang-learner-voice-setting-item">
          <label>发音引擎:</label>
          <select v-model="voiceSettings.engine" @change="onVoiceSettingsChange">
            <option value="online">🌐 在线发音</option>
            <option value="local">💻 系统发音</option>
          </select>
        </div>

        <!-- 在线真人参数展示 -->
        <div v-if="voiceSettings.engine === 'online'" class="lang-learner-voice-setting-item">
          <label>口音选择:</label>
          <select v-model="voiceSettings.onlineAccent" @change="onVoiceSettingsChange">
            <option :value="2">🇺🇸 美音</option>
            <option :value="1">🇬🇧 英音</option>
          </select>
        </div>

        <!-- 离线系统参数展示 -->
        <template v-else>
          <!-- 发音人选择 -->
          <div class="lang-learner-voice-setting-item">
            <label>系统音色选择:</label>
            <select v-model="voiceSettings.voiceName" @change="onVoiceSettingsChange">
              <option v-for="voice in (availableVoices || [])" :key="voice.name" :value="voice.name">
                {{ voice.name }}
              </option>
              <option v-if="!availableVoices || availableVoices.length === 0" value="">默认</option>
            </select>
          </div>
          <!-- 语速调节 -->
          <div class="lang-learner-voice-setting-item lang-learner-slider-row">
            <label>语速: {{ voiceSettings.rate.toFixed(1) }}x</label>
            <input 
              type="range" 
              v-model.number="voiceSettings.rate" 
              min="0.5" 
              max="1.8" 
              step="0.1" 
              @change="onVoiceSettingsChange"
            />
          </div>
          <!-- 音调调节 -->
          <div class="lang-learner-voice-setting-item lang-learner-slider-row">
            <label>音调: {{ voiceSettings.pitch.toFixed(1) }}</label>
            <input 
              type="range" 
              v-model.number="voiceSettings.pitch" 
              min="0.5" 
              max="1.5" 
              step="0.1" 
              @change="onVoiceSettingsChange"
            />
          </div>
        </template>
      </div>
    </div>

    <div class="lang-learner-settings-divider"></div>

    <!-- AI 教师配置区 -->
    <div class="lang-learner-panel-section lang-learner-ai-settings-section">
      <div 
        class="lang-learner-ai-settings-header" 
        @click="showAiConfig = !showAiConfig"
      >
        <span class="lang-learner-settings-title-text">🤖 AI 教师配置</span>
        <span class="lang-learner-settings-arrow-text">{{ showAiConfig ? '▼' : '▶' }}</span>
      </div>
      <div v-show="showAiConfig" class="lang-learner-ai-settings-body">
        <div class="lang-learner-ai-setting-item">
          <label>API Key:</label>
          <input 
            type="password" 
            v-model="aiSettings.apiKey" 
            @change="onAiSettingsChange"
            placeholder="sk-..."
          />
        </div>
        <div class="lang-learner-ai-setting-item">
          <label>Base URL:</label>
          <input 
            type="text" 
            v-model="aiSettings.baseUrl" 
            @change="onAiSettingsChange"
            placeholder="https://api.deepseek.com/v1"
          />
        </div>
        <div class="lang-learner-ai-setting-item">
          <label>Model:</label>
          <input 
            type="text" 
            v-model="aiSettings.model" 
            @change="onAiSettingsChange"
            placeholder="deepseek-chat"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, watch } from 'vue';
import type { VoiceSettings } from '../../services/AudioService';
import type { AISettings } from '../../services/aiService';

export default defineComponent({
  name: 'SettingsHeader',
  props: {
    availableVoices: {
      type: Array as () => SpeechSynthesisVoice[],
      required: true,
      default: () => []
    }
  },
  emits: ['voice-settings-changed', 'ai-settings-changed'],
  setup(props, { emit }) {
    const showVoiceConfig = ref(false);
    const showAiConfig = ref(false);

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

    // 加载配置
    function loadSettings() {
      try {
        const voiceStored = localStorage.getItem('lang-learner-voice-settings');
        if (voiceStored) {
          const parsed = JSON.parse(voiceStored);
          if (parsed) {
            Object.assign(voiceSettings.value, parsed);
          }
        }
      } catch (e) {
        console.error('载入发音配置失败:', e);
      }

      try {
        const aiStored = localStorage.getItem('lang-learner-ai-settings');
        if (aiStored) {
          const parsed = JSON.parse(aiStored);
          if (parsed) {
            Object.assign(aiSettings.value, parsed);
          }
        }
      } catch (e) {
        console.error('载入 AI 配置失败:', e);
      }
    }

    // 保存配置
    function onVoiceSettingsChange() {
      localStorage.setItem('lang-learner-voice-settings', JSON.stringify(voiceSettings.value));
      emit('voice-settings-changed', { ...voiceSettings.value });
    }

    function onAiSettingsChange() {
      localStorage.setItem('lang-learner-ai-settings', JSON.stringify(aiSettings.value));
      emit('ai-settings-changed', { ...aiSettings.value });
    }

    // 自动对齐默认 voiceName
    watch(() => props.availableVoices, (voices) => {
      if (!voiceSettings.value.voiceName && voices && voices.length > 0) {
        const matched = voices.find(v => v.name.toLowerCase().includes('siri') || v.name.toLowerCase().includes('samantha'));
        voiceSettings.value.voiceName = matched ? matched.name : voices[0].name;
        onVoiceSettingsChange();
      }
    }, { immediate: true });

    onMounted(() => {
      loadSettings();
      // 触发一次初始事件同步
      emit('voice-settings-changed', { ...voiceSettings.value });
      emit('ai-settings-changed', { ...aiSettings.value });
    });

    return {
      showVoiceConfig,
      showAiConfig,
      voiceSettings,
      aiSettings,
      onVoiceSettingsChange,
      onAiSettingsChange
    };
  }
});
</script>

<style scoped>
.lang-learner-settings-row {
  display: flex; 
  gap: 12px; 
  margin-bottom: 12px; 
  border-bottom: 1px solid var(--background-modifier-border); 
  padding-bottom: 8px; 
  align-items: flex-start;
}
.lang-learner-voice-settings-section, .lang-learner-ai-settings-section {
  flex: 1; 
  margin-bottom: 0; 
  padding-bottom: 0; 
  border-bottom: none;
}
.lang-learner-voice-settings-header, .lang-learner-ai-settings-header {
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  cursor: pointer; 
  padding: 4px 0;
}
.lang-learner-settings-title-text {
  font-weight: 500; 
  font-size: 0.85em; 
  color: var(--text-muted);
}
.lang-learner-settings-arrow-text {
  font-size: 0.75em; 
  color: var(--text-muted);
}
.lang-learner-voice-settings-body, .lang-learner-ai-settings-body {
  padding-top: 10px; 
  display: flex; 
  flex-direction: column; 
  gap: 8px; 
  max-height: 120px; 
  overflow-y: auto; 
  padding-right: 4px;
}
.lang-learner-voice-setting-item, .lang-learner-ai-setting-item {
  display: flex; 
  flex-direction: column; 
  gap: 4px;
}
.lang-learner-voice-setting-item label, .lang-learner-ai-setting-item label {
  font-size: 0.75em; 
  color: var(--text-muted);
}
.lang-learner-voice-setting-item select, .lang-learner-ai-setting-item input, .lang-learner-voice-setting-item input[type="text"] {
  width: 100%; 
  padding: 4px; 
  font-size: 0.85em; 
  border-radius: 4px; 
  border: 1px solid var(--background-modifier-border); 
  background-color: var(--background-primary); 
  color: var(--text-normal);
}
.lang-learner-slider-row {
  flex-direction: row !important;
  align-items: center; 
  justify-content: space-between;
}
.lang-learner-slider-row input {
  width: 60%; 
  cursor: pointer;
}
.lang-learner-settings-divider {
  align-self: stretch; 
  width: 1px; 
  background-color: var(--background-modifier-border); 
  margin: 4px 0;
}
</style>
