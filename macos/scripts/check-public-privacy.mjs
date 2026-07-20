import fs from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repositoryCandidate = path.resolve(here, "../..");
const rootArgument = process.argv[2] === "--root" && process.argv[3]
  ? path.resolve(process.argv[3]) : null;
if (process.argv.length > 2 && !rootArgument) {
  throw new Error("Usage: check-public-privacy.mjs [--root directory]");
}
const repositoryRoot = rootArgument || (existsSync(path.join(repositoryCandidate, "SKILL.md"))
  ? repositoryCandidate : path.resolve(here, ".."));
const skippedDirectories = new Set(rootArgument
  ? [".git", "node_modules"]
  : [".git", "node_modules", "release", "runtime", "tmp"]);
const binaryExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".zip"]);
const findings = [];

const rules = [
  { name: "macOS user directory", regex: /\/Users\/[^\/\r\n\0"'`$<>|\\]+\//g },
  { name: "macOS private temp directory", regex: /\/var\/folders\/[A-Za-z0-9._/-]+/g },
  { name: "email address", regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { name: "private key header", regex: new RegExp(`BEGIN (?:OPENSSH |RSA |EC )?${"PRIVATE"} KEY`, "g") },
  { name: "GitHub token shape", regex: new RegExp(`(?:gh[${"pousr"}]_[A-Za-z0-9]{20,}|github_${"pat"}_[A-Za-z0-9_]{20,})`, "g") },
  { name: "OpenAI key shape", regex: new RegExp(`s${"k"}-[A-Za-z0-9_-]{20,}`, "g") },
  { name: "AWS access key shape", regex: new RegExp(`AK${"IA"}[A-Z0-9]{16}`, "g") },
];

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    if (entry.name === ".DS_Store") continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!skippedDirectories.has(entry.name)) files.push(...await walk(absolute));
    } else if (entry.isFile()) {
      files.push(absolute);
    }
  }
  return files;
}

for (const absolute of await walk(repositoryRoot)) {
  const relative = path.relative(repositoryRoot, absolute);
  const buffer = await fs.readFile(absolute);
  const isBinary = binaryExtensions.has(path.extname(absolute).toLowerCase()) || buffer.includes(0);
  const content = isBinary
    ? `${buffer.toString("utf8")}\n${[...buffer.toString("latin1").matchAll(/[\x20-\x7e]{6,}/g)]
      .map((match) => match[0]).join("\n")}`
    : buffer.toString("utf8");
  for (const rule of rules) {
    if (isBinary && rule.textOnly) continue;
    rule.regex.lastIndex = 0;
    const match = rule.regex.exec(content);
    if (match) findings.push(`${relative}: ${rule.name}`);
  }
}

if (findings.length > 0) {
  console.error("Public privacy check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("PASS: public tree contains no user paths, temp paths, emails, private-key headers, or common token shapes.");
