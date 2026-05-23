<template>
  <div class="lang-learner-panel">
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
    </div>

    <!-- 全局自主查词输入框 -->
    <div class="lang-learner-search-bar">
      <input
        v-model="searchQuery"
        @keyup.enter="performSearch"
        placeholder="输入单词查询..."
        class="lang-learner-search-input"
      />
      <button @click="performSearch" class="lang-learner-btn lang-learner-btn-primary lang-learner-search-btn">🔍 查询</button>
    </div>

    <!-- 单词详情与熟悉度微调区 (全局共享，当有选中单词时浮现) -->
    <div v-if="selectedWord" class="lang-learner-panel-section lang-learner-word-detail">
      <h4 class="lang-learner-section-title" style="display: flex; justify-content: space-between; align-items: center;">
        <span>📝 单词详情</span>
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
          <button 
            class="lang-learner-btn-voice-word" 
            title="朗读单词" 
            @click="speak(selectedWord.word)"
            style="background: transparent; border: none; cursor: pointer; font-size: 1.1em; padding: 2px 6px; opacity: 0.85;"
          >
            🔊
          </button>
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
      </div>
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
      <!-- 语音发音配置区 -->
      <div class="lang-learner-panel-section lang-learner-voice-settings-section" style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--background-modifier-border);">
        <div 
          class="lang-learner-voice-settings-header" 
          @click="showVoiceConfig = !showVoiceConfig"
          style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; padding: 4px 0;"
        >
          <span style="font-weight: 500; font-size: 0.85em; color: var(--text-muted);">⚙️ 发音配置 (美音/英音)</span>
          <span style="font-size: 0.75em; color: var(--text-muted);">{{ showVoiceConfig ? '▼ 收起' : '▶ 展开' }}</span>
        </div>
        <div v-show="showVoiceConfig" class="lang-learner-voice-settings-body" style="padding-top: 10px; display: flex; flex-direction: column; gap: 8px;">
          <!-- 引擎选择 -->
          <div class="lang-learner-voice-setting-item" style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 0.75em; color: var(--text-muted);">发音引擎:</label>
            <select 
              v-model="voiceSettings.engine" 
              @change="saveVoiceSettings"
              style="width: 100%; padding: 4px; font-size: 0.85em; border-radius: 4px; border: 1px solid var(--background-modifier-border); background-color: var(--background-primary); color: var(--text-normal);"
            >
              <option value="online">🌐 在线真人发音 (推荐)</option>
              <option value="local">💻 系统原生离线发音</option>
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
              <option :value="2">🇺🇸 美式发音 (General American)</option>
              <option :value="1">🇬🇧 英式发音 (Received Pronunciation)</option>
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
                  {{ voice.name }} ({{ voice.lang }})
                </option>
                <option v-if="availableVoices.length === 0" value="">系统默认发音人</option>
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

    <!-- 单词详情面板已移至 Tab 按钮下方 (全局最高优先级位置) -->
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, inject, onMounted, onUnmounted, watch } from 'vue';
import { Notice } from 'obsidian';
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

const hyphenator = createHyphenator(hyphenationPatternsEnUs);

export default defineComponent({
  name: 'LangLearnerPanel',
  setup() {
    // 通过 provide/inject 获取核心依赖
    const vocabManager = inject<VocabularyManager>('vocabManager')!;
    const plugin = inject<any>('plugin')!;

    // 使用 Set 加速高频词查询 (O(1))
    const highFreqSet = new Set<string>(HIGH_FREQUENCY_WORDS);

    // ========== 导航 Tab 控制 ==========
    const mainTab = ref<'vocabulary' | 'estimate' | 'sentence' | 'review'>('vocabulary');

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
    function handleWordSelected(word: string) {
        // 自动切换到词汇本 Tab，确保用户能立即看到单词详情
        mainTab.value = 'vocabulary';
        showSyllableSplit.value = false;
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

    onMounted(() => {
        refreshStats();
        refreshWordList();
        eventBus.on('lang-learner:word-changed', handleWordChanged);
        eventBus.on('lang-learner:word-selected', handleWordSelected);
        
        // 监听来自全局快捷命令的整句分析唤醒
        eventBus.on('lang-learner:analyze-sentence', (sentence: string) => {
            mainTab.value = 'sentence';
            sentenceInput.value = sentence;
            analyzeInputSentence();
        });

        loadVoiceSettings();
        updateVoices();
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.onvoiceschanged = updateVoices;
        }
    });

    onUnmounted(() => {
        eventBus.off('lang-learner:word-changed', handleWordChanged);
        eventBus.off('lang-learner:word-selected', handleWordSelected);
        eventBus.off('lang-learner:analyze-sentence');
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

    /** 执行自主查词：将输入词还原为原型后触发 handleWordSelected */
    function performSearch() {
        const query = searchQuery.value.trim().toLowerCase();
        if (!query) return;
        const result = lemmatize(query);
        handleWordSelected(result.lemma);
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
      copyCardContent,
      dueWords,
      currentReviewWord,
      showReviewAnswer,
      reviewExampleSentences,
      isLoadingReviewExamples,
      submitReviewGrade,
      getGradeLabel
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
</style>

