import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const renderer = await fs.readFile(path.resolve(here, "../assets/renderer-inject.js"), "utf8");

const startMarker = "// COMPOSER_RESTYLE_POLICY_START";
const endMarker = "// COMPOSER_RESTYLE_POLICY_END";
const start = renderer.indexOf(startMarker);
const end = renderer.indexOf(endMarker, start);
assert.ok(start >= 0 && end > start,
  "The renderer must expose the composer restyle policy fixture.");

const policySource = renderer.slice(start + startMarker.length, end);
const createPolicy = vm.runInNewContext(
  `(() => { ${policySource}; return createComposerRestylePolicy; })()`,
);
const policy = createPolicy();

const expected = {
  mode: "codex",
  regions: ["footer", "editor", "tool-actions", "action-footer"],
  controls: ["attachment", "editor", "permission", "model", "voice", "send"],
  styled: ["composer-footer", "composer-editor", "composer-tool-actions", "composer-action-footer"],
};

assert.equal(policy.needsRestyle({ expected, current: expected }), false,
  "Typing inside an already classified composer must not rebuild its layout markers.");
assert.equal(policy.needsRestyle({ expected, current: { ...expected, controls: [...expected.controls, "new"] } }), true,
  "A real control topology change must trigger reclassification.");
assert.equal(policy.needsRestyle({ expected, current: { ...expected, mode: "compact" } }), true,
  "A composer-mode change must trigger reclassification.");
assert.equal(policy.needsRestyle({ expected, current: null }), true,
  "A new unclassified composer must be styled once.");

const scrollStartMarker = "// COMPOSER_SCROLL_POLICY_START";
const scrollEndMarker = "// COMPOSER_SCROLL_POLICY_END";
const scrollStart = renderer.indexOf(scrollStartMarker);
const scrollEnd = renderer.indexOf(scrollEndMarker, scrollStart);
assert.ok(scrollStart >= 0 && scrollEnd > scrollStart,
  "The renderer must expose the composer scroll policy fixture.");
const scrollPolicySource = renderer.slice(scrollStart + scrollStartMarker.length, scrollEnd);
const createScrollPolicy = vm.runInNewContext(
  `(() => { ${scrollPolicySource}; return createComposerScrollPolicy; })()`,
);
const scrollPolicy = createScrollPolicy();
assert.equal(scrollPolicy.shouldProtect({ view: "deep", scrollTop: -4500, editable: true }), true,
  "Typing while reading history in the deep skin must preserve the reading position.");
assert.equal(scrollPolicy.shouldProtect({ view: "deep", scrollTop: -0.5, editable: true }), false,
  "Typing at the live bottom must retain native follow behavior.");
assert.equal(scrollPolicy.shouldProtect({ view: "native", scrollTop: -4500, editable: true }), false,
  "Native Codex must remain untouched.");
assert.equal(scrollPolicy.shouldProtect({ view: "deep", scrollTop: -4500, editable: false }), false,
  "Non-composer keyboard interaction must never lock the conversation.");
assert.equal(scrollPolicy.isTextEditingKey("a"), true);
assert.equal(scrollPolicy.isTextEditingKey("Backspace"), true);
assert.equal(scrollPolicy.isTextEditingKey("ArrowDown"), false,
  "Navigation keys must remain available for intentional movement.");
for (const key of ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", "Escape"]) {
  assert.equal(scrollPolicy.cancelsForUserIntent({ type: "keydown", key }), true,
    `${key} must cancel a delayed text-input scroll restore.`);
}
for (const type of ["wheel", "pointerdown", "touchstart"]) {
  assert.equal(scrollPolicy.cancelsForUserIntent({ type }), true,
    `${type} must take priority over a delayed text-input scroll restore.`);
}
assert.equal(scrollPolicy.cancelsForUserIntent({ type: "scroll" }), false,
  "Programmatic scroll events from the guard must not cancel their own anchor.");
assert.equal(scrollPolicy.cancelsForUserIntent({ type: "keydown", key: "a" }), false,
  "Ordinary text keys must retain the history-reading anchor.");
assert.equal(scrollPolicy.cancelsForUserIntent({
  type: "keydown", key: "ArrowDown", isComposing: true, compositionActive: true,
}), false, "IME candidate navigation must retain the history-reading anchor.");
assert.equal(scrollPolicy.cancelsForUserIntent({
  type: "keydown", key: "PageDown", isComposing: false, compositionActive: false,
}), true, "Navigation after compositionend must cancel the delayed text-input restore.");

const cleanupStart = renderer.indexOf("  const cleanup = () => {");
const cleanupEnd = renderer.indexOf("  const scheduler =", cleanupStart);
assert.ok(cleanupStart >= 0 && cleanupEnd > cleanupStart, "Renderer cleanup fixture is missing.");
const cleanupSource = renderer.slice(cleanupStart, cleanupEnd);
assert.match(cleanupSource, /disposeInteractions\(\);[\s\S]{0,120}clearComposerScrollAnchor\(\);/,
  "Explicit restore/uninstall must cancel delayed composer scroll writes before returning to native Codex.");

console.log("PASS: stable composer input does not rebuild layout markers or move the scroll anchor.");
