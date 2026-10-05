const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const clips = [
  {
    scene: 1,
    time: 1.0,
    text: "Every great journey begins with a single step. Welcome to Climb Your Day."
  },
  {
    scene: 2,
    time: 7.6,
    text: "Turn your daily intentions into mountain quests. Create your habits and set your targets."
  },
  {
    scene: 3,
    time: 15.0,
    text: "Complete a habit, earn points, and watch your climber rise with every victory."
  },
  {
    scene: 4,
    time: 23.0,
    text: "Your progress is real. Every point brings you closer to the mountain peak."
  },
  {
    scene: 5,
    time: 28.6,
    text: "Build unstoppable momentum. Keep your daily streak alive, day after day."
  },
  {
    scene: 6,
    time: 34.6,
    text: "Smart reminders arrive at the perfect moment, keeping your focus sharp."
  },
  {
    scene: 7,
    time: 40.8,
    text: "Cut through the noise. Lock away distracting apps and protect your time."
  },
  {
    scene: 8,
    time: 48.0,
    text: "Stay locked in with focus sessions. Deep work that powers your ascent."
  },
  {
    scene: 9,
    time: 55.2,
    text: "Conquer each trail milestone. From Base Camp to Discipline, and on toward the summit."
  },
  {
    scene: 10,
    time: 64.0,
    text: "You made it to the summit. Your daily habits turned into a magnificent triumph."
  },
  {
    scene: 11,
    time: 69.6,
    text: "Climb Your Day gamifies personal growth, transforming your routine into an epic adventure."
  },
  {
    scene: 12,
    time: 77.2,
    text: "Your Day. Your Habits. Your Summit. Download Climb Your Day, and start climbing today."
  }
];

const tmpDir = path.join(__dirname, 'scratch_voice');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

console.log(`Synthesizing ${clips.length} voiceover clips using voice: Samantha...`);

clips.forEach((clip, i) => {
  const outPath = path.join(tmpDir, `clip_${i + 1}.wav`);
  const cmd = `say -v Samantha -r 160 "${clip.text}" -o "${outPath}" --data-format=LEI16@44100`;
  execSync(cmd);
  const info = execSync(`afinfo "${outPath}"`).toString();
  const m = info.match(/estimated duration: ([0-9.]+) sec/);
  const dur = m ? parseFloat(m[1]) : 0;
  console.log(`[Clip ${i + 1}] at ${clip.time.toFixed(1)}s (dur: ${dur.toFixed(2)}s, ends: ${(clip.time + dur).toFixed(2)}s) -> "${clip.text}"`);
});

console.log('All voice clips synthesized successfully.');
