# 04_答疑库 (FAQ)

> [!TIP]
> **用途**: 记录项目特有的坑点、环境配置难点、以及 AI 经常犯错的领域知识。

## 1. 环境与配置
- **问题**: esbuild 打包 `.vue` 单文件组件时报错：无法解析模块或模板。
- **场景**: 运行 `npm run dev` 或 `npm run build` 进行插件编译时。
- **方案**: 
  1. 确保安装了开发依赖 `esbuild-plugin-vue3`。
  2. 在 `esbuild.config.mjs` 的 plugins 列表中注册该插件：`plugins: [vuePlugin()]`。
  3. 注意，由于 Obsidian 只支持 CommonJS (`cjs`) 模块加载，我们在打包 Vue 时要确保 esbuild 将所有 Vue 核心代码内联打包进 `main.js`（即不将 `vue` 设为 external）。

## 2. 移动端真机沙盒避坑
- **问题**: 在 iPad/iPhone/Android 等移动端 Obsidian 激活插件时直接闪退或报错 `Module not found: 'fs'`。
- **场景**: 插件初始化或进行词库读写（I/O）时。
- **对策**: 
  1. 绝对禁止在 `src/` 的任何代码中 `import fs from 'fs'` 或使用 `path.join`。
  2. 必须全部采用 Obsidian 底座的 `this.app.vault.adapter` 接口。
  3. 对所有文件的路径，使用 `this.app.vault.adapter.normalizePath(path)` 标准化。

## 3. 前端交互与高亮
- **问题**: 修改单词状态时，文档中其他位置的相同单词没有实时褪色，或者页面出现卡顿。
- **对策**:
  1. 状态变更时不要触发 Obsidian 的全页重绘（Markdown 重新解析），这会导致极其严重的性能微卡顿。
  2. 正确的做法是：使用增量刷新。通过 `document.querySelectorAll(`span[data-lemma="${lemma}"]`)` 获取所有相同词的 DOM 节点，用 `classList.remove` 和 `classList.add` 微秒级切换样式。

## 4. 调试沙盒与卸载问题
- **问题**: 在 Obsidian 中点击“卸载（Uninstall）”后，重新刷新插件列表却发现插件彻底消失了。
- **场景**: 在真机测试沙盒与本地开发工作区进行软链接联调时。
- **对策**:
  1. 在本地联调开发时，不要在 Obsidian 的设置界面点击“卸载”按钮。因为卸载命令会物理删除测试沙盒下 `.obsidian/plugins/obsidian-english-learner` 目录，这会把指向我们工作区的软链接物理删掉。
  2. 若误操作导致链接消失，必须在终端中重新运行命令以恢复软链接：
     `ln -sf "/Users/up_dong/Documents/open_workspace/obsidian-english-learner" "/Users/up_dong/Documents/Obsidian-Dev-Sandbox/.obsidian/plugins/obsidian-english-learner"`
  3. 日常调试停用插件时，只需**关闭列表右侧的启用开关**即可，不要点击“卸载”按钮。
