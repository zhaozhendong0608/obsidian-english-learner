<template>
  <div class="lang-learner-tab-content">
    <div class="lang-learner-panel-dashboard">
      <h3 class="lang-learner-panel-title">🌐 网页导入</h3>
      <p style="font-size: 0.82em; color: var(--text-muted); margin: -4px 0 12px 0;">
        输入外文网站地址，自动提取正文并插入到编辑器，享受即读即查的学习体验。
      </p>
    </div>

    <!-- URL 输入区 -->
    <div class="lang-learner-panel-section">
      <label style="display: block; margin-bottom: 6px; font-weight: 500;">📝 网页地址 (URL)</label>
      <div style="display: flex; gap: 6px;">
        <input
          v-model="webUrl"
          placeholder="https://example.com/article"
          class="lang-learner-rss-input"
          style="flex: 1;"
          @keyup.enter="importWebPage"
        />
        <button
          @click="importWebPage"
          class="lang-learner-btn lang-learner-btn-primary"
          :disabled="isLoading || !webUrl.trim()"
        >
          {{ isLoading ? '⏳ 导入中...' : '📥 导入到编辑器' }}
        </button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="lang-learner-loading-text" style="padding: 20px 0; text-align: center;">
      正在抓取网页并提取正文，请稍候...
    </div>

    <!-- 预览区 -->
    <div v-if="previewArticle && !isLoading" class="lang-learner-panel-section">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <h4 class="lang-learner-section-title">📄 正文预览</h4>
        <button
          @click="clearPreview"
          class="lang-learner-btn-icon"
          title="清除预览"
        >
          ✕
        </button>
      </div>

      <div class="lang-learner-web-preview">
        <h3 style="margin: 0 0 8px 0; font-size: 1.1em;">{{ previewArticle.title }}</h3>
        <p style="font-size: 0.85em; color: var(--text-muted); margin-bottom: 12px;">
          <span v-if="previewArticle.byline">作者: {{ previewArticle.byline }} | </span>
          <span v-if="previewArticle.siteName">来源: {{ previewArticle.siteName }} | </span>
          字数: {{ previewArticle.length }}
        </p>
        <div class="lang-learner-web-excerpt" style="font-size: 0.9em; line-height: 1.6; color: var(--text-normal);">
          {{ previewArticle.excerpt || previewArticle.textContent.substring(0, 200) + '...' }}
        </div>
      </div>
    </div>

    <!-- 使用说明 -->
    <div v-if="!isLoading && !previewArticle" class="lang-learner-panel-section" style="font-size: 0.85em; color: var(--text-muted);">
      <p><strong>💡 使用提示:</strong></p>
      <ul style="margin: 8px 0; padding-left: 20px; line-height: 1.8;">
        <li>支持大多数静态网页（如博客、新闻网站）</li>
        <li>自动过滤广告、导航栏等噪音内容</li>
        <li>导入后自动触发分词高亮，点击单词即可查词</li>
        <li>⚠️ 不支持需要登录或 JavaScript 动态渲染的页面</li>
      </ul>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, inject } from 'vue';
import { Notice, MarkdownView } from 'obsidian';
import { WebScraperService, WebArticle } from '../../services/WebScraperService';
import type LanguageLearnerPlugin from '../../main';

export default defineComponent({
  name: 'WebImportTab',
  setup() {
    const plugin = inject<LanguageLearnerPlugin>('plugin')!;
    const webUrl = ref('');
    const isLoading = ref(false);
    const previewArticle = ref<WebArticle | null>(null);
    const scraperService = new WebScraperService();

    /**
     * 获取当前活动的 Markdown 编辑器
     */
    function getActiveMarkdownView(): MarkdownView | null {
      const activeLeaf = plugin.app.workspace.activeLeaf;
      if (activeLeaf && activeLeaf.view.getViewType() === 'markdown') {
        return activeLeaf.view as MarkdownView;
      }

      const recentLeaf = plugin.app.workspace.getMostRecentLeaf();
      if (recentLeaf && recentLeaf.view.getViewType() === 'markdown') {
        return recentLeaf.view as MarkdownView;
      }

      const leaves = plugin.app.workspace.getLeavesOfType('markdown');
      if (leaves.length > 0) {
        return leaves[0].view as MarkdownView;
      }

      return null;
    }

    /**
     * 导入网页到编辑器
     */
    async function importWebPage() {
      const url = webUrl.value.trim();
      if (!url) {
        new Notice('❌ 请输入有效的网页地址');
        return;
      }

      // 验证 URL 格式
      try {
        new URL(url);
      } catch (e) {
        new Notice('❌ 网页地址格式不正确，请输入完整的 URL（如 https://example.com）');
        return;
      }

      isLoading.value = true;
      previewArticle.value = null;

      try {
        // 抓取网页
        const html = await scraperService.fetchWebPage(url);

        // 提取正文
        const article = scraperService.extractMainContent(html, url);

        if (!article) {
          new Notice('❌ 无法提取网页正文，该网页可能不支持自动解析');
          isLoading.value = false;
          return;
        }

        // 显示预览
        previewArticle.value = article;

        // 格式化为 Markdown
        const markdown = scraperService.formatAsMarkdown(article, url);

        // 插入到编辑器
        const view = getActiveMarkdownView();
        if (!view) {
          new Notice('❌ 请先在主工作区打开一个 Markdown 笔记');
          isLoading.value = false;
          return;
        }

        const editor = view.editor;
        const cursor = editor.getCursor();

        // 在光标位置插入内容
        editor.replaceRange('\n\n' + markdown + '\n\n', cursor);

        new Notice(`✅ 成功导入文章《${article.title}》，共 ${article.length} 字`);

        // 清空输入框
        webUrl.value = '';

      } catch (error) {
        console.error('网页导入失败:', error);
        new Notice(`❌ 网页导入失败: ${error.message || '未知错误'}`);
      } finally {
        isLoading.value = false;
      }
    }

    /**
     * 清除预览
     */
    function clearPreview() {
      previewArticle.value = null;
    }

    return {
      webUrl,
      isLoading,
      previewArticle,
      importWebPage,
      clearPreview
    };
  }
});
</script>

<style scoped>
.lang-learner-web-preview {
  padding: 12px;
  background: var(--background-secondary);
  border-radius: 6px;
  border: 1px solid var(--background-modifier-border);
}

.lang-learner-web-excerpt {
  max-height: 200px;
  overflow-y: auto;
}
</style>
