import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const productRoot = path.resolve(here, "..");
const provenancePath = path.join(productRoot, "references", "asset-provenance.md");
const markdown = await fs.readFile(provenancePath, "utf8");
const entries = [];
const repositoryOnlyAssets = new Set([
  "../docs/images/qq-agentshow-cover.jpg",
  "../docs/images/qq-agentshow-preview.png",
  "../docs/images/qq-agentshow-features.png",
  "../docs/images/qq-agentshow-ui-sanitized.png",
  "../docs/images/qq-agentshow-live.png",
  "../docs/images/qq-retro-target-desktop.png",
  "../docs/images/qq-retro-target-chat.png",
]);
const inRepositoryCheckout = await fs.lstat(path.resolve(productRoot, "..", ".git"))
  .then(() => true, () => false);

for (const match of markdown.matchAll(/^\| `([^`]+)` \| `([0-9a-f]{64})` \|/gm)) {
  entries.push({ relative: match[1], expected: match[2] });
}
for (const match of markdown.matchAll(/^- File: `([^`]+)`\n- SHA-256: `([0-9a-f]{64})`/gm)) {
  entries.push({ relative: match[1], expected: match[2] });
}

if (entries.length !== 23) {
  throw new Error(`Expected 23 provenance-gated assets, found ${entries.length}`);
}

let verified = 0;
let standaloneSkipped = 0;
for (const { relative, expected } of entries) {
  const absolute = path.resolve(productRoot, relative);
  let bytes;
  try {
    bytes = await fs.readFile(absolute);
  } catch (error) {
    if (!inRepositoryCheckout && error?.code === "ENOENT" && repositoryOnlyAssets.has(relative)) {
      standaloneSkipped += 1;
      continue;
    }
    throw error;
  }
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== expected) {
    throw new Error(`${relative}: expected ${expected}, got ${actual}`);
  }
  verified += 1;
}

if (inRepositoryCheckout && standaloneSkipped !== 0) {
  throw new Error("Repository-only documentation artwork cannot be skipped in a checkout");
}
console.log(`PASS: ${verified} present asset digests match; ${standaloneSkipped} repository-only documentation assets are absent only from the standalone package.`);
