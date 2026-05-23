# 项目全景图 (Landscape) - Obsidian Language Learner

> 此文件是 AI 理解本插件项目的核心入口。请保持更新。

## 1. 项目元数据
- **项目名称**: Obsidian Language Learner (Obsidian 语言学习助手)
- **核心目标**: 在 Obsidian 本地 Markdown 笔记中实现“阅读文本 -> 自动还原分词 -> 状态比对 -> 语境高亮 -> 内存I/O安全落盘 -> 生物记忆复习”的完整学习闭环。
- **技术栈**: 
  - **语言**: TypeScript (100% 强类型)
  - **核心框架**: Vue 3 (Composition API / `<script setup>`) 用于交互控制面板
  - **构建打包**: esbuild + `esbuild-plugin-vue3` -> 编译输出单个 `main.js` 和 `styles.css`
  - **样式**: Vanilla CSS + scoped Vue 样式，零外部样式库依赖（无 TailwindCSS / Element UI）
  - **跨平台桥接**: Capacitor (基于 Obsidian 底座自带的 `this.app.vault.adapter`)
- **架构模式**: 内存优先 (Memory-First) + 零 JS 功耗悬浮窗 (CSS Pseudo-element Hover) + 订阅发布解耦 (Event Bus)。

---

## 2. 核心模块与职责划分

```
┌────────────────────────────────────────────────────────┐
│               Obsidian App (Host)                      │
│  ┌────────────────────────┐  ┌──────────────────────┐  │
│  │ Markdown Post Processor│  │ Workspace Sidebar    │  │
│  └───────────┬────────────┘  └──────────┬───────────┘  │
└──────────────┼──────────────────────────┼──────────────┘
               │ (Intercept DOM)          │ (Mount Vue View)
               ▼                          ▼
┌───────────────────────────┐      ┌─────────────────────┐
│ Tokenizer & Lemmatizer    │      │  Vue 3 Panel UI     │
│ (分词与词干还原)            ├─────►│  (词汇面板/估算问答) │
└──────────────┬────────────┘      └──────────┬──────────┘
               │                              │
               │ (Word Status Match)          │ (State Update)
               ▼                              ▼
┌────────────────────────────────────────────────────────┐
│                   Memory Cache Map                     │
│               (内存影子词库，纳米级响应)                 │
└──────────────────────────────┬─────────────────────────┘
                               │ (2000ms Throttled Write & Promise Queue Lock)
                               ▼
┌────────────────────────────────────────────────────────┐
│                   Obsidian Vault                       │
│    vocabulary.json (本地词库)  LangLearner/Cards/ (卡片)│
└────────────────────────────────────────────────────────┘
```

- **分词与还原 (Tokenizer & Lemmatizer)**:
  - 剥离 MD 标签，提取 Token，过滤噪音。
  - 内置 20k 高频词频表与不规则变形映射，做形态规则还原并使用高频词表进行有效性校验。
- **内存影子词库 (Memory-First DB)**:
  - 运行时全部在内存 Map 中查询与变更。
  - 通过 2000ms 节流刷写与并发队列锁进行文件保护。
  - 使用 `app.vault.adapter` 读写临时文件并覆盖，防范多平台沙盒限制。
- **渲染高亮 (Post-Processor & CSS Tooltips)**:
  - 用 `<span>` 标签拦截包装 DOM，由 CSS 伪元素属性 `attr(data-trans)` 实现“零 JS 功耗”悬浮气泡。
  - 单词状态改变时，执行 Class TokenList 微秒级全屏增量褪色，避免整页重绘。
- **语境笔记生成器 (Context Note Generator)**:
  - 抓取生词所在整句，建立指向原型 Lemma 的双链，基于 Front Matter 模板自动生成独立 MD 单词卡片。
- **冷启动估算**:
  - 二分查找算法（$\log_2 N$ 复杂度，一共约 20 个测试词）快速确定用户词汇量水位，批量标记水位线下词汇为 `KNOWN`。

---

## 3. 当前里程碑 (Current Milestone)
- **阶段**: 项目初始化与沙盒配置
- **重点**:
  - 完成 `package.json`、`esbuild.config.mjs` 及构建流程。
  - 编写 `scripts/generate_data.js` 准备高频词与不规则变形词表。
  - 运行 `npm run dev` 跑通 esbuild 实时监听，并在 `/Users/up_dong/Documents/Obsidian-Dev-Sandbox` 沙盒中激活并开启 `hot-reload`。

---

## 4. 已知风险与技术债 (Known Issues)
- **大文件性能**: 对于几万字的长文档，Markdown Post-Processor 进行全部分词拦截可能会引入毫秒级渲染延迟。需要确保 Token 提取和高亮包裹算法的极速执行（通过减少正则回溯）。
- **移动端 I/O 延迟**: 部分 Android 设备本地闪存较慢，并发写 `vocabulary.json` 可能引起短时间锁队列。必须维持 2000ms 节流来合并写入。

---
> *修订记录:*
> - *2026-05-23 - 插件技术全景图确立*
