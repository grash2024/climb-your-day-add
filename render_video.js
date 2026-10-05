/**
 * CLIMB YOUR DAY — Full 1080p MP4 Video Exporter
 * Captures 86-second motion graphic at 1920x1080 @ 30fps
 * Muxes with master soundtrack (Music + Samantha Voiceover + Audio Ducking)
 * Uses Apple Silicon hardware encoder (h264_videotoolbox) for blistering speed
 */

const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const FPS = 30;
const DURATION = 86.0;
const TOTAL_FRAMES = Math.floor(DURATION * FPS);
const WIDTH = 1920;
const HEIGHT = 1080;

const AUDIO_PATH = path.join(__dirname, 'soundtrack.wav');
const OUTPUT_MP4 = path.join(__dirname, 'climb_your_day_promo.mp4');

const SCENES = [
  { id: 1,  name: 'The Beginning',        start: 0.0,  end: 6.8  },
  { id: 2,  name: 'Add Your Habits',       start: 6.8,  end: 14.5 },
  { id: 3,  name: 'Complete a Habit',      start: 14.5, end: 22.5 },
  { id: 4,  name: 'Mountain Progress',     start: 22.5, end: 28.0 },
  { id: 5,  name: 'Daily Streak',          start: 28.0, end: 34.0 },
  { id: 6,  name: 'Smart Reminders',       start: 34.0, end: 40.0 },
  { id: 7,  name: 'Fight Distractions',    start: 40.0, end: 47.5 },
  { id: 8,  name: 'Focus Time',            start: 47.5, end: 54.5 },
  { id: 9,  name: 'Mountain Checkpoints',  start: 54.5, end: 63.5 },
  { id: 10, name: 'Summit Reached',        start: 63.5, end: 69.0 },
  { id: 11, name: 'Full App Overview',     start: 69.0, end: 76.5 },
  { id: 12, name: 'Your Summit',           start: 76.5, end: 86.0 }
];

function getSceneName(t) {
  for (let s of SCENES) {
    if (t >= s.start && t < s.end) return `${s.id}. ${s.name}`;
  }
  return '12. Your Summit';
}

(async () => {
  console.log(`===================================================`);
  console.log(`  CLIMB YOUR DAY — 1080p MP4 VIDEO PRODUCTION`);
  console.log(`  Duration: ${DURATION}s | Resolution: ${WIDTH}x${HEIGHT} | FPS: ${FPS}`);
  console.log(`  Total Frames: ${TOTAL_FRAMES}`);
  console.log(`  Audio Source: ${AUDIO_PATH}`);
  console.log(`  Output Video: ${OUTPUT_MP4}`);
  console.log(`===================================================\n`);

  if (!fs.existsSync(AUDIO_PATH)) {
    console.error(`Audio file not found: ${AUDIO_PATH}`);
    process.exit(1);
  }

  console.log('Launching headless Google Chrome...');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: [
      `--window-size=${WIDTH},${HEIGHT}`,
      '--no-sandbox',
      '--disable-gpu-sandbox',
      '--autoplay-policy=no-user-gesture-required'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
  console.log('Navigating to http://localhost:4173/?export=1 ...');
  await page.goto('http://localhost:4173/?export=1', { waitUntil: 'domcontentloaded' });

  // Wait for Google fonts and SVG assets to fully settle
  await new Promise(r => setTimeout(r, 2000));

  console.log('Spawning ffmpeg hardware encoder...');
  const ffmpeg = spawn('ffmpeg', [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-framerate', String(FPS),
    '-i', '-',
    '-i', AUDIO_PATH,
    '-c:v', 'h264_videotoolbox',
    '-b:v', '8M',
    '-c:a', 'aac',
    '-b:a', '256k',
    '-pix_fmt', 'yuv420p',
    '-shortest',
    OUTPUT_MP4
  ]);

  let ffmpegErr = '';
  ffmpeg.stderr.on('data', d => {
    ffmpegErr += d.toString();
  });

  const startTime = Date.now();
  console.log('Starting frame-by-frame capture...');

  for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
    const t = frame / FPS;

    await page.evaluate(time => {
      if (window.setTime) window.setTime(time, false);
    }, t);

    const imgBuf = await page.screenshot({ type: 'jpeg', quality: 92 });

    // Backpressure handling for pipe
    if (!ffmpeg.stdin.write(imgBuf)) {
      await new Promise(resolve => ffmpeg.stdin.once('drain', resolve));
    }

    if (frame % 100 === 0 || frame === TOTAL_FRAMES - 1) {
      const pct = ((frame / TOTAL_FRAMES) * 100).toFixed(1);
      const elapsedSec = (Date.now() - startTime) / 1000;
      const fpsReal = (frame + 1) / elapsedSec;
      const remainingSec = Math.max(0, (TOTAL_FRAMES - frame) / fpsReal);
      console.log(
        `[${pct.padStart(5, ' ')}%] Frame ${frame + 1}/${TOTAL_FRAMES} | ` +
        `Time: ${t.toFixed(2)}s | ${getSceneName(t)} | ` +
        `Speed: ${fpsReal.toFixed(1)} fps | ETA: ${remainingSec.toFixed(0)}s`
      );
    }
  }

  console.log('Finalizing video stream and flushing buffers...');
  ffmpeg.stdin.end();

  await new Promise((resolve, reject) => {
    ffmpeg.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg failed with exit code ${code}\n${ffmpegErr}`));
    });
  });

  const totalElapsed = (Date.now() - startTime) / 1000;
  await browser.close();

  if (fs.existsSync(OUTPUT_MP4)) {
    const stats = fs.statSync(OUTPUT_MP4);
    const sizeMb = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`\n===================================================`);
    console.log(`✓ VIDEO GENERATED SUCCESSFULLY!`);
    console.log(`  File: ${OUTPUT_MP4}`);
    console.log(`  Size: ${sizeMb} MB`);
    console.log(`  Encoding Time: ${totalElapsed.toFixed(1)}s (${(TOTAL_FRAMES / totalElapsed).toFixed(1)} fps)`);
    console.log(`===================================================\n`);
  }
})();
