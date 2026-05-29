# 🔄 强制重新加载插件指南

## 问题现象
- 英文联想正常工作
- 中文联想（`::掌`）不工作
- 控制台没有 `[WordSuggest]` 日志输出
- 说明 Obsidian 缓存了旧版本代码

## 🔧 解决方案

### 方法 1: 强制重新加载（推荐）

1. **完全退出 Obsidian**
   - 按 `Cmd+Q` 完全退出（不是关闭窗口）
   - 确保 Dock 栏中没有 Obsidian 图标

2. **清除 Obsidian 缓存**（可选，如果方法 1 不行）
   ```bash
   rm -rf ~/Library/Application\ Support/obsidian/Cache
   rm -rf ~/Library/Application\ Support/obsidian/Code\ Cache
   ```

3. **重新打开 Obsidian**

4. **验证插件版本**
   - 打开控制台（`Cmd+Option+I`）
   - 输入以下命令：
     ```javascript
     app.plugins.plugins['obsidian-english-immersion-reader'].manifest.version
     ```
   - 应该显示 `"1.0.0"`

5. **测试功能**
   - 在编辑器中输入 `ms`，观察控制台是否有日志：
     ```
     [WordSuggest] onTrigger called - textBefore: "ms" length: 2
     ```
   - 如果有日志，再输入 `::掌`，应该看到：
     ```
     [WordSuggest] onTrigger called - textBefore: "::掌" length: 3
     [WordSuggest] chineseMatch: ["::掌", "掌", ...]
     [WordSuggest] ✅ 中译英模式触发 - chineseQuery: 掌
     ```

---

### 方法 2: 禁用并重新启用插件

1. 打开 Obsidian 设置 → 社区插件
2. 找到 "Obsidian English Immersion Reader"
3. 点击开关**禁用**它
4. 等待 2 秒
5. 再次点击开关**启用**它
6. 按 `Cmd+R` 刷新 Obsidian

---

### 方法 3: 开发者模式强制刷新

1. 打开控制台（`Cmd+Option+I`）
2. 右键点击刷新按钮，选择 **"清空缓存并硬性重新加载"**
3. 或者按 `Cmd+Shift+R`（强制刷新）

---

## ✅ 验证成功标志

当您在编辑器中输入任何内容时，控制台应该持续输出日志：

```
[WordSuggest] onTrigger called - textBefore: "m" length: 1
[WordSuggest] ❌ 未匹配任何模式

[WordSuggest] onTrigger called - textBefore: "ms" length: 2
[WordSuggest] ✅ 英文模式触发 - query: ms

[WordSuggest] onTrigger called - textBefore: "::" length: 2
[WordSuggest] ❌ 未匹配任何模式

[WordSuggest] onTrigger called - textBefore: "::掌" length: 3
[WordSuggest] chineseMatch: ["::掌", "掌", index: 0, input: "::掌", groups: undefined]
[WordSuggest] ✅ 中译英模式触发 - chineseQuery: 掌
```

---

## 🐛 如果还是不行

请截图以下内容：
1. 控制台完整日志（包括所有输出）
2. 在控制台执行以下命令的结果：
   ```javascript
   app.plugins.plugins['obsidian-english-immersion-reader']
   ```
3. 文件修改时间：
   ```bash
   ls -la /Users/dongzi/Documents/工作/workplace_myself/obsidian-english-learner/main.js
   ```
