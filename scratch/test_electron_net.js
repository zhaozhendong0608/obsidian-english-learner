/**
 * 验证 Electron net.request 能否携带本地 YouTube Cookie 发起请求
 */
const { net, session } = require('electron');

async function postWithElectronNet(url, body, headers = {}) {
    return new Promise((resolve, reject) => {
        const request = net.request({
            method: 'POST',
            url,
            partition: 'persist:obsidian', // 使用持久化 session 以携带 Cookie
        });
        
        Object.entries({
            'Content-Type': 'application/json',
            ...headers
        }).forEach(([k, v]) => request.setHeader(k, v));
        
        let data = '';
        request.on('response', (response) => {
            response.on('data', (chunk) => data += chunk.toString());
            response.on('end', () => resolve({ text: data, status: response.statusCode }));
        });
        request.on('error', reject);
        request.write(JSON.stringify(body));
        request.end();
    });
}

async function run() {
    const videoId = '5MuIMqhT8DM';
    const transcriptParams = 'Cgs1TXVJTXFoVDhETRIOQ2dBU0FtVnVHZ0ElM0QYASozZW5nYWdlbWVudC1wYW5lbC1zZWFyY2hhYmxlLXRyYW5zY3JpcHQtc2VhcmNoLXBhbmVsMAA4AUAB';
    
    try {
        console.log('使用 Electron net.request 发起 POST...');
        const res = await postWithElectronNet(
            'https://www.youtube.com/youtubei/v1/get_transcript',
            {
                context: { client: { clientName: 'WEB', clientVersion: '2.20240101.00.00', hl: 'en', gl: 'US' } },
                params: transcriptParams
            },
            {
                'Referer': `https://www.youtube.com/watch?v=${videoId}`,
                'Origin': 'https://www.youtube.com',
            }
        );
        console.log('状态码:', res.status);
        console.log('Body 长度:', res.text.length);
        if (res.text.length > 0) console.log('内容前 300 字符:', res.text.slice(0, 300));
    } catch (e) {
        console.error('Electron net.request 出错:', e.message);
    }
}

run();
