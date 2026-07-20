import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writePrivateFileAtomic } from "../scripts/injector.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts", "codex-2007-acceptance.mjs");
const injectorSource = await fs.readFile(path.join(root, "scripts", "injector.mjs"), "utf8");
const verifySource = await fs.readFile(path.join(root, "scripts", "verify-dream-skin-macos.sh"), "utf8");
const planned = spawnSync(process.execPath, [script, "--plan"], { encoding: "utf8" });

assert.equal(planned.status, 0, planned.stderr || "Acceptance plan command must succeed.");
const plan = JSON.parse(planned.stdout);
assert.equal(plan.schemaVersion, 1);
assert.deepEqual(plan.routes, ["home", "project", "task", "native-right"]);
assert.deepEqual(plan.modes, ["deep", "native"]);
assert.deepEqual(plan.agentLayouts, ["classic-chat", "workbench", "minimal"]);
assert.deepEqual(plan.viewports.map((item) => item.id), ["100", "125", "150", "mid-height", "compact-height"]);
assert.deepEqual(plan.viewports.map((item) => item.scalePercent), [100, 125, 150, 100, 100]);
assert.deepEqual(plan.requiredEvidence, [
  "deep-home", "deep-project", "deep-task", "deep-native-right", "native-task",
]);
assert.deepEqual(plan.releaseGates, [
  "quick-regression", "full-tests", "doctor", "live-matrix", "restore-reapply", "release-archive",
]);
assert.match(injectorSource, /--matrix-dir[\s\S]{0,500}--scenario[\s\S]{0,500}--sanitized/,
  "The live injector must expose responsive matrix capture through its public CLI.");
assert.match(injectorSource, /Emulation\.setDeviceMetricsOverride[\s\S]{0,1800}Emulation\.clearDeviceMetricsOverride/,
  "Responsive verification must restore CDP viewport emulation after every matrix run.");
assert.match(injectorSource, /Emulation\.setDeviceMetricsOverride[\s\S]{0,700}dispatchEvent\(new Event\('resize'\)\)/,
  "Every emulated viewport must deterministically refresh the renderer title safe area.");
assert.match(injectorSource, /async function setAcceptanceRedaction/,
  "Acceptance screenshots must define a dedicated private-content redaction layer.");
assert.doesNotMatch(injectorSource, /filter:\s*blur\(/,
  "Screenshot privacy must use opaque masking, never reversible blur.");
assert.match(injectorSource, /QQ_AGENTSHOW_PRIVATE_CANARY[\s\S]{0,1800}visibility === 'hidden'/,
  "Sanitized capture must fail closed unless a bright canary is pixel-hidden by the redaction layer.");
assert.match(injectorSource, /publicBundledArt = typeof options\.themeDir === "string"[\s\S]{0,260}preset-codex-1907-deep/,
  "Public-art capture must be restricted to the exact bundled release preset path.");
assert.match(injectorSource, /data-qq-show-source="classic-girl"[\s\S]{0,260}data-qq-show-source="classic-boy"/,
  "Sanitized release previews may reveal only the two bundled avatar templates.");
assert.doesNotMatch(injectorSource, /data-qq-show-source="custom"[^}]*visibility:\s*visible/s,
  "Sanitized release previews must never reveal a user-selected custom avatar.");
assert.match(injectorSource, /\[data-codex-2007-acceptance-sensitive\] \*[\s\S]{0,600}visibility:\s*hidden !important/,
  "Private containers must hide descendants rather than merely soften readable glyphs.");
assert.match(injectorSource, /document\.head\.appendChild\(style\)/,
  "The private-content redaction style must be installed in the captured document.");
assert.match(injectorSource, /async function capture[\s\S]{0,380}setAcceptanceRedaction\(session, true, publicBundledArt\)[\s\S]{0,240}verifyAcceptanceRedaction/,
  "Screenshot capture must enable redaction before the image operation.");
assert.match(injectorSource, /Page\.captureScreenshot/,
  "Screenshot capture must use the verified CDP image operation.");
const safeOutputRoot = await fs.mkdtemp(path.join(os.tmpdir(), "qq-agentshow-output-"));
try {
  const sentinel = path.join(safeOutputRoot, "sentinel.txt");
  const linkedOutput = path.join(safeOutputRoot, "capture.png");
  await fs.writeFile(sentinel, "preserve-output-target\n");
  await fs.symlink(sentinel, linkedOutput);
  await assert.rejects(
    writePrivateFileAtomic(linkedOutput, Buffer.from("not-a-screenshot")),
    /unsafe output target/,
  );
  assert.equal(await fs.readFile(sentinel, "utf8"), "preserve-output-target\n");
} finally {
  await fs.rm(safeOutputRoot, { recursive: true, force: true });
}
assert.match(injectorSource, /finally[\s\S]{0,240}setAcceptanceRedaction\(session, false\)/,
  "Screenshot capture must remove redaction even when the image operation fails.");
assert.match(injectorSource, /data-codex-2007-acceptance-sensitive[\s\S]{0,1800}privateActionLabels/,
  "Sanitized screenshots must hide queued prompts that sit outside native turn markers.");
assert.match(injectorSource, /\[data-app-action-sidebar-project-row\],[\s\S]{0,120}\[data-app-action-sidebar-thread-row\],/,
  "Sanitized screenshots must mask complete project and recent-task rows, including text without utility classes.");
assert.match(injectorSource, /data-qq2007-section="tasks"\] \[role="listitem"\]/,
  "Sanitized screenshots must also hide native Recents rows that do not expose thread-row markers.");
assert.match(injectorSource, /--lifecycle-smoke/,
  "The live injector must expose a restore/reapply lifecycle smoke through its public CLI.");
assert.match(injectorSource, /friendQqShowControls\.length === 2[\s\S]{0,240}visibleQqShowControls\.length === 2/,
  "Live verification must require exactly the two non-personal default QQ Show choices.");
assert.match(injectorSource, /phases\.push\("removed-again"\)[\s\S]{0,1200}phases\.push\("applied-final"\)/,
  "The lifecycle smoke must prove a second cleanup and a final unique application.");
assert.match(verifySource, /--matrix-dir[\s\S]{0,700}--scenario[\s\S]{0,700}--lifecycle-smoke/,
  "The installed verify entrypoint must forward matrix and lifecycle acceptance modes.");

const evidenceDir = await fs.mkdtemp(path.join(os.tmpdir(), "codex-2007-matrix-test."));
const routeFor = (scenario) => scenario.slice(scenario.indexOf("-") + 1);
for (const scenario of plan.requiredEvidence) {
  for (const { id } of plan.viewports) {
    await fs.writeFile(path.join(evidenceDir, `${scenario}-${id}.png`), Buffer.from([137, 80, 78, 71]));
  }
  const layoutCases = scenario === "deep-task" ? plan.agentLayouts.map((layout) => ({
    layout,
    screenshot: `${scenario}-layout-${layout}-compact.png`,
    result: { pass: true, documentOverflow: { x: false, y: false } },
  })) : [];
  for (const item of layoutCases) {
    await fs.writeFile(path.join(evidenceDir, item.screenshot), Buffer.from([137, 80, 78, 71]));
  }
  await fs.writeFile(path.join(evidenceDir, `${scenario}.json`), `${JSON.stringify({
    schemaVersion: 1,
    scenario,
    mode: scenario.startsWith("native-") ? "native" : "deep",
    route: routeFor(scenario),
    sanitized: true,
    cases: plan.viewports.map(({ id, scalePercent }) => ({
      id,
      scalePercent,
      screenshot: `${scenario}-${id}.png`,
      result: { pass: true, documentOverflow: { x: false, y: false } },
    })),
    layoutCases,
  }, null, 2)}\n`);
}
const lifecyclePath = path.join(evidenceDir, "restore-reapply.json");
await fs.writeFile(lifecyclePath, `${JSON.stringify({
  schemaVersion: 1,
  pass: true,
  nativeIdentityPass: true,
  phases: ["removed", "applied", "reapplied", "removed-again", "applied-final"],
})}\n`);
const reportPath = path.join(evidenceDir, "acceptance-report.md");
const finalized = spawnSync(process.execPath, [
  script, "--finalize", "--evidence-dir", evidenceDir,
  "--lifecycle", lifecyclePath, "--output", reportPath,
], { encoding: "utf8" });
assert.equal(finalized.status, 0, finalized.stderr || "Complete evidence must finalize.");
const finalResult = JSON.parse(finalized.stdout);
assert.equal(finalResult.pass, true);
assert.equal(finalResult.scenarioCount, 5);
assert.equal(finalResult.viewportCaseCount, 25);
assert.equal(finalResult.layoutCaseCount, 3);
assert.match(await fs.readFile(reportPath, "utf8"), /5\/5 scenarios[\s\S]*25\/25 viewport cases[\s\S]*3\/3 compact template cases[\s\S]*restore\/reapply: PASS/);
await fs.rm(evidenceDir, { recursive: true, force: true });

console.log("PASS: Codex 2007 acceptance plan covers routes, modes, responsive viewports, and release gates.");
