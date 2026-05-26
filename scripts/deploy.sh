#!/bin/bash

# V4.0 一键部署脚本
# 用途：自动构建并部署插件到 Obsidian Vault

set -e  # 遇到错误立即退出

echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║              V4.0 端云协同口语评测引擎 - 一键部署脚本                         ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo ""

# 1. 检查当前目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误: 请在项目根目录下运行此脚本"
    exit 1
fi

# 2. 构建项目
echo "📦 步骤 1/4: 构建项目..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ 构建失败，请检查错误信息"
    exit 1
fi
echo "✅ 构建成功"
echo ""

# 3. 查找 Obsidian Vault 路径
echo "🔍 步骤 2/4: 查找 Obsidian Vault..."

# 常见 Vault 路径
VAULT_PATHS=(
    "$HOME/Documents/Obsidian"
    "$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents"
    "$HOME/Obsidian"
)

VAULT_PATH=""
for base_path in "${VAULT_PATHS[@]}"; do
    if [ -d "$base_path" ]; then
        # 查找第一个包含 .obsidian 目录的 Vault
        for vault in "$base_path"/*; do
            if [ -d "$vault/.obsidian" ]; then
                VAULT_PATH="$vault"
                break 2
            fi
        done
    fi
done

if [ -z "$VAULT_PATH" ]; then
    echo "⚠️  未找到 Obsidian Vault，请手动输入路径："
    read -p "Vault 路径: " VAULT_PATH

    if [ ! -d "$VAULT_PATH/.obsidian" ]; then
        echo "❌ 错误: 无效的 Vault 路径（缺少 .obsidian 目录）"
        exit 1
    fi
fi

echo "✅ 找到 Vault: $VAULT_PATH"
echo ""

# 4. 创建插件目录
PLUGIN_DIR="$VAULT_PATH/.obsidian/plugins/obsidian-english-learner"
echo "📁 步骤 3/4: 创建插件目录..."
mkdir -p "$PLUGIN_DIR/dist"
echo "✅ 插件目录: $PLUGIN_DIR"
echo ""

# 5. 拷贝文件
echo "📋 步骤 4/4: 拷贝文件..."

# 拷贝主文件
cp main.js "$PLUGIN_DIR/"
echo "  ✅ main.js"

cp styles.css "$PLUGIN_DIR/"
echo "  ✅ styles.css"

cp manifest.json "$PLUGIN_DIR/"
echo "  ✅ manifest.json"

# 拷贝 WASM 文件
if [ -d "dist" ]; then
    cp dist/*.wasm "$PLUGIN_DIR/dist/" 2>/dev/null || true
    WASM_COUNT=$(ls -1 "$PLUGIN_DIR/dist/"*.wasm 2>/dev/null | wc -l)
    echo "  ✅ WASM 文件 ($WASM_COUNT 个)"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║                            🎉 部署完成！                                      ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "📍 插件位置: $PLUGIN_DIR"
echo ""
echo "🚀 下一步操作："
echo "  1. 完全关闭 Obsidian (Cmd+Q)"
echo "  2. 重新打开 Obsidian"
echo "  3. 进入 设置 → 第三方插件"
echo "  4. 启用 'Obsidian English Learner' 插件"
echo ""
echo "📚 验证指南: 查看 LOCAL_VERIFICATION.md"
echo ""
