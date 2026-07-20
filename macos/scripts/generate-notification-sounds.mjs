import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
if (outIndex < 0 || !args[outIndex + 1] || args.length !== 2) {
  throw new Error("Usage: generate-notification-sounds.mjs --out <directory>");
}

const outputDirectory = path.resolve(args[outIndex + 1]);
const sampleRate = 44_100;
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const sourceDirectory = path.resolve(scriptDirectory, "../assets/sounds/sources");
const completionSourcePath = path.join(sourceDirectory, "historical-qq-task-complete.wav");
const confirmationSourcePath = path.join(sourceDirectory, "historical-qq-needs-confirmation.wav");

function decodePcmWave(bytes) {
  if (bytes.subarray(0, 4).toString("ascii") !== "RIFF" ||
      bytes.subarray(8, 12).toString("ascii") !== "WAVE") {
    throw new Error("Historical source must be a RIFF/WAVE file");
  }
  let format = null;
  let data = null;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const id = bytes.subarray(offset, offset + 4).toString("ascii");
    const length = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + length;
    if (end > bytes.length) throw new Error("Historical source contains a truncated WAV chunk");
    if (id === "fmt ") format = bytes.subarray(start, end);
    if (id === "data") data = bytes.subarray(start, end);
    offset = end + (length % 2);
  }
  if (!format || !data || format.length < 16 || format.readUInt16LE(0) !== 1) {
    throw new Error("Historical source must be an uncompressed PCM WAV file");
  }
  const channels = format.readUInt16LE(2);
  const sourceRate = format.readUInt32LE(4);
  const bitsPerSample = format.readUInt16LE(14);
  if (![1, 2].includes(channels) || ![11_025, 22_050, 44_100].includes(sourceRate) ||
      ![8, 16].includes(bitsPerSample)) {
    throw new Error("Historical source must use 1–2 channels, 11.025/22.05/44.1 kHz, and 8- or 16-bit PCM");
  }
  const bytesPerSample = bitsPerSample / 8;
  const bytesPerFrame = channels * bytesPerSample;
  const frameCount = Math.floor(data.length / bytesPerFrame);
  const mono = new Float64Array(frameCount);
  for (let frame = 0; frame < frameCount; frame += 1) {
    let sum = 0;
    for (let channel = 0; channel < channels; channel += 1) {
      const offset = frame * bytesPerFrame + channel * bytesPerSample;
      sum += bitsPerSample === 8
        ? (data.readUInt8(offset) - 128) / 128
        : data.readInt16LE(offset) / 32_768;
    }
    mono[frame] = sum / channels;
  }
  if (sourceRate === sampleRate) return mono;
  const samples = new Float64Array(Math.round(frameCount * sampleRate / sourceRate));
  for (let index = 0; index < samples.length; index += 1) {
    const position = index * sourceRate / sampleRate;
    const lower = Math.min(frameCount - 1, Math.floor(position));
    const upper = Math.min(frameCount - 1, lower + 1);
    const blend = position - lower;
    samples[index] = mono[lower] * (1 - blend) + mono[upper] * blend;
  }
  return samples;
}

function cleanHistoricalCue(sourceBytes, {
  highPassHz,
  lowPassHz,
  lowPasses = 2,
  targetPeak,
  fadeIn,
  fadeOut,
  maximumStep = null,
  postLowPassHz = null,
  postLowPasses = 1,
  noiseGate = null,
}) {
  // Preserve the historical cue's timing and timbre. Only remove residual DC,
  // soften sub-bass/high-frequency edges, reduce gain and force zero-boundary
  // fades so Web Audio cannot expose a hard electrical click.
  const input = decodePcmWave(sourceBytes);
  const values = new Float64Array(input.length);
  let mean = 0;
  for (const sample of input) mean += sample;
  mean /= input.length;
  const highPassRc = 1 / (2 * Math.PI * highPassHz);
  const dt = 1 / sampleRate;
  const highPassAlpha = highPassRc / (highPassRc + dt);
  let previousInput = input[0] - mean;
  let previousHigh = 0;
  for (let index = 0; index < input.length; index += 1) {
    const sample = input[index] - mean;
    previousHigh = highPassAlpha * (previousHigh + sample - previousInput);
    previousInput = sample;
    values[index] = previousHigh;
  }
  const lowPassRc = 1 / (2 * Math.PI * lowPassHz);
  const lowPassAlpha = dt / (lowPassRc + dt);
  for (let pass = 0; pass < lowPasses; pass += 1) {
    let previousLow = 0;
    for (let index = 0; index < values.length; index += 1) {
      previousLow += lowPassAlpha * (values[index] - previousLow);
      values[index] = previousLow;
    }
  }
  return encodePcm(values, targetPeak, {
    fadeIn,
    fadeOut,
    maximumStep,
    postLowPassHz,
    postLowPasses,
    noiseGate,
  });
}

function encodePcm(values, targetPeak = 0.58, {
  fadeIn = 192,
  fadeOut = 384,
  maximumStep = null,
  postLowPassHz = null,
  postLowPasses = 1,
  noiseGate = null,
} = {}) {
  const count = values.length;
  let mean = 0;
  for (let index = 0; index < count; index += 1) mean += values[index];
  mean /= count;
  let peak = 0;
  for (let index = 0; index < count; index += 1) {
    values[index] -= mean;
    peak = Math.max(peak, Math.abs(values[index]));
  }
  const gain = peak ? targetPeak / peak : 1;
  const output = new Float64Array(count);
  let previousSample = 0;
  for (let index = 0; index < count; index += 1) {
    const edgeFade = Math.min(1, index / fadeIn, (count - 1 - index) / fadeOut);
    const gained = Math.max(-1, Math.min(1, values[index] * gain * edgeFade));
    const magnitude = Math.abs(gained);
    const gated = noiseGate === null || magnitude >= noiseGate
      ? gained
      : gained * (magnitude / noiseGate) ** 2;
    // A few old desktop cues contain isolated single-sample edges inside the
    // recording. Limit only those slopes instead of globally lowering or
    // replacing the recognizable historical sound.
    const sample = maximumStep === null
      ? gated
      : Math.max(previousSample - maximumStep, Math.min(previousSample + maximumStep, gated));
    output[index] = sample;
    previousSample = sample;
  }
  if (postLowPassHz !== null) {
    const postRc = 1 / (2 * Math.PI * postLowPassHz);
    const postAlpha = (1 / sampleRate) / (postRc + (1 / sampleRate));
    for (let pass = 0; pass < postLowPasses; pass += 1) {
      let previousLow = 0;
      for (let index = 0; index < count; index += 1) {
        previousLow += postAlpha * (output[index] - previousLow);
        output[index] = previousLow;
      }
    }
  }
  const pcm = Buffer.alloc(count * 2);
  for (let index = 0; index < count; index += 1) {
    pcm.writeInt16LE(Math.round(output[index] * 32767), index * 2);
  }
  pcm.writeInt16LE(0, 0);
  pcm.writeInt16LE(0, pcm.length - 2);
  return pcm;
}

function wav(pcm) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

await fs.mkdir(outputDirectory, { recursive: true });
const completionSource = await fs.readFile(completionSourcePath);
const confirmationSource = await fs.readFile(confirmationSourcePath);
await Promise.all([
  fs.writeFile(
    path.join(outputDirectory, "qq-task-complete.wav"),
    wav(cleanHistoricalCue(completionSource, {
      highPassHz: 90,
      lowPassHz: 3_200,
      lowPasses: 3,
      targetPeak: 0.52,
      fadeIn: 441,
      fadeOut: 3_528,
      maximumStep: 0.04,
      postLowPassHz: 2_800,
      postLowPasses: 2,
      noiseGate: 0.006,
    })),
  ),
  fs.writeFile(
    path.join(outputDirectory, "qq-needs-confirmation.wav"),
    wav(cleanHistoricalCue(confirmationSource, {
      highPassHz: 140,
      lowPassHz: 3_200,
      lowPasses: 3,
      targetPeak: 0.46,
      fadeIn: 220,
      fadeOut: 882,
      maximumStep: 0.04,
      postLowPassHz: 2_800,
      postLowPasses: 2,
      noiseGate: 0.008,
    })),
  ),
]);
