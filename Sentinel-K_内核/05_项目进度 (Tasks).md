# 05 项目进度 (Tasks)

> [!IMPORTANT]
> **更新守则**: 每一个 Sub-Intent 结束后，AI 必须同步更新此处的 Checkbox。

## 🚀 阶段 1: 项目初始化与构建配置 [已完成]
- [x] 初始化内核规范（对齐总纲、全景、规约、FAQ等） `(2026-05-23)`
- [x] 初始化 `package.json` 并安装依赖项（包含 Vue 3 构建依赖） `(2026-05-23)`
- [x] 配置 `tsconfig.json`、`manifest.json` 与 `esbuild.config.mjs`（集成 Vue 3 编译插件） `(2026-05-23)`
- [x] 编写 `scripts/generate_data.js` 预生成高频词词表、不规则变形映射表、内置短语表和内置极简中英释义字典 `(2026-05-23)`

## 🏗️ 阶段 2: 核心功能实现

### 1. 算法与分词模块 (F1 & F10 & F9)
- [x] 实现 `src/tokenizer/tokenizer.ts` 的分词逻辑，支持 Markdown 标签剥离及 Token 偏移记录
- [x] 集成 **F10 词组优先匹配**，基于还原后词干序列进行多词前向匹配（滑动窗口 $N=4$），将匹配短语归并为完整 Token 输出
- [x] 实现 `src/tokenizer/lemmatizer.ts`，基于不规则词典与规则映射还原词原型，并对齐英美音
- [x] 实现 **F9 安全拼写容错红线**：严禁自动高亮静默替换，仅提供侧边栏查词建议和超纲长词的非侵入式联想

### 2. 本地影子词库与数据存储 (F2 & N1 & N3 & F11)
- [x] 定义 `src/types.ts` 单词状态（WordStatus）、本地词库项数据结构与词典配置项类型
- [x] 实现 `src/db/vocabulary.ts` 影子缓存 Map，设计 2000ms 合并写节流与 Promise 异步写锁
- [x] 实现 `app.vault.adapter` 移动端安全的临时文件写入与原子 `rename` 覆盖逻辑
- [x] 实现 **F11 词典本地化与在线翻译降级**：加载内置 20k 离线释义字典，预留设置页自定义词典路径，联网时异步触发在线翻译，断网无匹配时友好降级

### 3. 高性能渲染拦截与 CSS 气泡 (F3 & F7)
- [x] 编写 `src/styles.css`，定义高亮类名（`lang-learner-` 前缀），实现 `:hover::after` 读取 `data-trans` 实现零 JS 功耗气泡，并定义降噪层级 CSS 选择器
- [x] 在 `src/main.ts` 中注册 `registerMarkdownPostProcessor` 拦截 DOM。对于词组和单字执行 DOM 包裹（词组优先，内部严禁嵌套单字高亮 Span）
- [x] 实现 **F7 CSS变量驱动零重绘降噪滑块**，通过修改文章父容器类名或 CSS 变量达到 GPU 加速的渐进式半透明淡化效果
- [x] 实现 Class TokenList 级微秒局部刷新函数 `refreshWordsInDOM`，避免全页排版重绘

### 4. Vue 3 侧边栏与交互控制 (F5 & N2 & F8)
- [x] 实现 `src/event/EventBus.ts` 发布订阅事件总线，处理 `lang-learner:word-changed` 状态广播 (已完成强类型重构与验证)
- [x] 实现 `src/ui/SidebarView.ts` 在 Obsidian 侧边栏成功挂载 Vue 3 的 `Panel.vue` 控制面板 (已注入 plugin 支持 F8)
- [x] 编写 `src/ui/Panel.vue` 支持单词熟悉度微调和生词本列表 (分 Tab 与时间排序)
- [x] 实现 **F5 二分查找词汇量估算** 问答（$\log_2 N$ 复杂度，约 20 题估算），并在结束时批量标记水位线下高频词为 `KNOWN`
- [x] 实现 **F8 防污染一键学完 (Learn Article)**：差集计算仅在 20,000 高频词白名单内进行，避免脏数据污染 `vocabulary.json`

### 5. 语境卡片自动追加生成 (F4)
- [x] 实现 `src/generator/contextNote.ts` 的自动整句抓取，并在 `LangLearner/Cards/` 目录下生成独立 Lemma.md (已包含临时文件安全重命名写入)
- [x] 引入追加式更新机制：如果卡片已存在，解析 Front Matter 并将新语境追加至 `## 历史流转语境` 尾部，禁止覆盖旧数据 (支持同文本去重)

## 🧪 阶段 3: 整体测试与部署联调
- [x] 初始化 `/Users/up_dong/Documents/Obsidian-Dev-Sandbox` 沙盒 (已自动注入 community-plugins 并放置测试文档)
- [x] 建立软链接，启动开发构建 (`npm run dev`)，配置 `hot-reload` 插件 (后台 watch 进程已常驻运行)
- [x] 全链路调试（冷启动二分估算、词汇高亮、悬浮气泡、侧边栏 Vue 3 改写与 I/O 修复直写完成，测试绿灯）
- [x] 全量单词交互优化：支持“已掌握”词汇的悬浮/点击查词，及双击直接弹出桌面 Notice 翻译显示


---

## 📊 进度统计
- **总体完成度**: 100%
- **当前瓶颈**: 无。所有核心模块（包括分词、本地影子缓存、DOM 渲染拦截、Vue 3 侧边栏交互、词汇量估算、一键学完、语境卡片自动追加以及侧边栏样式命名空间重构）已全面开发并稳定通过验证。

