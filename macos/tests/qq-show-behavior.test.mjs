import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const renderer = await fs.readFile(path.resolve(here, "../assets/renderer-inject.js"), "utf8");

const startMarker = "// QQ_SHOW_SELECTION_POLICY_START";
const endMarker = "// QQ_SHOW_SELECTION_POLICY_END";
const start = renderer.indexOf(startMarker);
const end = renderer.indexOf(endMarker, start);
assert.ok(start >= 0 && end > start, "The renderer must expose the QQ Show selection policy fixture.");

const policySource = renderer.slice(start + startMarker.length, end);
const createPolicy = vm.runInNewContext(`(() => { ${policySource}; return createQqShowSelectionPolicy; })()`);
const policy = createPolicy();
const defaults = [
  { id: "classic-girl" },
  { id: "classic-boy" },
];
const customized = [...defaults, { id: "custom" }];

assert.equal(policy.initialSelection({ options: customized, storedSelection: null }), "custom",
  "A newly configured custom QQ Show must become visible without a personal UI button.");
assert.equal(policy.initialSelection({ options: defaults, storedSelection: null }), "classic-girl",
  "A fresh default install must still show the classic female QQ Show.");
assert.equal(policy.initialSelection({ options: customized, storedSelection: "classic-boy" }), "classic-boy",
  "An explicit local classic-character choice must survive later reinjection.");
assert.equal(policy.initialSelection({ options: defaults, storedSelection: "custom" }), "classic-girl",
  "Removing a custom image must fall back to an available bundled choice.");

console.log("PASS: custom QQ Show configuration is reachable without exposing a personal button.");
