import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const renderer = await fs.readFile(path.resolve(here, "../assets/renderer-inject.js"), "utf8");
const css = await fs.readFile(path.resolve(here, "../assets/dream-skin.css"), "utf8");
const startMarker = "// CONVERSATION_MEDIA_POLICY_START";
const endMarker = "// CONVERSATION_MEDIA_POLICY_END";
const start = renderer.indexOf(startMarker);
const end = renderer.indexOf(endMarker, start);
assert.ok(start >= 0 && end > start, "Conversation media behavior must expose its executable fixture block.");
const source = renderer.slice(start + startMarker.length, end);
const normalize = vm.runInNewContext(`(() => { ${source}; return normalizeConversationMedia; })()`);

const gallery = { dataset: {} };
const row = {
  dataset: {},
  parentElement: gallery,
  previews: [],
  querySelectorAll() { return this.previews; },
};
function sentImage(id) {
  const preview = {
    id,
    dataset: {},
    parentElement: row,
    getAttribute(name) { return name === "aria-label" ? "User attachment" : null; },
  };
  const image = {
    id,
    nodeType: 1,
    dataset: {},
    loading: "lazy",
    decoding: "auto",
    matches() { return true; },
    querySelectorAll() { return []; },
    closest() { return preview; },
  };
  preview.image = image;
  return { preview, image };
}

const sent = [sentImage("one"), sentImage("two"), sentImage("three")];
row.previews = sent.map((item) => item.preview);
const root = {
  nodeType: 1,
  matches() { return false; },
  querySelectorAll() { return sent.map((item) => item.image); },
};
normalize(root);
assert.equal(gallery.dataset.qq2007ConversationGallery, "true");
assert.equal(gallery.dataset.qq2007ConversationCount, "3");
assert.equal(row.dataset.qq2007ConversationGalleryRow, "true");
for (const { image, preview } of sent) {
  assert.equal(image.dataset.qq2007MediaReady, "true");
  assert.equal(image.loading, "eager");
  assert.equal(image.decoding, "async");
  assert.equal(preview.dataset.qq2007ConversationMedia, "image");
}

row.previews.splice(1, 1);
normalize(sent[0].image);
assert.deepEqual(row.previews.map((item) => item.id), ["one", "three"],
  "Removing the middle native attachment must preserve the other unique previews.");
assert.equal(gallery.dataset.qq2007ConversationCount, "2",
  "The real gallery count must follow native attachment removal.");

const pendingRule = css.match(/\.composer-attachment-surface:has\(img\)\s*\{([^}]+)\}/s)?.[1] || "";
assert.match(pendingRule, /flex:\s*0 0 60px !important/);
assert.match(pendingRule, /width:\s*60px !important/);
assert.match(css, /data-qq2007-composer-region="attachments"\]:not\(:empty\)[\s\S]{0,620}overflow-x:\s*auto !important/,
  "Three or more pending cards must remain in the native removable horizontal tray.");
assert.match(css, /data-qq2007-conversation-media="image"[\s\S]{0,420}height:\s*auto !important;[\s\S]{0,220}object-fit:\s*contain !important;/,
  "Sent media must preserve natural aspect ratio instead of becoming garbled thumbnails.");

console.log("PASS: three sent images remain distinct, removable, counted, and mapped to the responsive gallery policy.");
