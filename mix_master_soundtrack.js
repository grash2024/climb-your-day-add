/**
 * Broadcast Master Audio Mixer for "Climb Your Day"
 * - Combines procedural synth soundtrack + natural speech narration
 * - Implements broadcast-grade sidechain audio ducking
 * - Adds vocal room enhancement & master limiting
 * - Outputs: soundtrack.wav (Master), soundtrack_music.wav, soundtrack_voice.wav
 */

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const DURATION = 86.0;
const TOTAL_SAMPLES = Math.floor(SAMPLE_RATE * DURATION);

// Note frequencies (Hz)
const NOTE = {
  C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.00, A2: 110.00, B2: 123.47,
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
  C6: 1046.50, D6: 1174.66, E6: 1318.51, G6: 1567.98
};

// Buffers
const musicL = new Float32Array(TOTAL_SAMPLES);
const musicR = new Float32Array(TOTAL_SAMPLES);
const voiceL = new Float32Array(TOTAL_SAMPLES);
const voiceR = new Float32Array(TOTAL_SAMPLES);
const masterL = new Float32Array(TOTAL_SAMPLES);
const masterR = new Float32Array(TOTAL_SAMPLES);

// -------------------------------------------------------------
// 1. PROCEDURAL MUSIC & SFX SYNTHESIS
// -------------------------------------------------------------
function addPad(startTime, dur, freqs, gain = 0.18, pan = 0.0) {
  const startSample = Math.floor(startTime * SAMPLE_RATE);
  const numSamples = Math.floor(dur * SAMPLE_RATE);
  const endSample = Math.min(TOTAL_SAMPLES, startSample + numSamples);
  const attackSamples = Math.floor(SAMPLE_RATE * 0.8);
  const releaseSamples = Math.floor(SAMPLE_RATE * 1.2);

  freqs.forEach(freq => {
    const detunes = [-0.004, 0.0, 0.004];
    detunes.forEach((det, dIdx) => {
      const f = freq * (1 + det);
      const phase = Math.random() * Math.PI * 2;
      const oscGain = gain / (freqs.length * detunes.length);

      for (let i = startSample; i < endSample; i++) {
        const localIdx = i - startSample;
        let env = 1.0;
        if (localIdx < attackSamples) {
          env = localIdx / attackSamples;
        } else if (localIdx > numSamples - releaseSamples) {
          env = Math.max(0, (numSamples - localIdx) / releaseSamples);
        }
        const t = (i - startSample) / SAMPLE_RATE;
        const s = Math.sin(2 * Math.PI * f * t + phase) * 0.7 +
                  Math.sin(4 * Math.PI * f * t + phase) * 0.2 +
                  Math.sin(6 * Math.PI * f * t + phase) * 0.1;
        const val = s * env * oscGain;
        const panL = 0.5 * (1 - pan + (dIdx - 1) * 0.2);
        const panR = 0.5 * (1 + pan - (dIdx - 1) * 0.2);
        musicL[i] += val * panL;
        musicR[i] += val * panR;
      }
    });
  });
}

function addPluck(startTime, freq, gain = 0.15, decayTime = 1.2, pan = 0.0) {
  const startSample = Math.floor(startTime * SAMPLE_RATE);
  const numSamples = Math.floor(decayTime * SAMPLE_RATE);
  const endSample = Math.min(TOTAL_SAMPLES, startSample + numSamples);
  const panL = 0.5 * (1 - pan);
  const panR = 0.5 * (1 + pan);

  for (let i = startSample; i < endSample; i++) {
    const t = (i - startSample) / SAMPLE_RATE;
    const env = Math.exp(-t * (4.0 / decayTime));
    const s = Math.sin(2 * Math.PI * freq * t) * 0.75 +
              Math.sin(2 * Math.PI * freq * 2.756 * t) * 0.2 +
              Math.sin(2 * Math.PI * freq * 5.404 * t) * 0.05;
    const val = s * env * gain;
    musicL[i] += val * panL;
    musicR[i] += val * panR;

    const delaySample = i + Math.floor(0.26 * SAMPLE_RATE);
    if (delaySample < TOTAL_SAMPLES) {
      musicL[delaySample] += val * panR * 0.24;
      musicR[delaySample] += val * panL * 0.28;
    }
  }
}

function addBass(startTime, dur, freq, gain = 0.22) {
  const startSample = Math.floor(startTime * SAMPLE_RATE);
  const numSamples = Math.floor(dur * SAMPLE_RATE);
  const endSample = Math.min(TOTAL_SAMPLES, startSample + numSamples);

  for (let i = startSample; i < endSample; i++) {
    const t = (i - startSample) / SAMPLE_RATE;
    const attack = Math.min(1.0, t / 0.04);
    const release = Math.min(1.0, (dur - t) / 0.12);
    const env = attack * release;
    const s = Math.sin(2 * Math.PI * freq * t) * 0.85 +
              Math.sin(4 * Math.PI * freq * t) * 0.15;
    const val = s * env * gain;
    musicL[i] += val * 0.5;
    musicR[i] += val * 0.5;
  }
}

function addKick(startTime, gain = 0.3) {
  const startSample = Math.floor(startTime * SAMPLE_RATE);
  const numSamples = Math.floor(0.35 * SAMPLE_RATE);
  const endSample = Math.min(TOTAL_SAMPLES, startSample + numSamples);

  for (let i = startSample; i < endSample; i++) {
    const t = (i - startSample) / SAMPLE_RATE;
    const sweep = Math.exp(-t * 26);
    const f = 45 + 130 * sweep;
    const env = Math.exp(-t * 11);
    const val = Math.sin(2 * Math.PI * f * t) * env * gain;
    musicL[i] += val * 0.5;
    musicR[i] += val * 0.5;
  }
}

function addHiHat(startTime, gain = 0.07, isShaker = false) {
  const startSample = Math.floor(startTime * SAMPLE_RATE);
  const dur = isShaker ? 0.09 : 0.045;
  const numSamples = Math.floor(dur * SAMPLE_RATE);
  const endSample = Math.min(TOTAL_SAMPLES, startSample + numSamples);
  let lastNoise = 0;

  for (let i = startSample; i < endSample; i++) {
    const t = (i - startSample) / SAMPLE_RATE;
    const env = Math.exp(-t * (isShaker ? 35 : 75));
    const white = Math.random() * 2 - 1;
    const highpass = white - lastNoise * 0.85;
    lastNoise = white;
    const val = highpass * env * gain;
    musicL[i] += val * 0.45;
    musicR[i] += val * 0.55;
  }
}

function addChime(startTime, freqs, gain = 0.12) {
  freqs.forEach((freq, idx) => {
    addPluck(startTime + idx * 0.075, freq, gain, 2.2, (idx % 2 === 0 ? -0.3 : 0.3));
  });
}

function addWhoosh(startTime, dur = 1.0, gain = 0.14) {
  const startSample = Math.floor(startTime * SAMPLE_RATE);
  const numSamples = Math.floor(dur * SAMPLE_RATE);
  const endSample = Math.min(TOTAL_SAMPLES, startSample + numSamples);
  let filterState = 0;

  for (let i = startSample; i < endSample; i++) {
    const progress = (i - startSample) / numSamples;
    const env = Math.sin(progress * Math.PI);
    const centerFreq = 300 + 2600 * Math.sin(progress * Math.PI);
    const q = 0.06;
    const noise = Math.random() * 2 - 1;
    filterState += (noise - filterState) * (centerFreq / SAMPLE_RATE * 2);
    const val = filterState * env * gain;
    musicL[i] += val * (1 - progress);
    musicR[i] += val * progress;
  }
}

function addWindAmbiance(startTime, dur, gain = 0.06) {
  const startSample = Math.floor(startTime * SAMPLE_RATE);
  const numSamples = Math.floor(dur * SAMPLE_RATE);
  const endSample = Math.min(TOTAL_SAMPLES, startSample + numSamples);
  let filterStateL = 0;
  let filterStateR = 0;

  for (let i = startSample; i < endSample; i++) {
    const t = (i - startSample) / SAMPLE_RATE;
    const mod = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.15 * t);
    const cutoff = 250 + 450 * mod;
    const alpha = (cutoff / SAMPLE_RATE) * 2;
    filterStateL += ((Math.random() * 2 - 1) - filterStateL) * alpha;
    filterStateR += ((Math.random() * 2 - 1) - filterStateR) * (alpha * 1.1);
    musicL[i] += filterStateL * gain;
    musicR[i] += filterStateR * gain;
  }
}

console.log('Rendering procedural music soundtrack...');

// Mountain Wind & Horizon Ambience
addWindAmbiance(0.0, 86.0, 0.04);

// Part A: Dawn Awakening (0.0s – 14.5s)
addPad(0.0, 7.5, [NOTE.C3, NOTE.G3, NOTE.C4, NOTE.E4], 0.22);
addPad(6.5, 8.5, [NOTE.A2, NOTE.E3, NOTE.C4, NOTE.E4], 0.22);
const dawnMelody = [
  { t: 1.5, f: NOTE.G4 }, { t: 2.8, f: NOTE.C5 }, { t: 4.2, f: NOTE.D5 }, { t: 5.6, f: NOTE.E5 },
  { t: 7.2, f: NOTE.G4 }, { t: 8.8, f: NOTE.C5 }, { t: 10.4, f: NOTE.B4 }, { t: 12.0, f: NOTE.A4 }, { t: 13.4, f: NOTE.G4 }
];
dawnMelody.forEach(n => addPluck(n.t, n.f, 0.16, 1.4));

// Part B: Habit Flow & Ascending Trail (14.5s – 28.0s)
for (let t = 14.5; t < 28.0; t += 3.375) {
  addPad(t, 3.8, [NOTE.F3, NOTE.C4, NOTE.E4, NOTE.A4], 0.24);
  addBass(t, 3.2, NOTE.F2, 0.25);
}
for (let t = 14.5; t < 28.0; t += 0.75) {
  addHiHat(t, 0.045, true);
  if (Math.round((t - 14.5) / 0.75) % 2 === 0) addKick(t, 0.26);
}
// Scene 3 Milestone SFX at 17.0s
addWhoosh(16.6, 1.2, 0.16);
addChime(17.2, [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6], 0.22);

// Part C: Streaks & Smart Reminders (28.0s – 40.0s)
for (let t = 28.0; t < 40.0; t += 3.0) {
  addPad(t, 3.4, [NOTE.G3, NOTE.D4, NOTE.G4, NOTE.B4], 0.23);
  addBass(t, 2.9, NOTE.G2, 0.26);
}
for (let t = 28.0; t < 40.0; t += 0.375) {
  addHiHat(t, 0.04);
  if (Math.round((t - 28.0) / 0.375) % 4 === 0) addKick(t, 0.25);
}
// Streak bell ticks
for (let d = 0; d < 7; d++) {
  addPluck(29.2 + d * 0.45, NOTE.G5 * Math.pow(1.05946, d * 2), 0.14, 0.8, (d % 2 ? 0.3 : -0.3));
}
// Notification bell at 35.2s
addPluck(35.2, NOTE.E6, 0.22, 1.5, 0.2);
addPluck(35.35, NOTE.B5, 0.20, 1.8, -0.2);

// Part D: Focus Mode & Anti-Distraction (40.0s – 54.5s)
for (let t = 40.0; t < 54.5; t += 3.6) {
  addPad(t, 4.0, [NOTE.A2, NOTE.E3, NOTE.A3, NOTE.C4], 0.22);
  addBass(t, 3.5, NOTE.A2, 0.28);
}
// Shield Lock SFX at 43.5s
addPluck(43.5, NOTE.C4, 0.25, 0.4);
addPluck(43.58, NOTE.G4, 0.25, 0.8);
for (let t = 44.0; t < 54.5; t += 0.375) {
  addHiHat(t, 0.05);
  if (Math.round((t - 44.0) / 0.375) % 2 === 0) addKick(t, 0.28);
}
// Focus session complete chime at 53.0s
addChime(53.0, [NOTE.A4, NOTE.C5, NOTE.E5, NOTE.A5], 0.20);

// Part E: Mountain Checkpoints & Summit Ascent (54.5s – 69.0s)
for (let t = 54.5; t < 69.0; t += 3.6) {
  addPad(t, 4.0, [NOTE.C3, NOTE.G3, NOTE.C4, NOTE.E4, NOTE.G4], 0.28);
  addBass(t, 3.5, NOTE.C2, 0.30);
}
for (let t = 54.5; t < 63.5; t += 0.375) {
  addHiHat(t, 0.06);
  if (Math.round((t - 54.5) / 0.375) % 2 === 0) addKick(t, 0.30);
}
// Checkpoint fanfare sweeps (Scenes 9 & 10)
const cpTimes = [55.8, 57.2, 58.6, 60.0, 61.4, 62.8];
cpTimes.forEach((ct, i) => {
  addPluck(ct, NOTE.C5 * Math.pow(1.05946, i * 2), 0.18, 1.2);
});
// SUMMIT ARRIVAL FANFARE at 64.0s
addWhoosh(63.2, 1.5, 0.22);
addChime(64.2, [NOTE.C5, NOTE.G5, NOTE.C6, NOTE.E6], 0.30);
addPad(64.0, 6.0, [NOTE.C3, NOTE.G3, NOTE.E4, NOTE.G4, NOTE.C5], 0.32);

// Part F: App Overview & Hero Outro (69.0s – 86.0s)
for (let t = 69.0; t < 80.0; t += 3.6) {
  addPad(t, 4.0, [NOTE.F3, NOTE.C4, NOTE.E4, NOTE.A4], 0.25);
  addBass(t, 3.5, NOTE.F2, 0.26);
}
for (let t = 69.0; t < 76.5; t += 0.375) {
  addHiHat(t, 0.045);
  if (Math.round((t - 69.0) / 0.375) % 4 === 0) addKick(t, 0.24);
}
// Final Horizon Resolution (79.0s – 86.0s)
addPad(78.5, 7.5, [NOTE.C3, NOTE.G3, NOTE.C4, NOTE.E4, NOTE.G4], 0.28);
addPluck(80.0, NOTE.C5, 0.20, 3.0);
addPluck(81.5, NOTE.G5, 0.18, 3.5);
addPluck(83.0, NOTE.C6, 0.22, 4.5);

// -------------------------------------------------------------
// 2. LOAD & INTEGRATE SPEECH VOICEOVER CLIPS
// -------------------------------------------------------------
console.log('Loading voiceover clips from scratch_voice/ ...');

const clipsConfig = [
  { scene: 1,  time: 1.0  },
  { scene: 2,  time: 7.6  },
  { scene: 3,  time: 15.0 },
  { scene: 4,  time: 23.0 },
  { scene: 5,  time: 28.6 },
  { scene: 6,  time: 34.6 },
  { scene: 7,  time: 40.8 },
  { scene: 8,  time: 48.0 },
  { scene: 9,  time: 55.2 },
  { scene: 10, time: 64.0 },
  { scene: 11, time: 69.6 },
  { scene: 12, time: 77.2 }
];

function readWavSamples(filePath) {
  const buf = fs.readFileSync(filePath);
  // Find 'fmt ' and 'data' chunks
  let pos = 12;
  let audioFormat = 1;
  let numChannels = 1;
  let sampleRate = 44100;
  let bitsPerSample = 16;
  let dataOffset = 0;
  let dataSize = 0;

  while (pos < buf.length - 8) {
    const chunkId = buf.toString('ascii', pos, pos + 4);
    const chunkSize = buf.readUInt32LE(pos + 4);
    if (chunkId === 'fmt ') {
      audioFormat = buf.readUInt16LE(pos + 8);
      numChannels = buf.readUInt16LE(pos + 10);
      sampleRate = buf.readUInt32LE(pos + 12);
      bitsPerSample = buf.readUInt16LE(pos + 22);
    } else if (chunkId === 'data') {
      dataOffset = pos + 8;
      dataSize = chunkSize;
      break;
    }
    pos += 8 + chunkSize;
  }

  if (!dataOffset) {
    throw new Error(`Data chunk not found in ${filePath}`);
  }

  const sampleCount = Math.floor(dataSize / (bitsPerSample / 8) / numChannels);
  const outSamples = new Float32Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    const byteIdx = dataOffset + i * (bitsPerSample / 8) * numChannels;
    const rawInt16 = buf.readInt16LE(byteIdx);
    outSamples[i] = rawInt16 / 32768.0;
  }

  return outSamples;
}

const voiceActiveMask = new Float32Array(TOTAL_SAMPLES);

clipsConfig.forEach((cfg, idx) => {
  const clipFile = path.join(__dirname, 'scratch_voice', `clip_${idx + 1}.wav`);
  if (!fs.existsSync(clipFile)) {
    console.warn(`Clip file missing: ${clipFile}`);
    return;
  }

  const rawClip = readWavSamples(clipFile);
  const startSample = Math.floor(cfg.time * SAMPLE_RATE);
  const endSample = Math.min(TOTAL_SAMPLES, startSample + rawClip.length);
  const fadeSamples = Math.floor(0.015 * SAMPLE_RATE); // 15ms anti-click fade

  for (let i = startSample; i < endSample; i++) {
    const srcIdx = i - startSample;
    let env = 1.0;
    if (srcIdx < fadeSamples) {
      env = srcIdx / fadeSamples;
    } else if (srcIdx > rawClip.length - fadeSamples) {
      env = Math.max(0, (rawClip.length - srcIdx) / fadeSamples);
    }

    const s = rawClip[srcIdx] * env;
    // Subtle presence boost & center positioning
    voiceL[i] += s * 0.95;
    voiceR[i] += s * 0.95;

    // Subtle warm studio reflection (14ms delay)
    const reflectionIdx = i + Math.floor(0.014 * SAMPLE_RATE);
    if (reflectionIdx < TOTAL_SAMPLES) {
      voiceL[reflectionIdx] += s * 0.08;
      voiceR[reflectionIdx] += s * 0.08;
    }

    if (Math.abs(s) > 0.02) {
      voiceActiveMask[i] = 1.0;
    }
  }
});

// -------------------------------------------------------------
// 3. BROADCAST AUDIO DUCKING ENVELOPE
// -------------------------------------------------------------
console.log('Calculating broadcast audio ducking envelope...');

const duckEnvelope = new Float32Array(TOTAL_SAMPLES);
duckEnvelope.fill(1.0);

const preDuckSamples = Math.floor(0.12 * SAMPLE_RATE); // 120ms pre-duck
const postReleaseSamples = Math.floor(0.35 * SAMPLE_RATE); // 350ms release
const DUCK_FACTOR = 0.38; // Dips music to 38% (-8.4 dB) during speech

// Mark duck windows
for (let i = 0; i < TOTAL_SAMPLES; i++) {
  if (voiceActiveMask[i] > 0) {
    const start = Math.max(0, i - preDuckSamples);
    const end = Math.min(TOTAL_SAMPLES - 1, i + postReleaseSamples);
    for (let k = start; k <= end; k++) {
      duckEnvelope[k] = Math.min(duckEnvelope[k], DUCK_FACTOR);
    }
  }
}

// Smooth the duck envelope with a moving average filter
const smoothedDuck = new Float32Array(TOTAL_SAMPLES);
const windowSize = Math.floor(0.08 * SAMPLE_RATE); // 80ms smoothing window
let runningSum = 0;

for (let i = 0; i < TOTAL_SAMPLES; i++) {
  runningSum += duckEnvelope[i];
  if (i >= windowSize) runningSum -= duckEnvelope[i - windowSize];
  const count = Math.min(i + 1, windowSize);
  smoothedDuck[i] = runningSum / count;
}

// -------------------------------------------------------------
// 4. COMBINE & MASTER LIMITER
// -------------------------------------------------------------
console.log('Combining music and voiceover with master limiter...');

let maxMusicPeak = 0;
let maxVoicePeak = 0;
let maxMasterPeak = 0;

for (let i = 0; i < TOTAL_SAMPLES; i++) {
  maxMusicPeak = Math.max(maxMusicPeak, Math.abs(musicL[i]), Math.abs(musicR[i]));
  maxVoicePeak = Math.max(maxVoicePeak, Math.abs(voiceL[i]), Math.abs(voiceR[i]));

  // Ducked music + Voiceover
  const duckedL = musicL[i] * smoothedDuck[i];
  const duckedR = musicR[i] * smoothedDuck[i];

  // Voiceover with warm commercial boost
  const vL = voiceL[i] * 1.15;
  const vR = voiceR[i] * 1.15;

  masterL[i] = duckedL + vL;
  masterR[i] = duckedR + vR;

  maxMasterPeak = Math.max(maxMasterPeak, Math.abs(masterL[i]), Math.abs(masterR[i]));
}

console.log(`Peaks - Music: ${maxMusicPeak.toFixed(3)}, Voice: ${maxVoicePeak.toFixed(3)}, Master: ${maxMasterPeak.toFixed(3)}`);

// -------------------------------------------------------------
// 5. EXPORT WAV FILES
// -------------------------------------------------------------
function writeStereoWav(filePath, leftCh, rightCh, normFactor = 1.0) {
  const numChannels = 2;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = SAMPLE_RATE * blockAlign;
  const dataSize = TOTAL_SAMPLES * blockAlign;
  const totalSize = 44 + dataSize;

  const outBuffer = Buffer.alloc(totalSize);

  // RIFF header
  outBuffer.write('RIFF', 0);
  outBuffer.writeUInt32LE(totalSize - 8, 4);
  outBuffer.write('WAVE', 8);

  // fmt chunk
  outBuffer.write('fmt ', 12);
  outBuffer.writeUInt32LE(16, 16);
  outBuffer.writeUInt16LE(1, 20); // PCM
  outBuffer.writeUInt16LE(numChannels, 22);
  outBuffer.writeUInt32LE(SAMPLE_RATE, 24);
  outBuffer.writeUInt32LE(byteRate, 28);
  outBuffer.writeUInt16LE(blockAlign, 32);
  outBuffer.writeUInt16LE(16, 34);

  // data chunk
  outBuffer.write('data', 36);
  outBuffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    // 1.5s master outro fade
    let env = 1.0;
    if (i > TOTAL_SAMPLES - SAMPLE_RATE * 1.5) {
      env = (TOTAL_SAMPLES - i) / (SAMPLE_RATE * 1.5);
    }

    let sL = Math.max(-0.98, Math.min(0.98, leftCh[i] * normFactor * env));
    let sR = Math.max(-0.98, Math.min(0.98, rightCh[i] * normFactor * env));

    outBuffer.writeInt16LE(Math.round(sL * 32767), offset);
    outBuffer.writeInt16LE(Math.round(sR * 32767), offset + 2);
    offset += 4;
  }

  fs.writeFileSync(filePath, outBuffer);
  const st = fs.statSync(filePath);
  console.log(`Saved: ${filePath} (${(st.size / 1024 / 1024).toFixed(2)} MB)`);
}

// Master norm factor
const masterNorm = maxMasterPeak > 0.96 ? 0.96 / maxMasterPeak : 1.0;
const musicNorm = maxMusicPeak > 0.96 ? 0.96 / maxMusicPeak : 1.0;
const voiceNorm = maxVoicePeak > 0.96 ? 0.96 / maxVoicePeak : 1.0;

// Export master soundtrack (Music + Ducked Voice + SFX)
writeStereoWav(path.join(__dirname, 'soundtrack.wav'), masterL, masterR, masterNorm);

// Export music-only soundtrack
writeStereoWav(path.join(__dirname, 'soundtrack_music.wav'), musicL, musicR, musicNorm);

// Export voice-only soundtrack
writeStereoWav(path.join(__dirname, 'soundtrack_voice.wav'), voiceL, voiceR, voiceNorm);

console.log('Audio production completed successfully!');
