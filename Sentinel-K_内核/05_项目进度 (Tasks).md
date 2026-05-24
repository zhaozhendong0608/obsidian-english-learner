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

### 6. 整句分析与双引擎混合发音 (N2 & F12)
- [x] 实现侧边栏“整句分析” Tab 页，通过 `tokenize` and `lemmatizer` 实现长句交互分词高亮、去重清单展示及 MyMemory API 跨域整句翻译
- [x] 实现 **F12 双引擎混合真人发音系统 (Hybrid TTS)**，内置在线真人配音（有道 + 谷歌翻译）与离线系统合成双模引擎
- [x] 实现宿主 `requestUrl` 无 Origin/Referer 特权代理与本地 Blob 二进制转换播放，解决跨域及 Status 500 播放报错问题，并添加 localStorage 持久化及 stopAllAudio 播音打断隔离

### 7. 教学法发音调优与词源检索增强 (F12 & F11)
- [x] 实现基于句法结构的意群意向断句算法 (Syntactic Sense Group Phrasing)，支持大介词短语前自然换气与 Liaison 连读保留
- [x] 实现自适应语速控制 (Tempo Tuning)，复杂词降速 88%，过渡词提速 105% 提升发音真实度
- [x] 接入有道 `jsonapi` 词源与记忆辅助信息 (Etymology & Mnemonic) 获取并持久化至 `vocabulary.json`
- [x] 优化单词详情 UI，新增 `💡 词源与记忆辅助` 面板并支持 Obsidian 原生主题及换行渲染
- [x] 优化 `lemmatizer.ts` 中缀词性还原算法，确保稀有词（如 `languished` -> `languish`）正确匹配原型，并通过自动化单元测试
- [x] 实现点击文档单词时主进程自动激活侧边栏并聚焦 Tab 的联动逻辑 `(2026-05-23)`
- [x] 实现基于 lemmatizer 词干还原的全局自主查词框，打通从手动输入到生词本详情展示的检索通路 `(2026-05-23)`
- [x] 实现单词详情卡片一键复制 Markdown 格式文本至剪贴板功能 `(2026-05-23)`
- [x] 调整 Panel.vue DOM 布局，将单词详情区域提权至 Tab 按钮正下方，解决需滚动查看的体验问题 `(2026-05-23)`

## 🧪 阶段 3: 整体测试与部署联调
- [x] 初始化 `/Users/up_dong/Documents/Obsidian-Dev-Sandbox` 沙盒 (已自动注入 community-plugins 并放置测试文档)
- [x] 建立软链接，启动开发构建 (`npm run dev`)，配置 `hot-reload` 插件 (后台 watch 进程已常驻运行)
- [x] 全链路调试（冷启动二分估算、词汇高亮、悬浮气泡、侧边栏 Vue 3 改写与 I/O 修复直写完成，测试绿灯）
- [x] 全量单词交互优化：支持“已掌握”词汇的悬浮/点击查词，及双击直接弹出桌面 Notice 翻译显示
- [x] 混合发音调试：跑通双引擎切换及有道/谷歌双源 Failover，长句朗读流畅，混音打断符合预期

## 🎬 阶段 4: Media Extended 视频笔记与 Spaced Repetition 间隔复习 [已完成]
- [x] 实现 Spaced Repetition (间隔复习) SM-2 记忆算法及 Vue 侧边栏复习卡片界面 `(2026-05-23)`
- [x] 实现 obsidian://lang-learner-media 协议处理器与全局 EventBus 扩展 `(2026-05-23)`
- [x] 实现 Vue 3 HTML5 视频播放器、库内媒体扫描与时间戳一键插入/点击跳转功能 `(2026-05-23)`
- [x] 集成 YouTube Iframe Player API 以及 B站内嵌页渲染，支持 YouTube 视频的双向跳转与进度同步 `(2026-05-23)`
- [x] 修复侧边栏按钮夺取焦点导致 activeLeaf 变为 Panel 从而无法插入时间戳的 Focus Shift 问题 `(2026-05-23)`

---

## 🎪 阶段 5: 输入补全、RSS 阅读器与 YouTube 字幕学习 [已完成]

### 1. 输入补全 (Various Complements)
- [x] 编写 `src/ui/WordSuggest.ts` 并继承 Obsidian 的 `EditorSuggest` 类，拦截编辑器中的输入前缀 `(2026-05-23)`
- [x] 实现联想匹配：根据当前单词输入前缀，从本地影子词库中检索匹配项（生词/学习中优先，高频词兜底），支持模糊拼写推荐 `(2026-05-23)`
- [x] 在 `src/main.ts` 中注册该建议器，并进行编辑器打字流畅度与兼容性测试 `(2026-05-23)`

### 2. RSS 订阅阅读 (RSS Dashboard)
- [x] 在 `Panel.vue` 中新增 `Reader` (阅读器) Tab 按钮并实现基础布局 `(2026-05-23)`
- [x] 支持 RSS 订阅管理：允许用户输入 RSS 订阅源并进行持久化保存，通过 `requestUrl` 跨域拉取 XML 数据并用 `DOMParser` 解析 `(2026-05-23)`
- [x] 正文渲染与即读即查：将解析出的 RSS 文章内容渲染至 Vue 3 容器，直接应用插件分词与高亮处理器，实现点击查词发音与悬浮气泡 `(2026-05-23)`

### 3. YouTube 字幕学习 (OB English Learner)
- [x] 编写 YouTube 在线字幕抓取逻辑：根据视频 ID，通过 `requestUrl` 异步拉取 YouTube 的 XML 字幕轨道配置，下载并解析成带有时间戳的字幕文本 `(2026-05-23)`
- [x] 编写字幕备用机制：支持用户手动选择或拖入本地 `.srt` / `.vtt` 等字幕文件进行解析加载 `(2026-05-23)`
- [x] 在侧边栏新增字幕句列表渲染区：对提取的字幕进行交互式分词处理，实现“点击任意单词自动查词并发音” `(2026-05-23)`
- [x] 进度同步滚动高亮与间隙锁频同步：监听播放时间戳，通过区间算法自动平滑滚动聚焦到当前句并高亮，解决空白间隙处的索引抖动闪烁问题 `(2026-05-24)`
- [x] 实时精读大字歌词看板：在播放器下方新增“📢 当前播放句”实时高亮看板，支持播放时直接交互查词听音 `(2026-05-24)`
- [x] 批量 Markdown 跳转超链接导出：提供一键导出完整字幕至文档编辑区的功能，格式化为带 `obsidian://lang-learner-media` 协议的时间戳列表 `(2026-05-24)`

---

## 📊 进度统计
- **总体完成度**: 100%
- **当前瓶颈**: 无。阶段 7 (AI 教师深度解析与图谱网络构建) 已全部落地，并完成与 Obsidian 深度交互适配。

---

## 🎨 阶段 6: 全局侧边栏布局重构与体验优化 [已完成]
- [x] 全局 UI 扁平化重构：将全局查词输入框、发音配置面板、单词详情卡片提权至侧边栏顶部，所有功能 Tab 共享头部 `(2026-05-24)`
- [x] 单词详情一键收藏：声音播放按钮右侧追加 `➕` / `📌` 状态切换按钮，提供从详情页直接添加生词本的极简入口 `(2026-05-24)`
- [x] 免跳转专注阅读：移除点击单词或查词时强制跳转至“词汇本” Tab 的逻辑，保持用户原活动 Tab 视图连贯 `(2026-05-24)`

## 🤖 阶段 7: AI 教师深度解析与图谱网络构建 [已完成]
- [x] 接入 Obsidian 原生 MarkdownRenderer 将 AI 教师返回的 Markdown 文本动态渲染为交互式格式预览页面 `(2026-05-24)`
- [x] 优化 updateAIContextNote 构建语义双链网络，打通与 Roots/ 枢纽笔记的星状拓扑联动，完美适配 Obsidian Graph View `(2026-05-24)`
- [x] 修复 Obsidian 外部笔记文件点击/双击联动同步机制，打通 file-open 监听与全局编辑器选词更新双向绑定 `(2026-05-24)`
- [x] 优化侧边栏顶部配置面板，将发音配置与 AI教师配置并排分栏展示，并内置独立的竖向滚动条 `(2026-05-24)`
