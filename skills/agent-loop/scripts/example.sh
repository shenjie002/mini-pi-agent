#!/bin/sh
# 只读演示：从 Skill 自己的 assets/template.json 生成简短文本。
# Harness 目前只允许读取脚本源码，不会自动执行本文件。
set -eu

skill_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
node -e '
const fs = require("node:fs");
const path = require("node:path");
const template = JSON.parse(fs.readFileSync(path.join(process.argv[1], "assets/template.json"), "utf8"));
console.log(`# ${template.title}`);
for (const [index, step] of template.steps.entries()) {
  console.log(`${index + 1}. ${step}`);
}
' "$skill_dir"
