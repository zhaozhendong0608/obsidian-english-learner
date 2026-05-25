# EIR V4.0 前端重耦重构与端云一体化口语实验室实施计划

本计划旨在解决当前项目前端核心 `Panel.vue` 过于庞大（4500+ 行，单体巨石）的技术债，并在此基础上，稳健地开发并引入 **V4.0 端云协同极省口语实验室** 及 **主动生词伴写催化** 两个核心新需求。

---

## 🛠️ 第一阶段：前端单体解耦重构（V3.5 -> V4.0 预备）

> [!IMPORTANT]
> **目标**：将 `Panel.vue` 的行数缩减至 300 行以内，消除所有静态内联 `style` 样式，剥离出 7 个独立的 UI 子组件与 3 个专职服务层（Service）。

### 1. 目录结构调整
在 `src/ui/` 目录下创建 `components/` 文件夹，并将逻辑与算法进行独立归档：
```text
src/
├── services/               # 专职服务层
│   ├── AudioService.ts     # 发音控制、录音采集、播放队列与打断
│   ├── AIService.ts        # AI 教师、DeepSeek 接口调度与 Prompt
│   └── RSSService.ts       # RSS 订阅拉取与 XML 解析
├── utils/
│   └── algorithms.ts       # SM-2 复习算法、二分查词估算算法
└── ui/
    ├── SidebarView.ts      # 侧边栏挂载
    ├── Panel.vue           # 瘦身后的主控台（只负责 Tab 切换与核心状态分发）
    └── components/         # 独立功能 Tab 子组件
        ├── VocabularyTab.vue   # 词汇本列表与一键学完 (F8)
        ├── EstimateTab.vue     # 词汇量二分测试 (F5)
        ├── SentenceTab.vue     # 整句分析、机器翻译与分词交互 (N2)
        ├── ReviewTab.vue       # 间隔复习打分面板
        ├── MediaTab.vue        # 视频戳笔记播放器 (YouTube / HTML5)
        ├── ReaderTab.vue       # RSS 阅读器面板
        ├── SettingsHeader.vue  # 语音与 AI 教师配置面板 (滚动折叠)
        └── WordDetailCard.vue  # 共享的单词详情卡片 (含例句、词源与 AI 教师解析)
```

### 2. 重构执行策略

#### 1. 样式彻底剥离
*   将 `Panel.vue` 模板中的所有内联 `style="..."` 全面迁移至 `src/styles.css` 中，全部使用带 `lang-learner-` 命名空间的样式类进行接管，保证 Obsidian 主题（明/暗模式）的完美适配。

#### 2. 服务层与算法抽离
*   **AudioService**: 接管 TTS 播放状态、播放打断 (`stopAllAudio`)、全局 Web AudioContext 以及新增的口语评测录音捕获。
*   **AIService**: 封装 `requestUrl` 特权大模型请求，支持流式 SSE 获取，以及自动更新/追加 Context Note 双链结构。
*   **算法纯化**: 将 `SM-2` 与二分法彻底封装为纯 TypeScript 函数，接受输入状态，返回计算结果，不再与 Vue 响应式状态混杂。

#### 3. EventBus 与状态通信
*   使用已有的 `EventBus` 进行跨组件通信，当侧边栏头部查词更新时，广播 `lang-learner:word-changed`，使得 `WordDetailCard.vue` 自动响应更新，无需在子组件中重复声明繁琐的 props 链。

---

## 🚀 第二阶段：EIR V4.0 端云协同口语评测与伴写开发

### 1. 功能 12：本地轻量级声学强制对齐引擎 (Edge CAPT Engine)

#### 核心实现：
1.  **Web Worker 异步线程化加载 WASM**：
    *   引入量化 Whisper-Tiny-EN 模型（约 40MB 级）。
    *   在独立的 `Web Worker` 中初始化 ONNX 运行时，避免模型加载和音频特征提取阻塞 UI 线程。提供 CDN/Vault 路径加载缓存，绝对不打包进主 `main.js`。
2.  **音频重采样与捕获**：
    *   使用 `Web Audio API` 进行麦克风捕获，重采样为标准的 16kHz 单声道 WAV 原始音频（以 ArrayBuffer 的形式存储在内存中，不进行任何物理磁盘写入）。
3.  **音素强制对齐算分**：
    *   本地轻量化 G2P（音素化转化）将目标标准文本转化为目标音素。
    *   利用 WASM 运行 Whisper 提炼的特征向量与目标音标，通过动态时间规整（DTW）计算偏差概率，输出每个音素的置信度。
    *   前端使用 Vue `class` 配合 CSS `TokenList` 对错误音素（如 `/r/` 缺失）标红高亮。

### 2. 功能 13：DeepSeek 肌肉纠偏诊断与影子轨道回放

#### 核心实现：
1.  **极省 Token 肌肉纠偏诊断**：
    *   收集本地评测结果（仅发送脱敏后的 [标准英文 + 错误音标编码] 到在线 DeepSeek-V3 接口）。
    *   利用 `requestUrl` 发送自定义 System Prompt，要求模型基于中式发音肌肉习惯输出指导方案（舌位、含水练习等）。
    *   流式获取 Markdown 文本，并调用 Obsidian 原生 `MarkdownRenderer.renderMarkdown` 进行自适应主题排版。
2.  **A/B 轨道交替回放**：
    *   通过 `AudioService` 控制 Web Audio 播放器队列，支持一键切换原生 TTS 标准示范音（A轨）与用户刚录制的 Blob 录音（B轨）。切换单词或关闭侧边栏时自动调用 `URL.revokeObjectURL` 物理擦除内存占用。
3.  **双标准发音联动**：
    *   在配置面板增加 `evaluationAccent` 切换，美音（GA）/英音（RP）切换时，本地对齐靶点音标、在线 TTS 语音、以及 DeepSeek 诊断 System Prompt 同步更新。

### 3. 主动催化伴写 (Output-Driven Activation)

#### 核心实现：
1.  **临界复习生词倒排映射**：
    *   在影子词库加载时，提取生词本中记忆临界值最低（SM-2 阶段靠前且到期）的生词。
    *   利用本地 20k 离线字典，为这些临界生词生成一张 **[常用近义词 -> 临界生词]** 的轻量倒排映射表（如 `reduce -> mitigate`, `important -> crucial`）。
2.  **输入补全诱导暗示**：
    *   扩展 `WordSuggest.ts`（EditorSuggest 联想器）。当捕获到用户正在打字输入常用词（如 `reduce`）时，检测到尾部输入完成，立刻在光标补全建议的第一位显示生词替换诱导（如：`💡 替换为生词本中的 mitigate (可提升 30% 记忆存留)`）。
    *   用户一键确认即可替换，达成输出端的高频主动消费，打通生词记忆闭环。

---

## 🚨 Solid 资产触碰与授权申请

*   🚨 **Solid-Strict**：`package.json`, `esbuild.config.mjs`。
    *   *变更原因*：需要引入本地语音录制采样依赖、ONNX WASM Worker 依赖，以及在编译脚本中对 WASM/Worker 静态文件做输出目录拷贝。
    *   *要求*：新增 **ADR-011**，并在明天任务开始前由指挥官确认授权生成 `Approval_Hash`。
*   ⚠️ **Solid-Regulated**：`src/main.ts`, `src/ui/WordSuggest.ts`。
    *   *变更原因*：需要在主入口注册全新的口语诊断 View 面板与 `evaluationAccent` 状态同步，并且在补全器中实现主动伴写。

---

## 🧪 验证计划 (Verification Plan)

### 1. 自动化编译与类型检查
*   重构结束后，立即在控制台运行 `npm run build` 和 `npx tsc --noEmit`，确保无类型报错，单体 js 体积正常。

### 2. 单元测试回归
*   运行现有的 33 个算法用例 (`npm run test`)，确保重构没有破坏原有的 Tokenizer、Lemmatizer 以及文件节流同步锁。

### 3. 内存与性能监控
*   在沙盒中加载 Whisper 模型，监测 Chrome DevTools 内存占用（特别是移动端表现），确保录音关闭后内存通过 `revokeObjectURL` 被 100% 垃圾回收，不发生内存泄漏。
