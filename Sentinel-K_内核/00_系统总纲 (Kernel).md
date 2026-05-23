# 🟢 Sentinel-K 启动内核 (System Kernel) - Obsidian 插件版

> [!IMPORTANT]
> **SSOT (Single Source of Truth) 说明**: 本文件是 Obsidian Language Learner 项目的唯一权威口径。所有其他文档及 AI 工作流中的术语、阈值和规则必须引用本文件定义的锚点。

## 1. 术语表 (Glossary) `[K-TERM]`
- **指挥官 (Commander)**: 人类开发者。负责定义边界 (Intent)、审计安全 (Audit)、验收结果 (Accept)。
- **执行官 (Agent)**: AI 编码助手。负责推演逻辑 (Reasoning)、原子执行 (Execution)、提供证据 (Evidence)。
- **坚固资产 (Solid Asset)**: 风险极高的核心配置文件及底层算法文件，触碰需遵循 `[K-ADR]`。详见 `[K-ASSET]` 分级。
- **证据块 (Evidence Block)**: 代码交付时必须附带的物理验证摘要，格式见 `[K-EVIDENCE]`。
- **授权令牌 (Approval_Hash)**: 用于 `Solid-Strict` 资产变更的人类临时授权标识（如在任务开始前由指挥官确认的 Hash）。
- **合规回扣 (ADR_Entry)**: 指向某条 ADR 的引用与回扣说明（Liquid-only 允许写 `N/A`）。

---

## 2. 语言协议 (Language Protocol) `[K-LANG]`
- **原则**: 除代码符号、日志关键字及错误堆栈外，所有对话、文档 (Artifacts)、注释必须使用 **中文 (简体)**。

---

## 3. 启动协议 (Boot Protocol) `[K-BOOT]`
- **Pack-0 (Kernel)**: 内核基石。包含 `00_总纲` + `05_进度` + `内核地图.md`。
- **Pack-1 (Bone-Arch)**: 架构蓝图。在 Pack-0 基础上加载 `01_全景` + `02_规约` + `06_拓扑`。
- **Pack-2 (Muscle-Impl)**: 执行包。在 Pack-1 基础上加载 业务代码 + `03_决策日志` + `04_答疑库`。

---

## 4. 协作法则 (Core Laws)

### 4.1 切披萨法则 (Pizza Logic) `[K-PIZZA]`
- **判定阈值**: 预估变更内容 **> 3 个文件** 或 **> 100 行代码**。
- **强制约束**: 触发阈值后，必须物理拆分为 `Sub-Intent`。
    - **Stage A (Bone/骨架)**: 仅定义接口、类型、TS 声明及契约常数。
    - **Stage B (Stub/桩点 - 可选)**: 实现 Mock 数据并跑通 Obsidian 侧边栏/高亮的渲染测试。
    - **Stage C (Muscle/肌肉)**: 实现具体业务逻辑与标准证据交付。
- **协作模式**:
    - **默认两片**: Stage A + Stage C (跳过 Stub)。
    - **可选三片**: Stage A + Stage B + Stage C (复杂/涉及 Obsidian DOM 深度拦截推荐)。

### 4.2 资产分级治理 (Asset Grading) `[K-ASSET]`
- **Solid-Strict (强管制)**: 核心配置文件与构建定义。
  - **资产清单**: `package.json`, `manifest.json`, `tsconfig.json`, `esbuild.config.mjs`。
  - **动作**: 必须在 `03_决策日志 (ADR).md` 登记新条目，并提供任务级 `Approval_Hash`。
  - **证据**: 证据块必含 `ADR_Entry` 与 `Asset_Update`。
- **Solid-Regulated (受控)**: 核心系统组件、词干还原算法、数据存取机制。
  - **资产清单**: `src/main.ts` (入口/渲染拦截), `src/db/vocabulary.ts` (影子词库), `src/tokenizer/lemmatizer.ts` (还原算法)。
  - **动作**: 必须在 `03_决策日志 (ADR).md` 登记新条目。
  - **证据**: 证据块必含 `ADR_Entry` 与 `Asset_Update`。
- **Liquid (流动)**: UI 面板及辅助逻辑、样式。
  - **资产清单**: `src/ui/Panel.vue` (UI), `src/event/EventBus.ts` (事件解耦), `src/styles.css` (气泡样式), `src/generator/contextNote.ts` (卡片生成)。
  - **动作**: 自由演进，无需 ADR。
  - **证据**: 满足标准证据链即可。

### 4.3 反向测试证明 (Reverse Testing) `[K-TEST]`
- **场景**: 词形还原、本地影子词库的并发队列锁、提取上下文整句逻辑。
- **流程**: 先写测试证明其失败 (Red) -> 实现业务 (Green) -> 故意破坏业务逻辑再次确认失败 (Destructive) -> 恢复 (Recover)。

### 4.4 验证证据标准 (Evidence Standard) `[K-EVIDENCE]`
交付物必须包含以下标准键名的证据块。

**标准交付模板 (Copy-paste Ready)**:
```markdown
### 📢 Verification Evidence (IDE)
- **Compliance_Status**: 🟢 [Pass] | ⚠️ [Warning] | 🔴 [Partial]
- **Context_Log**: [Pack-0/1/2] + [Extra Files]
- **Diff_Summary**: [改动文件数] | [逻辑摘要]
- **Test_Run**: [esbuild build/vitest] -> [Pass/Total] | [Result Summary]
- **Scan_Result**: [eslint] -> [Block/Critical Errors Count]
- **Asset_Update**: [Solid-Strict/Regulated 的变更留痕 | Liquid-only 写 NO_CHANGE]
- **ADR_Entry**: [ADR-ID] -> [Decision Point Review | Liquid-only 写 N/A]
- **Reverse_Proof**: [Position] -> [Expected Error] -> [Recovered | 若不适用写 N/A]
```

### 4.5 信心评分标准 (Confidence Score) `[K-SCORE]`
每次主要交互必须输出 **Confidence Score Card** (整数 0-100)：
- **[90 - 100] (Pass)**: 路径清晰，证据齐备，准予执行。
- **[80 - 89] (Warning)**: 存在模糊点或潜在风险（如涉及移动端沙盒读写安全性），需人类介入或 ACK。
- **[0 - 79] (Block)**: 关键缺失或严重歧义（如未经测试直接调用 node fs），强制熔断 (Circuit Break)。

**Score Card 模板**:
```markdown
### 🧠 Confidence Score Card
- **Score**: [0-100]
- **Status**: [🟢/⚠️/🔴]
- **Reasoning**: [打分逻辑简述]
- **Gaps**: [遗留风险/知识盲区]
- **Action**: [Proceed | Need_ACK | Circuit_Break]
```

## 5. 架构决策记录 (ADR Rules) `[K-ADR]`
- **触发条件**: 修改 `Solid Asset` 或引入新的第三方库、重大设计变更（如接入云端翻译 API）。
- **存储位置**: `Sentinel-K_内核/03_决策日志 (ADR).md`。

---
> *修订记录:*
> - *2026-05-23 - 适配 Obsidian Language Learner TypeScript/Vue 3 纯前端架构体系*
