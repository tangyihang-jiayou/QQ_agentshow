import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { earlyPayloadFor, petPayloadFor, VERIFY_REMOVED_EXPRESSION } from "../scripts/injector.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const injectorPath = path.resolve(here, "../scripts/injector.mjs");
const source = await fs.readFile(injectorPath, "utf8");
assert.match(source, /cssTemplate\.replaceAll\(\s*"__DREAM_SKIN_ICON_SPRITE__"/,
  "Every CSS sprite reference, including the native-view recovery button, must be embedded.");
assert.match(source, /if \(cliMode !== "watch"\) process\.exit\(process\.exitCode \?\? 0\)/,
  "Finite injector CLI modes must exit even when Electron leaves a CDP socket half-open.");
assert.match(source, /path\.join\(assetsRoot, "sounds"\), "static"/,
  "The watcher must refresh its payload when bundled notification audio changes.");

function createFixture() {
  const observers = [];
  const timers = new Map();
  let nextTimer = 1;
  const markers = { shell: false, sidebar: false };
  const context = {
    window: { installs: [] },
    document: {
      documentElement: {},
      querySelector(selector) {
        if (selector === "main.main-surface") return markers.shell ? {} : null;
        if (selector === "aside.app-shell-left-panel") return markers.sidebar ? {} : null;
        return null;
      },
    },
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
        this.connected = true;
        observers.push(this);
      }
      observe() {}
      disconnect() { this.connected = false; }
    },
    setTimeout(callback) {
      const id = nextTimer++;
      timers.set(id, callback);
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
  };
  return { context, markers, observers };
}

const guarded = createFixture();
vm.runInNewContext(earlyPayloadFor('window.installs.push("guarded")', "guarded"), guarded.context);
assert.deepEqual(guarded.context.window.installs, [], "Auxiliary app targets must remain untouched.");
guarded.markers.shell = true;
guarded.observers[0].callback([]);
assert.deepEqual(guarded.context.window.installs, [], "A main surface without the Codex sidebar is not sufficient.");

const generations = createFixture();
vm.runInNewContext(earlyPayloadFor('window.installs.push("old")', "old"), generations.context);
vm.runInNewContext(earlyPayloadFor('window.installs.push("new")', "new"), generations.context);
generations.markers.shell = true;
generations.markers.sidebar = true;
for (const observer of generations.observers) observer.callback([]);
assert.deepEqual(
  generations.context.window.installs,
  ["new"],
  "A stale early script must yield to the newest watcher generation.",
);
assert.equal(generations.context.window.__CODEX_DREAM_SKIN_EARLY_APPLIED__, "new");

const discoveryStart = source.indexOf("record.earlyScriptId = await registerEarly");
const probeStart = source.indexOf("const probe = await waitForCodexProbe", discoveryStart);
assert.ok(discoveryStart >= 0 && probeStart > discoveryStart, "Early registration must happen before full shell probing.");
assert.match(
  source,
  /finally\s*\{[\s\S]*Promise\.all\(\[\.\.\.sessions\.values\(\)\][\s\S]*removeEarly\(record\)/,
  "Watcher shutdown must unregister persistent Page scripts before closing CDP sessions.",
);
assert.match(
  source,
  /const earlyApplied = await session\.evaluate\([\s\S]*if \(!earlyApplied\) \{[\s\S]*applyToSession/,
  "The watcher must not run the full payload twice after a successful early install.",
);
assert.match(source, /isPetOverlayTarget\(target\)[\s\S]{0,1000}applyPetToSession\(session, current\.petPayload\)/,
  "The watcher must route the avatar overlay to the dedicated project penguin payload.");
assert.match(source, /record\.kind === "pet"[\s\S]{0,160}applyPetToSession\(session, current\.petPayload\)/,
  "A hot theme refresh must update the live penguin pet without restarting Codex.");
assert.match(source, /friendScroll:[\s\S]*overflowY:/,
  "Live verification must inspect the friend panel's independent scroll region.");
assert.match(source, /const bitmapIconCount = bitmapIconStyles\.length;/,
  "Live verification must count the complete QQ2007 bitmap sprite roles.");
assert.match(source, /expectedBitmapIconRoles[\s\S]{0,1500}backgroundPosition[\s\S]{0,900}cellSize/,
  "Live verification must check each bitmap role's sprite cell, dimensions, and scaled position.");
assert.match(source, /const visualMaterialPass = [\s\S]{0,900}panelMaterials\.every/,
  "Live verification must inspect the shared QQ2007 panel materials.");
assert.match(source, /result\.visualPass = bitmapIconPass && visualMaterialPass;/,
  "Bitmap and material checks must participate in the live pass result.");
assert.match(source, /nativeSkinView[\s\S]{0,1200}nativeViewPass/,
  "Verification must treat an intentionally selected native view as a healthy installed state.");
assert.match(source, /compactComposer[\s\S]{0,1000}composerControls\.length === 4[\s\S]{0,200}composerEditorRegionClickable/,
  "Live verification must understand the current compact ChatGPT composer and its editable region.");
assert.match(source, /conversationLegibilityPass[\s\S]{0,900}conversationPass/,
  "Live verification must reject unreadable reasoning, activity, tool-status, and timestamp text.");
assert.match(source, /sidebarResizeHandle:[\s\S]{0,240}pointerEvents:/,
  "Live verification must report whether the QQ2007 sidebar resize handle can receive pointer input.");
assert.match(source, /const sidebarPass = [\s\S]{0,260}result\.sidebarResizeHandle\.pointerEvents === 'auto'[\s\S]{0,1400}result\.sidebarPass = sidebarPass/,
  "Live verification must require an interactive native sidebar resize handle.");
for (const watchedAsset of ["dream-skin.css", "renderer-inject.js", "qq2007-icons.png", "sounds"]) {
  assert.ok(source.includes(`name === "${watchedAsset}"`) || source.includes(`assetsRoot, "${watchedAsset}"`),
    `The live watcher must include ${watchedAsset} in static payload invalidation.`);
}
assert.match(source, /staticChanged[\s\S]{0,2400}invalidateStaticPayloadAssets\(\)/,
  "A watched static asset change must invalidate the embedded payload cache before refresh.");
assert.match(source, /friendSearch:[\s\S]*friendPet:[\s\S]*friendQqShow:/,
  "Live verification must inspect the fixed search row and clipped media regions.");
assert.match(source, /result\.friendPass = friendPass;/,
  "Live verification must expose the Issue 6 friend-panel verdict.");
assert.match(source, /\['新建任务', '已安排', '插件', '站点'\]\.every/,
  "Live verification must accept the four core navigation actions present in current Codex builds.");
assert.match(source, /sidebarHeadings\.includes\('Tasks'\) \|\| sidebarHeadings\.includes\('Recents'\)/,
  "Live verification must accept both legacy Tasks and current Recents sidebar sections.");
assert.match(source, /const friendPass = !qq2007Mode \|\| Boolean\(/,
  "Friend verification must return a boolean and remain neutral in classic mode.");
assert.match(source, /bodyGridColumns:\s*getComputedStyle\(document\.body\)\.gridTemplateColumns/,
  "Live verification must capture the computed workspace grid.");
assert.match(source, /rightColumnWidth[\s\S]{0,120}bodyGridColumns/,
  "Live verification must measure the persistent right recovery column.");
assert.match(source, /friendRail:[\s\S]{0,220}nativeTab:[\s\S]{0,220}friendTab:/,
  "Live verification must inspect the persistent right rail and both recovery actions.");
assert.match(source, /nativeRightGridPass[\s\S]{0,260}Math\.abs\([^\n]+- 28\) <= 1/,
  "Live verification must require the agreed 28px recovery rail while a native panel is active.");
assert.match(source, /nativeRightOpen[\s\S]{0,500}rightRailPass[\s\S]{0,500}friendPass/,
  "A native panel may replace the friend content only when the right recovery rail remains usable.");
assert.match(source, /preset-codex-1907-deep", "assistant\.png"[\s\S]*preset-codex-1907-deep", "qq-show\.png"/,
  "Deep themes without optional decorations must receive bundled assistant and QQ show defaults.");
assert.match(source, /qq-show-classic-girl\.png[\s\S]{0,320}qq-show-classic-boy\.png/,
  "Deep mode must bundle both selectable classic QQ show characters.");
assert.match(source, /qq-task-complete\.wav[\s\S]{0,320}qq-needs-confirmation\.wav/,
  "The static payload must bundle the two deterministically cleaned historical retro WAV notifications.");
assert.match(source, /notificationData[\s\S]{0,700}data:audio\/wav;base64/,
  "Bundled notification sounds must be embedded into the local renderer payload without network requests.");
assert.match(source, /const decorationAssets = theme\.mode === "deep"[\s\S]{0,120}\.{3}staticAssets\.defaultDecorationAssets, \.{3}themeDecorationAssets/,
  "Explicit deep-theme decorations must override bundled defaults.");
assert.match(source, /sentImageMedia[\s\S]{0,900}data-qq2007-conversation-gallery[\s\S]*conversationMediaPass/,
  "Live verification must reject sent images that fall back to the native thumbnail strip.");
assert.match(source,
  /isFullyClippedHiddenGeneratedSlide[\s\S]{0,500}generated-image-preview[^\n]*aria-hidden=\\?"true\\?"[\s\S]{0,500}generated-image-gallery[\s\S]{0,500}overflowX[\s\S]{0,500}previewRect\.right <= galleryRect\.left \+ 1 \|\| previewRect\.left >= galleryRect\.right - 1/,
  "Verification may ignore only fully clipped, aria-hidden native generated-image slides.");
assert.match(source,
  /visibleContentAssets[\s\S]{0,500}filter\(\(node\) => !isFullyClippedHiddenGeneratedSlide\(node\)\)/,
  "The content bounds gate must retain visible and partially visible media while excluding fully clipped native slides.");
assert.match(source,
  /intersectsThreadViewportVertically[\s\S]{0,500}assetRect\.bottom > viewportRect\.top \+ 1 && assetRect\.top < viewportRect\.bottom - 1[\s\S]{0,500}filter\(intersectsThreadViewportVertically\)/,
  "The visible-content bounds gate must ignore stale layout boxes from assets outside the current thread viewport.");

const petValues = new Map();
const petPriorities = new Map();
const petStyle = {
  getPropertyValue(name) { return petValues.get(name) || ""; },
  getPropertyPriority(name) { return petPriorities.get(name) || ""; },
  setProperty(name, value, priority = "") {
    petValues.set(name, String(value));
    petPriorities.set(name, String(priority));
  },
  removeProperty(name) {
    petValues.delete(name);
    petPriorities.delete(name);
  },
};
const petButtonAttributes = new Map([["aria-label", "Fireball pet"]]);
const petButton = {
  getAttribute(name) { return petButtonAttributes.get(name) ?? null; },
  setAttribute(name, value) { petButtonAttributes.set(name, String(value)); },
  removeAttribute(name) { petButtonAttributes.delete(name); },
};
const petAvatar = {
  style: petStyle,
  attributes: new Map(),
  setAttribute(name, value) { this.attributes.set(name, String(value)); },
  removeAttribute(name) { this.attributes.delete(name); },
  closest(selector) { return selector.includes("avatar-mascot-button") ? petButton : null; },
};
const petRootAttributes = new Map();
let petStyleNode = null;
const petFixture = {
  window: {
    addEventListener() {},
    removeEventListener() {},
    matchMedia() {
      return { matches: false, addEventListener() {}, removeEventListener() {} };
    },
  },
  setTimeout() { return 1; },
  clearTimeout() {},
  document: {
    head: { appendChild(node) { petStyleNode = node; } },
    documentElement: {
      appendChild(node) { petStyleNode = node; },
      setAttribute(name, value) { petRootAttributes.set(name, String(value)); },
      removeAttribute(name) { petRootAttributes.delete(name); },
    },
    createElement() {
      return { id: "", textContent: "", remove() { petStyleNode = null; } };
    },
    getElementById(id) { return id === "codex-dream-skin-pet-style" ? petStyleNode : null; },
    querySelector(selector) { return selector.includes("codex-avatar") ? petAvatar : null; },
  },
};
const petInstall = vm.runInNewContext(
  petPayloadFor("data:image/png;base64,UEVOR1VJTg==", "penguin-test", "playful"),
  petFixture,
);
assert.equal(petInstall.installed, true);
assert.equal(petInstall.motion, "playful");
assert.match(petValues.get("background-image"), /^url\("data:image\/png;base64,/);
assert.equal(petPriorities.get("background-image"), "important");
assert.equal(petButtonAttributes.get("aria-label"), "企鹅桌面宠物");
assert.equal(petAvatar.attributes.get("data-ds2007-pet-motion"), "playful");
assert.match(petStyleNode.textContent, /ds2007PetHop/);
assert.match(petStyleNode.textContent, /ds2007PetPeek[\s\S]*ds2007PetShuffle[\s\S]*ds2007PetType/,
  "The overlay penguin must share the expanded random QQ-pet action set.");
assert.equal(petRootAttributes.get("data-ds2007-penguin-pet"), "penguin-test");
assert.equal(petFixture.window.__CODEX_DREAM_SKIN_PET_STATE__.cleanup(), true);
assert.equal(petValues.has("background-image"), false);
assert.equal(petButtonAttributes.get("aria-label"), "Fireball pet");
assert.equal(petRootAttributes.has("data-ds2007-penguin-pet"), false);

function createRestoreFixture({
  rootClass = false, attribute = null, variable = null, styleNode = false, marker = false,
  state = false, disabled = false, analysisCache = false,
} = {}) {
  const attributes = attribute ? [{ name: attribute }] : [];
  const style = variable ? [variable] : [];
  const window = {};
  if (state) window.__CODEX_DREAM_SKIN_STATE__ = {};
  if (disabled) window.__CODEX_DREAM_SKIN_DISABLED__ = false;
  if (analysisCache) window.__CODEX_DREAM_SKIN_ANALYSIS_CACHE__ = new Map();
  return {
    window,
    document: {
      documentElement: {
        attributes,
        style,
        classList: { contains(name) { return name === "codex-dream-skin" && rootClass; } },
      },
      getElementById(id) { return styleNode && id === "codex-dream-skin-style" ? {} : null; },
      querySelector() { return marker ? {} : null; },
    },
  };
}

assert.equal(vm.runInNewContext(VERIFY_REMOVED_EXPRESSION, createRestoreFixture()), true);
for (const residue of [
  { rootClass: true },
  { attribute: "data-dream-shell" },
  { attribute: "data-ds2007-section" },
  { variable: "--ds-bg" },
  { variable: "--dream-skin-art" },
  { styleNode: true },
  { marker: true },
  { state: true },
  { disabled: true },
  { analysisCache: true },
]) {
  assert.equal(vm.runInNewContext(VERIFY_REMOVED_EXPRESSION, createRestoreFixture(residue)), false,
    `Restore verification must reject residue: ${JSON.stringify(residue)}`);
}

console.log("PASS: early injection is shell-guarded, generation-safe, and strict restore verification rejects residue.");
