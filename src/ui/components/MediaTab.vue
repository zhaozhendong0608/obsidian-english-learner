<template>
  <div class="lang-learner-tab-content" style="display: flex; flex-direction: column; gap: 12px;">
    <div class="lang-learner-panel-dashboard" style="margin-bottom: 0;">
      <h3 class="lang-learner-panel-title">🎬 视频戳笔记 (Media Extended)</h3>
      <p style="font-size: 0.82em; color: var(--text-muted); margin: -4px 0 0 0;">
        在侧边栏播放媒体文件，并可通过时间戳与 Obsidian 笔记实现双向跳转定位。
      </p>
    </div>

    <!-- 媒体文件选择与输入 -->
    <div class="lang-learner-panel-section lang-learner-media-input-box">
      <!-- 本地文件选择 -->
      <div class="lang-learner-media-input-row">
        <div class="lang-learner-media-input-header">
          <label>📁 载入库内媒体文件</label>
          <button 
            @click="scanMediaFiles" 
            class="lang-learner-btn-status-mini" 
            title="重新扫描 Vault 媒体文件"
          >
            🔄 扫描
          </button>
        </div>
        <select 
          v-model="selectedMediaFile" 
          @change="handleSelectLocalMedia"
        >
          <option value="">-- 请选择本地媒体 --</option>
          <option v-for="file in mediaFiles" :key="file.path" :value="file.path">
            {{ file.name }}
          </option>
        </select>
      </div>

      <!-- 外部 URL 输入 -->
      <div class="lang-learner-media-input-row lang-learner-media-input-row-divider">
        <label>🌐 外部直链 / YouTube / B站链接</label>
        <div style="display: flex; gap: 6px;">
          <input 
            v-model="currentVideoUrl" 
            placeholder="输入视频网址或文件直链"
            class="lang-learner-media-url-input"
          />
          <button 
            @click="loadMediaSource(currentVideoUrl)" 
            class="lang-learner-btn lang-learner-btn-primary" 
          >
            载入
          </button>
        </div>
      </div>
    </div>

    <!-- 视频播放与控制区域 -->
    <div v-if="mediaType !== 'none'" style="display: flex; flex-direction: column; gap: 10px;">
      <!-- 视频播放框 -->
      <div class="lang-learner-panel-section lang-learner-video-container-box">
        <!-- HTML5 播放器 -->
        <video 
          v-if="mediaType === 'html5'"
          ref="mediaVideoRef" 
          :src="activeVideoSrc" 
          controls 
          @timeupdate="onVideoTimeUpdate"
        ></video>

        <!-- YouTube 嵌入容器 -->
        <div v-else-if="mediaType === 'youtube'" id="youtube-player-container">
          <div id="youtube-player-el"></div>
        </div>

        <!-- Bilibili 嵌入网页 -->
        <iframe 
          v-else-if="mediaType === 'bilibili'"
          :src="activeVideoSrc" 
          allowfullscreen
        ></iframe>
      </div>

      <!-- 播放控制行 -->
      <div class="lang-learner-panel-section lang-learner-media-controls-box">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="lang-learner-media-time-display">
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
        >
          📌 插入当前视频时间戳至文档
        </button>
      </div>

      <!-- 💡 实时高亮字幕 -->
      <div 
        v-if="activeSubtitleIndex !== -1 && subtitlesList[activeSubtitleIndex]" 
        class="lang-learner-panel-section lang-learner-current-subtitle-box"
      >
        <div class="lang-learner-current-subtitle-header">
          <div style="display: flex; gap: 4px;">
            <button @click="goToPrevSubtitle" class="lang-learner-btn-status-mini">⏮️ 上一句</button>
            <button @click="goToNextSubtitle" class="lang-learner-btn-status-mini">下一句 ⏭️</button>
          </div>
          <div class="lang-learner-current-subtitle-title">📢 当前播放句</div>
          <div style="display: flex; gap: 4px;">
            <button 
              @click="toggleLoopCurrentSentence" 
              class="lang-learner-btn-status-mini"
              :class="{ active: isLoopingCurrentSentence }"
              :title="isLoopingCurrentSentence ? '点击关闭单句循环' : '点击开启单句循环'"
            >
              🔂 {{ isLoopingCurrentSentence ? '循环中' : '单句循环' }}
            </button>
          </div>
        </div>
        <div class="lang-learner-current-subtitle-text">
          <template v-for="(token, index) in subtitlesList[activeSubtitleIndex].segments" :key="index">
            <span v-if="token.type === 'text'">{{ token.text }}</span>
            <span
              v-else
              class="lang-learner-word lang-learner-subtitle-interactive-word"
              :class="{
                'lang-learner-unknown': token.status === 'UNKNOWN',
                'lang-learner-learning': token.status === 'LEARNING',
                'lang-learner-known': token.status === 'KNOWN',
                'lang-learner-phrase': token.isPhrase
              }"
              :data-lemma="token.lemma"
              :data-trans="token.trans"
              :data-phonetic="token.phonetic ? '/' + token.phonetic + '/' : ''"
              @click.stop="onWordClick(token.lemma)"
              @dblclick.stop="onWordDblClick(token)"
            >
              {{ token.text }}
            </span>
          </template>
        </div>
        <!-- 第二行译文 -->
        <div 
          v-if="subtitlesList[activeSubtitleIndex].translation && showTranslation" 
          class="lang-learner-current-subtitle-trans"
        >
          {{ subtitlesList[activeSubtitleIndex].translation }}
        </div>
      </div>

      <!-- 💬 视频字幕卡片 -->
      <div class="lang-learner-panel-section lang-learner-subtitles-card-box">
        <div class="lang-learner-subtitles-card-header">
          <span>💬 字幕列表 ({{ subtitlesList.length }} 句)</span>
          <div style="display: flex; gap: 4px;">
            <button 
              v-if="subtitlesList.length > 0"
              @click="showTranslation = !showTranslation" 
              class="lang-learner-btn-status-mini"
              :class="{ active: showTranslation }"
              title="切换双语模式"
            >
              👁️ {{ showTranslation ? '双语模式 (译文显示)' : '原文模式 (译文隐藏)' }}
            </button>
            <button 
              v-if="mediaType === 'youtube'" 
              @click="loadYouTubeCaptions" 
              class="lang-learner-btn-status-mini" 
              :disabled="isLoadingSubtitles"
            >
              {{ isLoadingSubtitles ? '抓取中...' : '🌐 抓取字幕' }}
            </button>
            <label class="lang-learner-btn-status-mini" style="cursor: pointer; margin: 0; display: inline-block;">
              📁 导入
              <input type="file" accept=".srt,.vtt" @change="handleLocalSubtitleUpload" style="display: none;" />
            </label>
            <button 
              v-if="subtitlesList.length > 0"
              @click="exportSubtitlesToNote" 
              class="lang-learner-btn-status-mini active" 
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
        >
          <div 
            v-for="(sub, idx) in subtitlesList" 
            :key="idx" 
            :id="'sub-line-' + idx"
            class="lang-learner-sub-line"
            :class="{ 'lang-learner-active-sub': activeSubtitleIndex === idx }"
            @click="seekToSubtitleTime(sub.start)"
          >
            <span class="lang-learner-sub-time-label">
              {{ formatTime(sub.start) }}
            </span>
            <span class="lang-learner-sub-text">
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
                  @click.stop="onWordClick(token.lemma)"
                  @dblclick.stop="onWordDblClick(token)"
                >
                  {{ token.text }}
                </span>
              </template>
            </span>
            <!-- 第二行：译文 -->
            <div 
              v-if="sub.translation && showTranslation" 
              class="lang-learner-sub-translation" 
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

    <div v-else class="lang-learner-empty-hint lang-learner-media-empty-box">
      <div style="font-size: 2.5em; margin-bottom: 10px; filter: grayscale(0.2);">🎬</div>
      <p style="margin: 0 0 4px 0; font-weight: 600; font-size: 1em; color: var(--text-normal);">暂无载入媒体</p>
      <p style="font-size: 0.8em; color: var(--text-muted); margin: 0; padding: 0 16px; line-height: 1.4;">
        请在上方选择库内媒体，或输入 YouTube 等链接载入播放。载入后即可导入或自动抓取字幕。
      </p>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, watch, inject, onMounted, onUnmounted } from 'vue';
import { Notice, requestUrl } from 'obsidian';
import { eventBus } from '../../event/EventBus';
import type { VocabularyManager } from '../../db/vocabulary';
import { tokenize } from '../../tokenizer/tokenizer';
import { OFFLINE_DICT } from '../../data/static_data';

export default defineComponent({
  name: 'MediaTab',
  emits: ['select-word'],
  setup(props, { emit }) {


    // 注入核心依赖
    const vocabManager = inject<VocabularyManager>('vocabManager')!;
    const plugin = inject<any>('plugin')!;

    const currentVideoUrl = ref(''); 
    const activeVideoSrc = ref('');  
    const mediaFiles = ref<{ path: string, name: string }[]>([]);
    const selectedMediaFile = ref('');
    const mediaVideoRef = ref<HTMLVideoElement | null>(null);
    const mediaPlaybackRate = ref(1.0);
    const currentVideoTime = ref(0);
    const mediaType = ref<'html5' | 'youtube' | 'bilibili' | 'none'>('none');
    const pendingSeekTime = ref<number | null>(null);

    let ytPlayer: any = null;
    let ytTimer: any = null;

    // 字幕状态
    const subtitlesList = ref<{ start: number; duration: number; text: string; translation: string; segments: any[] }[]>([]);
    const activeSubtitleIndex = ref(-1);
    const isLoadingSubtitles = ref(false);
    const isLoopingCurrentSentence = ref(false);
    const isSubtitleMasked = ref(false); 
    const showTranslation = ref(true);

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

    // 解析 Bilibili 链接
    function parseBilibiliUrl(url: string): string | null {
      try {
        const match = url.match(/(BV[a-zA-Z0-9]{10})/i);
        if (match) return match[1];
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
          setTimeout(init, 50); 
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
        const files = plugin.app.vault.getFiles();
        const extensions = ['mp4', 'webm', 'ogv', 'mp3', 'wav', 'm4a', 'ogg'];
        mediaFiles.value = files
          .filter((f: any) => extensions.includes(f.extension.toLowerCase()))
          .map((f: any) => ({ path: f.path, name: f.name }));
      } catch (e) {
        console.error('扫描本地媒体文件失败:', e);
      }
    }

    // 载入媒体源
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

    function handleSelectLocalMedia() {
      if (selectedMediaFile.value) {
        loadMediaSource(selectedMediaFile.value);
      }
    }

    // 调节播放速度
    function setPlaybackRate(rate: number) {
      mediaPlaybackRate.value = rate;
      if (mediaType.value === 'youtube' && ytPlayer && typeof ytPlayer.setPlaybackRate === 'function') {
        ytPlayer.setPlaybackRate(rate);
      } else if (mediaType.value === 'html5' && mediaVideoRef.value) {
        mediaVideoRef.value.playbackRate = rate;
      }
    }

    // 监听 HTML5 时间更新
    function onVideoTimeUpdate() {
      if (mediaType.value === 'html5' && mediaVideoRef.value) {
        currentVideoTime.value = mediaVideoRef.value.currentTime;
      }
    }

    // 获取 Markdown 编辑器
    function getActiveMarkdownView() {
      try {
        const activeLeaf = plugin.app.workspace.activeLeaf;
        if (activeLeaf && activeLeaf.view && activeLeaf.view.getViewType() === 'markdown') {
          return activeLeaf.view;
        }
      } catch (e) {}

      try {
        const mostRecentLeaf = plugin.app.workspace.getMostRecentLeaf();
        if (mostRecentLeaf && mostRecentLeaf.view && mostRecentLeaf.view.getViewType() === 'markdown') {
          return mostRecentLeaf.view;
        }
      } catch (e) {}

      try {
        const leaves = plugin.app.workspace.getLeavesOfType('markdown');
        if (leaves && leaves.length > 0) {
          return leaves[0].view;
        }
      } catch (e) {}

      return null;
    }

    // 插入时间戳
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
      const markdownView = getActiveMarkdownView();
      if (markdownView) {
        const editor = markdownView.editor;
        if (editor) {
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

    // 字幕文本拆分
    function formatSubtitleItem(rawText: string) {
      if (!rawText) return { text: '', translation: '' };
      const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) return { text: '', translation: '' };
      if (lines.length === 1) return { text: lines[0], translation: '' };

      const chineseIdx = lines.findIndex(line => /[\u4e00-\u9fa5]/.test(line));
      if (chineseIdx !== -1) {
        const trans = lines[chineseIdx];
        const orig = lines.filter((_, idx) => idx !== chineseIdx).join(' ');
        return { text: orig, translation: trans };
      }
      return { text: lines[0], translation: lines.slice(1).join(' ') };
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

    // 视频定位跳转
    function seekToSubtitleTime(seconds: number) {
      if (mediaType.value === 'youtube' && ytPlayer && typeof ytPlayer.seekTo === 'function') {
        ytPlayer.seekTo(seconds, true);
      } else if (mediaVideoRef.value) {
        mediaVideoRef.value.currentTime = seconds;
        mediaVideoRef.value.play().catch(e => console.log('播放失败:', e));
      }
    }

    // 循环单句开关
    function toggleLoopCurrentSentence() {
      isLoopingCurrentSentence.value = !isLoopingCurrentSentence.value;
      newNotice(isLoopingCurrentSentence.value ? '已开启单句循环' : '已关闭单句循环');
    }

    function newNotice(msg: string) {
      new Notice(msg);
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

    // 在线拉取 YouTube 字幕
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
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const res = await requestUrl({ 
          url: videoUrl,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Referer': `https://www.youtube.com/watch?v=${videoId}`
          }
        });
        const html = res.text || '';

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

        let track = captionTracks.find((t: any) => t.languageCode && t.languageCode.startsWith('en'));
        if (!track) track = captionTracks[0];

        let transcriptParams: string | null = null;
        let visitorData = '';
        let jsonSubtitles: any[] | null = null;

        try {
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
            const decodedParams = decodeURIComponent(transcriptParams);
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

            const transcriptRes = await requestUrl({
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
              }
            }
          } catch (innerTubeErr) {
            console.warn('InnerTube get_transcript 请求失败:', innerTubeErr);
          }
        }

        let xmlSubtitles: any[] | null = null;
        if (!jsonSubtitles) {
          const langCode = (track.languageCode || 'en').split('-')[0];
          const kindParam = track.kind === 'asr' ? '&kind=asr' : '';
          const unsignedFetchUrls = [
            `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${langCode}${kindParam}&fmt=json3`,
            `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&kind=asr&fmt=json3`,
            `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`
          ];

          for (const url of unsignedFetchUrls) {
            try {
              const r = await requestUrl({
                url,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                  'Referer': `https://www.youtube.com/watch?v=${videoId}`
                }
              });
              const txt = r.text || '';
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
                  if (segs.length > 0) {
                    xmlSubtitles = segs;
                    break;
                  }
                } catch (_) {
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
            } catch (e) {}
          }
        }

        const rawList = jsonSubtitles || xmlSubtitles;
        if (!rawList || rawList.length === 0) {
          throw new Error('无法获取 YouTube 字幕，请手动导入 SRT/VTT。');
        }

        subtitlesList.value = rawList.map((item: any) => {
          const formatted = formatSubtitleItem(item.text);
          return {
            start: item.start,
            duration: item.duration,
            text: formatted.text,
            translation: formatted.translation,
            segments: processTextToSegments(formatted.text)
          };
        });

        new Notice(`成功加载在线字幕：共 ${subtitlesList.value.length} 句`);
      } catch (e) {
        console.error('抓取 YouTube 在线字幕失败:', e);
        new Notice(`抓取字幕失败: ${e.message || e}`);
      } finally {
        isLoadingSubtitles.value = false;
      }
    }

    // 导入本地 SRT/VTT
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

          if (list.length === 0) throw new Error('未解析到有效的字幕条目');

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

    // 导出字幕
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

    function onWordClick(word: string) {
      emit('select-word', word);
    }

    // 双击临时查词
    async function onWordDblClick(token: any) {
      const currentStatus = vocabManager.get(token.lemma);
      const displayPhonetic = token.phonetic ? ` /${token.phonetic}/` : '';
      let trans = token.trans;
      let phonetic = token.phonetic;

      if (trans) {
        new Notice(`📖 ${token.lemma}${displayPhonetic}\n释义: ${trans}`, 3500);
      } else {
        const loadingNotice = new Notice(`📖 ${token.lemma}${displayPhonetic}\n正在查询释义...`, 5000);
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
          }
        } catch (err) {
          loadingNotice.hide();
        }
      }

      if (currentStatus !== 'KNOWN') {
        vocabManager.set(token.lemma, 'LEARNING', trans, phonetic);
        eventBus.emit('lang-learner:word-changed', token.lemma, 'LEARNING', token.text);
      }

      emit('select-word', token.lemma);
    }

    // 监听视频时间，精准寻找并激活字幕行
    watch(currentVideoTime, (t, oldT) => {
      if (subtitlesList.value.length === 0) return;

      const isManualSeek = oldT !== undefined && Math.abs(t - oldT) > 1.5;

      if (isLoopingCurrentSentence.value && activeSubtitleIndex.value !== -1 && !isManualSeek) {
        const sub = subtitlesList.value[activeSubtitleIndex.value];
        const end = sub.start + sub.duration;
        if (t >= end - 0.1 && t <= end + 2.0) {
          seekToSubtitleTime(sub.start);
          return;
        }
      }

      const idx = subtitlesList.value.findIndex(sub => t >= sub.start && t <= (sub.start + sub.duration));
      if (idx !== -1) {
        if (idx !== activeSubtitleIndex.value) activeSubtitleIndex.value = idx;
      } else {
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

    // 字幕行平滑滚动
    watch(activeSubtitleIndex, (newIdx) => {
      if (newIdx !== -1) {
        setTimeout(() => {
          const el = document.getElementById(`sub-line-${newIdx}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
      }
    });

    // 监听双向跳转事件
    function handlePlayMediaEvent(urlOrPath: string, timestamp: number) {
      const isYt = urlOrPath.includes('youtube.com') || urlOrPath.includes('youtu.be');
      if (isYt) {
        pendingSeekTime.value = timestamp;
        loadMediaSource(urlOrPath);
      } else {
        loadMediaSource(urlOrPath);
        setTimeout(() => {
          if (mediaVideoRef.value) {
            mediaVideoRef.value.currentTime = timestamp;
            mediaVideoRef.value.play().catch(() => {});
          }
        }, 500);
      }
    }

    // 增量同步状态
    function handleWordChanged(word: string, status: string) {
      subtitlesList.value.forEach(sub => {
        sub.segments.forEach(tok => {
          if (tok.lemma === word) tok.status = status;
        });
      });
    }

    onMounted(() => {
      scanMediaFiles();
      eventBus.on('lang-learner:word-changed', handleWordChanged);
      eventBus.on('lang-learner:play-media', handlePlayMediaEvent);
    });

    onUnmounted(() => {
      stopYtTimer();
      eventBus.off('lang-learner:word-changed', handleWordChanged);
      eventBus.off('lang-learner:play-media', handlePlayMediaEvent);
    });

    return {
      currentVideoUrl,
      activeVideoSrc,
      mediaFiles,
      selectedMediaFile,
      mediaVideoRef,
      mediaPlaybackRate,
      currentVideoTime,
      mediaType,
      subtitlesList,
      activeSubtitleIndex,
      isLoadingSubtitles,
      isLoopingCurrentSentence,
      showTranslation,
      scanMediaFiles,
      loadMediaSource,
      handleSelectLocalMedia,
      setPlaybackRate,
      onVideoTimeUpdate,
      insertVideoTimestamp,
      seekToSubtitleTime,
      toggleLoopCurrentSentence,
      goToPrevSubtitle,
      goToNextSubtitle,
      loadYouTubeCaptions,
      handleLocalSubtitleUpload,
      exportSubtitlesToNote,
      onWordClick,
      onWordDblClick,
      formatTime
    };
  }
});
</script>

<style scoped>
.lang-learner-media-input-box {
  padding: 10px; 
  border-radius: 8px; 
  border: 1px solid var(--background-modifier-border); 
  background: var(--background-secondary); 
  display: flex; 
  flex-direction: column; 
  gap: 8px;
}
.lang-learner-media-input-row {
  display: flex; 
  flex-direction: column; 
  gap: 4px;
}
.lang-learner-media-input-header {
  display: flex; 
  justify-content: space-between; 
  align-items: center;
}
.lang-learner-media-input-row select {
  width: 100%; 
  padding: 5px 8px; 
  border-radius: 6px; 
  background: var(--background-modifier-form-field); 
  border: 1px solid var(--background-modifier-border); 
  color: var(--text-normal); 
  font-size: 0.82em; 
  cursor: pointer;
}
.lang-learner-media-input-row-divider {
  border-top: 1px dashed var(--background-modifier-border); 
  padding-top: 8px;
}
.lang-learner-media-url-input {
  flex: 1; 
  padding: 5px 8px; 
  border-radius: 6px; 
  background: var(--background-modifier-form-field); 
  border: 1px solid var(--background-modifier-border); 
  color: var(--text-normal); 
  font-size: 0.82em;
}
.lang-learner-video-container-box {
  text-align: center; 
  background: #000; 
  border-radius: 8px; 
  padding: 2px; 
  overflow: hidden; 
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
}
.lang-learner-video-container-box video {
  width: 100%; 
  max-height: 280px; 
  aspect-ratio: 16/9; 
  display: block; 
  border-radius: 6px;
}
.lang-learner-video-container-box iframe {
  width: 100%; 
  height: 240px; 
  border: none; 
  border-radius: 6px; 
  display: block;
}
#youtube-player-container {
  width: 100%; 
  height: 240px; 
  display: block; 
  border-radius: 6px; 
  background: #000;
}
.lang-learner-media-controls-box {
  padding: 8px 12px; 
  border-radius: 8px; 
  border: 1px solid var(--background-modifier-border); 
  background: var(--background-secondary); 
  display: flex; 
  flex-direction: column; 
  gap: 8px;
}
.lang-learner-media-time-display {
  font-size: 0.85em; 
  font-weight: 600; 
  color: var(--text-accent); 
  display: flex; 
  align-items: center; 
  gap: 4px;
}
.lang-learner-current-subtitle-box {
  padding: 12px; 
  border-radius: 8px; 
  border: 1.5px solid var(--interactive-accent); 
  background: var(--background-primary); 
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05); 
  text-align: center;
}
.lang-learner-current-subtitle-header {
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  margin-bottom: 8px; 
  border-bottom: 1px dashed var(--background-modifier-border); 
  padding-bottom: 6px;
}
.lang-learner-current-subtitle-title {
  font-size: 0.75em; 
  color: var(--interactive-accent); 
  font-weight: 700; 
  letter-spacing: 0.5px;
}
.lang-learner-current-subtitle-text {
  font-size: 1.08em; 
  font-weight: 600; 
  line-height: 1.5; 
  color: var(--text-normal);
}
.lang-learner-subtitle-interactive-word {
  border-bottom: 1.5px dashed var(--text-accent); 
  padding: 0 1px; 
  margin: 0 1px; 
  cursor: pointer;
}
.lang-learner-current-subtitle-trans {
  font-size: 0.88em; 
  color: var(--text-muted); 
  margin-top: 8px; 
  font-weight: normal; 
  border-top: 1px dashed var(--background-modifier-border); 
  padding-top: 6px; 
  text-align: center;
}
.lang-learner-subtitles-card-box {
  padding: 10px; 
  border-radius: 8px; 
  border: 1px solid var(--background-modifier-border); 
  background: var(--background-secondary);
}
.lang-learner-subtitles-card-header {
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  margin-bottom: 8px;
  font-size: 0.82em; 
  font-weight: 700; 
  color: var(--text-muted);
}
.lang-learner-subtitles-container {
  max-height: 220px; 
  overflow-y: auto; 
  border: 1px solid var(--background-modifier-border); 
  border-radius: 6px; 
  padding: 6px; 
  background: var(--background-primary); 
  display: flex; 
  flex-direction: column; 
  gap: 6px;
}
.lang-learner-subtitles-container::-webkit-scrollbar {
  width: 6px;
}
.lang-learner-subtitles-container::-webkit-scrollbar-thumb {
  background-color: var(--background-modifier-border);
  border-radius: 3px;
}
.lang-learner-sub-line {
  padding: 5px 8px; 
  border-radius: 6px; 
  line-height: 1.45; 
  font-size: 0.88em; 
  transition: all 0.15s ease; 
  cursor: pointer; 
  display: flex; 
  flex-direction: column;
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
.lang-learner-sub-time-label {
  font-size: 0.72em; 
  color: var(--text-muted); 
  font-family: monospace; 
  display: block; 
  margin-bottom: 2px;
}
.lang-learner-sub-text {
  color: var(--text-normal); 
  display: block;
}
.lang-learner-sub-translation {
  font-size: 0.8em; 
  color: var(--text-muted); 
  margin-top: 3px; 
  font-weight: normal; 
  display: block;
}
.lang-learner-media-empty-box {
  padding: 40px 0; 
  text-align: center; 
  background: var(--background-secondary); 
  border-radius: 8px; 
  border: 1px dashed var(--background-modifier-border); 
  margin-top: 10px;
}
</style>
