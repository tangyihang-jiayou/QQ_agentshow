import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readPngTransparency } from "./image-metadata.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repositoryCandidate = path.resolve(here, "../..");
const fullRepository = existsSync(path.join(repositoryCandidate, "SKILL.md"));
const root = fullRepository ? repositoryCandidate : path.resolve(here, "..");
const runtimeRoot = fullRepository ? path.join(root, "macos") : root;
const skillPath = fullRepository ? path.join(root, "SKILL.md") : path.join(root, "SKILL.md");
const skill = await fs.readFile(skillPath, "utf8");
const lines = skill.trimEnd().split(/\r?\n/);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(lines.length <= 100, `SKILL.md must remain concise (found ${lines.length} lines)`);
assert(/^---\n[\s\S]*?\n---\n/.test(skill), "SKILL.md frontmatter is missing");
assert(/^name:\s*QQ_agentshow\s*$/m.test(skill), "Skill name must be exactly QQ_agentshow");
assert(/^description:\s*\S.{40,}$/m.test(skill), "Skill description must explain when to use it");

if (fullRepository) {
  const markdownFiles = [
    path.join(root, "README.md"), path.join(root, "SKILL.md"), path.join(root, "NOTICE.md"),
    ...((await fs.readdir(path.join(root, "docs"))).filter((name) => name.endsWith(".md"))
      .map((name) => path.join(root, "docs", name))),
    path.join(root, "macos", "README.md"), path.join(root, "macos", "SKILL.md"),
    path.join(root, "macos", "NOTICE.md"),
  ];
  for (const markdownFile of markdownFiles) {
    const markdown = await fs.readFile(markdownFile, "utf8");
    const localLinks = [...markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
      .map((match) => match[1])
      .filter((target) => !/^[a-z]+:/i.test(target) && !target.startsWith("#"));
    for (const target of localLinks) {
      const relativeTarget = decodeURIComponent(target.split("#", 1)[0]);
      const resolved = path.resolve(path.dirname(markdownFile), relativeTarget);
      assert(resolved === root || resolved.startsWith(`${root}${path.sep}`),
        `Markdown link escapes the repository: ${target}`);
      await fs.access(resolved);
    }
  }
}

const executablePaths = fullRepository
  ? [path.join(root, "install.sh"), path.join(root, "restore.sh")]
  : [path.join(root, "Install Codex Dream Skin.command"), path.join(root, "Restore Codex Dream Skin.command")];
for (const executable of executablePaths) {
  const stat = await fs.stat(executable);
  assert((stat.mode & 0o111) !== 0, `${path.basename(executable)} must be executable`);
}

const version = (await fs.readFile(path.join(runtimeRoot, "VERSION"), "utf8")).trim();
const packageJson = JSON.parse(await fs.readFile(path.join(runtimeRoot, "package.json"), "utf8"));
const common = await fs.readFile(path.join(runtimeRoot, "scripts/common-macos.sh"), "utf8");
const injector = await fs.readFile(path.join(runtimeRoot, "scripts/injector.mjs"), "utf8");
assert(packageJson.version === version, "package.json and VERSION differ");
assert(common.includes(`SKIN_VERSION="${version}"`), "common-macos.sh version differs");
assert(injector.includes(`const SKIN_VERSION = "${version}";`), "injector version differs");

const theme = JSON.parse(await fs.readFile(
  path.join(runtimeRoot, "presets/preset-codex-1907-deep/theme.json"), "utf8",
));
assert(theme.agentShow?.layout === "classic-chat", "public preset must default to classic-chat");
assert(theme.agentShow?.conversationPreview === "real", "public preset conversation default is missing");
assert(theme.agentShow?.petMotion === "calm", "public preset pet motion default is missing");

const penguinBytes = await fs.readFile(
  path.join(runtimeRoot, "presets/preset-codex-1907-deep/assistant.png"),
);
const penguin = readPngTransparency(penguinBytes);
assert(penguin?.hasAlphaChannel && penguin.hasTransparentPixels && penguin.hasVisiblePixels,
  "built-in penguin must be a visible transparent PNG cutout");

console.log(`PASS: QQ_agentshow Skill ${version} is linked, executable, version-consistent, and ships a transparent pet.`);
