# 内存监控指南

## 🔍 Chrome DevTools 内存监控步骤

### 1. 打开 Obsidian 开发者工具
```bash
# macOS
Cmd + Option + I

# Windows/Linux
Ctrl + Shift + I
```

### 2. 切换到 Memory 面板
1. 点击顶部 "Memory" 标签
2. 选择 "Heap snapshot"
3. 点击 "Take snapshot" 按钮

### 3. 执行测试操作
```
基线快照 (Baseline)
  ↓
打开侧边栏 → 切换到"口语评测" Tab
  ↓
录制发音 #1 → 停止 → 查看结果
  ↓
录制发音 #2 → 停止 → 查看结果
  ↓
录制发音 #3 → 停止 → 查看结果
  ↓
录制发音 #4 → 停止 → 查看结果
  ↓
录制发音 #5 → 停止 → 查看结果
  ↓
关闭侧边栏（触发 onUnmounted 清理）
  ↓
等待 5 秒（让 GC 回收）
  ↓
最终快照 (Final)
```

### 4. 对比快照
1. 点击 "Take snapshot" 按钮（最终快照）
2. 在快照列表中选择 "Final"
3. 在顶部下拉框选择 "Comparison"
4. 选择对比基线 "Baseline"

### 5. 分析内存增长
查看以下指标：
- **Size Delta**: 内存增长量（应 < 10MB）
- **# New**: 新增对象数量
- **# Deleted**: 删除对象数量
- **# Delta**: 净增对象数量（应接近 0）

### 6. 检查泄漏对象
在 "Class filter" 输入框搜索：
- `Blob` - 验证录音 Blob 已释放
- `Worker` - 验证 Worker 已销毁
- `AudioContext` - 验证 AudioContext 已关闭
- `MediaStream` - 验证媒体流已停止

---

## 📊 预期内存基线

### 正常内存增长（可接受）
- **首次打开侧边栏**: +2-5MB（Vue 组件初始化）
- **首次加载 WASM Worker**: +5-10MB（Worker 线程 + WASM 模块）
- **单次录音**: +0.5-2MB（音频 Blob + 临时缓冲区）
- **5 次录音后**: +3-8MB（累计临时对象，GC 后应回收）

### 异常内存增长（需修复）
- **5 次录音后**: +20MB+（可能存在 Blob 泄漏）
- **关闭侧边栏后**: 内存未回收（Worker 未销毁）
- **切换 Tab 后**: 内存持续增长（事件监听器未清理）

---

## 🛠️ 内存泄漏排查清单

### 1. Blob URL 泄漏
**症状**: 每次录音后内存增长 2-5MB，关闭侧边栏后不回收

**排查代码**:
```typescript
// src/ui/components/PronunciationTab.vue
const playUserAudio = () => {
  if (recordingBlob.value) {
    const blobUrl = URL.createObjectURL(recordingBlob.value);
    const audio = new Audio(blobUrl);
    audio.play();

    // ✅ 必须在播放结束后释放
    audio.onended = () => {
      URL.revokeObjectURL(blobUrl);
    };
  }
};
```

**验证方法**:
1. 在 DevTools Console 输入: `performance.memory.usedJSHeapSize`
2. 录制 5 次发音
3. 再次输入: `performance.memory.usedJSHeapSize`
4. 对比增长量（应 < 10MB）

---

### 2. Worker 未销毁
**症状**: 关闭侧边栏后，Worker 线程仍在运行

**排查代码**:
```typescript
// src/ui/components/PronunciationTab.vue
onUnmounted(() => {
  // ✅ 必须终止 Worker
  if (whisperWorker) {
    whisperWorker.terminate();
    whisperWorker = null;
  }
});
```

**验证方法**:
1. 打开 DevTools → Sources → Threads
2. 打开侧边栏 → 切换到"口语评测" Tab
3. 验证出现 "whisper-worker.ts" 线程
4. 关闭侧边栏
5. 验证 "whisper-worker.ts" 线程消失

---

### 3. AudioContext 未关闭
**症状**: 录音停止后，AudioContext 仍占用音频资源

**排查代码**:
```typescript
// src/services/AudioCaptureService.ts
dispose(): void {
  // ✅ 必须关闭 AudioContext
  if (this.audioContext) {
    this.audioContext.close();
    this.audioContext = null;
  }
}
```

**验证方法**:
1. 在 DevTools Console 输入: `navigator.mediaDevices.enumerateDevices()`
2. 录制发音
3. 停止录音
4. 再次输入: `navigator.mediaDevices.enumerateDevices()`
5. 验证麦克风设备状态为 "inactive"

---

### 4. 事件监听器未清理
**症状**: 切换 Tab 后，事件监听器仍在触发

**排查代码**:
```typescript
// src/ui/components/PronunciationTab.vue
onMounted(() => {
  eventBus.on('lang-learner:accent-changed', handleAccentChange);
});

onUnmounted(() => {
  // ✅ 必须移除事件监听器
  eventBus.off('lang-learner:accent-changed', handleAccentChange);
});
```

**验证方法**:
1. 在 DevTools Console 输入: `window.eventBus = eventBus`（临时暴露）
2. 打开侧边栏 → 切换到"口语评测" Tab
3. 输入: `eventBus.listeners.get('lang-learner:accent-changed').length`
4. 关闭侧边栏
5. 输入: `eventBus.listeners.get('lang-learner:accent-changed').length`
6. 验证监听器数量减少

---

## ✅ 内存监控通过标准

### 基线快照 vs 最终快照
- **Size Delta**: < 10MB
- **# Delta**: < 100 个对象
- **Blob 对象**: 0 个残留
- **Worker 线程**: 已终止
- **AudioContext**: 已关闭
- **事件监听器**: 已清理

### 性能指标
- **首次 Worker 初始化**: < 1 秒
- **单次录音处理**: < 2 秒
- **AI 诊断请求**: < 5 秒
- **内存峰值**: < 100MB（不含 WASM 模块）

---

## 🚨 已知问题与缓解措施

### 1. WASM 模块内存占用
**问题**: ONNX Runtime WASM 模块加载后占用 40-50MB 内存

**缓解措施**:
- Worker 线程隔离，不影响主线程
- 关闭侧边栏后 Worker 自动销毁，内存回收
- 移动端检测设备性能，低端设备禁用 WASM 功能

### 2. 录音 Blob 临时占用
**问题**: 录音 Blob 在播放期间占用 1-3MB 内存

**缓解措施**:
- 播放结束后立即调用 `URL.revokeObjectURL()`
- 切换 Tab 或关闭侧边栏时清空 `recordingBlob.value`

### 3. Vue 组件内存占用
**问题**: Vue 3 组件初始化占用 2-5MB 内存

**缓解措施**:
- 正常范围，Vue 3 响应式系统开销
- 组件卸载后内存自动回收

---

## 📝 内存监控报告模板

```markdown
## 内存监控报告

**测试日期**: YYYY-MM-DD
**测试环境**: [操作系统 + Obsidian 版本]

### 快照对比
- 基线快照: 45.2 MB
- 最终快照: 52.8 MB
- Size Delta: +7.6 MB ✅

### 对象统计
- # New: 1,234
- # Deleted: 1,189
- # Delta: +45 ✅

### 泄漏检查
- Blob 对象: 0 个 ✅
- Worker 线程: 已终止 ✅
- AudioContext: 已关闭 ✅
- 事件监听器: 已清理 ✅

### 结论
✅ 内存监控通过，无明显泄漏
```
