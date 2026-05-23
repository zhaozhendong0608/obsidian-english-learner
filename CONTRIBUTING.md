# 🛠️ 开发者贡献与环境指南 (CONTRIBUTING.md)

本指南旨在帮助开发者快速在本地搭建开发、构建与调试环境。

---

## 1. 本地开发与测试库环境配置

### 1.1 测试沙盒初始化
新建开发沙盒：在本地建立一个干净的空库作为开发沙盒，路径命名为：
`/Users/up_dong/Documents/Obsidian-Dev-Sandbox`

执行以下命令，确保隐藏插件文件夹存在：
```bash
mkdir -p "/Users/up_dong/Documents/Obsidian-Dev-Sandbox/.obsidian/plugins"
```

### 1.2 代码与沙盒库的物理软链接
真实工程路径：`/Users/up_dong/Documents/open_workspace/obsidian-english-learner`。
在终端执行以下命令，将代码仓库软映射至沙盒中：
```bash
ln -s "/Users/up_dong/Documents/open_workspace/obsidian-english-learner" "/Users/up_dong/Documents/Obsidian-Dev-Sandbox/.obsidian/plugins/obsidian-english-learner"
```

---

## 2. 自动化构建与实时监听 (Watch Mode)

进入工程根目录，执行以下命令：
```bash
# 安装依赖
npm install

# 启动构建监听
npm run dev
```

### 热重载配置
1. 将社区提供的 `hot-reload` 调试插件放入沙盒库的 `.obsidian/plugins/hot-reload` 目录下并开启。
2. 一旦 `npm run dev` 侦测到代码改变并重写了打包产物 `main.js`，`hot-reload` 插件就会在 0.5 秒内静默刷新当前插件，免去手动重启的烦恼。

---

## 3. 控制台调试与断点排查

- **打开 DevTools**: 在 Mac 平台，按下快捷键 `Cmd + Option + I`（Windows 为 `Ctrl + Shift + I`）打开内置的 Chromium 开发者工具（DevTools）。
- **源码断点 (Sourcemaps)**: 在 DevTools 顶栏切换到 `Sources` 面板，按下 `Cmd + P`，输入 `main.ts` 即可进行源码级单步调试与断点排查。
- **命令行验证**: 通过 Console 标签页，可以直接与插件全局挂载的调试变量进行交互。
