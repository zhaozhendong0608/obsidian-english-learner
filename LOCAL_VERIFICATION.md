# V4.0 本地验证指南

## 🚀 快速开始

### 步骤 1: 构建插件
```bash
cd /Users/dongzi/Documents/工作/workplace_myself/obsidian-english-learner
npm run build
```

### 步骤 2: 查找 Obsidian 插件目录
Obsidian 插件通常位于以下路径之一：

**macOS**:
```bash
# 方法 1: 查找你的 Vault 路径
# 打开 Obsidian → 设置 → 关于 → 查看 "Vault 路径"
# 插件目录为: <Vault路径>/.obsidian/plugins/

# 方法 2: 常见位置
~/Documents/Obsidian/<你的Vault名称>/.obsidian/plugins/
~/Library/Mobile Documents/iCloud~md~obsidian/Documents/<你的Vault名称>/.obsidian/plugins/
```

### 步骤 3: 创建插件目录（如果不存在）
```bash
# 替换 <Vault路径> 为你的实际 Vault 路径
mkdir -p "<Vault路径>/.obsidian/plugins/obsidian-english-learner"
```

### 步骤 4: 拷贝构建产物
```bash
# 拷贝主文件
cp main.js "<Vault路径>/.obsidian/plugins/obsidian-english-learner/"
cp styles.css "<Vault路径>/.obsidian/plugins/obsidian-english-learner/"
cp manifest.json "<Vault路径>/.obsidian/plugins/obsidian-english-learner/"

# 创建 dist 目录并拷贝 WASM 文件
mkdir -p "<Vault路径>/.obsidian/plugins/obsidian-english-learner/dist"
cp dist/*.wasm "<Vault路径>/.obsidian/plugins/obsidian-english-learner/dist/"
```

### 步骤 5: 重启 Obsidian
1. 完全关闭 Obsidian（Cmd+Q）
2. 重新打开 Obsidian

### 步骤 6: 启用插件
1. 打开 Obsidian
2. 进入 **设置** → **第三方插件**
3. 关闭 **安全模式**（如果已开启）
4. 在 **已安装插件** 列表中找到 **Obsidian English Learner**
5. 点击切换按钮启用插件

---

## 🧪 功能验证清单

### 1. 基础功能验证（确保没有回归）

#### 1.1 分词高亮
```markdown
1. 创建新笔记，输入以下内容：
   The quick brown fox jumps over the lazy dog.

2. 验证：
   ✅ 单词自动分词高亮
   ✅ 点击单词，侧边栏自动打开
   ✅ 侧边栏显示单词详情
```

#### 1.2 单词输入联想
```markdown
1. 在编辑器中输入: app
2. 验证：
   ✅ 出现联想下拉框
   ✅ 显示 apple, application 等建议
   ✅ 选择建议后自动插入
```

---

### 2. V4.0 新增功能验证

#### 2.1 口语评测 Tab 显示
```markdown
1. 点击左侧 Ribbon 图标（书本图标）打开侧边栏
2. 验证：
   ✅ 顶部 Tab 栏出现 "🎤 口语评测" 按钮
   ✅ 点击后切换到口语评测界面
```

#### 2.2 录音功能
```markdown
1. 切换到 "🎤 口语评测" Tab
2. 点击 "🔴 开始录音" 按钮
3. 验证：
   ✅ 浏览器弹出麦克风权限请求
   ✅ 允许后按钮变为 "⏹️ 停止录音"
   ✅ 显示 "录音中..." 提示

4. 说出单词 "apple"（或任意英文单词）
5. 点击 "⏹️ 停止录音"
6. 验证：
   ✅ 显示 "处理中..." 提示
   ✅ 1-2 秒后显示音素对齐结果
   ✅ 显示总体评分（0-100 分）
   ✅ 音素列表中错误音素标红
```

#### 2.3 A/B 轨道对比
```markdown
1. 录音完成后，验证：
   ✅ 出现 "🔊 A/B 轨道对比" 区域
   ✅ 点击 "🅰️ 标准音" 播放 TTS 发音
   ✅ 点击 "🅱️ 我的录音" 播放用户录音
   ✅ 按钮高亮状态正确切换
```

#### 2.4 发音标准切换
```markdown
1. 在 "发音标准" 下拉框中选择 "🇬🇧 英式发音"
2. 验证：
   ✅ 下拉框显示更新
   ✅ 无报错

3. 切换回 "🇺🇸 美式发音"
4. 验证：
   ✅ 下拉框显示更新
```

#### 2.5 AI 诊断功能（需配置 API Key）
```markdown
⚠️ 前置条件：需要配置 DeepSeek API Key

1. 在侧边栏顶部展开 "AI 教师配置"
2. 填写：
   - API Key: 你的 DeepSeek API Key
   - Base URL: https://api.deepseek.com/v1
   - Model: deepseek-chat

3. 录制一次发音（确保有错误音素）
4. 点击 "💡 获取诊断建议"
5. 验证：
   ✅ 显示 "处理中..." 提示
   ✅ 3-5 秒后显示诊断报告
   ✅ 报告包含：总体评分、错误音素分析、改进建议
   ✅ Markdown 格式正确渲染（标题、列表、粗体等）
```

#### 2.6 主动催化伴写
```markdown
⚠️ 前置条件：需要先标记一些单词为 "学习中" 状态

1. 在编辑器中点击单词 "mitigate"
2. 在侧边栏标记为 "学习中"
3. 在编辑器中输入: red
4. 验证：
   ✅ 联想列表中出现 "mitigate"（如果符合临界条件）
   ✅ 显示 "🔥 临界复习" 标签（橙色）
   ✅ 临界生词排在列表最前面
```

---

## 🐛 常见问题排查

### 问题 1: 插件未出现在列表中
**原因**: 文件拷贝路径错误或 manifest.json 缺失

**解决方法**:
```bash
# 检查文件是否存在
ls -la "<Vault路径>/.obsidian/plugins/obsidian-english-learner/"

# 应该看到以下文件：
# main.js
# styles.css
# manifest.json
# dist/ort-wasm-simd-threaded.wasm (等 4 个 WASM 文件)
```

### 问题 2: 插件启用后报错
**原因**: 构建产物不完整或版本不匹配

**解决方法**:
```bash
# 重新构建
npm run build

# 重新拷贝所有文件
cp main.js styles.css manifest.json "<Vault路径>/.obsidian/plugins/obsidian-english-learner/"
cp dist/*.wasm "<Vault路径>/.obsidian/plugins/obsidian-english-learner/dist/"

# 完全重启 Obsidian
```

### 问题 3: 麦克风权限被拒绝
**原因**: 浏览器或系统麦克风权限未授予

**解决方法（macOS）**:
```markdown
1. 打开 **系统设置** → **隐私与安全性** → **麦克风**
2. 确保 **Obsidian** 已勾选
3. 重启 Obsidian
```

### 问题 4: Worker 初始化失败
**原因**: WASM 文件未正确拷贝

**解决方法**:
```bash
# 检查 WASM 文件是否存在
ls -lh "<Vault路径>/.obsidian/plugins/obsidian-english-learner/dist/"

# 应该看到 4 个 .wasm 文件（总计 74MB）
# 如果缺失，重新拷贝：
cp dist/*.wasm "<Vault路径>/.obsidian/plugins/obsidian-english-learner/dist/"
```

### 问题 5: AI 诊断请求失败
**原因**: API Key 未配置或网络错误

**解决方法**:
```markdown
1. 检查 API Key 是否正确填写
2. 检查网络连接
3. 打开 DevTools (Cmd+Option+I) 查看 Console 错误信息
4. 验证 API Key 是否有效：
   curl -X POST https://api.deepseek.com/v1/chat/completions \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"test"}]}'
```

---

## 🔍 开发者调试模式

### 打开 DevTools
```markdown
macOS: Cmd + Option + I
Windows/Linux: Ctrl + Shift + I
```

### 查看 Console 日志
```markdown
1. 切换到 "Console" 标签
2. 过滤日志: 输入 "PronunciationTab" 或 "WhisperWorker"
3. 查看关键日志：
   - [PronunciationTab] 开始录音
   - [AudioCaptureService] 录音已启动
   - [PronunciationTab] 停止录音
   - [WhisperWorker] 开始音素对齐
   - [PronunciationTab] 评测结果: {...}
```

### 内存监控（可选）
```markdown
1. 切换到 "Memory" 标签
2. 选择 "Heap snapshot"
3. 点击 "Take snapshot" (基线快照)
4. 录制 5 次发音
5. 再次点击 "Take snapshot" (最终快照)
6. 选择 "Comparison" 对比两个快照
7. 验证 Size Delta < 10MB
```

---

## ✅ 验证完成标准

### 最小验证集（必须通过）
- [ ] 插件成功加载，无报错
- [ ] "🎤 口语评测" Tab 正常显示
- [ ] 录音功能正常（麦克风权限、录音、停止）
- [ ] 音素对齐结果正常显示（音素列表、评分）
- [ ] A/B 轨道播放正常（标准音、用户录音）

### 完整验证集（推荐）
- [ ] 最小验证集全部通过
- [ ] 发音标准切换正常（美音/英音）
- [ ] AI 诊断功能正常（需配置 API Key）
- [ ] 主动催化伴写功能正常（临界生词推荐）
- [ ] 内存监控通过（5 次录音后内存增长 < 10MB）

---

## 📞 遇到问题？

如果验证过程中遇到问题：

1. **查看 Console 日志**: Cmd+Option+I → Console 标签
2. **检查文件完整性**: 确保所有文件已正确拷贝
3. **重新构建**: `npm run build` 后重新拷贝
4. **完全重启**: 关闭 Obsidian (Cmd+Q) 后重新打开

---

**祝验证顺利！🎉**
