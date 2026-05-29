import { requestUrl, App } from 'obsidian';

export interface DownloadProgress {
    filename: string;
    loaded: number;
    total: number;
    percent: number;
    speed: string; // KB/s or MB/s
}

export type ProgressCallback = (progress: DownloadProgress) => void;

export class ModelDownloadService {
    private app: App;
    private pluginId: string = 'obsidian-english-immersion-reader';
    private modelsDir: string;

    constructor(app: App) {
        this.app = app;
        this.modelsDir = `.obsidian/plugins/${this.pluginId}/models`;
    }

    /**
     * 获取模型保存的本地相对路径
     */
    private getModelLocalPath(filename: string): string {
        return `${this.modelsDir}/${filename}`;
    }

    /**
     * 检查模型文件是否均已下载在本地
     */
    async checkIfModelsExist(): Promise<boolean> {
        const encoderPath = this.getModelLocalPath('encoder_model_quantized.onnx');
        const decoderPath = this.getModelLocalPath('decoder_model_merged_quantized.onnx');

        const encoderExists = await this.app.vault.adapter.exists(encoderPath);
        const decoderExists = await this.app.vault.adapter.exists(decoderPath);

        return encoderExists && decoderExists;
    }

    /**
     * 获取本地模型的 ArrayBuffer
     */
    async loadModelBuffer(filename: string): Promise<ArrayBuffer> {
        const localPath = this.getModelLocalPath(filename);
        if (!(await this.app.vault.adapter.exists(localPath))) {
            throw new Error(`本地模型文件 ${filename} 不存在，请先下载。`);
        }
        return await this.app.vault.adapter.readBinary(localPath);
    }

    /**
     * 下载模型文件并保存到本地
     */
    async downloadModel(
        filename: string,
        url: string,
        onProgress?: ProgressCallback
    ): Promise<void> {
        const localPath = this.getModelLocalPath(filename);

        // 确保 models 目录存在
        if (!(await this.app.vault.adapter.exists(this.modelsDir))) {
            await this.app.vault.adapter.mkdir(this.modelsDir);
        }

        console.log(`[ModelDownloadService] 开始下载模型 ${filename} 从 ${url}`);
        const startTime = Date.now();

        try {
            // 优先使用 browser fetch 以便支持流式进度监听
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP 错误: ${response.status} ${response.statusText}`);
            }

            const contentLength = response.headers.get('content-length');
            const total = contentLength ? parseInt(contentLength, 10) : 0;
            const reader = response.body?.getReader();

            if (!reader) {
                throw new Error('未获取到 ReadableStream 读者');
            }

            let loaded = 0;
            const chunks: Uint8Array[] = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                if (value) {
                    chunks.push(value);
                    loaded += value.length;

                    if (onProgress && total > 0) {
                        const elapsed = (Date.now() - startTime) / 1000;
                        const speedKb = elapsed > 0 ? (loaded / 1024) / elapsed : 0;
                        const speedStr = speedKb > 1024
                            ? `${(speedKb / 1024).toFixed(2)} MB/s`
                            : `${speedKb.toFixed(1)} KB/s`;

                        onProgress({
                            filename,
                            loaded,
                            total,
                            percent: Math.round((loaded / total) * 100),
                            speed: speedStr
                        });
                    }
                }
            }

            // 合并 chunks
            const resultBuffer = new Uint8Array(loaded);
            let offset = 0;
            for (const chunk of chunks) {
                resultBuffer.set(chunk, offset);
                offset += chunk.length;
            }

            // 保存到本地
            await this.app.vault.adapter.writeBinary(localPath, resultBuffer.buffer);
            console.log(`[ModelDownloadService] 模型 ${filename} 下载并保存成功`);

        } catch (error) {
            console.warn(`[ModelDownloadService] fetch 下载失败，尝试使用 requestUrl 兜底:`, error);
            
            // requestUrl 兜底（不支持进度，但可绕过某些跨域限制）
            if (onProgress) {
                onProgress({
                    filename,
                    loaded: 50,
                    total: 100,
                    percent: 50,
                    speed: '下载中...'
                });
            }

            const res = await requestUrl({
                url,
                method: 'GET',
                contentType: 'application/octet-stream'
            });

            if (res.status !== 200) {
                throw new Error(`兜底下载失败: 状态码 ${res.status}`);
            }

            await this.app.vault.adapter.writeBinary(localPath, res.arrayBuffer);
            console.log(`[ModelDownloadService] 模型 ${filename} 兜底下载并保存成功`);
            
            if (onProgress) {
                onProgress({
                    filename,
                    loaded: 100,
                    total: 100,
                    percent: 100,
                    speed: '已完成'
                });
            }
        }
    }
}
