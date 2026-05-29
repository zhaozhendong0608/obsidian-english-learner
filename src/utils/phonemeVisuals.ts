/**
 * 音素可视化映射数据
 * 定义 44 个英语常用音标到 12 种典型发音口腔剖面的映射
 * 提供完全一致的 SVG 贝塞尔路径结构以确保 CSS Morphing 动效平滑过渡
 */

export interface LipPaths {
    upper: string;
    lower: string;
}

export interface PhonemeVisualConfig {
    name: string;
    description: string;
    lips: LipPaths;
    tongue: string;
    jawYOffset: number; // 下颌/下齿的下移偏置
    airflow: string;    // 气流虚线箭头路径
    tips: string[];     // 教学纠偏要领
}

// 12 种发音口腔矢状剖面状态定义
export const PHONEME_VISUAL_STATES: Record<string, PhonemeVisualConfig> = {
    // 1. 双唇音 (如 /p/, /b/, /m/)
    bilabial: {
        name: '双唇音',
        description: '双唇紧闭阻碍气流，然后突然张开发出爆破音或通过鼻腔共鸣。',
        lips: {
            upper: 'M 105,75 Q 120,78 122,96 Q 112,94 105,88 Z',
            lower: 'M 98,135 Q 118,133 120,95 Q 110,115 98,118 Z'
        },
        tongue: 'M 40,160 C 50,135 75,135 90,143 C 98,147 100,153 98,160 Z',
        jawYOffset: 0,
        airflow: 'M 35,115 Q 70,115 100,115', // 气流阻断在双唇前
        tips: [
            '紧闭双唇，憋住气流。',
            '声带不振动（/p/）或振动（/b/），双唇突然张开，爆破而出。',
            '如果是鼻音 /m/，双唇保持紧闭，气流从鼻腔送出。'
        ]
    },

    // 2. 唇齿音 (如 /f/, /v/)
    labiodental: {
        name: '唇齿音',
        description: '上齿轻触下唇内侧，气流从缝隙中摩擦通过。',
        lips: {
            upper: 'M 105,75 Q 120,76 122,88 Q 112,86 105,82 Z',
            lower: 'M 98,135 Q 112,126 114,94 Q 106,110 98,118 Z' // 下唇向内缩，触碰上齿 (105, 95)
        },
        tongue: 'M 40,160 C 50,135 75,135 90,143 C 98,147 100,153 98,160 Z',
        jawYOffset: 2,
        airflow: 'M 35,115 Q 70,115 108,102', // 气流从唇齿缝隙擦出
        tips: [
            '上门齿轻轻贴在下唇内侧。',
            '让气流通过牙齿和嘴唇的窄缝摩擦而出。',
            '声带不振动为 /f/，振动为 /v/。'
        ]
    },

    // 3. 齿间音 (如 /θ/, /ð/)
    dental: {
        name: '齿间音 / 咬舌音',
        description: '舌尖轻轻置于上下齿之间，气流从舌齿缝隙中擦出。',
        lips: {
            upper: 'M 105,75 Q 120,74 122,86 Q 112,84 105,80 Z',
            lower: 'M 98,142 Q 118,138 120,110 Q 110,122 98,126 Z'
        },
        tongue: 'M 40,160 C 55,130 80,120 108,102 C 100,122 98,142 98,160 Z', // 舌尖伸出到 (108, 102) 齿间
        jawYOffset: 4,
        airflow: 'M 35,115 Q 70,110 114,103',
        tips: [
            '舌尖轻轻放于上下门牙之间，不要用力咬住。',
            '向外送气，让气流从舌头和上牙的夹缝中吹出。',
            '切忌读成 /s/ 或 /f/，注意保持“咬舌”状态。'
        ]
    },

    // 4. 舌尖齿龈音 (如 /t/, /d/, /s/, /z/, /n/, /l/)
    alveolar: {
        name: '舌尖齿龈音',
        description: '舌尖抵住上齿龈（牙龈），阻碍气流后突然释放或形成窄缝摩擦。',
        lips: {
            upper: 'M 105,75 Q 120,74 122,86 Q 112,84 105,80 Z',
            lower: 'M 98,142 Q 118,138 120,110 Q 110,122 98,126 Z'
        },
        tongue: 'M 40,160 C 55,115 80,105 104,95 C 100,115 98,135 98,160 Z', // 舌尖抵住上齿龈 (104, 95)
        jawYOffset: 2,
        airflow: 'M 35,115 Q 65,115 95,102', // 阻断在牙龈处
        tips: [
            '舌尖抵住上排牙齿后面的牙龈（上齿龈）。',
            '如果是爆破音 /t/, /d/，憋住气后舌尖突然弹开释放。',
            '如果是摩擦音 /s/, /z/，舌尖靠近但不贴死齿龈，留出极细缝隙。'
        ]
    },

    // 5. 舌叶硬腭音 (如 /ʃ/, /ʒ/, /tʃ/, /dʒ/, /j/, /r/)
    palatal_postalveolar: {
        name: '舌叶硬腭音 / 翘舌',
        description: '舌尖或舌叶抬起靠近硬腭，双唇略微向前突出呈喇叭状。',
        lips: {
            upper: 'M 105,75 Q 125,75 128,94 Q 115,92 105,86 Z', // 嘴唇稍微突起
            lower: 'M 98,135 Q 125,132 126,106 Q 112,116 98,120 Z'
        },
        tongue: 'M 40,160 C 55,110 85,108 98,118 C 101,128 100,148 98,160 Z',
        jawYOffset: 3,
        airflow: 'M 35,115 Q 65,110 110,100',
        tips: [
            '舌尖抬起，舌叶靠近上齿龈后方的硬腭，但不要贴死。',
            '嘴唇微噘，略呈喇叭状（圆唇突出）。',
            '送气时让气流通过舌面和硬腭之间的宽缝摩擦而出。'
        ]
    },

    // 6. 舌后软腭音 (如 /k/, /g/, /ŋ/)
    velar: {
        name: '舌后软腭音',
        description: '舌后部隆起抬高，抵住上腭后部的软腭，阻断气流。',
        lips: {
            upper: 'M 105,75 Q 120,74 122,86 Q 112,84 105,80 Z',
            lower: 'M 98,142 Q 118,138 120,110 Q 110,122 98,126 Z'
        },
        tongue: 'M 40,160 C 52,90 70,110 85,135 C 92,142 98,150 98,160 Z', // 舌后部隆起贴住软腭
        jawYOffset: 4,
        airflow: 'M 35,115 Q 50,105 60,95', // 气流阻断在喉部上方软腭处
        tips: [
            '舌头后部（舌根）高高抬起，顶住软腭（悬雍垂前方那一块软的区域）。',
            '憋住气流，然后舌根突然弹开释放，气流冲出发出爆破音。',
            '如果是鼻音 /ŋ/，舌根保持贴紧软腭，气流由鼻腔送出。'
        ]
    },

    // 7. 前闭元音 (如 /iː/, /ɪ/)
    vowel_close_front: {
        name: '前闭元音 / 扁唇高舌',
        description: '口型扁平呈微笑状，前舌抬高靠近硬腭，上下齿间距极小。',
        lips: {
            upper: 'M 105,75 Q 120,72 122,80 Q 112,78 105,76 Z', // 扁平开合
            lower: 'M 98,138 Q 118,135 120,116 Q 110,124 98,128 Z'
        },
        tongue: 'M 40,160 C 55,110 85,108 98,118 C 101,128 100,148 98,160 Z', // 前舌高抬
        jawYOffset: 2,
        airflow: 'M 35,115 Q 70,110 115,105',
        tips: [
            '嘴角向两侧拉开，像微笑一样。',
            '舌尖轻抵下齿，前舌抬得很高，舌侧缘贴住上臼齿。',
            '上下齿之间距离非常小（约放得下一个硬币）。'
        ]
    },

    // 8. 前开元音 (如 /æ/, /ɛ/)
    vowel_open_front: {
        name: '前开元音 / 大张嘴',
        description: '上下颌开合度大，舌位降到最低，前舌微隆。',
        lips: {
            upper: 'M 105,72 Q 120,70 122,82 Q 112,80 105,78 Z', // 张大嘴
            lower: 'M 98,165 Q 118,162 120,142 Q 110,148 98,152 Z'
        },
        tongue: 'M 40,160 C 50,145 75,145 88,148 C 94,152 95,156 95,160 Z', // 舌头压低
        jawYOffset: 12, // 明显的下巴下移
        airflow: 'M 35,115 Q 70,122 118,118',
        tips: [
            '张大嘴巴，下巴尽量向下落（/æ/ 需张大到放下两指）。',
            '舌尖平抵下齿，舌面自然压低，声带强力振动发音。',
            '注意区别于 /e/，/æ/ 的嘴张得更大、嘴角拉得更开。'
        ]
    },

    // 9. 后闭元音 (如 /uː/, /ʊ/)
    vowel_close_back: {
        name: '后闭元音 / 圆唇高舌',
        description: '嘴唇收圆并向前突出，后舌隆起抬高，上下齿距离小。',
        lips: {
            upper: 'M 105,75 Q 125,75 128,94 Q 115,92 105,86 Z', // 圆唇嘟起
            lower: 'M 98,135 Q 125,132 126,106 Q 112,116 98,120 Z'
        },
        tongue: 'M 40,160 C 45,95 70,110 88,135 C 95,142 98,150 98,160 Z', // 后舌高抬
        jawYOffset: 2,
        airflow: 'M 35,115 Q 60,112 118,105',
        tips: [
            '双唇收圆，像吹口哨一样嘟起。',
            '舌头往后缩，后舌（舌根部）高高隆起抬向软腭。',
            '声带振动，发音圆润饱满。'
        ]
    },

    // 10. 后开元音 (如 /ɒ/, /ɔː/)
    vowel_open_back: {
        name: '后开元音 / 圆唇低舌',
        description: '嘴巴张大，嘴唇微圆或呈扁圆，舌头后缩压低。',
        lips: {
            upper: 'M 105,72 Q 120,71 122,84 Q 112,82 105,80 Z', // 嘴张开
            lower: 'M 98,158 Q 118,155 120,132 Q 110,140 98,144 Z'
        },
        tongue: 'M 40,160 C 45,120 70,135 85,146 C 92,150 95,155 95,160 Z', // 舌头后缩压低
        jawYOffset: 8,
        airflow: 'M 35,115 Q 70,125 118,120',
        tips: [
            '嘴巴张开，双唇稍微收圆（呈椭圆状）。',
            '舌头平放后缩，舌根部压低。',
            '发出短促的 /ɒ/（如 hot）或圆润的长音 /ɔː/（如 law）。'
        ]
    },

    // 11. 中元音 (如 /ə/, /ɜː/, /ʌ/)
    vowel_mid_central: {
        name: '中元音 / 自然微开',
        description: '口腔各部位最自然的状态，嘴唇微开不拉紧，舌头平放中间。',
        lips: {
            upper: 'M 105,75 Q 120,74 122,86 Q 112,84 105,80 Z', // 自然微开
            lower: 'M 98,142 Q 118,138 120,110 Q 110,122 98,126 Z'
        },
        tongue: 'M 40,160 C 48,128 76,128 91,138 C 96,143 98,152 98,160 Z', // 舌头居中
        jawYOffset: 3,
        airflow: 'M 35,115 Q 70,115 115,112',
        tips: [
            '口腔肌肉完全放松，双唇微开，嘴角自然。',
            '舌头平放于口腔底部，不用力，发“呃”音。',
            '这是英语中最懒惰、最核心的弱读元音状态。'
        ]
    },

    // 12. 喉音 / 默认状态 (如 /h/)
    default: {
        name: '自然舒缓状态 / 喉音',
        description: '空气流经声门和口腔，不受到显著的阻碍。',
        lips: {
            upper: 'M 105,75 Q 120,74 122,86 Q 112,84 105,80 Z',
            lower: 'M 98,142 Q 118,138 120,110 Q 110,122 98,126 Z'
        },
        tongue: 'M 40,160 C 48,128 76,128 91,138 C 96,143 98,152 98,160 Z',
        jawYOffset: 3,
        airflow: 'M 35,115 Q 75,115 118,115', // 直通气流
        tips: [
            '口腔和嘴唇保持自然开合。',
            '舌头平放，不用力。',
            '气流自由呵出，发出无阻碍的摩擦声（如 /h/）。'
        ]
    }
};

// 常见音标到 12 种发音剖面状态的映射字典
const PHONEME_TO_STATE_MAP: Record<string, string> = {
    // 1. 双唇音
    'p': 'bilabial', 'b': 'bilabial', 'm': 'bilabial',
    // 2. 唇齿音
    'f': 'labiodental', 'v': 'labiodental',
    // 3. 齿间音
    'θ': 'dental', 'ð': 'dental',
    // 4. 舌尖齿龈音
    't': 'alveolar', 'd': 'alveolar', 's': 'alveolar', 'z': 'alveolar',
    'n': 'alveolar', 'l': 'alveolar',
    // 5. 舌叶硬腭音
    'ʃ': 'palatal_postalveolar', 'ʒ': 'palatal_postalveolar',
    'tʃ': 'palatal_postalveolar', 'dʒ': 'palatal_postalveolar',
    'j': 'palatal_postalveolar', 'r': 'palatal_postalveolar',
    // 6. 舌后软腭音
    'k': 'velar', 'g': 'velar', 'ŋ': 'velar',
    // 7. 前闭元音
    'iː': 'vowel_close_front', 'ɪ': 'vowel_close_front',
    // 8. 前开元音
    'æ': 'vowel_open_front', 'ɛ': 'vowel_open_front',
    // 9. 后闭元音
    'uː': 'vowel_close_back', 'ʊ': 'vowel_close_back',
    // 10. 后开元音
    'ɒ': 'vowel_open_back', 'ɔː': 'vowel_open_back',
    // 11. 中元音
    'ə': 'vowel_mid_central', 'ɜː': 'vowel_mid_central', 'ʌ': 'vowel_mid_central',
    // 12. 兜底
    'h': 'default'
};

/**
 * 根据音标字符获取对应的口腔动画状态配置
 * @param phoneme 音标符号（支持带斜杠如 /θ/ 或纯字符如 θ）
 */
export function getPhonemeVisualConfig(phoneme: string): PhonemeVisualConfig {
    // 清理音标前后的斜杠和空格
    const cleanPhoneme = phoneme.replace(/[\/\s]/g, '');
    
    const stateKey = PHONEME_TO_STATE_MAP[cleanPhoneme];
    if (stateKey && PHONEME_VISUAL_STATES[stateKey]) {
        return PHONEME_VISUAL_STATES[stateKey];
    }
    
    // 双元音或组合音，模糊映射到其第一个核心元音/辅音
    if (cleanPhoneme.length > 1) {
        // 例如 eɪ -> ɛ, oʊ -> ə 等
        const firstChar = cleanPhoneme.charAt(0);
        const fallbackKey = PHONEME_TO_STATE_MAP[firstChar];
        if (fallbackKey && PHONEME_VISUAL_STATES[fallbackKey]) {
            return PHONEME_VISUAL_STATES[fallbackKey];
        }
    }

    return PHONEME_VISUAL_STATES.default;
}
