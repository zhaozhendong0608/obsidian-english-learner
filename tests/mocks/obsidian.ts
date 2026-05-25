export class Notice {
    constructor(public message: string, public duration?: number) {}
}

export class Plugin {
    constructor(public app: any, public manifest: any) {}
    onload() {}
    onunload() {}
    registerView() {}
    registerEvent() {}
    registerMarkdownPostProcessor() {}
    registerEditorSuggest() {}
    addRibbonIcon() { return { addClass: () => {} }; }
    addSettingTab() {}
    loadData() { return Promise.resolve({}); }
    saveData() { return Promise.resolve(); }
}

export class ItemView {
    constructor(public leaf: any) {}
}

export class WorkspaceLeaf {}

export class MarkdownView {}

export class EditorSuggest {
    constructor(public app: any) {}
}

export class TFile {}

export class App {
    public vault = {
        adapter: {
            exists: async () => false,
            read: async () => "",
            write: async () => {},
            remove: async () => {},
        },
        getName: () => "MockVault",
        getAbstractFileByPath: () => null,
    };
    public workspace = {
        getLeavesOfType: () => [],
        getRightLeaf: () => null,
        revealLeaf: () => {},
        setActiveLeaf: () => {},
        getLeaf: () => ({ setViewState: async () => {} }),
    };
}

export const requestUrl = async (options: any) => {
    return {
        status: 200,
        headers: {},
        arrayBuffer: new ArrayBuffer(0),
        text: "",
        json: {}
    };
};

export const MarkdownRenderer = {
    renderMarkdown: async (markdown: string, el: HTMLElement, sourcePath: string, component: any) => {
        el.innerHTML = markdown;
    }
};
