import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";
import { SkillRegistry } from "./skills.js";
import { createReadSkillTool } from "../tools/read-skill.js";
import { createListSkillResourcesTool } from "../tools/list-skill-resources.js";
import { createReadSkillResourceTool } from "../tools/read-skill-resource.js";

const root = mkdtempSync(join(tmpdir(), "mini-skills-"));
after(() => rmSync(root, { recursive: true, force: true }));

function addSkill(dir: string, content: string) {
  const folder = join(root, dir);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "SKILL.md"), content);
  return folder;
}

const loopDir = addSkill("nested/agent-loop", `---
name: agent-loop
description: >-
  Use for loop
  explanations
license: MIT
compatibility: Node.js
metadata:
  category: education
  version: "1"
allowed-tools: "read_skill read_skill_resource"
---
Secret detailed instructions
`);
mkdirSync(join(loopDir, "references"));
writeFileSync(join(loopDir, "references", "glossary.md"), "Glossary content");
mkdirSync(join(loopDir, "scripts"));
writeFileSync(join(loopDir, "scripts", "run.sh"), "echo example");
mkdirSync(join(loopDir, "assets"));
writeFileSync(join(loopDir, "assets", "template.txt"), "Example asset");
const manualDir = addSkill("manual", `---
name: manual
description: Explicit only
disable-model-invocation: true
---
Manual steps
`);
addSkill("invalid", `---
name: bad--name
description: ignored
---
Bad
`);

const skills = new SkillRegistry(root);

test("discover YAML metadata and supporting files; prompt only advertises eligible skills", () => {
  assert.deepEqual(skills.list().map((skill) => skill.name), ["manual", "agent-loop"]);
  const loop = skills.list().find((skill) => skill.name === "agent-loop")!;
  assert.equal(loop.description, "Use for loop explanations");
  assert.equal(loop.license, "MIT");
  assert.equal(loop.compatibility, "Node.js");
  assert.deepEqual(loop.metadata, { category: "education", version: "1" });
  assert.deepEqual(loop.allowedTools, ["read_skill", "read_skill_resource"]);
  assert.deepEqual(loop.resources.map((resource) => resource.path), [
    "assets/template.txt", "references/glossary.md", "scripts/run.sh",
  ]);
  assert.match(skills.systemPrompt(), /agent-loop: Use for loop explanations/);
  assert.doesNotMatch(skills.systemPrompt(), /Secret detailed instructions|manual/);
});

test("read full skill instructions and listed resources through named tools", async () => {
  const readSkill = createReadSkillTool(skills);
  const listResources = createListSkillResourcesTool(skills);
  const readResource = createReadSkillResourceTool(skills);
  const instruction = await readSkill.execute({ name: "agent-loop" });
  assert.match(instruction.content[0].text, /Secret detailed instructions/);
  assert.match(instruction.content[0].text, /metadata: \{"category":"education","version":"1"\}/);
  assert.match(instruction.content[0].text, /references\/glossary.md \[reference\]/);
  assert.match((await listResources.execute({ name: "agent-loop" })).content[0].text, /scripts\/run.sh/);
  assert.equal((await readResource.execute({ name: "agent-loop", path: "references/glossary.md" })).content[0].text, "Glossary content");
  await assert.rejects(readResource.execute({ name: "agent-loop", path: "../../manual/SKILL.md" }), /Unknown resource/);
  await assert.rejects(readResource.execute({ name: "agent-loop", path: "SKILL.md" }), /Unknown resource/);
  await assert.rejects(readSkill.execute({ name: "../../other" }), /Unknown skill/);
  await assert.rejects(readSkill.execute({ name: "manual" }), /Unknown skill/);
  assert.match((await listResources.execute({ name: "manual" })).content[0].text, /no bundled resources/);
});

test("explicit skill command expands full instructions and arguments, including hidden skills", () => {
  assert.equal(skills.expandCommand("普通请求"), "普通请求");
  const expanded = skills.expandCommand("/skill:manual run now");
  assert.match(expanded, /<skill name="manual">[\s\S]*Manual steps[\s\S]*<\/skill>\n\nrun now$/);
  assert.throws(() => skills.expandCommand("/skill:unknown"), /Unknown skill/);
  assert.equal(skills.read("manual", true).includes("Manual steps"), true);
});

test("project example bundles reference, script and asset; script uses the asset without writing files", () => {
  const projectSkills = new SkillRegistry(resolve("skills"));
  const resources = projectSkills.listResources("agent-loop");
  assert.deepEqual(resources.map((resource) => [resource.path, resource.kind]), [
    ["assets/template.json", "asset"],
    ["references/agent-loop-glossary.md", "reference"],
    ["scripts/example.sh", "script"],
  ]);
  const asset = JSON.parse(projectSkills.readResource("agent-loop", "assets/template.json")) as {
    title: string;
    steps: string[];
  };
  assert.equal(asset.steps.length, 4);
  assert.match(projectSkills.readResource("agent-loop", "scripts/example.sh"), /template\.json/);
  const result = execFileSync("sh", [resolve("skills/agent-loop/scripts/example.sh")], {
    encoding: "utf8",
  });
  assert.equal(result, `# ${asset.title}\n${asset.steps.map((step, i) => `${i + 1}. ${step}`).join("\n")}\n`);
});

test("reject symlinked resources and changed resource paths", () => {
  symlinkSync(join(manualDir, "SKILL.md"), join(loopDir, "references", "outside.md"));
  assert.deepEqual(skills.listResources("agent-loop").map((item) => item.path).includes("references/outside.md"), false);
  rmSync(join(loopDir, "references", "glossary.md"));
  symlinkSync(join(manualDir, "SKILL.md"), join(loopDir, "references", "glossary.md"));
  assert.throws(() => skills.readResource("agent-loop", "references/glossary.md"), /not a regular file|no longer registered/);
});
