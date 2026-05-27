const fs = require('fs');
const path = require('path');

// 基础源路径
const sourceDir = path.join(__dirname, '../tmp_texts');
const googleDir = path.join(sourceDir, '谷歌10000词');
const kaoyanDir = path.join(sourceDir, '考研单词5500词');
const targetFile = path.join(__dirname, '../src/data/static_data.ts');

console.log('🏁 开始解析本地词单资产...');

// 1. 解析谷歌 10000 词 (降序词频)
const googleWords = [];
if (fs.existsSync(googleDir)) {
    const files = fs.readdirSync(googleDir).filter(f => f.endsWith('.md'));
    // 按数字排序，以保证词频降序顺序不变
    files.sort((a, b) => {
        const numA = parseInt(a.split('-')[0]) || 0;
        const numB = parseInt(b.split('-')[0]) || 0;
        return numA - numB;
    });

    for (const file of files) {
        const content = fs.readFileSync(path.join(googleDir, file), 'utf-8');
        const lines = content.split('\n');
        let articleBody = false;

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === '^^^article') {
                articleBody = true;
                continue;
            }
            if (!articleBody) continue;

            if (trimmed && !trimmed.startsWith('---') && !trimmed.startsWith('langr')) {
                // 仅保留纯英文字母单词
                if (/^[a-zA-Z]+(-[a-zA-Z]+)*$/.test(trimmed)) {
                    googleWords.push(trimmed.toLowerCase());
                }
            }
        }
    }
}
console.log(`✅ 成功解析谷歌高频词数: ${googleWords.length}`);

// 2. 解析考研 5500 词
const kaoyanWords = [];
if (fs.existsSync(kaoyanDir)) {
    const files = fs.readdirSync(kaoyanDir).filter(f => f.endsWith('.md'));
    files.sort();

    for (const file of files) {
        const content = fs.readFileSync(path.join(kaoyanDir, file), 'utf-8');
        const lines = content.split('\n');
        let articleBody = false;

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === '^^^article') {
                articleBody = true;
                continue;
            }
            if (!articleBody) continue;

            if (trimmed) {
                // 考研格式为 "1 abandon" 或 "123 ability"
                const parts = trimmed.split(/\s+/);
                if (parts.length >= 2) {
                    const word = parts[1].toLowerCase();
                    if (/^[a-zA-Z]+(-[a-zA-Z]+)*$/.test(word)) {
                        kaoyanWords.push(word);
                    }
                }
            }
        }
    }
}
console.log(`✅ 成功解析考研词汇数: ${kaoyanWords.length}`);

// 3. 去重与合并白名单，并保留谷歌词频顺序
const whitelistSet = new Set(googleWords);
// 考研词作为白名单扩充
for (const word of kaoyanWords) {
    whitelistSet.add(word);
}
const whitelistArray = Array.from(whitelistSet);
console.log(`📊 去重合并后高频白名单总容量: ${whitelistArray.length}`);

// 4. 预置常见不规则变形映射表 (IRREGULAR_MAP)
const irregularMap = {
    // be 动词
    "am": "be", "is": "be", "are": "be", "was": "be", "were": "be", "been": "be", "being": "be",
    // 常用不规则动词
    "went": "go", "gone": "go", "goes": "go",
    "did": "do", "done": "do", "does": "do",
    "had": "have", "has": "have", "having": "have",
    "saw": "see", "seen": "see", "sees": "see",
    "wrote": "write", "written": "write", "writes": "write",
    "took": "take", "taken": "take", "takes": "take",
    "made": "make", "makes": "make",
    "came": "come", "comes": "come",
    "gave": "give", "given": "give", "gives": "give",
    "found": "find", "finds": "find",
    "thought": "think", "thinks": "think",
    "told": "tell", "tells": "tell",
    "said": "say", "says": "say",
    "brought": "bring", "brings": "bring",
    "bought": "buy", "buys": "buy",
    "kept": "keep", "keeps": "keep",
    "held": "hold", "holds": "hold",
    "stood": "stand", "stands": "stand",
    "understood": "understand", "understands": "understand",
    "met": "meet", "meets": "meet",
    "ran": "run", "runned": "run", "runs": "run",
    "sat": "sit", "sits": "sit",
    "spoke": "speak", "spoken": "speak", "speaks": "speak",
    "spent": "spend", "spends": "spend",
    "lost": "lose", "loses": "lose",
    "fell": "fall", "fallen": "fall", "falls": "fall",
    "sent": "send", "sends": "send",
    "built": "build", "builds": "build",
    "left": "leave", "leaves": "leave",
    "grew": "grow", "grown": "grow", "grows": "grow",
    "drew": "draw", "drawn": "draw", "draws": "draw",
    "began": "begin", "begun": "begin", "begins": "begin",
    "showed": "show", "shown": "show", "shows": "show",
    "knew": "know", "known": "know", "knows": "know",
    "swam": "swim", "swum": "swim", "swims": "swim",
    // 常见名词不规则复数
    "children": "child",
    "men": "man",
    "women": "woman",
    "feet": "foot",
    "teeth": "tooth",
    "mice": "mouse",
    "geese": "goose",
    // 常见形容词/副词不规则比较级/最高级
    "better": "good", "best": "good",
    "worse": "bad", "worst": "bad",
    "less": "little", "least": "little",
    "more": "much", "most": "much"
};

// 5. 预置常见高频短语词组表 (F10 - 滑动窗口匹配基石)
const commonPhrases = [
    "look after", "look for", "look forward to", "look up", "look out", "look into",
    "take care of", "take part in", "take place", "take off", "take over", "take action",
    "deal with", "cope with", "agree with", "depend on", "rely on", "focus on",
    "because of", "instead of", "in front of", "in order to", "in spite of", "on account of",
    "by means of", "by virtue of", "by way of", "in terms of", "as a result of",
    "as well as", "as far as", "as soon as", "so as to",
    "according to", "due to", "thanks to", "prior to", "pointing out",
    "put off", "put on", "put out", "put up with", "put forward",
    "give up", "give in", "give rise to",
    "run out of", "run into", "run away",
    "get up", "get on", "get off", "get along with", "get rid of",
    "set up", "set off", "set out",
    "bring about", "bring up", "bring out",
    "carry out", "carry on",
    "call off", "call for", "call on",
    "point out", "make sure", "find out", "turn out to be"
];

// 6. 预置前 200 核心词的极简离线字典包 (F11)
const offlineDict = {
    "the": { phonetic: "ðə", trans: "art. 这；那" },
    "of": { phonetic: "ɒv", trans: "prep. …的；由…制成的" },
    "and": { phonetic: "ænd", trans: "conj. 和，与" },
    "to": { phonetic: "tuː", trans: "prep. 向，朝；达到" },
    "a": { phonetic: "eɪ", trans: "art. 一，一个" },
    "in": { phonetic: "ɪn", trans: "prep. 在…里；在…期间" },
    "for": { phonetic: "fɔː", trans: "prep. 为了；给；代表" },
    "is": { phonetic: "ɪz", trans: "v. 是（be的单数第三人称现在时）" },
    "on": { phonetic: "ɒn", trans: "prep. 在…之上；关于" },
    "that": { phonetic: "ðæt", trans: "pron. 那，那个；conj. 引导从句" },
    "by": { phonetic: "baɪ", trans: "prep. 被，由；通过；在…旁边" },
    "this": { phonetic: "ðɪs", trans: "pron. 这，这个" },
    "with": { phonetic: "wɪð", trans: "prep. 具有；和…一起；用" },
    "i": { phonetic: "aɪ", trans: "pron. 我" },
    "you": { phonetic: "juː", trans: "pron. 你，你们" },
    "it": { phonetic: "ɪt", trans: "pron. 它" },
    "not": { phonetic: "nɒt", trans: "adv. 不，没有" },
    "or": { phonetic: "ɔː", trans: "conj. 或者；否则" },
    "be": { phonetic: "biː", trans: "v. 是；存在" },
    "are": { phonetic: "ɑː", trans: "v. 是（be的复数现在时）" },
    "from": { phonetic: "frɒm", trans: "prep. 来自，从" },
    "at": { phonetic: "æt", trans: "prep. 在…地点；在…时刻" },
    "as": { phonetic: "æz", trans: "adv. 同样地；prep. 作为；conj. 当…时" },
    "your": { phonetic: "jɔː", trans: "pron. 你的，你们的" },
    "all": { phonetic: "ɔːl", trans: "adj. 全部的；pron. 所有人/事" },
    "have": { phonetic: "hæv", trans: "v. 有；吃；让" },
    "new": { phonetic: "njuː", trans: "adj. 新的；新鲜的" },
    "more": { phonetic: "mɔː", trans: "adv. 更多；adj. 更多的" },
    "an": { phonetic: "æn", trans: "art. 一（元音前）" },
    "was": { phonetic: "wɒz", trans: "v. 是（be的过去单数第一、三人称）" },
    "we": { phonetic: "wiː", trans: "pron. 我们" },
    "will": { phonetic: "wɪl", trans: "aux. 将要；n. 意志，遗嘱" },
    "can": { phonetic: "kæn", trans: "aux. 能，可以；n. 罐头" },
    "about": { phonetic: "əˈbaʊt", trans: "prep. 关于；大约" },
    "if": { phonetic: "ɪf", trans: "conj. 如果；是否" },
    "my": { phonetic: "maɪ", trans: "pron. 我的" },
    "has": { phonetic: "hæz", trans: "v. 有（have的单数第三人称现在时）" },
    "but": { phonetic: "bʌt", trans: "conj. 但是；而" },
    "our": { phonetic: "ˈaʊə", trans: "pron. 我们的" },
    "one": { phonetic: "wʌn", trans: "num. 一；pron. 某一个人/物" },
    "other": { phonetic: "ˈʌðə", trans: "adj. 其他的；pron. 另一个" },
    "do": { phonetic: "duː", trans: "v. 做，干；aux. 助动词" },
    "no": { phonetic: "nəʊ", trans: "adv. 不，没有；adj. 没有的" },
    "information": { phonetic: "ˌɪnfəˈmeɪʃn", trans: "n. 信息，消息，通知" },
    "time": { phonetic: "taɪm", trans: "n. 时间；次数；倍数" },
    "they": { phonetic: "ðeɪ", trans: "pron. 他们，她们，它们" },
    "he": { phonetic: "hiː", trans: "pron. 他" },
    "up": { phonetic: "ʌp", trans: "adv. 向上；在上方" },
    "may": { phonetic: "meɪ", trans: "aux. 也许，可以；n. 五月" },
    "what": { phonetic: "wɒt", trans: "pron. 什么" },
    "which": { phonetic: "wɪtʃ", trans: "pron. 哪个，哪些" },
    "their": { phonetic: "ðeə", trans: "pron. 他们的，她们的" },
    "out": { phonetic: "aʊt", trans: "adv. 向外；出来；彻底" },
    "use": { phonetic: "juːz", trans: "v. 使用，利用；n. 用途" },
    "any": { phonetic: "ˈeni", trans: "adj. 任何的；pron. 任何" },
    "there": { phonetic: "ðeə", trans: "adv. 在那里；there be 结构" },
    "see": { phonetic: "siː", trans: "v. 看见；明白" },
    "only": { phonetic: "ˈəʊnli", trans: "adv. 只，仅仅；adj. 唯一的" },
    "so": { phonetic: "səʊ", trans: "adv. 如此，这么；conj. 所以" },
    "his": { phonetic: "hɪz", trans: "pron. 他的" },
    "when": { phonetic: "wen", trans: "conj. 当…时；adv. 什么时候" },
    "here": { phonetic: "hɪə", trans: "adv. 在这里，到这里" },
    "business": { phonetic: "ˈbɪznəs", trans: "n. 商业，买卖；事务" },
    "who": { phonetic: "huː", trans: "pron. 谁，什么人" },
    "web": { phonetic: "web", trans: "n. 网，蛛网；互联网" },
    "also": { phonetic: "ˈɔːlsəʊ", trans: "adv. 而且，也" },
    "now": { phonetic: "naʊ", trans: "adv. 现在，立刻" },
    "help": { phonetic: "help", trans: "v. & n. 帮助，援助" },
    "get": { phonetic: "ɡet", trans: "v. 得到；到达；变得" },
    "view": { phonetic: "vjuː", trans: "n. 视野，观点；v. 观察" },
    "online": { phonetic: "ˌɒnˈlaɪn", trans: "adj. 在线的，联机的" },
    "first": { phonetic: "fɜːst", trans: "num. 第一；adv. 首先" },
    "been": { phonetic: "biːn", trans: "v. be的过去分词" },
    "would": { phonetic: "wʊd", trans: "aux. 将，会；愿意" },
    "how": { phonetic: "haʊ", trans: "adv. 怎样，如何；多么" },
    "were": { phonetic: "wɜː", trans: "v. be的过去式复数" },
    "me": { phonetic: "miː", trans: "pron. 我（宾格）" },
    "some": { phonetic: "sʌm", trans: "adj. 一些，若干；某些" },
    "these": { phonetic: "ðiːz", trans: "pron. 这些" },
    "like": { phonetic: "laɪk", trans: "v. 喜欢；prep. 像，如同" },
    "find": { phonetic: "faɪnd", trans: "v. 找到，发现；觉得" },
    "back": { phonetic: "bæk", trans: "adv. 向后；回来；n. 背部" },
    "people": { phonetic: "ˈpiːpl", trans: "n. 人，人们；民族" },
    "had": { phonetic: "hæd", trans: "v. have的过去式和过去分词" },
    "list": { phonetic: "lɪst", trans: "n. 目录，列表；v. 列出" },
    "name": { phonetic: "neɪm", trans: "n. 名字，名称；v. 命名" },
    "just": { phonetic: "dʒʌst", trans: "adv. 刚才；仅仅；非常" },
    "over": { phonetic: "ˈəʊvə", trans: "prep. 在…上方；越过；超过" },
    "state": { phonetic: "steɪt", trans: "n. 状态；国家；州；v. 陈述" },
    "year": { phonetic: "jɪə", trans: "n. 年，年度" },
    "day": { phonetic: "deɪ", trans: "n. 白天，一天" },
    "into": { phonetic: "ˈɪntə", trans: "prep. 进入…中；成为" },
    "two": { phonetic: "tuː", trans: "num. 二，两个" },
    "go": { phonetic: "ɡəʊ", trans: "v. 去，走；运转" },
    "work": { phonetic: "wɜːk", trans: "n. 工作；著作；v. 工作" },
    "last": { phonetic: "lɑːst", trans: "adj. 最后的；最近的；v. 持续" },
    "most": { phonetic: "məʊst", trans: "adj. 最多的；adv. 最，非常" },
    "make": { phonetic: "meɪk", trans: "v. 制造；做；使得" },
    "them": { phonetic: "ðem", trans: "pron. 他们/她们/它们（宾格）" },
    "should": { phonetic: "ʃʊd", trans: "aux. 应该，应当" },
    "system": { phonetic: "ˈsɪstəm", trans: "n. 系统，体系，制度" },
    "after": { phonetic: "ˈɑːftə", trans: "prep. 在…后面；在…之后" },
    "best": { phonetic: "best", trans: "adj. 最好的；adv. 最好地" },
    "good": { phonetic: "ɡʊd", trans: "adj. 好的，有益的" },
    "well": { phonetic: "wel", trans: "adv. 好地；adj. 健康的；n. 井" },
    "where": { phonetic: "weə", trans: "adv. 在哪里；conj. 在…的地方" },
    "high": { phonetic: "haɪ", trans: "adj. 高的；高尚的；adv. 高高地" },
    "school": { phonetic: "skuːl", trans: "n. 学校；学派" },
    "through": { phonetic: "θruː", trans: "prep. 穿过，通过；凭借" },
    "each": { phonetic: "iːtʃ", trans: "adj. & pron. 每个，各自" },
    "she": { phonetic: "ʃiː", trans: "pron. 她" },
    "order": { phonetic: "ˈɔːdə", trans: "n. 顺序；命令；订购；v. 命令" },
    "very": { phonetic: "ˈveri", trans: "adv. 非常，极" },
    "book": { phonetic: "bʊk", trans: "n. 书；v. 预订" },
    "company": { phonetic: "ˈkʌmpəni", trans: "n. 公司；伙伴；交往" },
    "read": { phonetic: "riːd", trans: "v. 阅读；朗读" },
    "group": { phonetic: "ɡruːp", trans: "n. 组，群；v. 分组" },
    "need": { phonetic: "niːd", trans: "v. & n. 需要，必须" },
    "many": { phonetic: "ˈmeni", trans: "adj. 许多的；pron. 许多人/物" },
    "user": { phonetic: "ˈjuːzə", trans: "n. 用户，使用者" },
    "said": { phonetic: "sed", trans: "v. say的过去式和过去分词" },
    "does": { phonetic: "dʌz", trans: "v. do的单数第三人称现在时" },
    "set": { phonetic: "set", trans: "v. 放，安置；设置；n. 一套" },
    "under": { phonetic: "ˈʌndə", trans: "prep. 在…下面；在…领导下" },
    "general": { phonetic: "ˈdʒenrəl", trans: "adj. 一般的，总的；n. 将军" },
    "research": { phonetic: "rɪˈsɜːtʃ", trans: "n. & v. 研究，调查" },
    "life": { phonetic: "laɪf", trans: "n. 生命；生活；一生" },
    "know": { phonetic: "nəʊ", trans: "v. 知道，认识；了解" },
    "way": { phonetic: "weɪ", trans: "n. 道路；方法；方向" },
    "could": { phonetic: "kʊd", trans: "aux. can的过去式；可能" },
    "great": { phonetic: "ɡreɪt", trans: "adj. 伟大的；重大的；极好的" },
    "must": { phonetic: "mʌst", trans: "aux. 必须，应当；必定" },
    "write": { phonetic: "raɪt", trans: "v. 写，书写，写作" }
};

// 7. 构建反向索引 (中文 → 英文 Lemma[])
console.log('🔄 开始构建中译英反向索引...');
const reverseIndex = {};

// 从 offlineDict 中提取中文释义并建立反向映射
for (const [lemma, entry] of Object.entries(offlineDict)) {
    const trans = entry.trans;
    // 提取中文词汇：匹配中文字符序列（排除标点和英文）
    const chineseMatches = trans.match(/[一-龥]+/g);
    if (chineseMatches) {
        for (const chineseWord of chineseMatches) {
            if (!reverseIndex[chineseWord]) {
                reverseIndex[chineseWord] = [];
            }
            // 避免重复添加
            if (!reverseIndex[chineseWord].includes(lemma)) {
                reverseIndex[chineseWord].push(lemma);
            }
        }
    }
}

console.log(`✅ 反向索引构建完成，共收录中文词汇: ${Object.keys(reverseIndex).length} 个`);

// 8. 生成输出文件
const outputDir = path.dirname(targetFile);
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const fileContent = `/**
 * THIS FILE IS AUTOMATICALLY GENERATED BY scripts/generate_data.js
 * DO NOT EDIT DIRECTLY.
 */

// 1. 去重合并的高频白名单词表 (基于 Google 10k 与考研 5.5k 去重)
export const HIGH_FREQUENCY_WORDS: string[] = ${JSON.stringify(whitelistArray, null, 4)};

// 2. 不规则词形还原映射表 (Exception Lexicon)
export const IRREGULAR_MAP: Record<string, string> = ${JSON.stringify(irregularMap, null, 4)};

// 3. 常用高频词组短语表 (F10 前向最大匹配基石)
export const COMMON_PHRASES: string[] = ${JSON.stringify(commonPhrases, null, 4)};

// 4. 内置前 200 核心词的极简离线字典包 (F11 降级支持)
export interface DictEntry {
    phonetic: string;
    trans: string;
}
export const OFFLINE_DICT: Record<string, DictEntry> = ${JSON.stringify(offlineDict, null, 4)};

// 5. 中译英反向索引 (中文词汇 → 英文 Lemma[])
export const REVERSE_INDEX: Record<string, string[]> = ${JSON.stringify(reverseIndex, null, 4)};
`;

fs.writeFileSync(targetFile, fileContent, 'utf-8');
console.log(`🎉 静态词表及规则数据已成功写入：${targetFile}`);
console.log(`📦 生成文件大小约: ${(fs.statSync(targetFile).size / 1024).toFixed(2)} KB`);
