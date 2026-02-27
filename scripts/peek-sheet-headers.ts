import https from 'https';

const sheetUrl = 'https://docs.google.com/spreadsheets/d/1zORDeAfYC-bEtCcLp6xKOESoz9khQvQW/export?format=csv&gid=594653964';

function fetchCsv(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                resolve(fetchCsv(res.headers.location));
            } else {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }
        }).on('error', reject);
    });
}

async function run() {
    const csvData = await fetchCsv(sheetUrl);
    const rows = csvData.split(/\r?\n/).slice(0, 5); // Just first 5 rows
    console.log("Headers or first rows:");
    rows.forEach(r => console.log(r));
}

run().catch(console.error);
