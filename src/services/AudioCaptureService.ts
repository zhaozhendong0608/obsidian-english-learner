/**
 * 音频采集服务
 * 负责麦克风捕获、16kHz 重采样与 Blob 生成
 */

/**
 * 音频采集服务类
 */
export class AudioCaptureService {
    private mediaStream: MediaStream | null = null;
    private mediaRecorder: MediaRecorder | null = null;
    private audioContext: AudioContext | null = null;
    private audioChunks: Blob[] = [];

    /**
     * 启动麦克风捕获
     * @throws 如果用户拒绝麦克风权限或浏览器不支持
     */
    async startRecording(): Promise<void> {
        try {
            // 请求麦克风权限
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,  // 单声道
                    sampleRate: 48000, // 高采样率（后续重采样为 16kHz）
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // 初始化 MediaRecorder
            this.audioChunks = [];
            this.mediaRecorder = new MediaRecorder(this.mediaStream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.start();
            console.log('[AudioCaptureService] 录音已启动');
        } catch (error: any) {
            console.error('[AudioCaptureService] 启动录音失败:', error);
            let userFriendlyMsg = '无法启动录音。';
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                userFriendlyMsg = '麦克风权限被拒绝。请在系统设置和 Obsidian 中开启麦克风使用权限，然后重试。';
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                userFriendlyMsg = '未检测到麦克风设备，请检查是否正确插入麦克风。';
            } else {
                userFriendlyMsg = `麦克风获取失败 (${error.name || '未知类型'}): ${error.message || String(error)}`;
            }
            throw new Error(userFriendlyMsg);
        }
    }

    /**
     * 获取当前录制媒体流
     */
    getStream(): MediaStream | null {
        return this.mediaStream;
    }

    /**
     * 停止录音并返回音频 Blob
     * @returns 录音的 Blob 对象（audio/webm 格式）
     */
    async stopRecording(): Promise<Blob> {
        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder) {
                reject(new Error('MediaRecorder 未初始化'));
                return;
            }

            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
                console.log('[AudioCaptureService] 录音已停止，Blob 大小:', blob.size);
                resolve(blob);
            };

            this.mediaRecorder.onerror = (event) => {
                reject(new Error(`录音错误: ${event}`));
            };

            this.mediaRecorder.stop();

            // 停止媒体流
            if (this.mediaStream) {
                this.mediaStream.getTracks().forEach(track => track.stop());
            }
        });
    }

    /**
     * 将音频重采样为 16kHz 单声道格式（Whisper 要求）
     * @param audioBuffer 原始音频 Buffer
     * @returns 16kHz 单声道的 Float32Array
     */
    async resampleTo16kHz(audioBuffer: AudioBuffer): Promise<Float32Array> {
        const targetSampleRate = 16000;
        const sourceSampleRate = audioBuffer.sampleRate;

        // 如果已经是 16kHz 单声道，直接返回
        if (sourceSampleRate === targetSampleRate && audioBuffer.numberOfChannels === 1) {
            return audioBuffer.getChannelData(0);
        }

        // 创建离线音频上下文进行重采样
        const offlineContext = new OfflineAudioContext(
            1, // 单声道
            Math.ceil(audioBuffer.duration * targetSampleRate),
            targetSampleRate
        );

        // 创建音频源
        const source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineContext.destination);
        source.start(0);

        // 渲染重采样后的音频
        const resampledBuffer = await offlineContext.startRendering();
        const resampledData = resampledBuffer.getChannelData(0);

        console.log('[AudioCaptureService] 重采样完成:', {
            原始采样率: sourceSampleRate,
            目标采样率: targetSampleRate,
            原始长度: audioBuffer.length,
            重采样长度: resampledData.length
        });

        return resampledData;
    }

    /**
     * 将 Blob 转换为 AudioBuffer
     * @param blob 音频 Blob
     * @returns AudioBuffer 对象
     */
    async blobToAudioBuffer(blob: Blob): Promise<AudioBuffer> {
        // 创建 AudioContext（如果不存在）
        if (!this.audioContext) {
            this.audioContext = new AudioContext();
        }

        // 将 Blob 转换为 ArrayBuffer
        const arrayBuffer = await blob.arrayBuffer();

        // 解码音频数据
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

        console.log('[AudioCaptureService] Blob 转换为 AudioBuffer:', {
            采样率: audioBuffer.sampleRate,
            声道数: audioBuffer.numberOfChannels,
            时长: audioBuffer.duration.toFixed(2) + 's'
        });

        return audioBuffer;
    }

    /**
     * 释放所有资源（停止媒体流、关闭 AudioContext）
     */
    dispose(): void {
        console.log('[AudioCaptureService] 释放资源');

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }

        if (this.mediaRecorder) {
            if (this.mediaRecorder.state !== 'inactive') {
                this.mediaRecorder.stop();
            }
            this.mediaRecorder = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.audioChunks = [];
    }
}
