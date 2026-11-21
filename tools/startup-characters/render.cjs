const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const [role, threePath, playwrightPath, destination] = process.argv.slice(2);
if (!['rider', 'restaurant'].includes(role) || !threePath || !playwrightPath || !destination) throw new Error('Pass role, Three.js folder, Playwright folder, output folder.');
const { chromium } = require(path.resolve(playwrightPath));
const html = `<style>html,body{margin:0;background:transparent}canvas{display:block}</style><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script><script type="module" src="/scene.mjs"></script>`;
const server = http.createServer((request, response) => {
  const relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  if (relative === '/') { response.setHeader('Content-Type', 'text/html'); response.end(html); return; }
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
    page.on('pageerror', e => console.error(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/?role=${role}`);
    await page.waitForFunction(() => typeof window.renderCharacter === 'function');
    fs.mkdirSync(destination, { recursive: true });
    for (let i = 0; i < 48; i++) {
      const data = await page.evaluate(p => window.renderCharacter(p), i / 48);
      fs.writeFileSync(path.join(destination, `${String(i).padStart(2, '0')}.png`), Buffer.from(data.split(',')[1], 'base64'));
    }
    const end = await page.evaluate(() => window.renderCharacter(1));
    fs.writeFileSync(path.join(destination, 'loop-end.png'), Buffer.from(end.split(',')[1], 'base64'));
    console.log(`Rendered ${role}: 48 articulated 3D frames.`);
  } finally { await browser?.close(); server.close(); }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
