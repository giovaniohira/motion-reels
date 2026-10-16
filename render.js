// node render.js stills 1.8,4.3,...   |   node render.js video
const puppeteer = require('puppeteer-core');
const ffmpeg = require('ffmpeg-static');
const {execFileSync} = require('child_process');
const fs = require('fs'), path = require('path');

const OUT = process.env.OUT_DIR || path.join(__dirname, 'out');
fs.mkdirSync(OUT, {recursive: true});
const [mode, list] = process.argv.slice(2);
const FPS = 30;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars']
  });
  const page = await browser.newPage();
  await page.setViewport({width: 1080, height: 1920, deviceScaleFactor: 1});
  page.on('pageerror', e => console.error('PAGEERR', e.message));
  await page.goto('http://localhost:8765/?clean', {waitUntil: 'domcontentloaded'});
  await page.waitForFunction('!!window.tl', {timeout: 180000, polling: 500});

  const shot = async (t, file) => {
    await page.evaluate(async t => {
      seekTo(t);
      map.triggerRepaint();
      await new Promise(r => { map.once('idle', r); setTimeout(r, 5000); });
    }, t);
    await page.screenshot({path: file, type: 'jpeg', quality: 92});
  };

  if (mode === 'stills') {
    for (const t of list.split(',').map(Number)) await shot(t, path.join(OUT, `still_${t.toFixed(1)}.jpg`));
  } else {
    const dir = path.join(OUT, 'frames');
    fs.mkdirSync(dir, {recursive: true});
    const total = Math.ceil(await page.evaluate('tl.duration()') * FPS);
    for (let i = 0; i < total; i++) {
      await shot(i / FPS, path.join(dir, String(i).padStart(5, '0') + '.jpg'));
      if (i % 60 === 0) console.log(`frame ${i}/${total}`);
    }
    execFileSync(ffmpeg, ['-y', '-framerate', String(FPS), '-i', path.join(dir, '%05d.jpg'),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart',
      path.join(OUT, 'reel-porto-belo.mp4')], {stdio: 'inherit'});
  }
  await browser.close();
})();
