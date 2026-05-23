import { Plugin } from 'obsidian';

export default class EnglishLearnerPlugin extends Plugin {
    async onload() {
        console.log('🚀 Obsidian English Learner 插件成功在沙盒中加载！');
    }

    async onunload() {
        console.log('⚡ Obsidian English Learner 插件已安全卸载。');
    }
}