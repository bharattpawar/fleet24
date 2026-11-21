// Usage: node render.cjs <three package folder> <playwright package folder> <temporary frames folder>
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const [threePath, playwrightPath, destination] = process.argv.slice(2);
if (!threePath || !playwrightPath || !destination) throw new Error('Pass Three.js, Playwright and output folder paths.');
const { chromium } = require(path.resolve(playwrightPath));
const html = `<style>html,body{margin:0;background:transparent}canvas{display:block}</style><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script><script type="module" src="/scene.mjs"></script>`;
const server = http.createServer((request, response) => {
  if (request.url === '/') { response.setHeader('Content-Type', 'text/html'); response.end(html); return; }
  const relative = decodeURIComponent(request.url.split('?')[0]);
  const root = relative.startsWith('/three/') ? path.resolve(threePath) : __dirname;
  const target = path.resolve(root, relative.startsWith('/three/') ? relative.slice(7) : relative.slice(1));
  if (!target.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  if (!fs.existsSync(target)) { response.writeHead(404).end(); return; }
  response.setHeader('Content-Type', 'text/javascript'); response.end(fs.readFileSync(target));
});
(async () => {
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 480, height: 480 } });
    page.on('pageerror', error => console.error(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => typeof window.renderRider === 'function');
    fs.mkdirSync(destination, { recursive: true });
    for (let i = 0; i < 48; i++) {
      const data = await page.evaluate(phase => window.renderRider(phase), i / 48);
      fs.writeFileSync(path.join(destination, `${String(i).padStart(2, '0')}.png`), Buffer.from(data.split(',')[1], 'base64'));
    }
    // The endpoint must be pixel-identical to the first pose for a seamless loop.
    const end = await page.evaluate(() => window.renderRider(1));
    fs.writeFileSync(path.join(destination, 'loop-end.png'), Buffer.from(end.split(',')[1], 'base64'));
    console.log('Rendered 48 articulated 3D frames at 480 × 480.');
  } finally { await browser?.close(); server.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
