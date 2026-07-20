import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const scanner = path.resolve(here, "../scripts/check-public-privacy.mjs");
const root = await fs.mkdtemp(path.join(os.tmpdir(), "qq-agentshow-privacy-"));

function scan(directory) {
  return spawnSync(process.execPath, [scanner, "--root", directory], { encoding: "utf8" });
}

try {
  const safe = path.join(root, "safe");
  await fs.mkdir(safe);
  await fs.writeFile(path.join(safe, "README.md"), "QQ_agentshow public fixture\n");
  assert.equal(scan(safe).status, 0, "Ordinary public content must pass the privacy gate.");

  const sensitiveShapes = [
    ["gh", "p_", "A".repeat(24)].join(""),
    ["gh", "o_", "B".repeat(24)].join(""),
    ["gh", "u_", "C".repeat(24)].join(""),
    ["gh", "s_", "D".repeat(24)].join(""),
    ["gh", "r_", "E".repeat(24)].join(""),
    ["github_", "pat_", "F".repeat(24)].join(""),
    ["-----BEGIN ", "OPENSSH ", "PRIVATE", " KEY-----"].join(""),
    ["-----BEGIN ", "RSA ", "PRIVATE", " KEY-----"].join(""),
    ["-----BEGIN ", "EC ", "PRIVATE", " KEY-----"].join(""),
  ];
  for (let index = 0; index < sensitiveShapes.length; index += 1) {
    const fixture = path.join(root, `blocked-${index}`);
    await fs.mkdir(fixture);
    await fs.writeFile(path.join(fixture, "value.txt"), `${sensitiveShapes[index]}\n`);
    const result = scan(fixture);
    assert.notEqual(result.status, 0, `Sensitive fixture ${index} must be rejected.`);
  }
  const binaryFixture = path.join(root, "binary-email");
  await fs.mkdir(binaryFixture);
  const binaryEmail = ["person", "@", "example", ".com"].join("");
  await fs.writeFile(path.join(binaryFixture, "asset.png"), Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0]), Buffer.from(binaryEmail), Buffer.from([0]),
  ]));
  assert.notEqual(scan(binaryFixture).status, 0,
    "Printable email metadata inside a binary asset must be rejected.");

  for (const [name, value, binary] of [
    ["space-home", ["", "Users", "Tang Test", "Documents", "private.txt"].join("/"), false],
    ["unicode-home", ["", "Users", "唐先生", "Documents", "private.txt"].join("/"), false],
    ["binary-space-home", ["", "Users", "Tang Test", "Library", "private.bin"].join("/"), true],
    ["binary-unicode-home", ["", "Users", "唐先生", "Library", "private.bin"].join("/"), true],
  ]) {
    const fixture = path.join(root, name);
    await fs.mkdir(fixture);
    const bytes = binary
      ? Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0]), Buffer.from(value), Buffer.from([0])])
      : `${value}\n`;
    await fs.writeFile(path.join(fixture, binary ? "asset.png" : "value.txt"), bytes);
    assert.notEqual(scan(fixture).status, 0,
      `${name} must be rejected even when the account name is not ASCII-safe.`);
  }
} finally {
  await fs.rm(root, { recursive: true, force: true });
}

console.log("PASS: privacy gate rejects common GitHub tokens and private-key headers.");
