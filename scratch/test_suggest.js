const https = require('https');

const query = encodeURIComponent('高效');
const url = `https://dict.youdao.com/suggest?q=${query}&num=10&doctype=json`;

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        console.log(data);
    });
}).on('error', (err) => {
    console.error(err);
});
