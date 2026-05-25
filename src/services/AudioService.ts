import { requestUrl } from 'obsidian';

export interface VoiceSettings {
    engine: string; // 'online' | 'local'
    onlineAccent: number; // 1: 英音, 2: 美音
    voiceName: string;
    rate: number;
    pitch: number;
}

export class AudioService {
    private currentAudio: HTMLAudioElement | null = null;
    private speakRequestVersion = 0;

    /**
     * 停止所有音频播放
     */
    public stopAllAudio(): void {
        if (this.currentAudio) {
            try {
                this.currentAudio.pause();
                this.currentAudio.currentTime = 0;
            } catch (e) {
                // 忽略清理报错
            }
            this.currentAudio = null;
        }
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
    }

    /**
     * 网络获取并播放音频流，播放成功返回 true，失败抛出异常
     */
    private async fetchAndPlayAudio(url: string, version: number): Promise<boolean> {
        // 在异步请求完毕后，随时检查版本号，如果版本号变了代表被截断
        if (version !== this.speakRequestVersion) {
            throw new Error('播放已被更新的播放请求取消');
        }

        try {
            const response = await requestUrl({
                url,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
                },
                throw: true
            });

            if (version !== this.speakRequestVersion) {
                throw new Error('播放已被更新的播放请求取消');
            }

            if (response.status === 200 && response.arrayBuffer) {
                const blob = new Blob([response.arrayBuffer], { type: 'audio/mpeg' });
                const blobUrl = URL.createObjectURL(blob);
                const audio = new Audio(blobUrl);
                this.currentAudio = audio;

                return new Promise((resolve, reject) => {
                    audio.onended = () => {
                        URL.revokeObjectURL(blobUrl);
                        resolve(true);
                    };
                    audio.onerror = () => {
                        URL.revokeObjectURL(blobUrl);
                        reject(new Error('音频解码或播放失败'));
                    };
                    audio.play().catch(err => {
                        URL.revokeObjectURL(blobUrl);
                        reject(err);
                    });
                });
            }
            throw new Error(`网络响应状态错误: ${response.status}`);
        } catch (e) {
            // 常规环境 fallback
            if (version !== this.speakRequestVersion) {
                throw new Error('播放已被更新的播放请求取消');
            }
            const audio = new Audio(url);
            this.currentAudio = audio;
            return new Promise((resolve, reject) => {
                audio.onended = () => resolve(true);
                audio.onerror = () => reject(new Error('HTMLAudioElement 播放失败'));
                audio.play().catch(reject);
            });
        }
    }

    /**
     * 发音入口，自适应多源路由
     */
    public async speak(
        text: string,
        settings: VoiceSettings,
        availableVoices: SpeechSynthesisVoice[],
        onBoundary?: (charIndex: number) => void,
        onEnd?: () => void
    ): Promise<void> {
        if (!text || !text.trim()) return;

        const currentVersion = ++this.speakRequestVersion;
        this.stopAllAudio();

        try {
            if (settings.engine === 'online') {
                const accent = settings.onlineAccent || 2;
                
                // 长句自动回退到本地系统发音，防止接口超载/报错
                if (text.trim().length > 180) {
                    this.playLocalVoice(text, settings, availableVoices, currentVersion, onBoundary, onEnd);
                    return;
                }
                
                // 1. 有道源
                try {
                    const youdaoUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=${accent}`;
                    await this.fetchAndPlayAudio(youdaoUrl, currentVersion);
                    if (onEnd) onEnd();
                    return;
                } catch (err1) {
                    if (currentVersion !== this.speakRequestVersion) return;
                    console.warn('有道在线发音源请求异常，自动尝试备用谷歌源:', err1);
                }

                // 2. 谷歌源
                try {
                    const tl = accent === 2 ? 'en-US' : 'en-GB';
                    const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${tl}&client=tw-ob`;
                    await this.fetchAndPlayAudio(googleUrl, currentVersion);
                    if (onEnd) onEnd();
                    return;
                } catch (err2) {
                    if (currentVersion !== this.speakRequestVersion) return;
                    console.error('所有在线发音源均加载失败，降级回退系统合成:', err2);
                    this.playLocalVoice(text, settings, availableVoices, currentVersion, onBoundary, onEnd);
                }
            } else {
                if (currentVersion !== this.speakRequestVersion) return;
                this.playLocalVoice(text, settings, availableVoices, currentVersion, onBoundary, onEnd);
            }
        } catch (e) {
            if (currentVersion !== this.speakRequestVersion) return;
            console.error('发音路由链条异常，强制回退本地播放:', e);
            this.playLocalVoice(text, settings, availableVoices, currentVersion, onBoundary, onEnd);
        }
    }

    /**
     * 播放本地系统离线发音，并支持意群微调及高亮回调
     */
    private playLocalVoice(
        text: string,
        settings: VoiceSettings,
        availableVoices: SpeechSynthesisVoice[],
        version: number,
        onBoundary?: (charIndex: number) => void,
        onEnd?: () => void
    ): void {
        if (typeof window === 'undefined' || !window.speechSynthesis) {
            console.warn('当前环境不支持 SpeechSynthesis');
            if (onEnd) onEnd();
            return;
        }

        window.speechSynthesis.cancel();

        interface SpeechSegment {
            text: string;
            pauseMs: number;
            rateMultiplier: number;
            startOffset: number;
        }

        const segments: SpeechSegment[] = [];
        const puncRegex = /([,.;:!?，。；：！？]+)/g;
        const parts = text.split(puncRegex);
        
        const structureWords = /\b(because|although|though|however|therefore|nevertheless|if|when|while|before|after|since|until|unless|but|so|that|which|who|whom|whose)\b/i;
        const prepositionWords = /\b(in|on|at|by|for|with|about|of|from|to|as)\b/i;
        const slowWords = /\b(because|although|though|however|therefore|nevertheless|especially|particularly|refuse|believe|bankrupt|insufficient|opportunity)\b/i;

        let currentOffset = 0;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!part) continue;
            
            const partLen = part.length;
            const partStart = currentOffset;
            currentOffset += partLen;

            if (part.match(/[,.;:!?，。；：！？]+/)) {
                let pauseMs = 350;
                if (part.match(/[.!?。！？]/)) {
                    pauseMs = 700;
                }
                if (segments.length > 0) {
                    segments[segments.length - 1].pauseMs = pauseMs;
                }
            } else {
                const words = part.split(/(\s+)/);
                let currentGroup = '';
                let groupStartOffset = partStart;
                let lastWordOffset = partStart;

                for (let j = 0; j < words.length; j++) {
                    const word = words[j];
                    const cleanWord = word.trim().toLowerCase();
                    const wordLen = word.length;
                    
                    const isMajor = structureWords.test(cleanWord);
                    const isMinor = prepositionWords.test(cleanWord);
                    const currentLen = currentGroup.trim().length;
                    
                    if ((isMajor && currentLen > 18) || (isMinor && currentLen > 28)) {
                        const groupText = currentGroup.trim();
                        let rateMultiplier = 1.0;
                        if (slowWords.test(groupText)) {
                            rateMultiplier = 0.88;
                        } else if (groupText.length < 15) {
                            rateMultiplier = 1.05;
                        }

                        segments.push({
                            text: groupText,
                            pauseMs: 150,
                            rateMultiplier,
                            startOffset: groupStartOffset
                        });

                        currentGroup = word;
                        groupStartOffset = lastWordOffset;
                    } else {
                        currentGroup += word;
                    }
                    lastWordOffset += wordLen;
                }

                if (currentGroup.trim()) {
                    const groupText = currentGroup.trim();
                    let rateMultiplier = 1.0;
                    if (slowWords.test(groupText)) {
                        rateMultiplier = 0.88;
                    } else if (groupText.length < 15) {
                        rateMultiplier = 1.05;
                    }
                    segments.push({
                        text: groupText,
                        pauseMs: 0,
                        rateMultiplier,
                        startOffset: groupStartOffset
                    });
                }
            }
        }

        if (segments.length === 0) {
            if (onEnd) onEnd();
            return;
        }

        let currentIndex = 0;
        const playNext = () => {
            if (currentIndex >= segments.length) {
                if (onEnd) onEnd();
                return;
            }
            if (version !== this.speakRequestVersion) return;
            
            const segment = segments[currentIndex];
            const utterance = new SpeechSynthesisUtterance(segment.text);
            
            if (settings.voiceName) {
                const matched = availableVoices.find(v => v.name === settings.voiceName);
                if (matched) utterance.voice = matched;
            }
            
            utterance.rate = settings.rate * segment.rateMultiplier;
            utterance.pitch = settings.pitch;
            
            utterance.onboundary = (event) => {
                if (version !== this.speakRequestVersion) return;
                if (event.name !== 'word') return;
                
                const absoluteCharIndex = segment.startOffset + event.charIndex;
                if (onBoundary) {
                    onBoundary(absoluteCharIndex);
                }
            };

            utterance.onend = () => {
                if (version !== this.speakRequestVersion) return;
                currentIndex++;
                if (currentIndex < segments.length) {
                    setTimeout(playNext, segment.pauseMs);
                } else {
                    if (onEnd) onEnd();
                }
            };
            
            utterance.onerror = (e) => {
                console.error('本地合成播放片段失败:', e);
                if (version !== this.speakRequestVersion) return;
                currentIndex++;
                playNext();
            };
            
            window.speechSynthesis.speak(utterance);
        };
        
        playNext();
    }
}
