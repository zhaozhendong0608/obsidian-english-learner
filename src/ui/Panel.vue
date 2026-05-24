<template>
  <div class="lang-learner-panel">
    <!-- 全局自主查词输入框 -->
    <div class="lang-learner-search-bar" style="display: flex; gap: 6px; width: 100%;">
      <input
        v-model="searchQuery"
        @keyup.enter="performSearch"
        placeholder="输入单词/中文查询..."
        class="lang-learner-search-input"
        style="flex: 1; min-width: 0;"
      />
      <button @click="performSearch" class="lang-learner-btn lang-learner-btn-primary lang-learner-search-btn" style="flex-shrink: 0;">🔍 查询</button>
      <button 
        v-if="searchQuery.trim()"
        @click="lookupInSystemDict(searchQuery)" 
        class="lang-learner-btn" 
        style="flex-shrink: 0; padding: 4px 8px; font-size: 0.85em; display: inline-flex; align-items: center; justify-content: center;"
        title="在 macOS 系统词典中查询"
      >
        📖 系统
      </button>
    </div>

    <!-- 顶部双配置折叠栏 -->
    <div class="lang-learner-settings-row" style="display: flex; gap: 12px; margin-bottom: 12px; border-bottom: 1px solid var(--background-modifier-border); padding-bottom: 8px; align-items: flex-start;">
      <!-- 语音发音配置区 -->
      <div class="lang-learner-panel-section lang-learner-voice-settings-section" style="flex: 1; margin-bottom: 0; padding-bottom: 0; border-bottom: none;">
        <div 
          class="lang-learner-voice-settings-header" 
          @click="showVoiceConfig = !showVoiceConfig"
          style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; padding: 4px 0;"
        >
          <span style="font-weight: 500; font-size: 0.85em; color: var(--text-muted);">⚙️ 发音配置</span>
          <span style="font-size: 0.75em; color: var(--text-muted);">{{ showVoiceConfig ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showVoiceConfig" class="lang-learner-voice-settings-body" style="padding-top: 10px; display: flex; flex-direction: column; gap: 8px; max-height: 120px; overflow-y: auto; padding-right: 4px;">
          <!-- 引擎选择 -->
          <div class="lang-learner-voice-setting-item" style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 0.75em; color: var(--text-muted);">发音引擎:</label>
            <select 
              v-model="voiceSettings.engine" 
              @change="saveVoiceSettings"
              style="width: 100%; padding: 4px; font-size: 0.85em; border-radius: 4px; border: 1px solid var(--background-modifier-border); background-color: var(--background-primary); color: var(--text-normal);"
            >
              <option value="online">🌐 在线发音</option>
              <option value="local">💻 系统发音</option>
            </select>
          </div>

          <!-- 在线真人参数展示 -->
          <div v-if="voiceSettings.engine === 'online'" class="lang-learner-voice-setting-item" style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 0.75em; color: var(--text-muted);">口音选择:</label>
            <select 
              v-model="voiceSettings.onlineAccent" 
              @change="saveVoiceSettings"
              style="width: 100%; padding: 4px; font-size: 0.85em; border-radius: 4px; border: 1px solid var(--background-modifier-border); background-color: var(--background-primary); color: var(--text-normal);"
            >
              <option :value="2">🇺🇸 美音</option>
              <option :value="1">🇬🇧 英音</option>
            </select>
          </div>

          <!-- 离线系统参数展示 -->
          <template v-else>
            <!-- 发音人选择 -->
            <div class="lang-learner-voice-setting-item" style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 0.75em; color: var(--text-muted);">系统音色选择:</label>
              <select 
                v-model="voiceSettings.voiceName" 
                @change="saveVoiceSettings"
                style="width: 100%; padding: 4px; font-size: 0.85em; border-radius: 4px; border: 1px solid var(--background-modifier-border); background-color: var(--background-primary); color: var(--text-normal);"
              >
                <option v-for="voice in availableVoices" :key="voice.name" :value="voice.name">
                  {{ voice.name }}
                </option>
                <option v-if="availableVoices.length === 0" value="">默认</option>
              </select>
            </div>
            <!-- 语速调节 -->
            <div class="lang-learner-voice-setting-item" style="display: flex; align-items: center; justify-content: space-between;">
              <label style="font-size: 0.75em; color: var(--text-muted);">语速: {{ voiceSettings.rate.toFixed(1) }}x</label>
              <input 
                type="range" 
                v-model.number="voiceSettings.rate" 
                min="0.5" 
                max="1.8" 
                step="0.1" 
                @change="saveVoiceSettings"
                style="width: 60%; cursor: pointer;"
              />
            </div>
            <!-- 音调调节 -->
            <div class="lang-learner-voice-setting-item" style="display: flex; align-items: center; justify-content: space-between;">
              <label style="font-size: 0.75em; color: var(--text-muted);">音调: {{ voiceSettings.pitch.toFixed(1) }}</label>
              <input 
                type="range" 
                v-model.number="voiceSettings.pitch" 
                min="0.5" 
                max="1.5" 
                step="0.1" 
                @change="saveVoiceSettings"
                style="width: 60%; cursor: pointer;"
              />
            </div>
          </template>
        </div>
      </div>

      <div style="align-self: stretch; width: 1px; background-color: var(--background-modifier-border); margin: 4px 0;"></div>

      <!-- AI 教师配置区 -->
      <div class="lang-learner-panel-section lang-learner-ai-settings-section" style="flex: 1; margin-bottom: 0; padding-bottom: 0; border-bottom: none;">
        <div 
          class="lang-learner-ai-settings-header" 
          @click="showAiConfig = !showAiConfig"
          style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; padding: 4px 0;"
        >
          <span style="font-weight: 500; font-size: 0.85em; color: var(--text-muted);">🤖 AI 教师配置</span>
          <span style="font-size: 0.75em; color: var(--text-muted);">{{ showAiConfig ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showAiConfig" class="lang-learner-ai-settings-body" style="padding-top: 10px; display: flex; flex-direction: column; gap: 8px; max-height: 120px; overflow-y: auto; padding-right: 4px;">
          <div class="lang-learner-ai-setting-item" style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 0.75em; color: var(--text-muted);">API Key:</label>
            <input 
              type="password" 
              v-model="aiSettings.apiKey" 
              @change="saveAiSettings"
              placeholder="sk-..."
              style="width: 100%; padding: 4px; font-size: 0.85em; border-radius: 4px; border: 1px solid var(--background-modifier-border); background-color: var(--background-primary); color: var(--text-normal);"
            />
          </div>
          <div class="lang-learner-ai-setting-item" style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 0.75em; color: var(--text-muted);">Base URL:</label>
            <input 
              type="text" 
              v-model="aiSettings.baseUrl" 
              @change="saveAiSettings"
              placeholder="https://api.deepseek.com/v1"
              style="width: 100%; padding: 4px; font-size: 0.85em; border-radius: 4px; border: 1px solid var(--background-modifier-border); background-color: var(--background-primary); color: var(--text-normal);"
            />
          </div>
          <div class="lang-learner-ai-setting-item" style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 0.75em; color: var(--text-muted);">Model:</label>
            <input 
              type="text" 
              v-model="aiSettings.model" 
              @change="saveAiSettings"
              placeholder="deepseek-chat"
              style="width: 100%; padding: 4px; font-size: 0.85em; border-radius: 4px; border: 1px solid var(--background-modifier-border); background-color: var(--background-primary); color: var(--text-normal);"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 搜索结果单词列表 -->
    <div v-if="searchResultsList.length > 0 && !selectedWord" class="lang-learner-panel-section lang-learner-search-results" style="margin-bottom: 12px; border-bottom: 1px solid var(--background-modifier-border); padding-bottom: 12px;">
      <h4 class="lang-learner-section-title" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span>🔍 搜索结果 ({{ searchResultsList.length }} 个)</span>
        <button 
          @click="searchResultsList = []" 
          style="background: transparent; border: none; cursor: pointer; font-size: 1.1em; color: var(--text-muted);"
          title="关闭列表"
        >
          ✕
        </button>
      </h4>
      <div 
        class="lang-learner-search-results-list" 
        style="max-height: 250px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding: 2px;"
      >
        <div 
          v-for="word in searchResultsList" 
          :key="word" 
          class="lang-learner-search-result-item" 
          @click="selectResultWord(word)"
          style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-radius: 6px; background-color: var(--background-secondary); cursor: pointer; border: 1px solid var(--border-color); transition: all 0.2s ease;"
        >
          <span style="font-weight: 600; color: var(--text-accent);">{{ word }}</span>
          <span 
            style="font-size: 0.85em; color: var(--text-muted); text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60%;"
            :title="getWordTranslation(word)"
          >
            {{ getWordTranslation(word) }}
          </span>
        </div>
      </div>
    </div>

    <!-- 单词详情与熟悉度微调区 (全局共享，当有选中单词时浮现) -->
    <div v-if="selectedWord" class="lang-learner-panel-section lang-learner-word-detail">
      <h4 class="lang-learner-section-title" style="display: flex; justify-content: space-between; align-items: center;">
        <span style="display: flex; align-items: center; gap: 6px;">
          <button 
            v-if="searchResultsList.length > 0" 
            @click="backToSearchResults" 
            style="background: transparent; border: none; cursor: pointer; font-size: 1em; padding: 0 4px; display: inline-flex; align-items: center;"
            title="返回搜索列表"
          >
            ⬅️
          </button>
          <span>📝 单词详情</span>
        </span>
        <button
          class="lang-learner-btn-icon"
          title="复制卡片内容"
          @click="copyCardContent"
        >📋</button>
      </h4>
      <div class="lang-learner-word-info-card">
        <div class="lang-learner-word-detail-header" style="display: flex; justify-content: space-between; align-items: center;">
          <div class="lang-learner-word-detail-word-box" title="点击切换音节划分" @click="toggleSyllableSplit">
            <span class="lang-learner-word-lemma">{{ displayWord }}</span>
            <span v-if="selectedWord.phonetic" class="lang-learner-word-phonetic-inline">/{{ selectedWord.phonetic }}/</span>
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            <button 
              class="lang-learner-btn-voice-word" 
              title="朗读单词" 
              @click="speak(selectedWord.word)"
              style="background: transparent; border: none; cursor: pointer; font-size: 1.1em; padding: 2px 6px; opacity: 0.85;"
            >
              🔊
            </button>
            <button 
              class="lang-learner-btn-voice-word" 
              title="在系统词典中查看" 
              @click="lookupInSystemDict(selectedWord.word)"
              style="background: transparent; border: none; cursor: pointer; font-size: 1.1em; padding: 2px 6px; opacity: 0.85;"
            >
              📖
            </button>
            <button 
              class="lang-learner-btn-add-word" 
              :title="selectedWord.status === 'LEARNING' ? '已在生词本，点击移出' : '添加到生词本'" 
              @click="toggleAddWord(selectedWord.word)"
              style="background: transparent; border: none; cursor: pointer; font-size: 1.1em; padding: 2px 6px; opacity: 0.85;"
            >
              {{ selectedWord.status === 'LEARNING' ? '📌' : '➕' }}
            </button>
          </div>
        </div>
        <div class="lang-learner-word-trans">{{ selectedWord.trans || '暂无释义' }}</div>
        
        <!-- 词源与记忆法辅助 -->
        <div v-if="selectedWord.etymology" class="lang-learner-word-etymology-container" style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--background-modifier-border);">
          <div class="lang-learner-etymology-title" style="font-weight: 500; font-size: 0.85em; color: var(--text-accent); margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
            <span>💡 词源与记忆辅助</span>
          </div>
          <div class="lang-learner-etymology-content" style="font-size: 0.85em; color: var(--text-normal); line-height: 1.4; background-color: var(--background-secondary-alt); padding: 6px 8px; border-radius: 4px; border-left: 3px solid var(--text-accent); white-space: pre-wrap;">
            {{ selectedWord.etymology }}
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
        <div class="lang-learner-ai-teacher-container" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--background-modifier-border);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div class="lang-learner-examples-title">🤖 AI 教师深度解析</div>
            <button 
              @click="askAITeacher" 
              :disabled="isAiLoading"
              style="font-size: 0.8em; padding: 4px 8px; border-radius: 4px; background-color: var(--interactive-accent); color: var(--text-on-accent); border: none; cursor: pointer; opacity: 0.9;"
            >
              {{ isAiLoading ? '思考中...' : '询问 AI 教师' }}
            </button>
          </div>
          
          <div v-if="aiResponse" class="lang-learner-ai-response-box" style="margin-top: 8px;">
            <!-- 词汇结构展示 (如词根/词缀) -->
            <div v-if="aiResponse.root" style="margin-bottom: 8px; display: flex; gap: 8px; align-items: center; background-color: rgba(var(--interactive-accent-rgb, 99, 102, 241), 0.1); padding: 4px 8px; border-radius: 4px;">
              <span style="font-size: 0.8em; color: var(--text-muted);">词根枢纽:</span>
              <span style="font-size: 0.85em; font-weight: bold; color: var(--text-accent);">{{ aiResponse.root }} ({{ aiResponse.rootMeaning }})</span>
            </div>
            
            <!-- AI 生成的具体解析渲染 -->
            <div 
              ref="aiMarkdownEl"
              class="lang-learner-ai-markdown markdown-preview-view markdown-rendered" 
              style="font-size: 0.85em; color: var(--text-normal); line-height: 1.5; background-color: var(--background-secondary); padding: 8px; border-radius: 6px; max-height: 300px; overflow-y: auto;"
            >
            </div>
            
            <button 
              @click="exportAIResponse" 
              style="margin-top: 8px; width: 100%; padding: 6px; background-color: var(--background-secondary-alt); border: 1px solid var(--interactive-accent); color: var(--interactive-accent); border-radius: 4px; cursor: pointer; font-size: 0.85em;"
            >
              ✍️ 一键归纳并构建词根网络
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 顶部主导航 Tab -->
    <div class="lang-learner-main-tabs">
      <button
        class="lang-learner-main-tab-btn"
        :class="{ 'lang-learner-active': mainTab === 'vocabulary' }"
        @click="mainTab = 'vocabulary'"
      >
        📋 词汇本
      </button>
      <button
        class="lang-learner-main-tab-btn"
        :class="{ 'lang-learner-active': mainTab === 'estimate' }"
        @click="mainTab = 'estimate'"
      >
        🎯 词汇量测试
      </button>
      <button
        class="lang-learner-main-tab-btn"
        :class="{ 'lang-learner-active': mainTab === 'sentence' }"
        @click="mainTab = 'sentence'"
      >
        🔍 整句分析
      </button>
      <button
        class="lang-learner-main-tab-btn"
        :class="{ 'lang-learner-active': mainTab === 'review' }"
        @click="mainTab = 'review'"
      >
        📅 间隔复习
      </button>
      <button
        class="lang-learner-main-tab-btn"
        :class="{ 'lang-learner-active': mainTab === 'media' }"
        @click="mainTab = 'media'; scanMediaFiles();"
      >
        🎬 视频笔记
      </button>
      <button
        class="lang-learner-main-tab-btn"
        :class="{ 'lang-learner-active': mainTab === 'reader' }"
        @click="mainTab = 'reader'; loadRssFeeds();"
      >
        📰 RSS 阅读
      </button>
    </div>

    <!-- Tab 1: 词汇库 -->
    <div v-show="mainTab === 'vocabulary'" class="lang-learner-tab-content">
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
        <h4 class="lang-learner-section-title">📋 生词本</h4>
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
            @click="selectWord(item)"
          >
            <span class="lang-learner-wl-word">{{ item.word }}</span>
            <span class="lang-learner-wl-trans">{{ item.trans || '—' }}</span>
            <div class="lang-learner-wordlist-actions" style="display: flex; align-items: center; gap: 6px;">
              <button
                class="lang-learner-btn-voice-mini"
                title="发音"
                @click.stop="speak(item.word)"
                style="background: transparent; border: none; cursor: pointer; font-size: 0.9em; padding: 2px 4px; opacity: 0.8;"
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

    <!-- Tab 2: 词汇量测试 -->
    <div v-show="mainTab === 'estimate'" class="lang-learner-tab-content">
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

    <!-- Tab 3: 整句分析 -->
    <div v-show="mainTab === 'sentence'" class="lang-learner-tab-content">

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
              v-if="sentenceInput.trim()"
              class="lang-learner-btn-voice-sentence" 
              title="朗读整句" 
              @click="speak(sentenceInput)"
              style="background: transparent; border: none; cursor: pointer; font-size: 1.1em; padding: 2px 6px; opacity: 0.85;"
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
                @click="onSentenceWordClick(token.lemma)"
                @dblclick="onSentenceWordDblClick(token)"
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
              @click="onSentenceWordClick(item.word)"
            >
              <span class="lang-learner-wl-word" :class="{ 'lang-learner-wl-phrase': item.isPhrase }">
                {{ item.word }} <small v-if="item.isPhrase" style="opacity: 0.6; font-size: 0.7em;">(短语)</small>
              </span>
              <span class="lang-learner-wl-trans">{{ item.trans || '—' }}</span>
              <div class="lang-learner-sentence-word-status-btns" style="display: flex; align-items: center; gap: 4px;">
                <button
                  class="lang-learner-btn-voice-mini"
                  title="发音"
                  @click.stop="speak(item.word)"
                  style="background: transparent; border: none; cursor: pointer; font-size: 0.9em; padding: 2px 4px; opacity: 0.8;"
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

    <!-- Tab 4: 间隔复习 -->
    <div v-show="mainTab === 'review'" class="lang-learner-tab-content">
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
            <span class="lang-learner-big-word">{{ currentReviewWord.word }}</span>
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

        <!-- 答面详情 (点击“显示释义”后呈现) -->
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

    <!-- Tab 5: 视频戳笔记 -->
    <div v-show="mainTab === 'media'" class="lang-learner-tab-content" style="display: flex; flex-direction: column; gap: 12px;">
      <div class="lang-learner-panel-dashboard" style="margin-bottom: 0;">
        <h3 class="lang-learner-panel-title">🎬 视频戳笔记 (Media Extended)</h3>
        <p style="font-size: 0.82em; color: var(--text-muted); margin: -4px 0 0 0;">
          在侧边栏播放媒体文件，并可通过时间戳与 Obsidian 笔记实现双向跳转定位。
        </p>
      </div>

      <!-- 媒体文件选择与输入 (无框扁平布局) -->
      <div class="lang-learner-panel-section" style="padding: 10px; border-radius: 8px; border: 1px solid var(--background-modifier-border); background: var(--background-secondary); display: flex; flex-direction: column; gap: 8px;">
        <!-- 本地文件选择 -->
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 0.8em; font-weight: 600; color: var(--text-muted);">📁 载入库内媒体文件</label>
            <button 
              @click="scanMediaFiles" 
              class="lang-learner-btn-status-mini" 
              style="padding: 1px 4px; font-size: 0.7em;"
              title="重新扫描 Vault 媒体文件"
            >
              🔄 扫描
            </button>
          </div>
          <select 
            v-model="selectedMediaFile" 
            @change="handleSelectLocalMedia"
            style="width: 100%; padding: 5px 8px; border-radius: 6px; background: var(--background-modifier-form-field); border: 1px solid var(--background-modifier-border); color: var(--text-normal); font-size: 0.82em; cursor: pointer;"
          >
            <option value="">-- 请选择本地媒体 --</option>
            <option v-for="file in mediaFiles" :key="file.path" :value="file.path">
              {{ file.name }}
            </option>
          </select>
        </div>

        <!-- 外部 URL 输入 -->
        <div style="display: flex; flex-direction: column; gap: 4px; border-top: 1px dashed var(--background-modifier-border); padding-top: 8px;">
          <label style="font-size: 0.8em; font-weight: 600; color: var(--text-muted);">🌐 外部直链 / YouTube / B站链接</label>
          <div style="display: flex; gap: 6px;">
            <input 
              v-model="currentVideoUrl" 
              placeholder="输入视频网址或文件直链"
              style="flex: 1; padding: 5px 8px; border-radius: 6px; background: var(--background-modifier-form-field); border: 1px solid var(--background-modifier-border); color: var(--text-normal); font-size: 0.82em;"
            />
            <button 
              @click="loadMediaSource(currentVideoUrl)" 
              class="lang-learner-btn lang-learner-btn-primary" 
              style="padding: 5px 12px; font-size: 0.82em; font-weight: 600; border-radius: 6px;"
            >
              载入
            </button>
          </div>
        </div>
      </div>

      <!-- 视频播放与控制区域 -->
      <div v-if="mediaType !== 'none'" style="display: flex; flex-direction: column; gap: 10px;">
        <!-- 视频播放框 -->
        <div class="lang-learner-panel-section" style="text-align: center; background: #000; border-radius: 8px; padding: 2px; overflow: hidden; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);">
          <!-- HTML5 播放器 -->
          <video 
            v-if="mediaType === 'html5'"
            ref="mediaVideoRef" 
            :src="activeVideoSrc" 
            controls 
            @timeupdate="onVideoTimeUpdate"
            style="width: 100%; max-height: 280px; aspect-ratio: 16/9; display: block; border-radius: 6px;"
          ></video>

          <!-- YouTube 嵌入容器 -->
          <div v-else-if="mediaType === 'youtube'" id="youtube-player-container" style="width: 100%; height: 240px; display: block; border-radius: 6px; background: #000;">
            <div id="youtube-player-el"></div>
          </div>

          <!-- Bilibili 嵌入网页 -->
          <iframe 
            v-else-if="mediaType === 'bilibili'"
            :src="activeVideoSrc" 
            style="width: 100%; height: 240px; border: none; border-radius: 6px; display: block;" 
            allowfullscreen
          ></iframe>
        </div>

        <!-- 播放控制行 (整合紧凑的控制栏) -->
        <div class="lang-learner-panel-section" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--background-modifier-border); background: var(--background-secondary); display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.85em; font-weight: 600; color: var(--text-accent); display: flex; align-items: center; gap: 4px;">
              🕒 {{ formatTime(currentVideoTime) }}
            </span>
            <!-- 速度调节 -->
            <div v-if="mediaType === 'html5' || mediaType === 'youtube'" style="display: flex; gap: 3px; align-items: center;">
              <span style="font-size: 0.75em; color: var(--text-muted); margin-right: 2px;">倍速:</span>
              <button 
                v-for="rate in [0.8, 1.0, 1.25, 1.5]" 
                :key="rate" 
                @click="setPlaybackRate(rate)" 
                class="lang-learner-btn-status-mini"
                :class="{ active: mediaPlaybackRate === rate }"
                style="padding: 1px 4px; font-size: 0.7em; font-weight: 600;"
              >
                {{ rate }}x
              </button>
            </div>
          </div>

          <div v-if="mediaType === 'bilibili'" style="font-size: 0.72em; color: var(--text-warning); line-height: 1.3;">
            ⚠️ 提示：B站内嵌页由于跨域限制无法抓取时间进度或支持双向定位。
          </div>

          <button 
            v-if="mediaType === 'html5' || mediaType === 'youtube'"
            @click="insertVideoTimestamp" 
            class="lang-learner-btn lang-learner-btn-primary lang-learner-btn-full"
            style="font-size: 0.85em; padding: 7px; font-weight: 600; display: flex; justify-content: center; align-items: center; gap: 4px; border-radius: 6px;"
          >
            📌 插入当前视频时间戳至文档
          </button>
        </div>

        <!-- 💡 实时高亮字幕 (当前播放的大字精读看句，支持直接划词查词) -->
        <div 
          v-if="activeSubtitleIndex !== -1 && subtitlesList[activeSubtitleIndex]" 
          class="lang-learner-panel-section" 
          style="padding: 12px; border-radius: 8px; border: 1.5px solid var(--interactive-accent); background: var(--background-primary); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05); text-align: center;"
        >
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px dashed var(--background-modifier-border); padding-bottom: 6px;">
            <div style="display: flex; gap: 4px;">
              <button 
                @click="goToPrevSubtitle" 
                class="lang-learner-btn-status-mini" 
                style="padding: 2px 5px; font-size: 0.7em;"
                title="上一句"
              >
                ⏮️ 上一句
              </button>
              <button 
                @click="goToNextSubtitle" 
                class="lang-learner-btn-status-mini" 
                style="padding: 2px 5px; font-size: 0.7em;"
                title="下一句"
              >
                下一句 ⏭️
              </button>
            </div>
            <div style="font-size: 0.75em; color: var(--interactive-accent); font-weight: 700; letter-spacing: 0.5px;">📢 当前播放句</div>
            <div style="display: flex; gap: 4px;">
              <button 
                @click="toggleLoopCurrentSentence" 
                class="lang-learner-btn-status-mini"
                :class="{ active: isLoopingCurrentSentence }"
                style="padding: 2px 6px; font-size: 0.7em; font-weight: 600;"
                :title="isLoopingCurrentSentence ? '点击关闭单句循环' : '点击开启单句循环'"
              >
                🔂 {{ isLoopingCurrentSentence ? '循环中' : '单句循环' }}
              </button>
            </div>
          </div>
          <div 
            style="font-size: 1.08em; font-weight: 600; line-height: 1.5; color: var(--text-normal);"
          >
            <template v-for="(token, index) in subtitlesList[activeSubtitleIndex].segments" :key="index">
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
                @click.stop="onSentenceWordClick(token.lemma)"
                @dblclick.stop="onSentenceWordDblClick(token)"
                style="border-bottom: 1.5px dashed var(--text-accent); padding: 0 1px; margin: 0 1px; cursor: pointer;"
              >
                {{ token.text }}
              </span>
            </template>
          </div>
          <!-- 第二行译文 (独立一行，仅在译文模式开启时展示) -->
          <div 
            v-if="subtitlesList[activeSubtitleIndex].translation && showTranslation" 
            style="font-size: 0.88em; color: var(--text-muted); margin-top: 8px; font-weight: normal; border-top: 1px dashed var(--background-modifier-border); padding-top: 6px; text-align: center;"
          >
            {{ subtitlesList[activeSubtitleIndex].translation }}
          </div>
        </div>

        <!-- 💬 视频字幕卡片 (独立面板，脱离嵌套) -->
        <div class="lang-learner-panel-section" style="padding: 10px; border-radius: 8px; border: 1px solid var(--background-modifier-border); background: var(--background-secondary);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 0.82em; font-weight: 700; color: var(--text-muted); display: flex; align-items: center; gap: 4px;">
              💬 字幕列表 ({{ subtitlesList.length }} 句)
            </span>
            <div style="display: flex; gap: 4px;">
              <button 
                v-if="subtitlesList.length > 0"
                @click="showTranslation = !showTranslation" 
                class="lang-learner-btn-status-mini"
                :class="{ active: showTranslation }"
                style="padding: 2px 5px; font-size: 0.7em; font-weight: 600;"
                :title="showTranslation ? '点击显示原文，隐藏翻译' : '点击双语对照显示'"
              >
                👁️ {{ showTranslation ? '双语模式 (译文显示)' : '原文模式 (译文隐藏)' }}
              </button>
              <button 
                v-if="mediaType === 'youtube'" 
                @click="loadYouTubeCaptions" 
                class="lang-learner-btn-status-mini" 
                style="padding: 2px 5px; font-size: 0.7em;"
                :disabled="isLoadingSubtitles"
              >
                {{ isLoadingSubtitles ? '抓取中...' : '🌐 抓取字幕' }}
              </button>
              <label class="lang-learner-btn-status-mini" style="padding: 2px 5px; font-size: 0.7em; cursor: pointer; display: inline-block; margin: 0;">
                📁 导入
                <input type="file" accept=".srt,.vtt" @change="handleLocalSubtitleUpload" style="display: none;" />
              </label>
              <button 
                v-if="subtitlesList.length > 0"
                @click="exportSubtitlesToNote" 
                class="lang-learner-btn-status-mini active" 
                style="padding: 2px 5px; font-size: 0.7em;"
                title="导出完整字幕至正在编辑的文档区"
              >
                📤 导出
              </button>
            </div>
          </div>
          
          <!-- 字幕列表容器 -->
          <div 
            v-if="subtitlesList.length > 0" 
            class="lang-learner-subtitles-container" 
            style="max-height: 220px; overflow-y: auto; border: 1px solid var(--background-modifier-border); border-radius: 6px; padding: 6px; background: var(--background-primary); display: flex; flex-direction: column; gap: 6px;"
          >
            <div 
              v-for="(sub, idx) in subtitlesList" 
              :key="idx" 
              :id="'sub-line-' + idx"
              class="lang-learner-sub-line"
              :class="{ 'lang-learner-active-sub': activeSubtitleIndex === idx }"
              style="padding: 5px 8px; border-radius: 6px; line-height: 1.45; font-size: 0.88em; transition: all 0.15s ease; cursor: pointer; display: flex; flex-direction: column;"
              @click="seekToSubtitleTime(sub.start)"
            >
              <span style="font-size: 0.72em; color: var(--text-muted); font-family: monospace; display: block; margin-bottom: 2px;">
                {{ formatTime(sub.start) }}
              </span>
              <span class="lang-learner-sub-text" style="color: var(--text-normal); display: block;">
                <template v-for="(token, index) in sub.segments" :key="index">
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
                    @click.stop="onSentenceWordClick(token.lemma)"
                    @dblclick.stop="onSentenceWordDblClick(token)"
                  >
                    {{ token.text }}
                  </span>
                </template>
              </span>
              <!-- 第二行：译文 (只在译文开启时展示) -->
              <div 
                v-if="sub.translation && showTranslation" 
                class="lang-learner-sub-translation" 
                style="font-size: 0.8em; color: var(--text-muted); margin-top: 3px; font-weight: normal; display: block;"
              >
                {{ sub.translation }}
              </div>
            </div>
          </div>
          <div v-else style="font-size: 0.78em; color: var(--text-muted); text-align: center; padding: 16px; font-style: italic;">
            暂无字幕，请抓取在线字幕或导入本地 SRT/VTT 文件
          </div>
        </div>
      </div>

      <div v-else class="lang-learner-empty-hint" style="padding: 40px 0; text-align: center; background: var(--background-secondary); border-radius: 8px; border: 1px dashed var(--background-modifier-border); margin-top: 10px;">
        <div style="font-size: 2.5em; margin-bottom: 10px; filter: grayscale(0.2);">🎬</div>
        <p style="margin: 0 0 4px 0; font-weight: 600; font-size: 1em; color: var(--text-normal);">暂无载入媒体</p>
        <p style="font-size: 0.8em; color: var(--text-muted); margin: 0; padding: 0 16px; line-height: 1.4;">
          请在上方选择库内媒体，或输入 YouTube 等链接载入播放。载入后即可导入或自动抓取字幕。
        </p>
      </div>
    </div>

    <!-- Tab 6: RSS阅读器 -->
    <div v-show="mainTab === 'reader'" class="lang-learner-tab-content">
      <div class="lang-learner-panel-dashboard">
        <h3 class="lang-learner-panel-title">📰 RSS 订阅阅读</h3>
        <p style="font-size: 0.82em; color: var(--text-muted); margin: -4px 0 12px 0;">
          在此处订阅英语文章源，享受即读即划、纳米级查词与发音的阅读体验。
        </p>
      </div>

      <!-- RSS 订阅源管理器 -->
      <div class="lang-learner-panel-section" style="margin-bottom: 12px; padding: 12px; border-radius: 8px; border: 1px solid var(--background-modifier-border); background: var(--background-secondary);">
        <div 
          class="lang-learner-voice-settings-header" 
          @click="showRssConfig = !showRssConfig"
          style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; padding: 4px 0;"
        >
          <span style="font-weight: 600; font-size: 0.85em; color: var(--text-muted);">➕ 管理 RSS 订阅源</span>
          <span style="font-size: 0.75em; color: var(--text-muted);">{{ showRssConfig ? '▼ 收起' : '▶ 展开' }}</span>
        </div>
        
        <div v-show="showRssConfig" style="padding-top: 10px; display: flex; flex-direction: column; gap: 8px;">
          <!-- 添加新订阅源 -->
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <input 
              v-model="newFeedName" 
              placeholder="订阅源名称 (如: Hacker News)"
              style="width: 100%; padding: 6px 8px; border-radius: 4px; background: var(--background-modifier-form-field); border: 1px solid var(--background-modifier-border); color: var(--text-normal); font-size: 0.85em;"
            />
            <div style="display: flex; gap: 6px;">
              <input 
                v-model="newFeedUrl" 
                placeholder="订阅源 RSS URL"
                style="flex: 1; padding: 6px 8px; border-radius: 4px; background: var(--background-modifier-form-field); border: 1px solid var(--background-modifier-border); color: var(--text-normal); font-size: 0.85em;"
              />
              <button 
                @click="addRssFeed" 
                class="lang-learner-btn lang-learner-btn-primary" 
                style="padding: 6px 12px; font-size: 0.85em; font-weight: 500;"
              >
                添加
              </button>
            </div>
          </div>
          
          <!-- 已有订阅源列表 -->
          <div style="border-top: 1px dashed var(--background-modifier-border); padding-top: 8px; margin-top: 4px;">
            <label style="font-size: 0.75em; color: var(--text-muted); font-weight: 600; display: block; margin-bottom: 4px;">已订阅源列表:</label>
            <div style="display: flex; flex-direction: column; gap: 4px; max-height: 120px; overflow-y: auto;">
              <div 
                v-for="(feed, idx) in rssFeeds" 
                :key="idx"
                style="display: flex; justify-content: space-between; align-items: center; padding: 4px 6px; border-radius: 4px; background: var(--background-primary); border: 1px solid var(--background-modifier-border);"
              >
                <span style="font-size: 0.8em; color: var(--text-normal); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px;">{{ feed.name }}</span>
                <button 
                  @click="removeRssFeed(idx)" 
                  class="lang-learner-btn-icon" 
                  title="删除该源"
                  style="padding: 2px 4px; font-size: 0.8em; opacity: 0.7;"
                >
                  ❌
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 选择订阅源 -->
      <div class="lang-learner-panel-section" style="margin-bottom: 12px; display: flex; flex-direction: column; gap: 6px;">
        <label style="font-size: 0.85em; font-weight: 600; color: var(--text-muted);">📰 选择订阅源进行阅读</label>
        <select 
          v-model="selectedFeedUrl" 
          @change="handleSelectFeed"
          style="width: 100%; padding: 6px 8px; border-radius: 4px; background: var(--background-modifier-form-field); border: 1px solid var(--background-modifier-border); color: var(--text-normal); font-size: 0.85em; cursor: pointer;"
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
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid var(--background-modifier-border); padding-bottom: 8px;">
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
              style="text-decoration: none; font-size: 1.1em;"
            >
              🌐
            </a>
          </div>

          <h3 style="font-size: 1.2em; font-weight: bold; margin: 0 0 6px 0; line-height: 1.3; color: var(--text-normal);">
            {{ selectedArticle.title }}
          </h3>
          <p style="font-size: 0.75em; color: var(--text-muted); margin: 0 0 16px 0;">
            发布日期: {{ selectedArticle.date }}
          </p>

          <!-- 文章分词正文段落列表 -->
          <div class="lang-learner-rss-article-body" style="line-height: 1.6; font-size: 0.95em; color: var(--text-normal); display: flex; flex-direction: column; gap: 14px;">
            <p 
              v-for="(p, pIdx) in selectedArticleParagraphs" 
              :key="pIdx" 
              style="margin: 0; text-indent: 0; text-align: justify; white-space: pre-wrap;"
            >
              <template v-for="(token, index) in p.segments" :key="index">
                <!-- 纯文本 -->
                <span v-if="token.type === 'text'">{{ token.text }}</span>
                <!-- 划词高亮字/词组 -->
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
                  @click="onSentenceWordClick(token.lemma)"
                  @dblclick="onSentenceWordDblClick(token)"
                >
                  {{ token.text }}
                </span>
              </template>
            </p>
          </div>
        </div>

        <!-- 列表展示模式 -->
        <div v-else-if="feedItems.length > 0" class="lang-learner-rss-items-list" style="display: flex; flex-direction: column; gap: 8px;">
          <div 
            v-for="(item, idx) in feedItems" 
            :key="idx" 
            @click="readArticle(item)"
            class="lang-learner-wordlist-item"
            style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 10px; cursor: pointer; transition: background 0.2s;"
          >
            <span style="font-weight: 600; font-size: 0.95em; color: var(--text-normal); line-height: 1.3; text-align: left;">{{ item.title }}</span>
            <span style="font-size: 0.75em; color: var(--text-muted);">{{ item.date }}</span>
          </div>
        </div>

        <!-- 空状态提示 -->
        <div v-else class="lang-learner-empty-hint" style="padding: 40px 0; text-align: center; background: var(--background-secondary); border-radius: 8px; border: 1px dashed var(--background-modifier-border);">
          <div style="font-size: 2.5em; margin-bottom: 8px;">📰</div>
          <p style="margin: 0; font-size: 0.85em; color: var(--text-muted); padding: 0 16px;">
            未拉取到文章列表。请在上方选择或添加 RSS 订阅源并载入。
          </p>
        </div>
      </div>
    </div>

    <!-- 单词详情面板已移至 Tab 按钮下方 (全局最高优先级位置) -->
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, inject, onMounted, onUnmounted, watch } from 'vue';
import { Notice, MarkdownView, MarkdownRenderer } from 'obsidian';
// @ts-ignore
import createHyphenator from 'hyphen';
// @ts-ignore
import hyphenationPatternsEnUs from 'hyphen/patterns/en-us';
import { eventBus } from '../event/EventBus';
import { lemmatize } from '../tokenizer/lemmatizer';
import { HIGH_FREQUENCY_WORDS, OFFLINE_DICT } from '../data/static_data';
import { tokenize } from '../tokenizer/tokenizer';
import type { VocabularyManager } from '../db/vocabulary';
import type { WordInfo, WordStatus } from '../types';
import { fetchAITeacher, type AISettings } from '../services/aiService';
import { updateAIContextNote } from '../generator/contextNote';
import { ensureRootNoteLinked } from '../generator/rootNote';
const hyphenator = createHyphenator(hyphenationPatternsEnUs);

export default defineComponent({
  name: 'LangLearnerPanel',
  setup() {
    // 通过 provide/inject 获取核心依赖
    const vocabManager = inject<VocabularyManager>('vocabManager')!;
    const plugin = inject<any>('plugin')!;
    const app = plugin.app;

    // 使用 Set 加速高频词查询 (O(1))
    const highFreqSet = new Set<string>(HIGH_FREQUENCY_WORDS);

    // ========== 导航 Tab 控制 ==========
    const mainTab = ref<'vocabulary' | 'estimate' | 'sentence' | 'review' | 'media'>('vocabulary');

    // ========== 统计仪表盘 ==========
    const stats = ref({ total: 0, unknown: 0, learning: 0, known: 0 });

    /** 刷新统计数据 */
    function refreshStats() {
        console.log('refreshStats: vocabManager =', vocabManager);
        const count = vocabManager?.getCount?.();
        console.log('refreshStats: getCount() returned =', count);
        if (count) {
            stats.value = count;
        }
    }

    // ========== 生词本列表 ==========
    const activeTab = ref<'UNKNOWN' | 'LEARNING'>('UNKNOWN');
    const wordListCache = ref<WordInfo[]>([]);

    /** 刷新生词列表缓存 */
    function refreshWordList() {
        const entries = vocabManager.getAllEntries();
        const list: WordInfo[] = [];
        entries.forEach((info) => {
            if (info.status === 'UNKNOWN' || info.status === 'LEARNING') {
                list.push(info);
            }
        });
        // 按更新时间倒序排列（最新的在前面）
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

    // ========== 单词详情 ==========
    const selectedWord = ref<WordInfo | null>(null);
    const searchResultsList = ref<string[]>([]);
    const showSyllableSplit = ref(false);
    const exampleSentences = ref<string[]>([]);
    const isLoadingExamples = ref(false);
    let exampleRequestVersion = 0;

    const displayWord = computed(() => {
        if (!selectedWord.value) return '';
        if (showSyllableSplit.value) {
            const word = selectedWord.value.word;
            if (word.includes(' ')) {
                return word.split(' ').map(w => hyphenator(w, { hyphenChar: '·' })).join(' ');
            }
            return hyphenator(word, { hyphenChar: '·' });
        }
        return selectedWord.value.word;
    });

    function toggleSyllableSplit() {
        showSyllableSplit.value = !showSyllableSplit.value;
    }

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
            const obsidian = require('obsidian');
            let data: any = null;
            if (obsidian && obsidian.requestUrl) {
                const res = await obsidian.requestUrl({ url });
                data = typeof res.json === 'object' ? res.json : JSON.parse(res.text || '[]');
            } else {
                const res = await fetch(url);
                if (res.ok) {
                    data = await res.json();
                }
            }
            
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
            // 1. 优先从当前文档搜索例句
            let sentences = await searchCurrentDocSentences(cleanWord);
            
            // 2. 如果不够，从本地卡片中读取
            if (sentences.length < 3) {
                const cardSentences = await loadLocalCardSentences(cleanWord);
                sentences = [...sentences, ...cardSentences];
            }

            // 3. 去重并过滤空值
            sentences = Array.from(new Set(sentences.map(s => s.trim()))).filter(Boolean);

            // 4. 判断是否需要在线拉取音标（当前选中词且缺失音标）
            const needPhonetic = selectedWord.value && selectedWord.value.word === word && !selectedWord.value.phonetic;

            let onlineSentences: string[] = [];
            let fetchedPhonetic: string | undefined;

            if (sentences.length < 2 || needPhonetic) {
                const res = await fetchOnlineExamples(cleanWord);
                onlineSentences = res.examples;
                fetchedPhonetic = res.phonetic;
            }

            sentences = [...sentences, ...onlineSentences];

            // 5. 最终过滤和去重，最多展示 3 条
            const finalSentences = Array.from(new Set(sentences.map(s => s.trim())))
                .filter(s => s.toLowerCase().includes(cleanWord) || s.length > 5)
                .slice(0, 3);

            if (currentVersion === exampleRequestVersion) {
                exampleSentences.value = finalSentences;

                // 如果在线拉取到了音标且当前词仍然缺失音标，则同步更新与持久化保存
                if (fetchedPhonetic && selectedWord.value && selectedWord.value.word === word) {
                    const cleanPhonetic = fetchedPhonetic.replace(/^\/|\/$/g, '');
                    if (cleanPhonetic) {
                        selectedWord.value.phonetic = cleanPhonetic;
                        
                        // 同步写入本地数据库
                        const currentStatus = vocabManager.get(word);
                        const info = vocabManager.getInfo(word);
                        const trans = info?.trans || selectedWord.value.trans || '';
                        vocabManager.set(word, currentStatus, trans, cleanPhonetic);
                        
                        // 广播状态更新以同步至主窗口视图
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

    /** 选中一个单词以展示详情 */
    function selectWord(info: WordInfo) {
        selectedWord.value = { ...info };
        showSyllableSplit.value = false;
        aiResponse.value = null;
        loadExamples(info.word);
    }

    /** 修改单词熟悉度状态 */
    function changeWordStatus(word: string, newStatus: WordStatus) {
        const info = vocabManager.getInfo(word);
        const trans = info?.trans || OFFLINE_DICT[word]?.trans || '';
        const phonetic = info?.phonetic || OFFLINE_DICT[word]?.phonetic || '';
        const etymology = info?.etymology;
        vocabManager.set(word, newStatus, trans, phonetic, etymology);

        // 通过 EventBus 广播，驱动 DOM 增量刷新
        eventBus.emit('lang-learner:word-changed', word, newStatus);

        // 更新本地 UI 状态
        if (selectedWord.value && selectedWord.value.word === word) {
            selectedWord.value.status = newStatus;
        }
        refreshStats();
        refreshWordList();
    }

    /** 快速推进单词状态：UNKNOWN -> LEARNING，LEARNING -> KNOWN */
    function quickAdvance(info: WordInfo) {
        const nextStatus: WordStatus = info.status === 'UNKNOWN' ? 'LEARNING' : 'KNOWN';
        changeWordStatus(info.word, nextStatus);
    }

    // ========== F5 词汇量二分估算 ==========
    const estimationState = ref<'idle' | 'running' | 'done'>('idle');
    const currentQuestionIndex = ref(0);
    const totalQuestions = ref(20);
    const currentTestWord = ref('');
    const estimatedLevel = ref(0);
    const batchMarkedCount = ref(0);

    // 二分查找状态
    let bsLow = 0;
    let bsHigh = HIGH_FREQUENCY_WORDS.length - 1;
    let bsRound = 0;
    const maxRounds = 20;

    const progressPercent = computed(() =>
        Math.round(((currentQuestionIndex.value + 1) / totalQuestions.value) * 100)
    );

    /** 启动词汇量估算 */
    function startEstimation() {
        bsLow = 0;
        bsHigh = HIGH_FREQUENCY_WORDS.length - 1;
        bsRound = 0;
        currentQuestionIndex.value = 0;
        estimationState.value = 'running';
        pickNextWord();
    }

    /** 从当前二分区间的中点取出测试词 */
    function pickNextWord() {
        const mid = Math.floor((bsLow + bsHigh) / 2);
        currentTestWord.value = HIGH_FREQUENCY_WORDS[mid];
    }

    /** 用户回答"认识/不认识" */
    function answerEstimation(known: boolean) {
        const mid = Math.floor((bsLow + bsHigh) / 2);

        if (known) {
            // 认识 -> 水位线可能更高，向右搜索
            bsLow = mid + 1;
        } else {
            // 不认识 -> 水位线更低，向左搜索
            bsHigh = mid - 1;
        }

        bsRound++;
        currentQuestionIndex.value = bsRound;

        // 判断是否终止
        if (bsRound >= maxRounds || bsLow > bsHigh) {
            finishEstimation();
        } else {
            pickNextWord();
        }
    }

    /** 完成估算，批量标记水位线以下词汇 */
    function finishEstimation() {
        // 水位线 = bsLow（第一个"不认识"的词的索引位置）
        const waterLevel = bsLow;
        estimatedLevel.value = waterLevel;

        // 获取水位线以下的全部高频词
        const wordsToMark = HIGH_FREQUENCY_WORDS.slice(0, waterLevel);

        // 过滤掉已经是 LEARNING 状态 of 词（用户主动标记的生词不应被覆盖）
        const safeWords = wordsToMark.filter(w => {
            const status = vocabManager.get(w);
            return status !== 'LEARNING';
        });

        vocabManager.batchSetKnown(safeWords);
        batchMarkedCount.value = safeWords.length;

        // 广播事件
        eventBus.emit('lang-learner:batch-known', safeWords.length);
        eventBus.emit('lang-learner:estimation-done', waterLevel);

        estimationState.value = 'done';
        refreshStats();
        refreshWordList();
    }

    // ========== F8 一键学完 ==========

    /** 一键将当前文章中高频词表内的未标记词批量标为 KNOWN */
    function learnArticle() {
        try {
            // 获取当前活动文档的原始文本
            const activeFile = plugin.app.workspace.getActiveFile();
            if (!activeFile) {
                new Notice('请先打开一篇文章再使用此功能');
                return;
            }

            // 从 Obsidian 缓存中读取文本
            const cachedRead = plugin.app.vault.cachedRead(activeFile);
            if (!cachedRead) {
                console.log('无法读取当前文章内容');
                return;
            }

            cachedRead.then((articleText: string) => {
                if (!articleText) return;

                // 提取文章中的所有英文单词并进行 lemma 还原
                const wordRegex = /[a-zA-Z]+(?:[''][a-zA-Z]+)*(?:-[a-zA-Z]+)*/g;
                const articleWordsSet = new Set<string>();
                let match: RegExpExecArray | null;
                while ((match = wordRegex.exec(articleText)) !== null) {
                    articleWordsSet.add(match[0].toLowerCase());
                }

                // F8 差集公式: (文章全量词集 ∩ 20000高频词表) - 用户标记生词集
                const wordsToMark: string[] = [];
                articleWordsSet.forEach(word => {
                    // 只处理高频词表内的词（防污染白名单过滤）
                    if (!highFreqSet.has(word)) return;
                    // 跳过用户主动标记为 LEARNING 的词
                    const currentStatus = vocabManager.get(word);
                    if (currentStatus === 'KNOWN' || currentStatus === 'LEARNING') return;
                    wordsToMark.push(word);
                });

                if (wordsToMark.length === 0) {
                    console.log('当前文章中没有需要批量标记的高频词');
                    return;
                }

                vocabManager.batchSetKnown(wordsToMark);

                // 广播批量标熟事件
                eventBus.emit('lang-learner:batch-known', wordsToMark.length);

                console.log(`一键学完：已将 ${wordsToMark.length} 个高频词标记为已掌握`);
                refreshStats();
                refreshWordList();
            });
        } catch (err) {
            console.error('一键学完操作异常:', err);
        }
    }

    // ========== 整句分析模块 ==========
    const sentenceInput = ref('');
    const isAnalyzing = ref(false);
    const hasAnalyzed = ref(false);
    const isTranslating = ref(false);
    const sentenceTranslation = ref('');
    const analyzedSentenceTokens = ref<any[]>([]);
    const analyzedWordsList = ref<any[]>([]);
    const activeTokenIndex = ref<number | null>(null);

    /** 分析输入的整句 */
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
            // 1. 调用分词器对输入文本进行分词
            const tokens = tokenize(text);
            
            // 构建短语偏移范围索引，防止单字高亮 Span 嵌套入短语内
            const phraseRanges: Array<{ start: number; end: number }> = [];
            for (const token of tokens) {
                if (token.isPhrase) {
                    phraseRanges.push({ start: token.start, end: token.end });
                }
            }

            function isCoveredByPhrase(token: any): boolean {
                if (token.isPhrase) return false;
                for (const range of phraseRanges) {
                    if (token.start >= range.start && token.end <= range.end) {
                        return true;
                    }
                }
                return false;
            }

            // 2. 将句子物理切分为文本段与可高亮交互的单词段
            let lastIndex = 0;
            const segments: any[] = [];
            const uniqueWords = new Map<string, any>();

            for (const token of tokens) {
                if (isCoveredByPhrase(token)) continue;

                // 填充单词之前的纯文本字符（如空格、标点）
                if (token.start > lastIndex) {
                    segments.push({
                        type: 'text',
                        text: text.slice(lastIndex, token.start),
                        lemma: '',
                        start: lastIndex,
                        end: token.start
                    });
                }

                // 查询词汇的熟悉度与本地离线释义
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

                // 统计句中的去重词汇清单，短语比单字优先级高
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

            // 填充末尾多余文本
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

            // 3. 异步在线翻译句子并呈现
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

    /** 导入当前文档中选中的文本 */
    function importSelection() {
        try {
            const { MarkdownView } = require('obsidian');
            let selection = '';
            
            // 优先查找活动视图的选中文本
            const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
            if (activeView && activeView.editor) {
                selection = activeView.editor.getSelection();
            }
            
            // 降级遍历所有可见叶子寻找被选中的文本段
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
            console.error('从编辑器获取选中文本失败:', err);
            new Notice('无法直接获取选中文本，请使用命令面板或手动粘贴');
        }
    }

    /** 分析句中单词的点击事件 */
    function onSentenceWordClick(word: string) {
        handleWordSelected(word);
    }

    /** 分析句中单词的双击事件：标记为学习中，并追加语境 */
    async function onSentenceWordDblClick(token: any) {
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
            // 先写入带有音标和释义的 'LEARNING' 状态数据以防覆盖
            vocabManager.set(token.lemma, 'LEARNING', trans, phonetic, etymology);
            
            // 广播词汇状态改变，联动 main.ts 触发语境卡片静默追加
            eventBus.emit('lang-learner:word-changed', token.lemma, 'LEARNING', sentence);
        } else {
            vocabManager.set(token.lemma, 'KNOWN', trans, phonetic, etymology);
        }

        handleWordSelected(token.lemma);
    }

    /** 句中单词列表的微型按钮状态修改 */
    function updateWordStatusInList(word: string, newStatus: WordStatus) {
        const info = vocabManager.getInfo(word);
        const trans = info?.trans || OFFLINE_DICT[word]?.trans || '';
        const phonetic = info?.phonetic || OFFLINE_DICT[word]?.phonetic || '';
        const etymology = info?.etymology;
        vocabManager.set(word, newStatus, trans, phonetic, etymology);

        // 广播事件以触发全屏 DOM 刷新与样式重绘
        eventBus.emit('lang-learner:word-changed', word, newStatus);

        // 实时更新整句分析渲染的状态引用
        analyzedSentenceTokens.value.forEach(token => {
            if (token.lemma === word) {
                token.status = newStatus;
            }
        });
        analyzedWordsList.value.forEach(item => {
            if (item.word === word) {
                item.status = newStatus;
            }
        });
    }

    // ========== 生命周期与全局事件监听 ==========

    /** 处理事件总线广播的单词状态更改，实现多组件联动 */
    function handleWordChanged(word: string, status: string) {
        refreshStats();
        refreshWordList();
        
        // 同步对齐整句分析页面中的相应单词状态
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

        // 同步更新已选中单词的详情面板
        if (selectedWord.value && selectedWord.value.word === word) {
            selectedWord.value.status = status as WordStatus;
        }
    }

    /** 响应主窗口的单词单击选中事件，更新侧边栏详情 */
    function handleWordSelected(word: string, keepSearchResults = false) {
        if (!keepSearchResults) {
            searchResultsList.value = [];
        }
        showSyllableSplit.value = false;
        aiResponse.value = null;
        loadExamples(word);
        const info = vocabManager.getInfo(word);
        if (info) {
            selectedWord.value = { ...info };
            if (!info.trans) {
                fetchOnlineAndUpdate(word);
            }
        } else {
            // 词库中未记录的单词（即 UNKNOWN），从离线词典中拉取释义音标做初始化展示
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
            if (!trans) {
                fetchOnlineAndUpdate(word);
            }
        }
    }

    /** 在线异步查询释义并更新状态与 UI */
    async function fetchOnlineAndUpdate(word: string) {
        try {
            const result = await vocabManager.fetchOnlineTranslationAndDetails(word);
            if (result && result.trans) {
                // 如果用户仍处于当前选中的单词上，实时更新详情释义、音标、词源
                if (selectedWord.value && selectedWord.value.word === word) {
                    selectedWord.value.trans = result.trans;
                    if (result.phonetic) {
                        selectedWord.value.phonetic = result.phonetic;
                    }
                    if (result.etymology) {
                        selectedWord.value.etymology = result.etymology;
                    }
                }
                // 更新保存到内存影子词库中，使得高亮和缓存生效
                const currentStatus = vocabManager.get(word);
                vocabManager.set(word, currentStatus, result.trans, result.phonetic, result.etymology);
            }
        } catch (err) {
            console.error('在线异步更新释义与详情失败:', err);
        }
    }

    /** 将单词快速添加到生词本或从生词本中移出 */
    function toggleAddWord(word: string) {
        const info = vocabManager.getInfo(word);
        const currentStatus = info?.status || 'UNKNOWN';
        const newStatus = currentStatus === 'LEARNING' ? 'UNKNOWN' : 'LEARNING';
        
        const trans = info?.trans || OFFLINE_DICT[word]?.trans || selectedWord.value?.trans || '';
        const phonetic = info?.phonetic || OFFLINE_DICT[word]?.phonetic || selectedWord.value?.phonetic || '';
        const etymology = info?.etymology || selectedWord.value?.etymology || '';
        
        vocabManager.set(word, newStatus, trans, phonetic, etymology);
        
        // 广播事件以触发全屏 DOM 刷新与样式重绘
        eventBus.emit('lang-learner:word-changed', word, newStatus);
        
        // 实时更新已选中单词的详情面板
        if (selectedWord.value && selectedWord.value.word === word) {
            selectedWord.value.status = newStatus;
        }
        
        // 刷新列表和统计
        refreshStats();
        refreshWordList();
    }

    onMounted(() => {
        refreshStats();
        refreshWordList();
        eventBus.on('lang-learner:word-changed', handleWordChanged);
        eventBus.on('lang-learner:word-selected', handleWordSelected);
        eventBus.on('lang-learner:play-media', handlePlayMediaEvent);
        
        // 监听来自全局快捷命令的整句分析唤醒
        eventBus.on('lang-learner:analyze-sentence', (sentence: string) => {
            mainTab.value = 'sentence';
            sentenceInput.value = sentence;
            analyzeInputSentence();
        });

        loadVoiceSettings();
        loadAiSettings();
        updateVoices();
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.onvoiceschanged = updateVoices;
        }
    });

    onUnmounted(() => {
        stopYtTimer();
        eventBus.off('lang-learner:word-changed', handleWordChanged);
        eventBus.off('lang-learner:word-selected', handleWordSelected);
        eventBus.off('lang-learner:analyze-sentence');
        eventBus.off('lang-learner:play-media', handlePlayMediaEvent);
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.onvoiceschanged = null;
        }
    });

    const availableVoices = ref<SpeechSynthesisVoice[]>([]);
    const showVoiceConfig = ref(false);
    const voiceSettings = ref({
        engine: 'online', // 'online' 或 'local'
        onlineAccent: 2,  // 1: 英音, 2: 美音
        voiceName: '',
        rate: 0.9,
        pitch: 1.0
    });

    let currentAudio: HTMLAudioElement | null = null;
    let speakRequestVersion = 0;

    function stopAllAudio() {
        activeTokenIndex.value = null;
        if (currentAudio) {
            try {
                currentAudio.pause();
                currentAudio.currentTime = 0;
            } catch (e) {
                // 忽略清理报错
            }
            currentAudio = null;
        }
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
    }

    function loadVoiceSettings() {
        try {
            const stored = localStorage.getItem('lang-learner-voice-settings');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed) {
                    if (parsed.engine !== undefined) voiceSettings.value.engine = parsed.engine;
                    if (parsed.onlineAccent !== undefined) voiceSettings.value.onlineAccent = parsed.onlineAccent;
                    if (parsed.voiceName !== undefined) voiceSettings.value.voiceName = parsed.voiceName;
                    if (parsed.rate !== undefined) voiceSettings.value.rate = parsed.rate;
                    if (parsed.pitch !== undefined) voiceSettings.value.pitch = parsed.pitch;
                }
            }
        } catch (e) {
            console.error('载入发音配置失败:', e);
        }
    }

    function saveVoiceSettings() {
        localStorage.setItem('lang-learner-voice-settings', JSON.stringify(voiceSettings.value));
    }

    // ========== AI 教师配置与状态 ==========
    const showAiConfig = ref(false);
    const aiSettings = ref<AISettings>({
        apiKey: '',
        baseUrl: 'https://api.deepseek.com/v1',
        model: 'deepseek-chat'
    });
    const isAiLoading = ref(false);
    const aiResponse = ref<{ root?: string; rootMeaning?: string; phrases?: string[]; markdown: string } | null>(null);
    const aiMarkdownEl = ref<HTMLElement | null>(null);

    watch([aiResponse, aiMarkdownEl], () => {
        // 当 aiResponse 改变且元素已挂载，调用 Obsidian 的 MarkdownRenderer 渲染出精美排版的 HTML
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
    }, { flush: 'post' }); // 使用 post 确保 DOM 已渲染更新

    function loadAiSettings() {
        try {
            const stored = localStorage.getItem('lang-learner-ai-settings');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed) {
                    if (parsed.apiKey !== undefined) aiSettings.value.apiKey = parsed.apiKey;
                    if (parsed.baseUrl !== undefined) aiSettings.value.baseUrl = parsed.baseUrl;
                    if (parsed.model !== undefined) aiSettings.value.model = parsed.model;
                }
            }
        } catch (e) {
            console.error('载入 AI 配置失败:', e);
        }
    }

    function saveAiSettings() {
        localStorage.setItem('lang-learner-ai-settings', JSON.stringify(aiSettings.value));
    }

    /** 触发 AI 教师查询 */
    async function askAITeacher() {
        if (!selectedWord.value) return;
        const word = selectedWord.value.word;
        // 尝试从本地词库拿一下当前保存的历史例句作为上下文，如果有的话
        const info = vocabManager.getInfo(word);
        let contextSentence = info?.sentence;
        
        isAiLoading.value = true;
        aiResponse.value = null;
        try {
            const result = await fetchAITeacher(word, contextSentence, aiSettings.value);
            aiResponse.value = result;
        } catch (e: any) {
            new Notice(`AI 教师请求失败: ${e.message}`);
        } finally {
            isAiLoading.value = false;
        }
    }

    /** 导出 AI 结果到卡片与图谱 */
    async function exportAIResponse() {
        if (!selectedWord.value || !aiResponse.value) return;
        
        const word = selectedWord.value.word;
        const { root, rootMeaning, markdown } = aiResponse.value;
        
        try {
            // 1. 更新内存与磁盘影子词库
            vocabManager.updateRootInfo(word, root || '', rootMeaning || '', aiResponse.value.phrases || []);
            
            // 2. 调用生成器，强制追加到当前词汇笔记卡片，并自动挂载双链
            // @ts-ignore (We pass root safely)
            await updateAIContextNote(app, word, root || '', rootMeaning || '', markdown);
            
            // 3. 确保词根星形图谱连线聚合文件存在并双向绑定
            if (root) {
                await ensureRootNoteLinked(app, root, rootMeaning || '', word);
            }
            
            // 4. 将内容光标导出到当前活动的 Markdown 视图
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

    function updateVoices() {
        if (typeof window === 'undefined' || !window.speechSynthesis) return;
        const allVoices = window.speechSynthesis.getVoices();
        // 过滤出英文发音人
        availableVoices.value = allVoices.filter(v => v.lang.toLowerCase().startsWith('en'));
        
        // 默认选择 Siri 或 Samantha 或是第一个英文发音人
        if (!voiceSettings.value.voiceName && availableVoices.value.length > 0) {
            const siriOrSamantha = availableVoices.value.find(v => v.name.toLowerCase().includes('siri') || v.name.toLowerCase().includes('samantha'));
            if (siriOrSamantha) {
                voiceSettings.value.voiceName = siriOrSamantha.name;
            } else {
                voiceSettings.value.voiceName = availableVoices.value[0].name;
            }
            saveVoiceSettings();
        }
    }

    /**
     * 网络获取并播放音频流，播放成功返回 true，失败抛出异常
     * @param url 音频链接
     */
    async function fetchAndPlayAudio(url: string, version: number): Promise<boolean> {
        let hasObsidianRequest = false;
        let obsidianRequestUrl: any = null;
        try {
            const obs = require('obsidian');
            if (obs && obs.requestUrl) {
                obsidianRequestUrl = obs.requestUrl;
                hasObsidianRequest = true;
            }
        } catch (e) {
            // 忽略开发环境 require 异常
        }

        if (hasObsidianRequest && obsidianRequestUrl) {
            const response = await obsidianRequestUrl({
                url,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
                },
                throw: true
            });

            // 异步请求完毕，检查是否在此期间已发起了新的播放，若是则取消当前播放
            if (version !== speakRequestVersion) {
                throw new Error('播放已被更新的播放请求取消');
            }

            if (response.status === 200 && response.arrayBuffer) {
                const blob = new Blob([response.arrayBuffer], { type: 'audio/mpeg' });
                const blobUrl = URL.createObjectURL(blob);
                const audio = new Audio(blobUrl);
                currentAudio = audio;

                // 播放完成或出错时释放内存
                return new Promise((resolve, reject) => {
                    audio.onended = () => {
                        URL.revokeObjectURL(blobUrl);
                        resolve(true);
                    };
                    audio.onerror = (errEvent) => {
                        URL.revokeObjectURL(blobUrl);
                        reject(new Error('音频解码或播放失败'));
                    };
                    audio.play().catch(err => {
                        URL.revokeObjectURL(blobUrl);
                        reject(err);
                    });
                });
            }
            throw new Error(`网络响应状态错误: ${response.status}`);
        } else {
            // 常规环境 fallback
            if (version !== speakRequestVersion) {
                throw new Error('播放已被更新的播放请求取消');
            }
            const audio = new Audio(url);
            currentAudio = audio;
            return new Promise((resolve, reject) => {
                audio.onended = () => resolve(true);
                audio.onerror = () => reject(new Error('HTMLAudioElement 播放失败'));
                audio.play().catch(reject);
            });
        }
    }

    /**
     * 语音朗读单词或整句 (高可用多源发音路由)
     * @param text 待播放的文本
     */
    async function speak(text: string) {
        if (!text || !text.trim()) return;
        
        const currentVersion = ++speakRequestVersion;
        // 停止当前所有播放的发音（隔离多重点击）
        stopAllAudio();
        
        try {
            if (voiceSettings.value.engine === 'online') {
                const accent = voiceSettings.value.onlineAccent || 2; // 2: 美音, 1: 英音
                
                // 如果文本长度过长（超出 180 个字符），在线 API 会因为长度限制导致 400 错误
                // 此时直接使用本地系统离线发音，完美支持长句且无延迟
                if (text.trim().length > 180) {
                    playLocalVoice(text);
                    return;
                }
                
                // --- 尝试源 1: 有道发音 ---
                try {
                    const youdaoUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=${accent}`;
                    await fetchAndPlayAudio(youdaoUrl, currentVersion);
                    return; // 播放成功，直接退出
                } catch (err1) {
                    if (currentVersion !== speakRequestVersion) return;
                    console.warn('有道在线发音源请求异常，自动尝试备用谷歌源:', err1);
                }

                // --- 尝试源 2: 谷歌翻译 TTS (长句/重负载高频极其稳定) ---
                try {
                    const tl = accent === 2 ? 'en-US' : 'en-GB';
                    const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${tl}&client=tw-ob`;
                    await fetchAndPlayAudio(googleUrl, currentVersion);
                    return; // 播放成功
                } catch (err2) {
                    if (currentVersion !== speakRequestVersion) return;
                    console.error('有道与谷歌备用发音源均加载失败，降级回退系统合成:', err2);
                    playLocalVoice(text);
                }
            } else {
                if (currentVersion !== speakRequestVersion) return;
                playLocalVoice(text);
            }
        } catch (e) {
            if (currentVersion !== speakRequestVersion) return;
            console.error('发音路由链条异常，强制回退本地播放:', e);
            playLocalVoice(text);
        }
    }

    /** 播放本地系统离线发音 */
    function playLocalVoice(text: string) {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            // 首先清空当前正在播放的发音
            window.speechSynthesis.cancel();
            activeTokenIndex.value = null;

            interface SpeechSegment {
                text: string;
                pauseMs: number;
                rateMultiplier: number;
                startOffset: number;
            }

            const segments: SpeechSegment[] = [];

            // 1. 拆分标点符号（硬断句）
            const puncRegex = /([,.;:!?，。；：！？]+)/g;
            const parts = text.split(puncRegex);
            
            // 句法边界双阈值控制：
            // Major: 关系代词与从句连词（引导主干结构变化，分割阈值较低，为 18 字符）
            const structureWords = /\b(because|although|though|however|therefore|nevertheless|if|when|while|before|after|since|until|unless|but|so|that|which|who|whom|whose)\b/i;
            // Minor: 介词与不定式/比较代词（用于长句中细分意群，分割阈值较高，为 28 字符，防止 join with / go down 等紧密搭配断开）
            const prepositionWords = /\b(in|on|at|by|for|with|about|of|from|to|as)\b/i;
            const slowWords = /\b(because|although|though|however|therefore|nevertheless|especially|particularly|refuse|believe|bankrupt|insufficient|opportunity)\b/i;

            let currentOffset = 0;

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (!part) continue;
                
                const partLen = part.length;
                const partStart = currentOffset;
                currentOffset += partLen;

                if (part.match(/[,.;:!?，。；：！？]+/)) {
                    // 这是标点符号。把停顿追加到前一个意群分段上
                    let pauseMs = 350; // 逗号等默认停顿 350ms
                    if (part.match(/[.!?。！？]/)) {
                        pauseMs = 700; // 句号等句尾停顿 700ms
                    }
                    if (segments.length > 0) {
                        segments[segments.length - 1].pauseMs = pauseMs;
                    }
                } else {
                    // 这是普通文本。在此进一步按“语法意群”进行细分，保持儿童学英语的自然连读与句法断句感
                    const words = part.split(/(\s+)/);
                    let currentGroup = '';
                    let groupStartOffset = partStart;
                    let lastWordOffset = partStart;

                    for (let j = 0; j < words.length; j++) {
                        const word = words[j];
                        const cleanWord = word.trim().toLowerCase();
                        const wordLen = word.length;
                        
                        const isMajor = structureWords.test(cleanWord);
                        const isMinor = prepositionWords.test(cleanWord);
                        const currentLen = currentGroup.trim().length;
                        
                        // 双阈值规则判定：主干从句累积 > 18 字符，或介词短语累积 > 28 字符时进行分割
                        if ((isMajor && currentLen > 18) || (isMinor && currentLen > 28)) {
                            const groupText = currentGroup.trim();
                            // 计算语速乘数：含有较难/强调修饰词，慢速 0.88x，过渡短意群 1.05x，正常 1.0x
                            let rateMultiplier = 1.0;
                            if (slowWords.test(groupText)) {
                                rateMultiplier = 0.88;
                            } else if (groupText.length < 15) {
                                rateMultiplier = 1.05;
                            }

                            segments.push({
                                text: groupText,
                                pauseMs: 150, // 意群间有 150ms 的自然呼吸/换气时间
                                rateMultiplier,
                                startOffset: groupStartOffset
                            });

                            currentGroup = word;
                            groupStartOffset = lastWordOffset;
                        } else {
                            currentGroup += word;
                        }
                        lastWordOffset += wordLen;
                    }

                    if (currentGroup.trim()) {
                        const groupText = currentGroup.trim();
                        let rateMultiplier = 1.0;
                        if (slowWords.test(groupText)) {
                            rateMultiplier = 0.88;
                        } else if (groupText.length < 15) {
                            rateMultiplier = 1.05;
                        }
                        segments.push({
                            text: groupText,
                            pauseMs: 0,
                            rateMultiplier,
                            startOffset: groupStartOffset
                        });
                    }
                }
            }

            if (segments.length === 0) return;

            let currentIndex = 0;
            const currentSession = speakRequestVersion; // 绑定当前会话版本号

            function playNext() {
                if (currentIndex >= segments.length) {
                    activeTokenIndex.value = null; // 播放完毕清空高亮
                    return;
                }
                if (currentSession !== speakRequestVersion) return; // 被新播放请求截断
                
                const segment = segments[currentIndex];
                const utterance = new SpeechSynthesisUtterance(segment.text);
                
                // 应用选定的发音人
                if (voiceSettings.value.voiceName) {
                    const matched = availableVoices.value.find(v => v.name === voiceSettings.value.voiceName);
                    if (matched) utterance.voice = matched;
                }
                
                // 自适应句型语速控制：基础语速 * 意群语速乘数
                utterance.rate = voiceSettings.value.rate * segment.rateMultiplier;
                utterance.pitch = voiceSettings.value.pitch;
                
                // 监听 boundary 事件高亮对应单词/短语
                utterance.onboundary = (event) => {
                    if (currentSession !== speakRequestVersion) return;
                    if (event.name !== 'word') return;
                    
                    // 计算在此意群相对于整句的绝对字符偏移量
                    const absoluteCharIndex = segment.startOffset + event.charIndex;
                    
                    // 查找对应的 token index
                    const tokenIndex = analyzedSentenceTokens.value.findIndex(token => {
                        return absoluteCharIndex >= token.start && absoluteCharIndex < token.end;
                    });
                    
                    if (tokenIndex !== -1) {
                        activeTokenIndex.value = tokenIndex;
                    }
                };

                utterance.onend = () => {
                    if (currentSession !== speakRequestVersion) return;
                    currentIndex++;
                    if (currentIndex < segments.length) {
                        setTimeout(playNext, segment.pauseMs);
                    } else {
                        activeTokenIndex.value = null; // 全部播放完，清空高亮
                    }
                };
                
                utterance.onerror = (e) => {
                    console.error('系统语音合成片段播放出错:', e);
                    if (currentSession !== speakRequestVersion) return;
                    currentIndex++;
                    playNext();
                };
                
                window.speechSynthesis.speak(utterance);
            }
            
            playNext();
        } else {
            new Notice('当前系统不支持离线发音');
        }
    }

    // ========== 全局自主查词 ==========
    const searchQuery = ref('');
    const onlineTransCache = new Map<string, string>();

    /** 异步在线获取有道中文词汇推荐 */
    async function fetchOnlineChineseSuggestions(query: string): Promise<Array<{ word: string, trans: string }>> {
        console.log(`[Language Learner] 开始异步在线获取有道中文词汇联想，查询词: "${query}"`);
        const url = `https://dict.youdao.com/suggest?q=${encodeURIComponent(query)}&num=20&doctype=json`;
        try {
            // 尝试使用 obsidian.requestUrl 绕过 CORS
            try {
                const obsidian = require('obsidian');
                if (obsidian && obsidian.requestUrl) {
                    console.log(`[Language Learner] 正在使用 obsidian.requestUrl 抓取: ${url}`);
                    const res = await obsidian.requestUrl({ url });
                    const data = typeof res.json === 'object' ? res.json : JSON.parse(res.text || '{}');
                    console.log(`[Language Learner] obsidian.requestUrl 获取成功，数据条数:`, data?.data?.entries?.length || 0);
                    if (data?.data?.entries) {
                        return data.data.entries
                            .filter((e: any) => e.entry && e.explain)
                            .map((e: any) => ({ word: e.entry, trans: e.explain }));
                    }
                }
            } catch (obsError) {
                console.warn('[Language Learner] 使用 Obsidian requestUrl 获取在线推荐失败，回退到 fetch:', obsError);
            }

            console.log(`[Language Learner] 正在使用 window.fetch 抓取: ${url}`);
            const res = await fetch(url);
            if (!res.ok) {
                console.error(`[Language Learner] fetch 网络请求返回错误，状态码: ${res.status}`);
                return [];
            }
            const data = await res.json();
            console.log(`[Language Learner] fetch 获取成功，数据条数:`, data?.data?.entries?.length || 0);
            if (data?.data?.entries) {
                return data.data.entries
                    .filter((e: any) => e.entry && e.explain)
                    .map((e: any) => ({ word: e.entry, trans: e.explain }));
            }
        } catch (e) {
            console.error('[Language Learner] 获取在线中文查词推荐发生异常:', e);
        }
        return [];
    }

    /** 获取单词释义（用于搜索列表展示） */
    function getWordTranslation(word: string): string {
        const info = vocabManager.getInfo(word);
        if (info && info.trans) {
            return info.trans;
        }
        const cached = onlineTransCache.get(word);
        if (cached) {
            return cached;
        }
        const dictEntry = OFFLINE_DICT[word];
        if (dictEntry) {
            return dictEntry.trans;
        }
        return '暂无释义';
    }

    /** 选中搜索结果列表中的一个单词 */
    function selectResultWord(word: string) {
        handleWordSelected(word, true);
    }

    /** 从单词详情返回搜索结果列表 */
    function backToSearchResults() {
        selectedWord.value = null;
    }

    /** 在 macOS 系统词典中查询 */
    function lookupInSystemDict(query: string) {
        const cleanQuery = query.trim();
        console.log(`[Language Learner] 唤起 macOS 系统词典，查询词: "${cleanQuery}"`);
        if (!cleanQuery) return;
        const dictUrl = `dict://${encodeURIComponent(cleanQuery)}`;
        console.log(`[Language Learner] 正在通过 window.open 打开 URI: ${dictUrl}`);
        window.open(dictUrl);
    }

    /** 执行自主查词：支持输入英文或中文查询 */
    async function performSearch() {
        const query = searchQuery.value.trim();
        console.log(`[Language Learner] 执行 performSearch，输入内容: "${query}"`);
        if (!query) return;

        // 检查输入是否包含中文
        const hasChinese = /[\u4e00-\u9fa5]/.test(query);
        console.log(`[Language Learner] 输入分析：hasChinese = ${hasChinese}`);

        if (hasChinese) {
            const queryLower = query.toLowerCase();
            let matches: string[] = [];

            // 1. 扫描内存影子词库
            const customEntries = vocabManager.getAllEntries();
            console.log(`[Language Learner] 1. 开始扫描自定义影子词库...`);
            for (const entry of customEntries.values()) {
                if (entry.trans && entry.trans.toLowerCase().includes(queryLower)) {
                    matches.push(entry.word);
                }
            }
            console.log(`[Language Learner] 影子词库扫描完毕，当前匹配数: ${matches.length}`);

            // 2. 扫描本地离线词典
            console.log(`[Language Learner] 2. 开始扫描本地极简离线字典...`);
            for (const [word, entry] of Object.entries(OFFLINE_DICT)) {
                if (entry.trans && entry.trans.toLowerCase().includes(queryLower)) {
                    if (!matches.includes(word)) {
                        matches.push(word);
                    }
                }
            }
            console.log(`[Language Learner] 本地字典扫描完毕，当前累计匹配数: ${matches.length}`);

            // 3. 异步在线获取建议词
            console.log(`[Language Learner] 3. 开始异步在线获取建议词...`);
            const onlineResults = await fetchOnlineChineseSuggestions(query);
            console.log(`[Language Learner] 在线建议词返回条数: ${onlineResults.length}`);
            for (const item of onlineResults) {
                const wordLower = item.word.toLowerCase();
                const isEnglishWord = /^[a-zA-Z\s\-'\.]+$/.test(wordLower);
                if (isEnglishWord && !matches.includes(wordLower)) {
                    matches.push(wordLower);
                    onlineTransCache.set(wordLower, item.trans);
                }
            }
            console.log(`[Language Learner] 异步提取处理完毕，最终匹配单词列表:`, matches);

            if (matches.length === 0) {
                new Notice(`未找到包含 "${query}" 释义的英文单词`);
                return;
            }

            if (matches.length === 1) {
                console.log(`[Language Learner] 单个匹配项: ${matches[0]}，直接打开详情。`);
                searchResultsList.value = [];
                handleWordSelected(matches[0]);
            } else {
                let totalMatches = matches.length;
                if (totalMatches > 100) {
                    matches = matches.slice(0, 100);
                    new Notice(`找到 ${totalMatches} 个结果，仅展示前 100 个`);
                } else {
                    new Notice(`找到 ${totalMatches} 个匹配的英文单词`);
                }
                console.log(`[Language Learner] 多个匹配项，渲染结果列表，前100个:`, matches);
                selectedWord.value = null;
                searchResultsList.value = matches;
            }
        } else {
            // 英文查词
            console.log(`[Language Learner] 英文查词流程，进行词形还原并打开详情。`);
            searchResultsList.value = [];
            const result = lemmatize(query.toLowerCase());
            console.log(`[Language Learner] 还原结果: lemma = ${result.lemma}`);
            handleWordSelected(result.lemma);
        }
        searchQuery.value = '';
    }

    // ========== 卡片内容一键复制 ==========

    /** 将当前选中单词的详情格式化为 Markdown 并复制到剪贴板 */
    function copyCardContent() {
        if (!selectedWord.value) return;
        const lines: string[] = [];
        lines.push(`# ${selectedWord.value.word}`);
        if (selectedWord.value.phonetic) {
            lines.push(`**音标**: /${selectedWord.value.phonetic}/`);
        }
        lines.push(`**释义**: ${selectedWord.value.trans || '暂无释义'}`);
        if (selectedWord.value.etymology) {
            lines.push(`**词源**: ${selectedWord.value.etymology}`);
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

    // ========== 间隔复习 (Spaced Repetition) ==========
    const showReviewAnswer = ref(false);
    const reviewExampleSentences = ref<string[]>([]);
    const isLoadingReviewExamples = ref(false);
    let reviewExampleVersion = 0;

    const dueWords = computed(() => {
        const now = Date.now();
        return wordListCache.value
            .filter(w => w.status === 'LEARNING' && (!w.nextReview || w.nextReview <= now))
            .sort((a, b) => (a.nextReview || 0) - (b.nextReview || 0));
    });

    const currentReviewWord = computed(() => {
        return dueWords.value[0] || null;
    });

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
        
        refreshStats();
        refreshWordList();

        new Notice(`已记录复习：${wordObj.word} (${getGradeLabel(grade)})`);
    }

    function getGradeLabel(grade: number): string {
        switch (grade) {
            case 0: return '忘记';
            case 1: return '模糊';
            case 2: return '记得';
            case 3: return '熟练';
            default: return '';
        }
    }

    // ========== 视频播放/视频戳笔记 (Media Extended) ==========
    const currentVideoUrl = ref(''); // 输入的 URL 或选中的本地路径
    const activeVideoSrc = ref('');  // 最终给 <video>/<iframe> src 的解析 URL (本地文件使用 getResourcePath)
    const mediaFiles = ref<{ path: string, name: string }[]>([]);
    const selectedMediaFile = ref('');
    const mediaVideoRef = ref<HTMLVideoElement | null>(null);
    const mediaPlaybackRate = ref(1.0);
    const currentVideoTime = ref(0);
    const mediaType = ref<'html5' | 'youtube' | 'bilibili' | 'none'>('none');
    const pendingSeekTime = ref<number | null>(null);

    let ytPlayer: any = null;
    let ytTimer: any = null;

    // 格式化时间为 mm:ss 或 hh:mm:ss
    function formatTime(seconds: number): string {
        if (isNaN(seconds) || seconds < 0) return '00:00';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const pad = (n: number) => String(n).padStart(2, '0');
        if (h > 0) {
            return `${pad(h)}:${pad(m)}:${pad(s)}`;
        }
        return `${pad(m)}:${pad(s)}`;
    }

    // 解析 YouTube 视频链接和起始时间
    function parseYouTubeUrl(url: string): { videoId: string | null, start: number } {
        let videoId: string | null = null;
        let start = 0;
        try {
            const urlObj = new URL(url);
            if (urlObj.hostname.includes('youtube.com')) {
                if (urlObj.pathname === '/watch') {
                    videoId = urlObj.searchParams.get('v');
                } else if (urlObj.pathname.startsWith('/embed/')) {
                    videoId = urlObj.pathname.split('/')[2];
                }
                const t = urlObj.searchParams.get('t') || urlObj.searchParams.get('start');
                if (t) {
                    start = parseInt(t.replace('s', ''), 10) || 0;
                }
            } else if (urlObj.hostname === 'youtu.be') {
                videoId = urlObj.pathname.substring(1);
                const t = urlObj.searchParams.get('t');
                if (t) {
                    start = parseInt(t.replace('s', ''), 10) || 0;
                }
            }
        } catch (e) {
            console.error('解析 YouTube URL 失败:', e);
        }
        return { videoId, start };
    }

    // 解析 Bilibili 链接的 BV 号
    function parseBilibiliUrl(url: string): string | null {
        try {
            const match = url.match(/(BV[a-zA-Z0-9]{10})/i);
            if (match) {
                return match[1];
            }
        } catch (e) {}
        return null;
    }

    // 启动 YouTube 进度轮询定时器
    function startYtTimer() {
        stopYtTimer();
        ytTimer = setInterval(() => {
            if (mediaType.value === 'youtube' && ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
                currentVideoTime.value = ytPlayer.getCurrentTime();
            }
        }, 250);
    }

    // 停止 YouTube 定时器
    function stopYtTimer() {
        if (ytTimer) {
            clearInterval(ytTimer);
            ytTimer = null;
        }
    }

    // 初始化 YouTube 播放器
    function initYouTubePlayer(videoId: string, startSeconds: number) {
        const init = () => {
            const el = document.getElementById('youtube-player-el');
            if (!el) {
                setTimeout(init, 50); // 元素未挂载时延迟重试
                return;
            }
            ytPlayer = new (window as any).YT.Player('youtube-player-el', {
                height: '200',
                width: '100%',
                videoId: videoId,
                playerVars: {
                    'playsinline': 1,
                    'start': startSeconds,
                    'origin': window.location.origin
                },
                events: {
                    'onReady': (event: any) => {
                        event.target.setPlaybackRate(mediaPlaybackRate.value);
                        if (pendingSeekTime.value !== null) {
                            event.target.seekTo(pendingSeekTime.value, true);
                            event.target.playVideo();
                            pendingSeekTime.value = null;
                        }
                    }
                }
            });
        };

        if (!(window as any).YT) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
            (window as any).onYouTubeIframeAPIReady = () => {
                init();
            };
        } else {
            setTimeout(init, 50);
        }
    }

    // 扫描 Vault 媒体文件
    function scanMediaFiles() {
        try {
            if (!plugin || !plugin.app || !plugin.app.vault) return;
            const files = plugin.app.vault.getFiles();
            const extensions = ['mp4', 'webm', 'ogv', 'mp3', 'wav', 'm4a', 'ogg'];
            mediaFiles.value = files
                .filter((f: any) => extensions.includes(f.extension.toLowerCase()))
                .map((f: any) => ({ path: f.path, name: f.name }));
        } catch (e) {
            console.error('扫描本地媒体文件失败:', e);
        }
    }

    // 载入指定的媒体源
    function loadMediaSource(targetUrlOrPath: string) {
        if (!targetUrlOrPath) return;
        currentVideoUrl.value = targetUrlOrPath;

        const isYt = targetUrlOrPath.includes('youtube.com') || targetUrlOrPath.includes('youtu.be');
        const isBili = targetUrlOrPath.includes('bilibili.com');

        if (isYt) {
            mediaType.value = 'youtube';
            const { videoId, start } = parseYouTubeUrl(targetUrlOrPath);
            if (videoId) {
                initYouTubePlayer(videoId, start);
                startYtTimer();
            } else {
                new Notice('无法解析该 YouTube 视频 ID');
            }
        } else if (isBili) {
            mediaType.value = 'bilibili';
            stopYtTimer();
            const bvid = parseBilibiliUrl(targetUrlOrPath);
            if (bvid) {
                activeVideoSrc.value = `https://player.bilibili.com/player.html?bvid=${bvid}&page=1`;
            } else {
                new Notice('无法解析该 Bilibili 视频 BV 号');
            }
        } else {
            mediaType.value = 'html5';
            stopYtTimer();
            // 如果是本地 Vault 路径，则使用 getResourcePath 获取可播放的本地服务 URL
            if (!targetUrlOrPath.startsWith('http://') && !targetUrlOrPath.startsWith('https://') && !targetUrlOrPath.startsWith('app://')) {
                const file = plugin.app.vault.getAbstractFileByPath(targetUrlOrPath);
                if (file) {
                    activeVideoSrc.value = plugin.app.vault.getResourcePath(file);
                } else {
                    new Notice('找不到指定的库内媒体文件');
                }
            } else {
                activeVideoSrc.value = targetUrlOrPath;
            }
        }
    }

    // 点击本地文件选择
    function handleSelectLocalMedia() {
        if (selectedMediaFile.value) {
            loadMediaSource(selectedMediaFile.value);
        }
    }

    // 获取活动或最近聚焦的 Markdown 编辑器（兼容侧边栏点击焦点丢失场景）
    function getActiveMarkdownView() {
        try {
            // 方式一：尝试直接获取 activeLeaf
            const activeLeaf = plugin.app.workspace.activeLeaf;
            if (activeLeaf && activeLeaf.view && activeLeaf.view.getViewType() === 'markdown') {
                return activeLeaf.view;
            }
        } catch (e) {}

        try {
            // 方式二：获取最近被聚焦/活跃的主编辑叶子（最适合侧边栏夺取焦点的场景）
            const mostRecentLeaf = plugin.app.workspace.getMostRecentLeaf();
            if (mostRecentLeaf && mostRecentLeaf.view && mostRecentLeaf.view.getViewType() === 'markdown') {
                return mostRecentLeaf.view;
            }
        } catch (e) {}

        try {
            // 方式三：兜底遍历工作区中所有 Markdown 类型的叶子
            const leaves = plugin.app.workspace.getLeavesOfType('markdown');
            if (leaves && leaves.length > 0) {
                return leaves[0].view;
            }
        } catch (e) {}

        return null;
    }

    // 插入视频戳
    function insertVideoTimestamp() {
        let time = 0;
        if (mediaType.value === 'youtube' && ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
            time = ytPlayer.getCurrentTime();
        } else if (mediaType.value === 'html5' && mediaVideoRef.value) {
            time = mediaVideoRef.value.currentTime;
        } else {
            new Notice('当前播放源无法获取时间进度');
            return;
        }

        const formatted = formatTime(time);
        
        // 获取活动或最近聚焦的 Markdown 编辑器
        const markdownView = getActiveMarkdownView();
        if (markdownView) {
            const editor = markdownView.editor;
            if (editor) {
                // 构造 obsidian:// 协议跳转链接
                const uri = `obsidian://lang-learner-media?url=${encodeURIComponent(currentVideoUrl.value)}&t=${Math.floor(time)}`;
                const timestampText = `[🎬 ${formatted}](${uri})`;
                editor.replaceSelection(timestampText);
                new Notice(`📌 已成功插入时间戳 ${formatted}`);
            } else {
                new Notice('无法获取编辑器实例，请将光标置于 Markdown 文档中');
            }
        } else {
            new Notice('请先在主工作区打开并聚焦一个 Markdown 笔记');
        }
    }

    // 调整播放速度
    function setPlaybackRate(rate: number) {
        mediaPlaybackRate.value = rate;
        if (mediaType.value === 'youtube' && ytPlayer && typeof ytPlayer.setPlaybackRate === 'function') {
            ytPlayer.setPlaybackRate(rate);
        } else if (mediaType.value === 'html5' && mediaVideoRef.value) {
            mediaVideoRef.value.playbackRate = rate;
        }
    }

    // 监听时间更新
    function onVideoTimeUpdate() {
        if (mediaType.value === 'html5' && mediaVideoRef.value) {
            currentVideoTime.value = mediaVideoRef.value.currentTime;
        }
    }

    // 响应跳转事件
    function handlePlayMediaEvent(urlOrPath: string, timestamp: number) {
        mainTab.value = 'media';
        const isYt = urlOrPath.includes('youtube.com') || urlOrPath.includes('youtu.be');
        
        if (isYt) {
            pendingSeekTime.value = timestamp;
            loadMediaSource(urlOrPath);
        } else {
            loadMediaSource(urlOrPath);
            setTimeout(() => {
                if (mediaVideoRef.value) {
                    mediaVideoRef.value.currentTime = timestamp;
                    mediaVideoRef.value.play().catch(e => console.log('自动播放安全受限:', e));
                }
            }, 500);
        }
    }

    // ========== 新增：视频字幕学习模块 ==========
    const subtitlesList = ref<{ start: number; duration: number; text: string; translation: string; segments: any[] }[]>([]);
    const activeSubtitleIndex = ref(-1);
    const isLoadingSubtitles = ref(false);
    const isLoopingCurrentSentence = ref(false);
    const isSubtitleMasked = ref(false); 
    const showTranslation = ref(true);

    // 辅助函数：分离字幕中的英文原文和中文译文
    function formatSubtitleItem(rawText: string) {
        if (!rawText) return { text: '', translation: '' };
        const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) {
            return { text: '', translation: '' };
        }
        if (lines.length === 1) {
            return { text: lines[0], translation: '' };
        }
        // 寻找包含中文的行作为译文
        const chineseIdx = lines.findIndex(line => /[\u4e00-\u9fa5]/.test(line));
        if (chineseIdx !== -1) {
            const trans = lines[chineseIdx];
            const orig = lines.filter((_, idx) => idx !== chineseIdx).join(' ');
            return { text: orig, translation: trans };
        }
        // 默认第一行为原文，其余为译文
        return { text: lines[0], translation: lines.slice(1).join(' ') };
    }

    function toggleLoopCurrentSentence() {
        isLoopingCurrentSentence.value = !isLoopingCurrentSentence.value;
        if (isLoopingCurrentSentence.value) {
            new Notice('已开启单句循环');
        } else {
            new Notice('已关闭单句循环');
        }
    }

    function goToPrevSubtitle() {
        if (subtitlesList.value.length === 0) return;
        let targetIdx = activeSubtitleIndex.value - 1;
        if (targetIdx < 0) targetIdx = 0;
        seekToSubtitleTime(subtitlesList.value[targetIdx].start);
    }

    function goToNextSubtitle() {
        if (subtitlesList.value.length === 0) return;
        let targetIdx = activeSubtitleIndex.value + 1;
        if (targetIdx >= subtitlesList.value.length) targetIdx = subtitlesList.value.length - 1;
        seekToSubtitleTime(subtitlesList.value[targetIdx].start);
    }

    // 视频定位跳转
    function seekToSubtitleTime(seconds: number) {
        if (mediaType.value === 'youtube' && ytPlayer && typeof ytPlayer.seekTo === 'function') {
            ytPlayer.seekTo(seconds, true);
        } else if (mediaVideoRef.value) {
            mediaVideoRef.value.currentTime = seconds;
            mediaVideoRef.value.play().catch(e => console.log('播放失败:', e));
        }
    }

    // 在线抓取 YouTube 字幕
    async function loadYouTubeCaptions() {
        if (mediaType.value !== 'youtube') return;
        const { videoId } = parseYouTubeUrl(currentVideoUrl.value);
        if (!videoId) {
            new Notice('未能识别 YouTube 视频 ID，请确认 URL 正确');
            return;
        }

        isLoadingSubtitles.value = true;
        subtitlesList.value = [];
        activeSubtitleIndex.value = -1;

        try {
            const obsidian = require('obsidian');
            if (!obsidian || !obsidian.requestUrl) {
                throw new Error('当前非 Obsidian 环境或 requestUrl 不可用');
            }

            const headers = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Referer': `https://www.youtube.com/watch?v=${videoId}`
            };

            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
            const res = await obsidian.requestUrl({ 
                url: videoUrl,
                headers: headers
            });
            const html = res.text || '';

            // 正则匹配 ytInitialPlayerResponse 里的 captions 字幕配置
            let responseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
            if (!responseMatch) {
                const alternateMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?})\s*<\/script>/);
                if (!alternateMatch) {
                    throw new Error('未能在 YouTube 页面中匹配到 captions 字幕轨道配置');
                }
                responseMatch = alternateMatch;
            }

            const playerResponse = JSON.parse(responseMatch[1]);
            const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

            if (!captionTracks || captionTracks.length === 0) {
                throw new Error('该 YouTube 视频无可用字幕音轨');
            }

            // 优先查找英文音轨 (包含 en-US, en-GB, en 等不同变体)
            let track = captionTracks.find((t: any) => t.languageCode && t.languageCode.startsWith('en'));
            if (!track) {
                track = captionTracks[0];
            }

            // ============= 策略一：InnerTube get_transcript API (JSON，最稳定) =============
            // 从 ytInitialData 的 engagementPanel 中提取 transcript params
            let transcriptParams: string | null = null;
            let innerTubeApiKey = '';
            let visitorData = '';
            let jsonSubtitles: any[] | null = null;

            try {
                const apiKeyMatch = html.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/);
                innerTubeApiKey = apiKeyMatch?.[1] || '';

                const visitorDataMatch = html.match(/"VISITOR_DATA"\s*:\s*"([^"]+)"/);
                visitorData = visitorDataMatch?.[1] || '';

                const ytDataMatch = html.match(/ytInitialData\s*=\s*({.+?});\s*<\/script>/);
                if (ytDataMatch) {
                    const ytData = JSON.parse(ytDataMatch[1]);
                    const panels: any[] = ytData?.engagementPanels || [];
                    const transcriptPanel = panels.find((p: any) =>
                        p?.engagementPanelSectionListRenderer?.targetId === 'engagement-panel-searchable-transcript'
                    );
                    const contEndpoint = transcriptPanel
                        ?.engagementPanelSectionListRenderer?.content
                        ?.continuationItemRenderer?.continuationEndpoint;
                    transcriptParams = contEndpoint?.getTranscriptEndpoint?.params || null;
                }
            } catch (parseErr) {
                console.warn('提取 transcript params 时出错:', parseErr);
            }

            if (transcriptParams) {
                try {
                    // 关键修复：从 ytInitialData JSON 提取的 params 含有 URL 编码字符（如 %3D 表示 =）
                    // 必须先解码还原为合法的 base64 字符串才能被 YouTube API 正常解析
                    const decodedParams = decodeURIComponent(transcriptParams);
                    console.log('InnerTube params (解码后):', decodedParams.slice(0, 60) + '...');

                    const postUrl = `https://www.youtube.com/youtubei/v1/get_transcript`;
                    const postBodyObj = {
                        context: {
                            client: {
                                clientName: 'WEB',
                                clientVersion: '2.20240101.00.00',
                                hl: 'en',
                                gl: 'US',
                                visitorData
                            }
                        },
                        params: decodedParams
                    };

                    // 使用 obsidian.requestUrl 绕过 CORS（主进程代理）
                    const transcriptRes = await obsidian.requestUrl({
                        url: postUrl,
                        method: 'POST',
                        contentType: 'application/json',
                        headers: {
                            'Referer': `https://www.youtube.com/watch?v=${videoId}`,
                            'Origin': 'https://www.youtube.com',
                            'X-Youtube-Client-Name': '1',
                            'X-Youtube-Client-Version': '2.20240101.00.00'
                        },
                        body: JSON.stringify(postBodyObj)
                    });

                    console.log('InnerTube 响应状态码:', transcriptRes.status);

                    if (transcriptRes.status === 200) {
                        const json = transcriptRes.json;
                        const segments = json?.actions?.[0]
                            ?.updateEngagementPanelAction?.content
                            ?.transcriptRenderer?.content
                            ?.transcriptSearchPanelRenderer?.body
                            ?.transcriptSegmentListRenderer?.initialSegments;

                        if (segments?.length) {
                            jsonSubtitles = segments.map((seg: any) => {
                                const r = seg?.transcriptSegmentRenderer;
                                const startMs = parseInt(r?.startMs || '0');
                                const endMs = parseInt(r?.endMs || '0');
                                const text = (r?.snippet?.runs || []).map((run: any) => run.text || '').join('').trim();
                                return { start: startMs / 1000, duration: (endMs - startMs) / 1000, text };
                            }).filter((s: any) => s.text);
                            console.log(`InnerTube API 成功获取 ${jsonSubtitles.length} 条字幕`);
                        } else {
                            console.warn('InnerTube segments 为空，完整响应:\n', JSON.stringify(json).slice(0, 600));
                        }
                    } else {
                        console.warn('InnerTube 响应异常，状态码:', transcriptRes.status, '响应体:', transcriptRes.text?.slice(0, 300));
                    }
                } catch (innerTubeErr) {
                    console.warn('InnerTube get_transcript 请求失败:', innerTubeErr);
                }
            }

            // ============= 策略二：无签名 fmt=json3 公共接口 (无需 Cookie) =============
            let xmlSubtitles: any[] | null = null;
            if (!jsonSubtitles) {
                const langCode = (track.languageCode || 'en').split('-')[0]; // 取主语言代码 en
                const kindParam = track.kind === 'asr' ? '&kind=asr' : '';

                // 无签名公共接口 URL 列表（youtube-transcript 库实际使用的路径）
                const unsignedFetchUrls = [
                    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${langCode}${kindParam}&fmt=json3`,
                    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&kind=asr&fmt=json3`,
                    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`
                ];

                for (const url of unsignedFetchUrls) {
                    try {
                        const r = await obsidian.requestUrl({
                            url,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                                'Referer': `https://www.youtube.com/watch?v=${videoId}`,
                                'Accept': 'application/json, text/plain, */*',
                                'Accept-Language': 'en-US,en;q=0.9'
                            }
                        });
                        const txt = r.text || '';
                        console.log(`无签名接口 [${url.slice(-30)}] 状态:${r.status} 长度:${txt.length}`);
                        if (txt && txt.trim().length > 5) {
                            // 尝试 JSON3 格式解析
                            try {
                                const j3 = JSON.parse(txt);
                                const events = j3?.events || [];
                                const segs: any[] = [];
                                for (const ev of events) {
                                    if (!ev.segs) continue;
                                    const startSec = (ev.tStartMs || 0) / 1000;
                                    const durSec = (ev.dDurationMs || 0) / 1000;
                                    const text = ev.segs.map((s: any) => s.utf8 || '').join('').replace(/\n/g, ' ').trim();
                                    if (text && text !== '\n') segs.push({ start: startSec, duration: durSec, text });
                                }
                                if (segs.length > 0) {
                                    xmlSubtitles = segs;
                                    console.log(`json3 格式解析成功，共 ${segs.length} 条字幕`);
                                    break;
                                }
                            } catch (_) {
                                // 不是 JSON，尝试 XML 解析
                                if (txt.trim().startsWith('<')) {
                                    const parser = new DOMParser();
                                    const xmlDoc = parser.parseFromString(txt, 'text/xml');
                                    const nodes = xmlDoc.querySelectorAll('text');
                                    if (nodes.length > 0) {
                                        const parsed: any[] = [];
                                        nodes.forEach((node: any) => {
                                            const start = parseFloat(node.getAttribute('start') || '0');
                                            const dur = parseFloat(node.getAttribute('dur') || '0');
                                            const text = (node.textContent || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n/g, ' ').trim();
                                            if (text) parsed.push({ start, duration: dur, text });
                                        });
                                        if (parsed.length > 0) { xmlSubtitles = parsed; break; }
                                    }
                                }
                            }
                        }
                    } catch (e) { /* 继续下一个 */ }
                }

                // 若无签名接口失败，用 window.fetch 携带 Cookie 尝试有签名 baseUrl
                if (!xmlSubtitles) {
                    const baseUrl = (track.baseUrl || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
                    try {
                        const fetchRes = await window.fetch(baseUrl + '&fmt=json3', { method: 'GET', credentials: 'include' });
                        if (fetchRes.ok) {
                            const txt = await fetchRes.text();
                            if (txt && txt.trim().length > 5) {
                                try {
                                    const j3 = JSON.parse(txt);
                                    const events = j3?.events || [];
                                    const segs: any[] = [];
                                    for (const ev of events) {
                                        if (!ev.segs) continue;
                                        const startSec = (ev.tStartMs || 0) / 1000;
                                        const durSec = (ev.dDurationMs || 0) / 1000;
                                        const text = ev.segs.map((s: any) => s.utf8 || '').join('').replace(/\n/g, ' ').trim();
                                        if (text && text !== '\n') segs.push({ start: startSec, duration: durSec, text });
                                    }
                                    if (segs.length > 0) xmlSubtitles = segs;
                                } catch (_) { /* 忽略 */ }
                            }
                        }
                    } catch (_) { /* 忽略 CORS 错误 */ }
                }
            }

            const rawList = jsonSubtitles || xmlSubtitles;
            if (!rawList || rawList.length === 0) {
                console.warn('=== YouTube 字幕拉取失败诊断 ===');
                console.log('transcriptParams:', transcriptParams);
                console.log('所有可用字幕音轨:', captionTracks);
                throw new Error('无法获取 YouTube 字幕（YouTube 需要登录验证）。请使用"📁 导入 SRT/VTT"功能手动导入字幕文件，或在 YouTube 网站上打开视频并手动下载字幕。');
            }

            // 将 rawList 转换为带 segments 的完整字幕列表
            const list: any[] = rawList.map((item: any) => {
                const formatted = formatSubtitleItem(item.text);
                return {
                    start: item.start,
                    duration: item.duration,
                    text: formatted.text,
                    translation: formatted.translation,
                    segments: processTextToSegments(formatted.text)
                };
            });

            subtitlesList.value = list;
            new Notice(`成功加载在线字幕：共 ${list.length} 句`);
        } catch (e) {
            console.error('抓取 YouTube 在线字幕失败:', e);
            new Notice(`抓取字幕失败: ${e.message || e}`);
        } finally {
            isLoadingSubtitles.value = false;
        }
    }

    // 本地字幕上传解析器
    function handleLocalSubtitleUpload(event: Event) {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            try {
                let list: any[] = [];
                if (file.name.endsWith('.vtt')) {
                    list = parseVTT(text);
                } else {
                    list = parseSRT(text);
                }

                if (list.length === 0) {
                    throw new Error('未解析到有效的字幕条目');
                }

                subtitlesList.value = list;
                activeSubtitleIndex.value = -1;
                new Notice(`成功导入本地字幕：共 ${list.length} 句`);
            } catch (err) {
                new Notice(`解析字幕文件失败: ${err.message || err}`);
            }
        };
        reader.readAsText(file);
    }

    // 简单 SRT 解析器
    function parseSRT(srtText: string): any[] {
        const blocks = srtText.replace(/\r\n/g, '\n').split('\n\n');
        const list: any[] = [];

        blocks.forEach(block => {
            const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
            if (lines.length >= 3) {
                const timeLine = lines[1];
                const text = lines.slice(2).join('\n');
                
                const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/);
                if (timeMatch) {
                    const startSec = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000;
                    const endSec = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000;
                    const formatted = formatSubtitleItem(text);
                    list.push({
                        start: startSec,
                        duration: endSec - startSec,
                        text: formatted.text,
                        translation: formatted.translation,
                        segments: processTextToSegments(formatted.text)
                    });
                }
            }
        });
        return list;
    }

    // 简单 VTT 解析器
    function parseVTT(vttText: string): any[] {
        const cleaned = vttText.replace(/\r\n/g, '\n').replace(/^WEBVTT[^\n]*\n+/, '');
        const blocks = cleaned.split('\n\n');
        const list: any[] = [];

        blocks.forEach(block => {
            const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
            if (lines.length >= 2) {
                let timeLine = lines[0];
                let textLines = lines.slice(1);
                
                if (!timeLine.includes('-->') && lines.length >= 3) {
                    timeLine = lines[1];
                    textLines = lines.slice(2);
                }

                if (timeLine.includes('-->')) {
                    const text = textLines.join('\n');
                    const timeMatch = timeLine.match(/(?:(\d{2}):)?(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(?:(\d{2}):)?(\d{2}):(\d{2})[.,](\d{3})/);
                    if (timeMatch) {
                        const startH = timeMatch[1] ? parseInt(timeMatch[1]) : 0;
                        const startM = parseInt(timeMatch[2]);
                        const startS = parseInt(timeMatch[3]);
                        const startMs = parseInt(timeMatch[4]);
                        const startSec = startH * 3600 + startM * 60 + startS + startMs / 1000;

                        const endH = timeMatch[5] ? parseInt(timeMatch[5]) : 0;
                        const endM = parseInt(timeMatch[6]);
                        const endS = parseInt(timeMatch[7]);
                        const endMs = parseInt(timeMatch[8]);
                        const endSec = endH * 3600 + endM * 60 + endS + endMs / 1000;

                        const formatted = formatSubtitleItem(text);
                        list.push({
                            start: startSec,
                            duration: endSec - startSec,
                            text: formatted.text,
                            translation: formatted.translation,
                            segments: processTextToSegments(formatted.text)
                        });
                    }
                }
            }
        });
        return list;
    }

    // 监听播放时间，动态计算当前字幕行（更鲁棒的区间算法，防止小间隙卡死）
    watch(currentVideoTime, (t, oldT) => {
        if (subtitlesList.value.length === 0) return;

        // 检测是否是大幅度手动 Seek (超过 1.5 秒)
        const isManualSeek = oldT !== undefined && Math.abs(t - oldT) > 1.5;

        // 如果开启了单句循环，且有活动字幕，且不是大幅度的手动 Seek
        if (isLoopingCurrentSentence.value && activeSubtitleIndex.value !== -1 && !isManualSeek) {
            const sub = subtitlesList.value[activeSubtitleIndex.value];
            const end = sub.start + sub.duration;
            // 临近结束时，重置播放进度到单句起点
            if (t >= end - 0.1 && t <= end + 2.0) {
                seekToSubtitleTime(sub.start);
                return;
            }
        }

        const idx = subtitlesList.value.findIndex(sub => t >= sub.start && t <= (sub.start + sub.duration));
        if (idx !== -1) {
            if (idx !== activeSubtitleIndex.value) {
                activeSubtitleIndex.value = idx;
            }
        } else {
            // 如果处于间隙，找到在当前时间之前开始的最后一句字幕线
            let lastStartedIdx = -1;
            for (let i = 0; i < subtitlesList.value.length; i++) {
                if (t >= subtitlesList.value[i].start) {
                    lastStartedIdx = i;
                } else {
                    break;
                }
            }
            if (lastStartedIdx !== -1 && lastStartedIdx !== activeSubtitleIndex.value) {
                activeSubtitleIndex.value = lastStartedIdx;
            }
        }
    });

    // 字幕激活行改变时，平滑滚动聚焦
    watch(activeSubtitleIndex, (newIdx) => {
        if (newIdx !== -1) {
            setTimeout(() => {
                const el = document.getElementById(`sub-line-${newIdx}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 50);
        }
    });

    // 导出完整字幕带时间戳至当前 Markdown 文档编辑区
    function exportSubtitlesToNote() {
        if (subtitlesList.value.length === 0) {
            new Notice('当前没有可导出的字幕');
            return;
        }

        const markdownView = getActiveMarkdownView();
        if (!markdownView) {
            new Notice('请先在主工作区打开并聚焦一个 Markdown 笔记');
            return;
        }

        const editor = markdownView.editor;
        if (!editor) {
            new Notice('无法获取编辑器实例，请将光标置于 Markdown 文档中');
            return;
        }

        let output = `\n### 🎬 视频字幕记录 - ${formatTime(currentVideoTime.value)}\n`;
        const videoUrl = currentVideoUrl.value;
        subtitlesList.value.forEach(sub => {
            const formatted = formatTime(sub.start);
            const uri = `obsidian://lang-learner-media?url=${encodeURIComponent(videoUrl)}&t=${Math.floor(sub.start)}`;
            if (sub.translation) {
                output += `- [🎬 ${formatted}](${uri}) ${sub.text}\n  * 译：${sub.translation}\n`;
            } else {
                output += `- [🎬 ${formatted}](${uri}) ${sub.text}\n`;
            }
        });
        output += `\n`;

        editor.replaceSelection(output);
        new Notice(`📤 已成功导出 ${subtitlesList.value.length} 句字幕至文档`);
    }


    // ========== 新增：RSS 订阅阅读器模块 ==========
    const showRssConfig = ref(false);
    const newFeedName = ref('');
    const newFeedUrl = ref('');
    const rssFeeds = ref<{ name: string; url: string }[]>([]);
    const selectedFeedUrl = ref('');
    const isLoadingFeeds = ref(false);
    const feedItems = ref<{ title: string; link: string; date: string; content: string; description: string }[]>([]);
    
    const selectedArticle = ref<{ title: string; link: string; date: string; content: string; description: string } | null>(null);
    const selectedArticleParagraphs = ref<{ text: string; segments: any[] }[]>([]);
    const RSS_FEEDS_KEY = 'lang-learner-rss-feeds';

    function loadRssFeeds() {
        try {
            const saved = localStorage.getItem(RSS_FEEDS_KEY);
            if (saved) {
                rssFeeds.value = JSON.parse(saved);
            } else {
                const defaultFeeds = [
                    { name: 'Hacker News', url: 'https://news.ycombinator.com/rss' },
                    { name: 'BBC Global News', url: 'http://feeds.bbci.co.uk/news/world/rss.xml' }
                ];
                rssFeeds.value = defaultFeeds;
                localStorage.setItem(RSS_FEEDS_KEY, JSON.stringify(defaultFeeds));
            }
        } catch (e) {
            console.error('加载 RSS 列表出错:', e);
        }
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
        localStorage.setItem(RSS_FEEDS_KEY, JSON.stringify(rssFeeds.value));
        newFeedName.value = '';
        newFeedUrl.value = '';
        new Notice('订阅源添加成功');
    }

    function removeRssFeed(idx: number) {
        rssFeeds.value.splice(idx, 1);
        localStorage.setItem(RSS_FEEDS_KEY, JSON.stringify(rssFeeds.value));
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
            const xmlText = await fetchRssFeedXml(selectedFeedUrl.value);
            feedItems.value = parseRssXml(xmlText);
            new Notice(`成功拉取 ${feedItems.value.length} 篇文章`);
        } catch (e) {
            console.error(e);
            new Notice('RSS 订阅源拉取或解析失败，请检查网络或 URL 是否正确');
        } finally {
            isLoadingFeeds.value = false;
        }
    }

    async function fetchRssFeedXml(url: string): Promise<string> {
        try {
            const obsidian = require('obsidian');
            if (obsidian && obsidian.requestUrl) {
                const res = await obsidian.requestUrl({ url });
                return res.text || '';
            }
        } catch (e) {
            console.warn('Obsidian requestUrl 获取 RSS 失败，尝试 fetch:', e);
        }
        const res = await fetch(url);
        return await res.text();
    }

    function parseRssXml(xmlText: string) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        const items = xmlDoc.querySelectorAll('item');
        const parsedItems: any[] = [];
        
        items.forEach(item => {
            const title = item.querySelector('title')?.textContent || '';
            const link = item.querySelector('link')?.textContent || '';
            const date = item.querySelector('pubDate')?.textContent || item.querySelector('date')?.textContent || '';
            
            let content = '';
            const contentEncoded = item.getElementsByTagName('content:encoded');
            if (contentEncoded && contentEncoded.length > 0) {
                content = contentEncoded[0].textContent || '';
            }
            if (!content) {
                content = item.querySelector('description')?.textContent || '';
            }
            
            parsedItems.push({
                title: title.trim(),
                link: link.trim(),
                date: date.trim(),
                content: content,
                description: item.querySelector('description')?.textContent || ''
            });
        });
        
        if (parsedItems.length === 0) {
            const entries = xmlDoc.querySelectorAll('entry');
            entries.forEach(entry => {
                const title = entry.querySelector('title')?.textContent || '';
                const link = entry.querySelector('link')?.getAttribute('href') || entry.querySelector('link')?.textContent || '';
                const date = entry.querySelector('updated')?.textContent || entry.querySelector('published')?.textContent || '';
                const content = entry.querySelector('content')?.textContent || entry.querySelector('summary')?.textContent || '';
                parsedItems.push({
                    title: title.trim(),
                    link: link.trim(),
                    date: date.trim(),
                    content: content,
                    description: entry.querySelector('summary')?.textContent || ''
                });
            });
        }
        return parsedItems;
    }

    function readArticle(item: any) {
        selectedArticle.value = item;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = item.content || item.description || '';
        
        let paragraphs: string[] = [];
        const pEls = tempDiv.querySelectorAll('p');
        if (pEls.length > 0) {
            pEls.forEach(p => {
                const txt = p.textContent?.trim();
                if (txt) paragraphs.push(txt);
            });
        } else {
            paragraphs = tempDiv.textContent?.split(/\n+/).map(p => p.trim()).filter(Boolean) || [];
        }

        if (paragraphs.length === 0 && tempDiv.textContent?.trim()) {
            paragraphs.push(tempDiv.textContent.trim());
        }

        selectedArticleParagraphs.value = paragraphs.map(pText => {
            return {
                text: pText,
                segments: processTextToSegments(pText)
            };
        });
    }


    // ========== 新增：公共分词渲染助手 ==========
    function processTextToSegments(text: string): any[] {
        if (!text) return [];
        const tokens = tokenize(text);
        const phraseRanges: Array<{ start: number; end: number }> = [];
        for (const token of tokens) {
            if (token.isPhrase) {
                phraseRanges.push({ start: token.start, end: token.end });
            }
        }
        function isCoveredByPhrase(token: any): boolean {
            if (token.isPhrase) return false;
            for (const range of phraseRanges) {
                if (token.start >= range.start && token.end <= range.end) {
                    return true;
                }
            }
            return false;
        }
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

    return {
      speak,
      availableVoices,
      showVoiceConfig,
      voiceSettings,
      saveVoiceSettings,
      stats,
      activeTab,
      wordListCache,
      unknownList,
      learningList,
      currentTabList,
      selectedWord,
      estimationState,
      currentQuestionIndex,
      totalQuestions,
      currentTestWord,
      estimatedLevel,
      batchMarkedCount,
      progressPercent,
      mainTab,
      sentenceInput,
      isAnalyzing,
      hasAnalyzed,
      isTranslating,
      sentenceTranslation,
      analyzedSentenceTokens,
      analyzedWordsList,
      activeTokenIndex,
      selectWord,
      changeWordStatus,
      quickAdvance,
      startEstimation,
      answerEstimation,
      learnArticle,
      analyzeInputSentence,
      importSelection,
      onSentenceWordClick,
      onSentenceWordDblClick,
      updateWordStatusInList,
      displayWord,
      toggleSyllableSplit,
      exampleSentences,
      isLoadingExamples,
      searchQuery,
      performSearch,
      searchResultsList,
      selectResultWord,
      backToSearchResults,
      lookupInSystemDict,
      getWordTranslation,
      toggleAddWord,
      copyCardContent,
      showAiConfig,
      aiSettings,
      saveAiSettings,
      isAiLoading,
      aiResponse,
      aiMarkdownEl,
      askAITeacher,
      exportAIResponse,
      dueWords,
      currentReviewWord,
      showReviewAnswer,
      reviewExampleSentences,
      isLoadingReviewExamples,
      submitReviewGrade,
      getGradeLabel,
      currentVideoUrl,
      activeVideoSrc,
      mediaFiles,
      selectedMediaFile,
      mediaVideoRef,
      mediaPlaybackRate,
      currentVideoTime,
      formatTime,
      scanMediaFiles,
      loadMediaSource,
      handleSelectLocalMedia,
      insertVideoTimestamp,
      setPlaybackRate,
      onVideoTimeUpdate,
      mediaType,
      // RSS
      showRssConfig,
      newFeedName,
      newFeedUrl,
      rssFeeds,
      selectedFeedUrl,
      isLoadingFeeds,
      feedItems,
      selectedArticle,
      selectedArticleParagraphs,
      loadRssFeeds,
      addRssFeed,
      removeRssFeed,
      handleSelectFeed,
      readArticle,
      // 字幕
      subtitlesList,
      activeSubtitleIndex,
      isLoadingSubtitles,
      seekToSubtitleTime,
      loadYouTubeCaptions,
      handleLocalSubtitleUpload,
      exportSubtitlesToNote,
      isLoopingCurrentSentence,
      isSubtitleMasked,
      showTranslation,
      toggleLoopCurrentSentence,
      goToPrevSubtitle,
      goToNextSubtitle
    };
  }
});
</script>

<style>
/* ========================================================================
   Obsidian English Learner - 侧边栏控制面板专属样式表
   设计要点：
   1. 所有选择器均以 `.lang-learner-` 开头，避免污染 Obsidian 全局应用样式。
   2. 不带 scoped 属性以确保与 esbuild 构建输出完全匹配。
   ======================================================================== */

/* ---- 1. 面板基础容器 ---- */
.lang-learner-panel {
    padding: 14px;
    font-family: var(--font-interface, sans-serif);
    color: var(--text-normal);
    overflow-y: auto;
    height: 100%;
}

/* ---- 2. 统计仪表盘 Card ---- */
.lang-learner-panel-dashboard {
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    padding: 12px 14px;
    margin-bottom: 16px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.04);
}

.lang-learner-panel-title {
    margin: 0 0 12px 0;
    color: var(--text-accent);
    font-size: 1.1em;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 6px;
}

.lang-learner-stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
}

.lang-learner-stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 10px 8px;
    border-radius: 8px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.lang-learner-stat-item:hover {
    transform: translateY(-1.5px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
    border-color: var(--interactive-accent);
}

.lang-learner-stat-value {
    font-size: 1.4em;
    font-weight: 800;
    line-height: 1.1;
    transition: color 0.2s ease;
}

.lang-learner-stat-label {
    font-size: 0.75em;
    color: var(--text-muted);
    margin-top: 4px;
    font-weight: 500;
}

/* 单词状态着色 */
.lang-learner-stat-known .lang-learner-stat-value {
    color: var(--text-success, #27ae60);
}
.lang-learner-stat-learning .lang-learner-stat-value {
    color: var(--text-warning, #f1c40f);
}
.lang-learner-stat-unknown .lang-learner-stat-value {
    color: var(--text-error, #e74c3c);
}
.lang-learner-stat-total .lang-learner-stat-value {
    color: var(--text-accent);
}

/* ---- 3. 通用面板区块 ---- */
.lang-learner-panel-section {
    margin-bottom: 16px;
    padding: 14px;
    border-radius: 10px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
}

.lang-learner-section-title {
    margin: 0 0 12px 0;
    font-size: 0.95em;
    font-weight: 700;
    color: var(--text-normal);
    border-bottom: 1px solid var(--background-modifier-border);
    padding-bottom: 6px;
}

/* ---- 4. 按钮系统 ---- */
.lang-learner-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border: none;
    border-radius: 6px;
    padding: 8px 16px;
    font-size: 0.85em;
    font-weight: 600;
    text-align: center;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    outline: none;
    line-height: 1.4;
}

.lang-learner-btn:hover {
    filter: brightness(1.12);
    transform: translateY(-1px);
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.08);
}

.lang-learner-btn:active {
    transform: translateY(0);
    scale: 0.98;
    box-shadow: none;
}

.lang-learner-btn-full {
    width: 100%;
}

.lang-learner-btn-primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
}

.lang-learner-btn-secondary {
    background: var(--background-primary);
    color: var(--text-normal);
    border: 1px solid var(--background-modifier-border);
}

.lang-learner-btn-accent {
    background: linear-gradient(135deg, var(--interactive-accent) 0%, #8c7ae6 100%);
    color: #fff;
    border: none;
}

.lang-learner-btn-yes {
    background: #27ae60;
    color: #fff;
    flex: 1;
}

.lang-learner-btn-no {
    background: #e74c3c;
    color: #fff;
    flex: 1;
}

.lang-learner-btn-status {
    background: var(--background-primary);
    color: var(--text-muted);
    border: 1px solid var(--background-modifier-border);
    flex: 1;
    font-size: 0.8em;
    padding: 6px 4px;
    font-weight: 500;
}

.lang-learner-btn-status.lang-learner-active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
    font-weight: 700;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.lang-learner-btn-icon {
    cursor: pointer;
    background: none;
    border: none;
    font-size: 1.1em;
    padding: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    opacity: 0.45;
    transition: opacity 0.2s ease, transform 0.2s ease;
}

.lang-learner-btn-icon:hover {
    opacity: 1;
    transform: scale(1.2);
}

.lang-learner-hint-text {
    margin: 8px 0 0 0;
    font-size: 0.75em;
    color: var(--text-muted);
    text-align: center;
    line-height: 1.4;
}

/* ---- 5. F5 词汇量估算面板 ---- */
.lang-learner-estimation-header {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 14px;
}

.lang-learner-estimation-progress {
    font-size: 0.8em;
    color: var(--text-muted);
    font-weight: 500;
}

.lang-learner-progress-bar {
    width: 100%;
    height: 6px;
    background: var(--background-primary);
    border-radius: 3px;
    overflow: hidden;
    border: 1px solid var(--background-modifier-border);
}

.lang-learner-progress-fill {
    height: 100%;
    background: var(--interactive-accent);
    border-radius: 3px;
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.lang-learner-estimation-word {
    text-align: center;
    padding: 24px 10px;
    background: var(--background-primary);
    border-radius: 8px;
    border: 1px solid var(--background-modifier-border);
    margin-bottom: 12px;
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.02);
}

.lang-learner-big-word {
    font-size: 1.9em;
    font-weight: 800;
    color: var(--text-accent);
    letter-spacing: 0.5px;
}

.lang-learner-estimation-prompt {
    text-align: center;
    color: var(--text-muted);
    font-size: 0.85em;
    margin: 0 0 14px 0;
}

.lang-learner-estimation-actions {
    display: flex;
    gap: 10px;
}

/* ---- 6. 估算完成结果 ---- */
.lang-learner-estimation-result {
    text-align: center;
}

.lang-learner-result-title {
    font-size: 1.2em;
    font-weight: 800;
    color: var(--text-accent);
    margin: 0 0 8px 0;
}

.lang-learner-result-value {
    font-size: 0.95em;
    margin: 0 0 6px 0;
    color: var(--text-normal);
}

.lang-learner-result-value strong {
    color: var(--text-accent);
    font-size: 1.35em;
    font-weight: 800;
}

.lang-learner-result-detail {
    font-size: 0.8em;
    color: var(--text-muted);
    margin: 0 0 14px 0;
    line-height: 1.45;
}

/* ---- 7. 单词详情与状态微调 ---- */
.lang-learner-word-info-card {
    background: var(--background-primary);
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 12px;
    border: 1px solid var(--background-modifier-border);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
}

.lang-learner-word-lemma {
    font-size: 1.3em;
    font-weight: 800;
    color: var(--text-accent);
}

.lang-learner-word-phonetic {
    font-size: 0.85em;
    color: var(--text-muted);
    font-family: var(--font-monospace, monospace);
    margin: 4px 0;
}

.lang-learner-word-trans {
    font-size: 0.9em;
    color: var(--text-normal);
    margin-top: 8px;
    line-height: 1.45;
    border-top: 1px dashed var(--background-modifier-border);
    padding-top: 8px;
}

.lang-learner-status-actions {
    display: flex;
    gap: 8px;
}

/* ---- 8. 胶囊风格 Tab 栏 ---- */
.lang-learner-tab-bar {
    display: flex;
    background: var(--background-primary);
    border-radius: 8px;
    padding: 3px;
    border: 1px solid var(--background-modifier-border);
    margin-bottom: 10px;
}

.lang-learner-tab-btn {
    flex: 1;
    cursor: pointer;
    background: transparent;
    border: none;
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 0.8em;
    font-weight: 700;
    color: var(--text-muted);
    transition: all 0.2s ease;
    outline: none;
}

.lang-learner-tab-btn.lang-learner-active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* ---- 9. 生词列表与滚动条 ---- */
.lang-learner-wordlist-container {
    max-height: 300px;
    overflow-y: auto;
    padding-right: 2px;
}

.lang-learner-wordlist-container::-webkit-scrollbar {
    width: 4px;
}

.lang-learner-wordlist-container::-webkit-scrollbar-thumb {
    background: var(--background-modifier-border);
    border-radius: 2px;
}

.lang-learner-wordlist-item {
    display: flex;
    align-items: center;
    padding: 8px 10px;
    border-radius: 6px;
    cursor: pointer;
    margin-bottom: 4px;
    background: var(--background-primary);
    border: 1px solid transparent;
    transition: all 0.15s ease;
}

.lang-learner-wordlist-item:hover {
    background: var(--background-primary-alt);
    border-color: var(--background-modifier-border);
}

.lang-learner-wl-word {
    font-weight: 700;
    font-size: 0.88em;
    min-width: 85px;
    color: var(--text-normal);
}

.lang-learner-wl-trans {
    flex: 1;
    font-size: 0.78em;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin: 0 8px;
}

.lang-learner-empty-hint {
    text-align: center;
    color: var(--text-muted);
    font-size: 0.8em;
    padding: 24px 0;
    margin: 0;
    opacity: 0.7;
    font-style: italic;
}

/* ---- 10. 顶部主导航 Tab ---- */
.lang-learner-main-tabs {
    display: flex;
    gap: 6px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 4px;
    margin-bottom: 16px;
}

.lang-learner-main-tab-btn {
    flex: 1;
    cursor: pointer;
    background: transparent;
    border: none;
    border-radius: 6px;
    padding: 8px 4px;
    font-size: 0.85em;
    font-weight: 700;
    color: var(--text-muted);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    outline: none;
    text-align: center;
}

.lang-learner-main-tab-btn:hover {
    background: var(--background-primary-alt);
    color: var(--text-normal);
}

.lang-learner-main-tab-btn.lang-learner-active {
    background: var(--background-primary);
    color: var(--text-accent);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

/* ---- 11. 整句分析样式 ---- */
.lang-learner-textarea {
    width: 100%;
    padding: 10px;
    border-radius: 6px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    color: var(--text-normal);
    font-family: var(--font-interface, sans-serif);
    font-size: 0.9em;
    resize: vertical;
    outline: none;
    margin-bottom: 12px;
    transition: border-color 0.2s ease;
}

.lang-learner-textarea:focus {
    border-color: var(--interactive-accent);
}

.lang-learner-sentence-actions {
    display: flex;
    gap: 10px;
}

.lang-learner-result-box {
    margin-top: 14px;
    border-top: 1px solid var(--background-modifier-border);
    padding-top: 12px;
}

.lang-learner-box-title {
    font-size: 0.8em;
    color: var(--text-muted);
    font-weight: 700;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.lang-learner-loading-text {
    font-size: 0.85em;
    color: var(--text-muted);
    font-style: italic;
}

.lang-learner-translation-text {
    font-size: 0.9em;
    color: var(--text-normal);
    line-height: 1.5;
    background: var(--background-primary);
    padding: 10px;
    border-radius: 6px;
    border-left: 3px solid var(--interactive-accent);
    margin: 0;
}

.lang-learner-interactive-sentence {
    background: var(--background-primary);
    padding: 12px;
    border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
    font-size: 1.05em;
    line-height: 1.6;
    color: var(--text-normal);
}

/* 单词列表迷你状态按钮 */
.lang-learner-sentence-word-status-btns {
    display: flex;
    gap: 3px;
}

.lang-learner-btn-status-mini {
    cursor: pointer;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    color: var(--text-muted);
    font-size: 0.7em;
    font-weight: 600;
    padding: 2px 5px;
    border-radius: 4px;
    transition: all 0.15s ease;
    outline: none;
}

.lang-learner-btn-status-mini:hover {
    filter: brightness(1.1);
}

.lang-learner-btn-status-mini.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
}

.lang-learner-wl-phrase {
    color: #8c7ae6;
    font-weight: 800;
}

/* ---- 12. 全局自主查词输入框 ---- */
.lang-learner-search-bar {
    display: flex;
    gap: 6px;
    margin-bottom: 12px;
    padding: 0 2px;
}

.lang-learner-search-input {
    flex: 1;
    padding: 7px 10px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-family: var(--font-interface, sans-serif);
    font-size: 0.85em;
    outline: none;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.lang-learner-search-input:focus {
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb, 99, 102, 241), 0.15);
}

.lang-learner-search-input::placeholder {
    color: var(--text-faint);
    font-style: italic;
}

.lang-learner-search-btn {
    padding: 6px 12px;
    font-size: 0.82em;
    white-space: nowrap;
}

/* ---- 13. 动画与间隔复习样式 ---- */
@keyframes langLearnerFadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
}

.lang-learner-review-card-container {
    animation: langLearnerFadeIn 0.25s ease-out;
}

.lang-learner-review-answer-section {
    animation: langLearnerFadeIn 0.2s ease-out;
}

/* ---- 14. 视频字幕高亮与RSS排版 ---- */
.lang-learner-sub-line {
    background: transparent;
    border-left: 3px solid transparent;
}

.lang-learner-sub-line:hover {
    background: var(--background-secondary-alt);
}

.lang-learner-active-sub {
    background: rgba(var(--interactive-accent-rgb, 99, 102, 241), 0.12) !important;
    border-left: 3px solid var(--interactive-accent) !important;
    font-weight: 500;
}

.lang-learner-subtitles-container::-webkit-scrollbar {
    width: 6px;
}

.lang-learner-subtitles-container::-webkit-scrollbar-thumb {
    background-color: var(--background-modifier-border);
    border-radius: 3px;
}

.lang-learner-rss-article-body p {
    margin-bottom: 1.2em;
    font-family: var(--font-text, Georgia, serif);
    font-size: 1.05em;
}

.lang-learner-rss-para {
    line-height: 1.6;
    letter-spacing: 0.01em;
}


</style>

