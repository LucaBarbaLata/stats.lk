// Writes public/soundtrack.wav: a 120 BPM house-style track synthesised from
// scratch and timed to src/timeline.json, so every cut, word and pop lands on
// a sound. No samples, no licences. Run with `node scripts/soundtrack.mjs`.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const T = JSON.parse(readFileSync(join(root, "src/timeline.json"), "utf8"));
const SR = 48000;
const LENGTH = Math.ceil((T.duration / T.fps) * SR);
const sec = (frame) => frame / T.fps;
const mtof = (midi) => 440 * 2 ** ((midi - 69) / 12);

const bus = () => ({ L: new Float32Array(LENGTH), R: new Float32Array(LENGTH) });
const drums = bus();
const music = bus();
const pads = bus();
const fx = bus();
const send = bus();

function add(target, index, left, right = left) {
  if (index >= 0 && index < LENGTH) {
    target.L[index] += left;
    target.R[index] += right;
  }
}

// The same noise on every run
let seed = 7;
function noise() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2147483648 - 1;
}

// Topology-preserving state variable filter; mode is "low", "band" or "high"
function svf(mode) {
  let ic1 = 0;
  let ic2 = 0;
  return (x, cutoff, q = 0.7) => {
    const g = Math.tan((Math.PI * Math.min(cutoff, SR * 0.45)) / SR);
    const k = 1 / q;
    const a1 = 1 / (1 + g * (g + k));
    const a2 = g * a1;
    const a3 = g * a2;
    const v3 = x - ic2;
    const v1 = a1 * ic1 + a2 * v3;
    const v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1;
    ic2 = 2 * v2 - ic2;
    return mode === "low" ? v2 : mode === "band" ? v1 : x - k * v1 - v2;
  };
}

// Band-limited saw
function saw(phase, dt) {
  let blep = 0;
  if (phase < dt) {
    const t = phase / dt;
    blep = t + t - t * t - 1;
  } else if (phase > 1 - dt) {
    const t = (phase - 1) / dt;
    blep = t * t + t + t + 1;
  }
  return 2 * phase - 1 - blep;
}

function render(at, seconds, fn) {
  const start = Math.round(at * SR);
  const length = Math.round(seconds * SR);
  for (let n = 0; n < length; n++) fn(n / SR, start + n, n / length);
}

const kickTimes = [];

function kick(at, gain = 1) {
  kickTimes.push(at);
  let phase = 0;
  render(at, 0.5, (t, i) => {
    phase += (42 + 120 * Math.exp(-t / 0.03)) / SR;
    let s = Math.sin(2 * Math.PI * phase) * Math.exp(-t / 0.26) * Math.min(1, t / 0.002);
    if (t < 0.004) s += noise() * 0.3 * (1 - t / 0.004);
    add(drums, i, Math.tanh(s * 1.6) * gain);
  });
}

function clap(at, gain = 1) {
  const filter = svf("band");
  render(at, 0.4, (t, i) => {
    let env = 0;
    for (const offset of [0, 0.011, 0.022]) if (t >= offset) env = Math.max(env, Math.exp(-(t - offset) / 0.007));
    if (t >= 0.022) env = Math.max(env, 0.55 * Math.exp(-(t - 0.022) / 0.11));
    const s = filter(noise(), 1400, 1.2) * env * gain * 2.2;
    add(drums, i, s);
    add(send, i, s * 0.35);
  });
}

function hat(at, gain, decay = 0.03, pan = 0) {
  const filter = svf("high");
  render(at, decay * 6, (t, i) => {
    const s = filter(noise(), 7000, 0.8) * Math.exp(-t / decay) * gain;
    add(drums, i, s * (1 - pan), s * (1 + pan));
  });
}

function bass(at, length, midi, gain) {
  const freq = mtof(midi);
  const dt = freq / SR;
  const filter = svf("low");
  let phase = 0;
  let sub = 0;
  render(at, length + 0.08, (t, i) => {
    phase = (phase + dt) % 1;
    sub = (sub + dt / 2) % 1;
    const env = Math.min(1, t / 0.004) * (t < length ? 1 : Math.exp(-(t - length) / 0.015));
    const s = (filter(saw(phase, dt), 180 + 1400 * Math.exp(-t / 0.06), 0.9) * 0.8 + Math.sin(2 * Math.PI * sub) * 0.5) * env * gain;
    add(music, i, s);
  });
}

function pad(at, length, midis, gain, cutoffFrom = 900, cutoffTo = 1800, release = 0.18) {
  const voices = midis.flatMap((midi) => [-0.12, 0, 0.11].map((detune) => ({ freq: mtof(midi) * 2 ** (detune / 12), phase: (noise() + 1) / 2 })));
  const left = svf("low");
  const right = svf("low");
  render(at, length + release * 5, (t, i) => {
    let l = 0;
    let r = 0;
    voices.forEach((voice, index) => {
      const dt = voice.freq / SR;
      voice.phase = (voice.phase + dt) % 1;
      const s = saw(voice.phase, dt);
      if (index % 3 === 0) l += s;
      else if (index % 3 === 2) r += s;
      else {
        l += s * 0.7;
        r += s * 0.7;
      }
    });
    const env = Math.min(1, t / 0.25) * (t < length ? 1 : Math.exp(-(t - length) / release));
    const cutoff = cutoffFrom + (cutoffTo - cutoffFrom) * Math.min(1, t / length);
    const scale = (env * gain * 3) / voices.length;
    l = left(l, cutoff, 0.6) * scale;
    r = right(r, cutoff, 0.6) * scale;
    add(pads, i, l, r);
    add(send, i, l * 0.25, r * 0.25);
  });
}

function pluck(at, midi, gain, decay = 0.28) {
  const dt = mtof(midi) / SR;
  const filter = svf("low");
  let a = 0;
  let b = 0.25;
  render(at, decay * 5, (t, i) => {
    a = (a + dt) % 1;
    b = (b + dt * 1.004) % 1;
    const env = Math.min(1, t / 0.002) * Math.exp(-t / decay);
    const s = filter(saw(a, dt) * 0.6 + saw(b, dt * 1.004) * 0.4, 600 + 5000 * Math.exp(-t / 0.08), 1) * env * gain;
    add(music, i, s * 0.9, s * 1.1);
    add(send, i, s * 0.4);
  });
}

function tick(at, gain, freq = 2600) {
  render(at, 0.08, (t, i) => {
    const s = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t / 0.012) * gain;
    add(fx, i, s);
    add(send, i, s * 0.3);
  });
}

function riser(from, to, gain) {
  const filter = svf("band");
  let phase = 0;
  render(from, to - from, (t, i, x) => {
    phase += (180 * 6 ** x) / SR;
    const s = (filter(noise(), 300 * (8000 / 300) ** x, 2.5) * 1.2 + Math.sin(2 * Math.PI * phase) * 0.12) * x * x * gain;
    const wobble = 0.3 * Math.sin(x * 20);
    add(fx, i, s * (1 - wobble), s * (1 + wobble));
    add(send, i, s * 0.3);
  });
}

function impact(at, gain) {
  const filter = svf("low");
  let phase = 0;
  render(at, 3, (t, i) => {
    phase += (34 + 60 * Math.exp(-t / 0.08)) / SR;
    const boom = Math.tanh(Math.sin(2 * Math.PI * phase) * 1.5) * Math.exp(-t / 0.9) * 0.9;
    const crash = filter(noise(), 1500 + 6000 * Math.exp(-t / 0.4), 0.7) * Math.exp(-t / 0.6) * 0.5;
    add(fx, i, (boom + crash) * gain);
    add(send, i, (crash * 0.6 + boom * 0.1) * gain);
  });
}

function whoosh(center, gain, length = 0.45) {
  const filter = svf("band");
  render(center - length * 0.7, length, (t, i, x) => {
    const bell = Math.sin(Math.PI * x);
    const s = filter(noise(), 400 * 10 ** bell, 1.5) * bell * bell * gain;
    const pan = -0.8 + 1.6 * x;
    add(fx, i, s * (1 - pan), s * (1 + pan));
    add(send, i, s * 0.3);
  });
}

// Freeverb: eight damped combs and four allpasses per side
function reverb(input) {
  const scale = SR / 44100;
  const process = (signal, spread) => {
    const out = new Float32Array(LENGTH);
    for (const size of [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617]) {
      const buffer = new Float32Array(Math.round((size + spread) * scale));
      let index = 0;
      let store = 0;
      for (let n = 0; n < LENGTH; n++) {
        const y = buffer[index];
        store = y * 0.75 + store * 0.25;
        buffer[index] = signal[n] * 0.015 + store * 0.86;
        out[n] += y;
        index = (index + 1) % buffer.length;
      }
    }
    for (const size of [556, 441, 341, 225]) {
      const buffer = new Float32Array(Math.round((size + spread) * scale));
      let index = 0;
      for (let n = 0; n < LENGTH; n++) {
        const y = buffer[index];
        buffer[index] = out[n] + y * 0.5;
        out[n] = y - out[n];
        index = (index + 1) % buffer.length;
      }
    }
    return out;
  };
  return { L: process(input.L, 0), R: process(input.R, 23) };
}

// Cubic-bezier easing, to follow the counter on screen
function bezier(x1, y1, x2, y2) {
  const curve = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x) => {
    let low = 0;
    let high = 1;
    for (let step = 0; step < 40; step++) {
      const mid = (low + high) / 2;
      if (curve(x1, x2, mid) < x) low = mid;
      else high = mid;
    }
    return curve(y1, y2, (low + high) / 2);
  };
}

// ---- Arrangement ----------------------------------------------------------

const C = T.cuts;
const BEAT = T.beat;
const BAR = BEAT * 4;
const CHORDS = [
  { notes: [57, 60, 64], root: 45 }, // A minor
  { notes: [53, 57, 60], root: 41 }, // F
  { notes: [55, 60, 64], root: 48 }, // C
  { notes: [55, 59, 62], root: 43 }, // G
];

// Intro: a filtered pad, a note per word of the hook, hats coming in
pad(0, sec(240), CHORDS[0].notes, 0.5, 450, 1300, 0.25);
pad(sec(240), sec(106), CHORDS[1].notes, 0.5, 1300, 2800, 0.08);
[57, 60, 64, 57, 60, 64, 67, 69].forEach((midi, index) => pluck(sec(15 + index * 15), midi + 12, 0.5));
for (let f = BAR; f < C.logo - 10; f += BEAT / 2) hat(sec(f), f % BEAT ? 0.28 : 0.14);

// The counter: a tick each time the thousands digit turns, then a build into the drop
const ease = bezier(0.16, 1, 0.3, 1);
let lastThousand = 0;
for (let f = C.counter + 10; f <= C.counter + 100; f += 0.25) {
  const thousand = Math.floor((24310 * ease((f - C.counter - 10) / 90)) / 1000);
  if (thousand !== lastThousand) {
    tick(sec(f), 0.16, 1800 + thousand * 40);
    lastThousand = thousand;
  }
}
[98, 106, 114].forEach((offset, index) => pluck(sec(C.counter + offset), [76, 79, 81][index], 0.35, 0.18));
riser(sec(C.counter), sec(C.logo - 8), 0.55);
for (let s = sec(C.counter + 60); s < sec(C.logo - 8); ) {
  const x = (s - sec(C.counter + 60)) / (sec(C.logo - 8) - sec(C.counter + 60));
  clap(s, 0.12 + 0.4 * x);
  s += x < 0.5 ? sec(BEAT / 2) : sec(BEAT / 4);
}

// The drop on the logo, a groove under every feature
impact(sec(C.logo), 1);
const breakFrom = C.free + 76;
const breakTo = C.free + 120;
for (let barStart = C.logo; barStart < C.end; barStart += BAR) {
  const bar = (barStart - C.logo) / BAR;
  const chord = CHORDS[bar % 4];
  pad(sec(barStart), sec(BAR) - 0.02, chord.notes, 0.55, 1600, 2400);
  for (let beat = 0; beat < 4; beat++) {
    const f = barStart + beat * BEAT;
    if (f >= breakFrom && f < breakTo) continue;
    kick(sec(f), 1);
    if (beat % 2) clap(sec(f), 0.45);
    hat(sec(f + BEAT / 2), 0.32, 0.09, 0.2);
    hat(sec(f + BEAT / 4), 0.1, 0.02, -0.3);
    hat(sec(f + (BEAT * 3) / 4), 0.1, 0.02, 0.3);
    bass(sec(f + BEAT / 2), 0.2, chord.root, 0.5);
    // An arpeggio joins halfway through the features
    if (barStart >= C.friends) {
      pluck(sec(f), chord.notes[[0, 1, 2, 1][beat]] + 12, 0.16, 0.2);
      pluck(sec(f + BEAT / 2), chord.notes[[2, 1, 0, 2][beat]] + 12, 0.12, 0.2);
    }
  }
}
for (const cut of [C.top, C.activity, C.history, C.friends, C.trophies, C.wrapped, C.free]) whoosh(sec(cut), 0.55);
for (let row = 0; row < 5; row++) tick(sec(C.top + 30 + row * 7), 0.1, 2200 + row * 200);
for (let badge = 0; badge < 6; badge++) tick(sec(C.trophies + 30 + badge * 7), 0.1, 2600 + badge * 180);
// The top list switching to albums, then to genres
for (const at of T.topList.switches) {
  whoosh(sec(C.top + at + 4), 0.3, 0.3);
  for (let row = 0; row < 5; row++) tick(sec(C.top + at + 6 + row * 4), 0.08, 2400 + row * 150);
}
// A trophy going up a tier, to silver and then to gold, with a sparkle after each
T.trophies.upgrades.forEach((at, step) => {
  pluck(sec(C.trophies + at), [83, 88][step], 0.34, 0.35);
  pluck(sec(C.trophies + at), [90, 95][step], 0.22, 0.35);
  for (let spark = 0; spark < 4; spark++) tick(sec(C.trophies + at + 3 + spark * 3), 0.06, 3200 + spark * 400 + step * 300);
});
pluck(sec(C.history + 114), 88, 0.3, 0.25);
pluck(sec(C.history + 118), 93, 0.3, 0.4);

// "Free": a note per line, a short break, the slam
[81, 84, 88].forEach((midi, index) => pluck(sec(C.free + index * BEAT), midi, 0.32, 0.3));
riser(sec(breakFrom), sec(breakTo - 2), 0.4);
impact(sec(breakTo), 0.6);

// End card: a last hit, the logo's bars as three rising notes, a held chord,
// a note for each line of text, one per tester seat and a chime for the button
const E = T.endCard;
impact(sec(C.end), 0.9);
pad(sec(C.end), 3.6, [45, 57, 60, 64], 0.6, 2200, 700, 0.5);
bass(sec(C.end), 3.2, 33, 0.45);
[69, 72, 76].forEach((midi, index) => pluck(sec(C.end + 8 + index * 6), midi, 0.35, 0.35));
pluck(sec(C.end + E.headline), 81, 0.22, 0.3);
pluck(sec(C.end + E.testers), 84, 0.22, 0.3);
[69, 72, 74, 76, 79].forEach((midi, index) => pluck(sec(C.end + E.seats + index * E.seatStagger), midi + 12, 0.28, 0.25));
pluck(sec(C.end + E.cta), 81, 0.3, 0.5);
pluck(sec(C.end + E.cta), 88, 0.22, 0.5);

// ---- Mix -----------------------------------------------------------------

// Pads duck under each kick
const duck = new Float32Array(LENGTH).fill(1);
for (const at of kickTimes) {
  const start = Math.round(at * SR);
  for (let n = 0; n < SR * 0.4 && start + n < LENGTH; n++) duck[start + n] = Math.min(duck[start + n], 1 - 0.65 * Math.exp(-n / SR / 0.11));
}

const wet = reverb(send);
const out = bus();
for (const side of ["L", "R"]) {
  let dc = 0;
  for (let n = 0; n < LENGTH; n++) {
    const x = drums[side][n] * 0.9 + music[side][n] * 0.8 + pads[side][n] * duck[n] + fx[side][n] * 0.8 + wet[side][n] * 0.9;
    // Remove DC and rumble below ~20 Hz
    dc += (x - dc) * 0.0025;
    out[side][n] = x - dc;
  }
}
let peak = 0;
for (const side of ["L", "R"]) for (const x of out[side]) peak = Math.max(peak, Math.abs(x));
const drive = 1.6;
const fadeFrom = LENGTH - Math.round(1.5 * SR);
const pcm = Buffer.alloc(LENGTH * 4);
for (let n = 0; n < LENGTH; n++) {
  const fade = n < fadeFrom ? 1 : 1 - (n - fadeFrom) / (LENGTH - fadeFrom);
  for (const [channel, side] of [[0, "L"], [1, "R"]]) {
    // Gentle saturation instead of a limiter, peaking at -1 dBFS
    const y = (Math.tanh((out[side][n] / peak) * drive) / Math.tanh(drive)) * 0.89 * fade;
    pcm.writeInt16LE(Math.round(y * 32767), n * 4 + channel * 2);
  }
}

const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22);
header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(pcm.length, 40);

mkdirSync(join(root, "public"), { recursive: true });
writeFileSync(join(root, "public/soundtrack.wav"), Buffer.concat([header, pcm]));
console.log(`public/soundtrack.wav: ${(LENGTH / SR).toFixed(1)} s`);
