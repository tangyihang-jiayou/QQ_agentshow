import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const renderer = await fs.readFile(path.resolve(here, "../assets/renderer-inject.js"), "utf8");

function markedSource(startMarker, endMarker) {
  const start = renderer.indexOf(startMarker);
  const end = renderer.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `Missing renderer fixture markers: ${startMarker}`);
  return renderer.slice(start + startMarker.length, end);
}

const policySource = markedSource("// NOTIFICATION_POLICY_START", "// NOTIFICATION_POLICY_END");
const createPolicy = vm.runInNewContext(`(() => { ${policySource}; return createNotificationPolicy; })()`);
const policy = createPolicy();
const button = (label) => ({
  textContent: label,
  getAttribute(name) { return name === "aria-label" ? label : null; },
});
const request = (...labels) => ({ querySelectorAll() { return labels.map(button); } });

assert.equal(policy.isConfirmationRequest(request("Run")), false,
  "A normal Run button must not be mistaken for a human-confirmation request.");
assert.equal(policy.isConfirmationRequest(request("Continue")), false,
  "A normal Continue button must not trigger a confirmation sound.");
assert.equal(policy.isConfirmationRequest(request("Run", "Cancel")), true,
  "A paired Run/Cancel decision must be recognized as a confirmation request.");
assert.equal(policy.isConfirmationRequest(request("允许", "拒绝")), true,
  "A paired Chinese approval decision must be recognized.");

const played = new Set();
assert.equal(policy.remember(played, "same-semantic-key"), true);
assert.equal(policy.remember(played, "same-semantic-key"), false,
  "Removing and remounting the same semantic request must not replay it.");
assert.equal(policy.remember(played, "different-key"), true,
  "A different confirmation request must remain eligible.");
for (let index = 0; index < 160; index += 1) policy.remember(played, `bounded-${index}`);
assert.equal(played.size, 128, "In-memory confirmation dedupe must remain bounded.");

assert.equal(policy.completionShouldPlay({
  armed: true, cancelled: false, sameRun: true, running: false, looksSuccessful: true,
}), true, "A successful main-Agent transition must play once.");
assert.equal(policy.completionShouldPlay({
  armed: true, cancelled: true, sameRun: true, running: false, looksSuccessful: true,
}), false, "A user Stop action must suppress the completion sound.");
assert.equal(policy.completionShouldPlay({
  armed: true, cancelled: false, sameRun: false, running: false, looksSuccessful: true,
}), false, "A stale timer from another run must not play.");
assert.equal(policy.completionShouldPlay({
  armed: true, cancelled: false, sameRun: true, running: true, looksSuccessful: true,
}), false, "A still-running task must not play a completion cue.");
assert.equal(policy.completionTextLooksSuccessful("任务完成，已更新两个文件。"), true,
  "A normal Chinese completion must remain eligible.");
assert.equal(policy.completionTextLooksSuccessful("失败：命令返回非零状态。"), false,
  "A Chinese failure followed by full-width punctuation must not play completion.");
assert.equal(policy.completionTextLooksSuccessful("错误，无法读取配置。"), false,
  "A Chinese error prefix must not depend on an ASCII word boundary.");
assert.equal(policy.completionTextLooksSuccessful("Failed: command exited 1"), false,
  "An English failure prefix must remain suppressed.");

const playerSource = markedSource("// NOTIFICATION_PLAYER_START", "// NOTIFICATION_PLAYER_END");
const playback = await vm.runInNewContext(`(async () => {
  const sources = [];
  const gains = [];
  let boundaryRamps = 0;
  let notificationAudioContext = null;
  let notificationActivePlayback = null;
  let notificationStartingKind = null;
  let notificationPendingConfirmationKey = null;
  let notificationReplayPendingConfirmation = () => {};
  let notificationPlaybackId = 0;
  const notificationAudioBuffers = new Map();
  const NOTIFICATION_DATA = {
    taskComplete: "data:audio/wav;base64,AAAA",
    needsConfirmation: "data:audio/wav;base64,AAAA",
  };
  const atob = () => "\\0\\0\\0";
  const decodeNotificationBytes = () => new Uint8Array([0, 0, 0]).buffer;
  class FakeAudioContext {
    constructor() { this.state = "running"; this.currentTime = 0; this.destination = {}; }
    decodeAudioData() { return Promise.resolve({ decoded: true, duration: 1 }); }
    createBufferSource() {
      const source = {
        starts: 0, stops: 0, disconnects: 0, onended: null,
        connect() { return { connect() {} }; },
        start() { this.starts += 1; },
        stop() { this.stops += 1; },
        disconnect() { this.disconnects += 1; },
      };
      sources.push(source);
      return source;
    }
    createGain() {
      const gain = { gain: {
        value: 0,
        cancelScheduledValues() {},
        setValueAtTime(value) { this.value = value; },
        linearRampToValueAtTime(value) { this.value = value; boundaryRamps += 1; },
      }, disconnects: 0,
        disconnect() { this.disconnects += 1; } };
      gains.push(gain);
      return gain;
    }
  }
  const window = {
    AudioContext: FakeAudioContext,
    localStorage: { setItem() {} },
  };
  ${playerSource}
  const replayedKeys = [];
  notificationReplayPendingConfirmation = async (key) => {
    replayedKeys.push(key);
    await playQqNotification("confirmation", key);
  };
  const first = await playQqNotification("completion");
  const second = await playQqNotification("confirmation", "request-1");
  sources[0].onended();
  await Promise.resolve();
  const third = await playQqNotification("completion");
  return {
    first, second, third, sourceCount: sources.length,
    firstStarts: sources[0]?.starts, firstStops: sources[0]?.stops,
    firstDisconnects: sources[0]?.disconnects, firstGainDisconnects: gains[0]?.disconnects,
    replayedKeys, confirmationStarts: sources[1]?.starts, boundaryRamps,
  };
})()`, { Uint8Array });
assert.deepEqual({ ...playback, replayedKeys: Array.from(playback.replayedKeys) }, {
  first: true,
  second: false,
  third: false,
  sourceCount: 2,
  firstStarts: 1,
  firstStops: 0,
  firstDisconnects: 1,
  firstGainDisconnects: 1,
  replayedKeys: ["request-1"],
  confirmationStarts: 1,
  boundaryRamps: 4,
}, "A confirmation arriving during completion must wait, then play exactly once without layering or a hard stop.");

const disposerSource = markedSource("// NOTIFICATION_DISPOSER_START", "// NOTIFICATION_DISPOSER_END");
const disposed = vm.runInNewContext(`(() => {
  let completionSoundTimer = 11;
  let completionSoundArmed = true;
  let completionSoundRunning = true;
  let completionRunCancelled = true;
  let confirmationSoundTimer = 22;
  let confirmationSoundActive = true;
  let confirmationSoundRequest = {};
  let confirmationSoundRequestKey = "request";
  let closeCount = 0;
  let sourceStops = 0;
  let scheduledStop = 0;
  let sourceDisconnects = 0;
  let gainDisconnects = 0;
  let gainRamps = 0;
  let notificationPlaybackId = 9;
  let notificationStartingKind = "completion";
  let notificationPendingConfirmationKey = "request";
  let notificationActivePlayback = {
    source: {
      stop(when) { sourceStops += 1; scheduledStop = when; },
      disconnect() { sourceDisconnects += 1; },
    },
    gain: {
      gain: {
        value: 0.68,
        cancelScheduledValues() {},
        setValueAtTime() {},
        linearRampToValueAtTime(value) { if (value === 0) gainRamps += 1; },
      },
      disconnect() { gainDisconnects += 1; },
    },
  };
  let notificationAudioContext = { state: "running", currentTime: 3,
    close() { closeCount += 1; return Promise.resolve(); } };
  const notificationAudioBuffers = new Map([["completion", {}]]);
  const cleared = [];
  const clearTimeout = (value) => cleared.push(value);
  const setTimeout = (callback) => { callback(); return 1; };
  ${disposerSource}
  disposeNotificationRuntime();
  return {
    completionSoundTimer, completionSoundArmed, completionSoundRunning, completionRunCancelled,
    confirmationSoundTimer, confirmationSoundActive, confirmationSoundRequest,
    confirmationSoundRequestKey, closeCount, bufferCount: notificationAudioBuffers.size, cleared,
    sourceStops, scheduledStop, sourceDisconnects, gainDisconnects, gainRamps,
    notificationPlaybackId,
    notificationStartingKind, notificationPendingConfirmationKey,
  };
})()`);
assert.deepEqual(Array.from(disposed.cleared), [11, 22], "Hot reinjection must cancel both pending sound timers.");
assert.equal(disposed.closeCount, 1, "Hot reinjection must close the old AudioContext.");
assert.equal(disposed.bufferCount, 0, "Hot reinjection must discard decoded buffers from the old context.");
assert.equal(disposed.sourceStops, 1, "Hot reinjection must stop an in-flight notification source.");
assert.equal(disposed.sourceDisconnects, 1, "Hot reinjection must disconnect an in-flight notification source.");
assert.equal(disposed.gainDisconnects, 1, "Hot reinjection must disconnect the old GainNode.");
assert.equal(disposed.gainRamps, 1, "Hot reinjection must fade the old source to zero before stopping it.");
assert.ok(disposed.scheduledStop > 3, "Hot reinjection must schedule, not immediately hard-stop, the old source.");
assert.equal(disposed.notificationPlaybackId, 10, "Hot reinjection must invalidate pending async decodes.");
assert.equal(disposed.notificationStartingKind, null);
assert.equal(disposed.notificationPendingConfirmationKey, null);
assert.equal(disposed.completionSoundTimer, null);
assert.equal(disposed.confirmationSoundTimer, null);
assert.equal(disposed.completionSoundArmed, false);
assert.equal(disposed.confirmationSoundActive, false);

console.log("PASS: notification policy rejects false positives, dedupes remounts, suppresses Stop, and disposes hot-reload audio.");
