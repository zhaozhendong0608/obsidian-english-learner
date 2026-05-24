/**
 * 验证 URL 解码后的 transcriptParams 是否能使 get_transcript 返回 200
 */
const https = require('https');

function httpsGet(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const req = https.get({ hostname: parsed.hostname, path: parsed.pathname + parsed.search, headers }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ text: data, status: res.statusCode }));
        });
        req.on('error', reject);
    });
}

function httpsPost(hostname, path, body, headers = {}) {
    return new Promise((resolve, reject) => {
        const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
        const options = {
            hostname, path, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr), ...headers }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ text: data, status: res.statusCode }));
        });
        req.on('error', reject);
        req.write(bodyStr);
        req.end();
    });
}

async function run() {
    const videoId = '5MuIMqhT8DM';
    
    const pageRes = await httpsGet(`https://www.youtube.com/watch?v=${videoId}`, {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
    });
    const html = pageRes.text;
    
    const visitorData = html.match(/"VISITOR_DATA"\s*:\s*"([^"]+)"/)?.[1] || '';
    const dataMatch = html.match(/ytInitialData\s*=\s*({.+?});\s*<\/script>/);
    if (!dataMatch) { console.error('无 ytInitialData'); return; }
    
    const ytData = JSON.parse(dataMatch[1]);
    const panels = ytData?.engagementPanels || [];
    const transcriptPanel = panels.find(p =>
        p?.engagementPanelSectionListRenderer?.targetId === 'engagement-panel-searchable-transcript'
    );
    const contEndpoint = transcriptPanel
        ?.engagementPanelSectionListRenderer?.content
        ?.continuationItemRenderer?.continuationEndpoint;
    const rawParams = contEndpoint?.getTranscriptEndpoint?.params;
    
    if (!rawParams) { console.error('无 transcriptParams'); return; }
    
    const decodedParams = decodeURIComponent(rawParams);
    console.log('raw params:', rawParams.slice(0, 60));
    console.log('decoded params:', decodedParams.slice(0, 60));
    console.log('是否不同:', rawParams !== decodedParams);
    
    console.log('\n发起 POST (使用 decoded params)...');
    const res = await httpsPost(
        'www.youtube.com',
        '/youtubei/v1/get_transcript',
        {
            context: { client: { clientName: 'WEB', clientVersion: '2.20240101.00.00', hl: 'en', gl: 'US', visitorData } },
            params: decodedParams
        },
        {
            'Referer': `https://www.youtube.com/watch?v=${videoId}`,
            'Origin': 'https://www.youtube.com',
            'X-Youtube-Client-Name': '1',
            'X-Youtube-Client-Version': '2.20240101.00.00'
        }
    );
    
    console.log('状态码:', res.status, '| Body 长度:', res.text.length);
    if (res.status === 200 && res.text.length > 0) {
        const json = JSON.parse(res.text);
        const segments = json?.actions?.[0]
            ?.updateEngagementPanelAction?.content
            ?.transcriptRenderer?.content
            ?.transcriptSearchPanelRenderer?.body
            ?.transcriptSegmentListRenderer?.initialSegments;
        console.log('字幕片段数量:', segments?.length);
        if (segments?.length) {
            for (const seg of segments.slice(0, 3)) {
                const r = seg?.transcriptSegmentRenderer;
                const text = (r?.snippet?.runs || []).map(run => run.text).join('');
                const startMs = parseInt(r?.startMs || 0);
                console.log(`  [${(startMs/1000).toFixed(1)}s] ${text}`);
            }
        }
    } else {
        console.log('响应:', res.text.slice(0, 300));
    }
}

run().catch(console.error);
