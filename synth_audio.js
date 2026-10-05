/**
 * Audio Synthesizer for "Climb Your Day" Promotional Motion Graphic
 * Generates an 86-second 44.1kHz 16-bit Stereo PCM WAV soundtrack:
 * - Ambient warm mountain analog pads
 * - Melodic pentatonic kalimba & synth plucks
 * - Deep sub-bass & acoustic percussion
 * - Timeline-synced sound effects (habit chimes, energy whoosh, streak ticks, summit fanfare)
 * 100% royalty-free, procedural, original music.
 */

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const DURATION = 86.0;
const TOTAL_SAMPLES = Math.floor(SAMPLE_RATE * DURATION);

// Left and Right channel float buffers (-1.0 to 1.0)
const bufferL = new Float32Array(TOTAL_SAMPLES);
const bufferR = new Float32Array(TOTAL_SAMPLES);

// Note frequencies (Hz)
const NOTE = {
  C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.00, A2: 110.00, B2: 123.47,
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
  C6: 1046.50, D6: 1174.66, E6: 1318.51, G6: 1567.98
};

// -------------------------------------------------------------
// SOUND GENERATORS
// -------------------------------------------------------------

// Add warm detuned synth pad chord
function addPad(startTime, dur, freqs, gain = 0.18, pan = 0.0) {
  const startSample = Math.floor(startTime * SAMPLE_RATE);
  const numSamples = Math.floor(dur * SAMPLE_RATE);
  const endSample = Math.min(TOTAL_SAMPLES, startSample + numSamples);

  const attackSamples = Math.floor(SAMPLE_RATE * 0.8);
  const releaseSamples = Math.floor(SAMPLE_RATE * 1.2);

  freqs.forEach(freq => {
    // 3 detuned oscillators per note for rich lush analog chorus
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

        // Soft warmth: sine + warm 2nd & 3rd harmonic
        const t = (i - startSample) / SAMPLE_RATE;
        const s = Math.sin(2 * Math.PI * f * t + phase) * 0.7 +
                  Math.sin(4 * Math.PI * f * t + phase) * 0.2 +
                  Math.sin(6 * Math.PI * f * t + phase) * 0.1;

        const val = s * env * oscGain;
        const panL = 0.5 * (1 - pan + (dIdx - 1) * 0.2);
        const panR = 0.5 * (1 + pan - (dIdx - 1) * 0.2);

        bufferL[i] += val * panL;
        bufferR[i] += val * panR;
      }
    });
  });
}

// Add melodic kalimba / pluck note
function addPluck(startTime, freq, gain = 0.15, decayTime = 1.2, pan = 0.0) {
  const startSample = Math.floor(startTime * SAMPLE_RATE);
  const numSamples = Math.floor(decayTime * SAMPLE_RATE);
  const endSample = Math.min(TOTAL_SAMPLES, startSample + numSamples);

  const panL = 0.5 * (1 - pan);
  const panR = 0.5 * (1 + pan);

  for (let i = startSample; i < endSample; i++) {
    const t = (i - startSample) / SAMPLE_RATE;
    const env = Math.exp(-t * (4.0 / decayTime));

    // Fundamental + bell harmonic
    const s = Math.sin(2 * Math.PI * freq * t) * 0.75 +
              Math.sin(2 * Math.PI * freq * 2.756 * t) * 0.2 +
              Math.sin(2 * Math.PI * freq * 5.404 * t) * 0.05;

    const val = s * env * gain;
    bufferL[i] += val * panL;
    bufferR[i] += val * panR;

    // Simple stereo delay echo at 0.26s
    const echoSample = i + Math.floor(SAMPLE_RATE * 0.26);
    if (echoSample < TOTAL_SAMPLES) {
      bufferL[echoSample] += val * panR * 0.35;
      bufferR[echoSample] += val * panL * 0.35;
    }
  }
}

// Add deep sub bass note
function addBass(startTime, dur, freq, gain = 0.22) {
  const startSample = Math.floor(startTime * SAMPLE_RATE);
  const numSamples = Math.floor(dur * SAMPLE_RATE);
  const endSample = Math.min(TOTAL_SAMPLES, startSample + numSamples);

  for (let i = startSample; i < endSample; i++) {
    const t = (i - startSample) / SAMPLE_RATE;
    let env = 1.0;
    if (i - startSample < SAMPLE_RATE * 0.04) {
      env = (i - startSample) / (SAMPLE_RATE * 0.04);
    } else if (i - startSample > numSamples - SAMPLE_RATE * 0.2) {
      env = Math.max(0, (numSamples - (i - startSample)) / (SAMPLE_RATE * 0.2));
    }

    // Pure warm low end
    const s = Math.sin(2 * Math.PI * freq * t) * 0.85 +
              Math.sin(4 * Math.PI * freq * t) * 0.15;

    const val = s * env * gain;
    bufferL[i] += val * 0.5;
    bufferR[i] += val * 0.5;
  }
}

// Add soft warm kick drum
function addKick(startTime, gain = 0.35) {
  const startSample = Math.floor(startTime * SAMPLE_RATE);
  const numSamples = Math.floor(0.4 * SAMPLE_RATE);
  const endSample = Math.min(TOTAL_SAMPLES, startSample + numSamples);

  for (let i = startSample; i < endSample; i++) {
    const t = (i - startSample) / SAMPLE_RATE;
    const env = Math.exp(-t * 9.0);
    // Pitch drop from 140Hz down to 48Hz
    const pitch = 48 + 92 * Math.exp(-t * 28.0);
    const s = Math.sin(2 * Math.PI * pitch * t);
    const val = s * env * gain;
    bufferL[i] += val * 0.5;
    bufferR[i] += val * 0.5;
  }
}

// Add gentle acoustic shaker / hi-hat
function addHiHat(startTime, gain = 0.06, pan = 0.2) {
  const startSample = Math.floor(startTime * SAMPLE_RATE);
  const numSamples = Math.floor(0.08 * SAMPLE_RATE);
  const endSample = Math.min(TOTAL_SAMPLES, startSample + numSamples);

  for (let i = startSample; i < endSample; i++) {
    const t = (i - startSample) / SAMPLE_RATE;
    const env = Math.exp(-t * 45.0);
    const noise = (Math.random() * 2 - 1);
    const val = noise * env * gain;
    bufferL[i] += val * (1 - pan);
    bufferR[i] += val * (1 + pan);
  }
}

// Add resonant energy whoosh SFX (filtered noise sweep)
function addWhoosh(startTime, dur, gain = 0.2, panStart = 0.6, panEnd = -0.6) {
  const startSample = Math.floor(startTime * SAMPLE_RATE);
  const numSamples = Math.floor(dur * SAMPLE_RATE);
  const endSample = Math.min(TOTAL_SAMPLES, startSample + numSamples);

  let bandpassState = 0;
  for (let i = startSample; i < endSample; i++) {
    const progress = (i - startSample) / numSamples;
    const env = Math.sin(progress * Math.PI); // Smooth arc

    // Center frequency rises from 400Hz to 2800Hz
    const centerFreq = 400 + progress * 2400;
    const pan = panStart + (panEnd - panStart) * progress;

    const noise = Math.random() * 2 - 1;
    // Simple 1-pole resonant tracking
    const alpha = (2 * Math.PI * centerFreq) / SAMPLE_RATE;
    bandpassState += alpha * (noise - bandpassState);

    const val = bandpassState * env * gain;
    bufferL[i] += val * 0.5 * (1 - pan);
    bufferR[i] += val * 0.5 * (1 + pan);
  }
}

// Add crystal bell chime SFX
function addChime(startTime, freq, gain = 0.2, decay = 2.0, pan = 0.0) {
  const startSample = Math.floor(startTime * SAMPLE_RATE);
  const numSamples = Math.floor(decay * SAMPLE_RATE);
  const endSample = Math.min(TOTAL_SAMPLES, startSample + numSamples);

  for (let i = startSample; i < endSample; i++) {
    const t = (i - startSample) / SAMPLE_RATE;
    const env = Math.exp(-t * (3.5 / decay));
    const s = Math.sin(2 * Math.PI * freq * t) * 0.7 +
              Math.sin(2 * Math.PI * freq * 2.0 * t) * 0.2 +
              Math.sin(2 * Math.PI * freq * 3.01 * t) * 0.1;
    const val = s * env * gain;
    bufferL[i] += val * 0.5 * (1 - pan);
    bufferR[i] += val * 0.5 * (1 + pan);
  }
}

// -------------------------------------------------------------
// COMPOSING THE 86-SECOND SOUNDTRACK
// -------------------------------------------------------------
console.log('Composing promotional soundtrack for Climb Your Day...');

const BPM = 112;
const BEAT = 60 / BPM; // ~0.5357s
const BAR = BEAT * 4;  // ~2.1428s

// --- 1. INTRO (0s – 6.8s): Serene mountain dawn ---
addPad(0.0, 3.8, [NOTE.C3, NOTE.G3, NOTE.B3, NOTE.E4], 0.16, -0.2);
addPad(3.5, 3.6, [NOTE.A2, NOTE.E3, NOTE.G3, NOTE.C4], 0.16, 0.2);
addBass(0.2, 3.5, NOTE.C2, 0.18);
addBass(3.6, 3.2, NOTE.A2, 0.18);

// Gentle dawn chimes
[NOTE.C5, NOTE.E5, NOTE.G5, NOTE.B5, NOTE.C6].forEach((n, i) => {
  addPluck(1.5 + i * 0.45, n, 0.08, 1.8, (i % 2 === 0 ? -0.3 : 0.3));
});

// --- 2. ADD & COMPLETE HABITS (6.8s – 22.5s) ---
// Chords & Bass
const s2Chords = [
  { t: 6.8,  chord: [NOTE.C3, NOTE.G3, NOTE.C4, NOTE.E4], bass: NOTE.C2 },
  { t: 10.8, chord: [NOTE.G2, NOTE.D3, NOTE.G3, NOTE.B3], bass: NOTE.G2 },
  { t: 14.8, chord: [NOTE.A2, NOTE.E3, NOTE.A3, NOTE.C4], bass: NOTE.A2 },
  { t: 18.8, chord: [NOTE.F2, NOTE.C3, NOTE.F3, NOTE.A3], bass: NOTE.F2 }
];

s2Chords.forEach(c => {
  addPad(c.t, 4.2, c.chord, 0.18);
  addBass(c.t, 3.9, c.bass, 0.22);
});

// Upbeat rhythm starts at 7.0s
for (let t = 7.0; t < 22.5; t += BEAT) {
  const beatNum = Math.round((t - 7.0) / BEAT) % 4;
  if (beatNum === 0 || beatNum === 2) {
    addKick(t, 0.28);
  }
  addHiHat(t + BEAT * 0.5, 0.05, 0.25);
}

// Sparkling melodic arpeggios
const s2Melody = [
  { t: 7.2, n: NOTE.E4 }, { t: 7.5, n: NOTE.G4 }, { t: 7.8, n: NOTE.C5 }, { t: 8.3, n: NOTE.D5 },
  { t: 8.8, n: NOTE.E5 }, { t: 9.4, n: NOTE.D5 }, { t: 10.0, n: NOTE.G4 },
  { t: 11.2, n: NOTE.D4 }, { t: 11.5, n: NOTE.G4 }, { t: 11.8, n: NOTE.B4 }, { t: 12.4, n: NOTE.D5 },
  { t: 13.0, n: NOTE.C5 }, { t: 13.6, n: NOTE.B4 }, { t: 14.0, n: NOTE.G4 },
  { t: 15.2, n: NOTE.C4 }, { t: 15.5, n: NOTE.E4 }, { t: 15.8, n: NOTE.A4 }, { t: 16.4, n: NOTE.C5 }
];
s2Melody.forEach(m => addPluck(m.t, m.n, 0.12, 1.0, (Math.random() - 0.5) * 0.6));

// SPECIFIC SFX: Habit complete at 17.0s!
// Golden +50 points pop & energetic chime
addChime(17.0, NOTE.E5, 0.24, 1.8, -0.2);
addChime(17.15, NOTE.G5, 0.26, 1.8, 0.0);
addChime(17.3, NOTE.C6, 0.32, 2.5, 0.3);
// Whoosh from phone to mountain climber
addWhoosh(17.2, 1.6, 0.26, 0.7, -0.7);

// --- 3. MOUNTAIN PROGRESS & STREAK (22.5s – 34.0s) ---
const s4Chords = [
  { t: 22.5, chord: [NOTE.C3, NOTE.G3, NOTE.E4, NOTE.G4], bass: NOTE.C2 },
  { t: 26.5, chord: [NOTE.G2, NOTE.D3, NOTE.G3, NOTE.D4], bass: NOTE.G2 },
  { t: 30.5, chord: [NOTE.A2, NOTE.E3, NOTE.A3, NOTE.E4], bass: NOTE.A2 }
];
s4Chords.forEach(c => {
  addPad(c.t, 4.2, c.chord, 0.2);
  addBass(c.t, 3.8, c.bass, 0.24);
});

// Driving climb beats
for (let t = 22.8; t < 34.0; t += BEAT) {
  const beatNum = Math.round((t - 22.8) / BEAT) % 4;
  if (beatNum === 0 || beatNum === 2) addKick(t, 0.3);
  addHiHat(t, 0.05, -0.2);
  addHiHat(t + BEAT * 0.5, 0.05, 0.2);
}

// SPECIFIC SFX: 7 Day streak checkmarks (Mon - Sun ascending chimes)
const streakNotes = [NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5, NOTE.A5, NOTE.C6, NOTE.E6];
streakNotes.forEach((n, idx) => {
  const tickTime = 28.5 + idx * 0.55;
  addChime(tickTime, n, 0.18, 1.2, (idx / 6) * 0.8 - 0.4);
});

// --- 4. SMART REMINDERS (34.0s – 40.0s) ---
addPad(34.0, 5.8, [NOTE.F2, NOTE.C3, NOTE.A3, NOTE.C4, NOTE.E4], 0.2, 0.1);
addBass(34.2, 5.2, NOTE.F2, 0.2);

// Notification crystal double-pings
addChime(35.1, NOTE.G5, 0.28, 1.4, -0.2);
addChime(35.25, NOTE.D6, 0.3, 1.6, 0.2);

addChime(36.3, NOTE.A5, 0.28, 1.4, -0.1);
addChime(36.45, NOTE.E6, 0.3, 1.6, 0.3);

// --- 5. FIGHT DISTRACTIONS & FOCUS MODE (40.0s – 47.5s) ---
// Tension pad & muffled rapid pulse representing endless feed
addPad(40.0, 4.0, [NOTE.A2, NOTE.E3, NOTE.G3, NOTE.C4], 0.18);
addBass(40.0, 3.8, NOTE.A2, 0.22);
for (let t = 40.5; t < 43.8; t += BEAT * 0.5) {
  addHiHat(t, 0.07, (Math.random() - 0.5) * 0.8);
}

// At 44.0s: Focus Mode toggle switch & crystal clarity bell!
addWhoosh(43.8, 0.8, 0.2, 0.4, -0.4);
addChime(44.2, NOTE.C5, 0.35, 3.5, 0.0);
addChime(44.25, NOTE.G5, 0.32, 3.5, 0.1);
addChime(44.3, NOTE.E6, 0.3, 4.0, -0.1);
addPad(44.2, 3.8, [NOTE.C3, NOTE.G3, NOTE.C4, NOTE.E4], 0.24, 0.0);

// --- 6. FOCUS TIME (47.5s – 54.5s) ---
addPad(47.5, 7.0, [NOTE.C3, NOTE.E3, NOTE.G3, NOTE.B3, NOTE.D4], 0.22);
addBass(47.8, 6.4, NOTE.C2, 0.22);

// Gentle focus pulse ticking (like a calm meditation bell)
for (let t = 48.0; t < 52.0; t += BEAT) {
  addPluck(t, NOTE.C5, 0.06, 0.4, 0.0);
}

// SPECIFIC SFX: Focus session complete (+100 PTS) at 52.2s!
addChime(52.2, NOTE.E5, 0.28, 2.0, -0.3);
addChime(52.35, NOTE.G5, 0.3, 2.0, 0.0);
addChime(52.5, NOTE.C6, 0.35, 2.8, 0.3);
addWhoosh(52.4, 1.8, 0.28, 0.7, -0.7);

// --- 7. CHECKPOINTS ASCENT (54.5s – 63.5s) ---
// Building momentum & energy!
const s9Steps = [
  { t: 54.8, c: [NOTE.F2, NOTE.C3, NOTE.F3, NOTE.A3], b: NOTE.F2, n: NOTE.F5 },
  { t: 57.0, c: [NOTE.G2, NOTE.D3, NOTE.G3, NOTE.B3], b: NOTE.G2, n: NOTE.G5 },
  { t: 59.2, c: [NOTE.A2, NOTE.E3, NOTE.A3, NOTE.C4], b: NOTE.A2, n: NOTE.A5 },
  { t: 61.4, c: [NOTE.G2, NOTE.D3, NOTE.B3, NOTE.D4], b: NOTE.G2, n: NOTE.B5 }
];
s9Steps.forEach(st => {
  addPad(st.t, 2.4, st.c, 0.22);
  addBass(st.t, 2.2, st.b, 0.26);
  addChime(st.t + 0.2, st.n, 0.24, 1.8, 0.2);
});

// Ascending driving rhythm
for (let t = 54.8; t < 63.5; t += BEAT) {
  addKick(t, 0.32);
  addHiHat(t + BEAT * 0.5, 0.06, 0.3);
}

// Pre-summit riser cymbal / whoosh into 63.5s
addWhoosh(61.8, 1.7, 0.35, -0.8, 0.8);

// --- 8. SUMMIT CLIMAX & OVERVIEW (63.5s – 76.5s) ---
// Grand triumphant mountain fanfare!
const summitChords = [
  { t: 63.5, c: [NOTE.C3, NOTE.G3, NOTE.C4, NOTE.E4, NOTE.G4, NOTE.C5], b: NOTE.C2 },
  { t: 67.5, c: [NOTE.G2, NOTE.D3, NOTE.G3, NOTE.B3, NOTE.D4, NOTE.G4], b: NOTE.G2 },
  { t: 71.5, c: [NOTE.A2, NOTE.E3, NOTE.A3, NOTE.C4, NOTE.E4, NOTE.A4], b: NOTE.A2 }
];

summitChords.forEach(sc => {
  addPad(sc.t, 4.2, sc.c, 0.3);
  addBass(sc.t, 3.9, sc.b, 0.3);
});

// Grand summit chime celebration
addChime(63.5, NOTE.C5, 0.35, 4.0, -0.4);
addChime(63.65, NOTE.G5, 0.38, 4.0, 0.0);
addChime(63.8, NOTE.C6, 0.42, 5.0, 0.4);

// Uplifting full driving groove
for (let t = 64.0; t < 76.5; t += BEAT) {
  const beatNum = Math.round((t - 64.0) / BEAT) % 4;
  if (beatNum === 0 || beatNum === 2) addKick(t, 0.36);
  addHiHat(t, 0.06, -0.2);
  addHiHat(t + BEAT * 0.5, 0.07, 0.2);
}

// High arpeggios dancing across summit view
const summitArp = [
  NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.D6, NOTE.E6, NOTE.G6
];
for (let i = 0; i < 24; i++) {
  const noteTime = 64.2 + i * 0.48;
  const n = summitArp[i % summitArp.length];
  addPluck(noteTime, n, 0.14, 1.2, (i % 2 === 0 ? -0.35 : 0.35));
}

// --- 9. OUTRO: FINAL MESSAGE & APP LOGO (76.5s – 86.0s) ---
// Soaring sunrise warmth sustaining to a peaceful, motivating finish
addPad(76.5, 5.5, [NOTE.F2, NOTE.C3, NOTE.A3, NOTE.C4, NOTE.E4], 0.24, -0.1);
addBass(76.8, 5.0, NOTE.F2, 0.24);

addPad(81.5, 4.5, [NOTE.C3, NOTE.G3, NOTE.C4, NOTE.E4, NOTE.G4], 0.22, 0.1);
addBass(81.8, 4.0, NOTE.C2, 0.22);

// Final signature chimes echoing into distance
addChime(77.0, NOTE.C5, 0.25, 2.5, -0.2);
addChime(79.0, NOTE.E5, 0.25, 2.5, 0.2);
addChime(81.5, NOTE.G5, 0.28, 3.5, -0.1);
addChime(82.5, NOTE.C6, 0.32, 4.5, 0.1);

console.log('Writing 16-bit 44.1kHz Stereo WAV file...');

// -------------------------------------------------------------
// ENCODE 16-BIT STEREO PCM WAV FILE
// -------------------------------------------------------------
const numChannels = 2;
const bytesPerSample = 2;
const blockAlign = numChannels * bytesPerSample;
const byteRate = SAMPLE_RATE * blockAlign;
const dataSize = TOTAL_SAMPLES * blockAlign;
const wavHeaderSize = 44;
const totalSize = wavHeaderSize + dataSize;

const outBuffer = Buffer.alloc(totalSize);

// RIFF header
outBuffer.write('RIFF', 0);
outBuffer.writeUInt32LE(totalSize - 8, 4);
outBuffer.write('WAVE', 8);

// fmt chunk
outBuffer.write('fmt ', 12);
outBuffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
outBuffer.writeUInt16LE(1, 20);  // AudioFormat (1 for PCM)
outBuffer.writeUInt16LE(numChannels, 22);
outBuffer.writeUInt32LE(SAMPLE_RATE, 24);
outBuffer.writeUInt32LE(byteRate, 28);
outBuffer.writeUInt16LE(blockAlign, 32);
outBuffer.writeUInt16LE(16, 34); // BitsPerSample

// data chunk
outBuffer.write('data', 36);
outBuffer.writeUInt32LE(dataSize, 40);

// Soft limiter & clipping protection
let offset = 44;
let peak = 0;
for (let i = 0; i < TOTAL_SAMPLES; i++) {
  peak = Math.max(peak, Math.abs(bufferL[i]), Math.abs(bufferR[i]));
}
const normFactor = peak > 0.95 ? 0.95 / peak : 1.0;
console.log(`Peak audio amplitude: ${peak.toFixed(3)}, normalized with: ${normFactor.toFixed(3)}`);

for (let i = 0; i < TOTAL_SAMPLES; i++) {
  // Soft fade out in the last 1.5 seconds
  let masterEnv = 1.0;
  if (i > TOTAL_SAMPLES - SAMPLE_RATE * 1.5) {
    masterEnv = (TOTAL_SAMPLES - i) / (SAMPLE_RATE * 1.5);
  }

  let sampleL = Math.max(-1, Math.min(1, bufferL[i] * normFactor * masterEnv));
  let sampleR = Math.max(-1, Math.min(1, bufferR[i] * normFactor * masterEnv));

  const intL = Math.round(sampleL * 32767);
  const intR = Math.round(sampleR * 32767);

  outBuffer.writeInt16LE(intL, offset);
  outBuffer.writeInt16LE(intR, offset + 2);
  offset += 4;
}

const outputPath = path.join(__dirname, 'soundtrack.wav');
fs.writeFileSync(outputPath, outBuffer);

const stats = fs.statSync(outputPath);
console.log(`Successfully generated soundtrack: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
