import {
  lstatSync,
  readdirSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import YAML from "yaml";

export type SkillResource = {
  path: string;
  kind: "script" | "reference" | "asset" | "file";
};

export type Skill = {
  name: string;
  description: string;
  filePath: string;
  baseDir: string;
  license?: string;
  compatibility?: string;
  metadata: Record<string, string>;
  allowedTools: string[];
  disableModelInvocation: boolean;
  resources: SkillResource[];
};

type ParsedSkill = Omit<Skill, "filePath" | "baseDir" | "resources"> & {
  body: string;
};

/**
 * A deliberately small, read-only implementation of the Agent Skills model.
 *
 * A skill is a directory rooted at SKILL.md. Its Markdown body is the workflow;
 * files next to it are supporting resources. Resources are exposed by name, not
 * by arbitrary filesystem paths.
 */
export class SkillRegistry {
  private readonly skills = new Map<string, Skill>();

  constructor(private readonly root: string) {
    this.discover(resolve(root));
  }

  list(): Skill[] {
    return [...this.skills.values()];
  }

  /** Metadata only: this is what belongs in the system prompt at startup. */
  systemPrompt(): string {
    const available = this.list().filter((skill) => !skill.disableModelInvocation);
    if (!available.length) return "";

    return [
      "可用技能（这里只展示摘要，完整正文和配套资源按需加载）：",
      ...available.map((skill) => {
        const details = [
          skill.license ? `license=${skill.license}` : "",
          skill.compatibility ? `compatibility=${skill.compatibility}` : "",
          skill.allowedTools.length > 0
            ? `declared-tools=${skill.allowedTools.join(",")}`
            : "",
        ].filter(Boolean).join("; ");
        return `- ${skill.name}: ${skill.description}${details ? ` (${details})` : ""}`;
      }),
      "当任务符合技能简介时，先调用 read_skill(name) 读取完整正文；需要参考资料时，再调用 list_skill_resources 和 read_skill_resource。",
      "技能正文中的 allowed-tools 只是声明性元数据，不会授予额外工具权限；所有文件和脚本操作仍必须通过当前 Harness 已注册的工具完成。",
    ].join("\n");
  }

  /** Render the complete instruction document, but not the resource contents. */
  read(name: string, explicit = false): string {
    const skill = this.require(name, explicit);
    const parsed = this.readParsed(skill);
    const metadata = [
      `location: ${skill.filePath}`,
      `base directory: ${skill.baseDir}`,
      parsed.license ? `license: ${parsed.license}` : "",
      parsed.compatibility ? `compatibility: ${parsed.compatibility}` : "",
      parsed.allowedTools.length > 0
        ? `allowed-tools (declarative): ${parsed.allowedTools.join(", ")}`
        : "",
      Object.keys(parsed.metadata).length > 0
        ? `metadata: ${JSON.stringify(parsed.metadata)}`
        : "",
    ].filter(Boolean);

    const resources = skill.resources.length === 0
      ? "(none)"
      : skill.resources.map((resource) => `- ${resource.path} [${resource.kind}]`).join("\n");

    return [
      `<skill name="${escapeXml(skill.name)}">`,
      "This is an instruction document, not an authorization grant.",
      ...metadata,
      "References are relative to the skill base directory.",
      "",
      parsed.body,
      "",
      "Available bundled resources:",
      resources,
      "</skill>",
    ].join("\n");
  }

  listResources(name: string): SkillResource[] {
    return [...this.require(name, true).resources];
  }

  readResource(name: string, resourcePath: string): string {
    const skill = this.require(name, true);
    const normalized = resourcePath.replaceAll("\\", "/");
    const resource = skill.resources.find((item) => item.path === normalized);
    if (!resource) {
      throw new Error(`Unknown resource for skill ${name}: ${resourcePath}`);
    }

    // Keep the published resource index current when a directory changes.
    const resourcePaths = new Set(discoverResources(skill.baseDir).map((item) => item.path));
    if (!resourcePaths.has(resource.path)) {
      throw new Error(`Skill resource is no longer registered: ${resourcePath}`);
    }
    const absolutePath = resolve(skill.baseDir, resource.path);
    const relativePath = relative(skill.baseDir, absolutePath);
    if (
      relativePath === ".." ||
      relativePath.startsWith(`..${sep}`) ||
      absolutePath === skill.baseDir
    ) {
      throw new Error(`Skill resource escapes skill directory: ${resourcePath}`);
    }

    // Symlinks are excluded from discovery; verify again before reading, including
    // parent directories that may have changed since discovery.
    if (!lstatSync(absolutePath).isFile() ||
        !realpathSync(absolutePath).startsWith(`${realpathSync(skill.baseDir)}${sep}`)) {
      throw new Error(`Skill resource is not a regular file within its skill: ${resourcePath}`);
    }
    const contents = readFileSync(absolutePath);
    if (contents.length > 256 * 1024 || contents.includes(0)) {
      throw new Error(`Skill resource must be a small text file: ${resourcePath}`);
    }
    return contents.toString("utf8");
  }

  /** Expand the explicit /skill:name command into a user message. */
  expandCommand(input: string): string {
    const match = /^\/skill:([^\s]+)(?:\s+([\s\S]*))?$/.exec(input.trim());
    if (!match) return input;
    const body = this.read(match[1], true);
    return match[2] ? `${body}\n\n${match[2]}` : body;
  }

  private require(name: string, explicit: boolean): Skill {
    const skill = this.skills.get(name);
    if (!skill || (skill.disableModelInvocation && !explicit)) {
      throw new Error(`Unknown skill: ${name}`);
    }
    return skill;
  }

  private discover(directory: string): void {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }

    const skillFile = entries.find(
      (entry) => entry.name === "SKILL.md" && entry.isFile(),
    );
    if (skillFile) {
      this.loadSkill(join(directory, skillFile.name));
      return;
    }

    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules") {
        continue;
      }
      this.discover(join(directory, entry.name));
    }
  }

  private loadSkill(filePath: string): void {
    let parsed: ParsedSkill | null;
    try {
      parsed = parseSkill(readFileSync(filePath, "utf8"));
    } catch {
      parsed = null;
    }
    if (!parsed || this.skills.has(parsed.name)) {
      console.warn(`Skipping invalid or duplicate skill: ${filePath}`);
      return;
    }

    const baseDir = dirname(filePath);
    this.skills.set(parsed.name, {
      ...parsed,
      filePath,
      baseDir,
      resources: discoverResources(baseDir),
    });
  }

  private readParsed(skill: Skill): ParsedSkill {
    if (!lstatSync(skill.filePath).isFile() ||
        !realpathSync(skill.filePath).startsWith(`${realpathSync(this.root)}${sep}`)) {
      throw new Error(`Invalid skill file: ${skill.name}`);
    }
    const parsed = parseSkill(readFileSync(skill.filePath, "utf8"));
    if (!parsed || parsed.name !== skill.name) {
      throw new Error(`Invalid skill: ${skill.name}`);
    }
    return parsed;
  }
}

function discoverResources(baseDir: string): SkillResource[] {
  const resources: SkillResource[] = [];
  const visit = (directory: string) => {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
      } else if (entry.isFile() && entry.name !== "SKILL.md") {
        const path = relative(baseDir, absolutePath).split(sep).join("/");
        resources.push({ path, kind: resourceKind(path) });
      }
    }
  };
  visit(baseDir);
  return resources;
}

function resourceKind(path: string): SkillResource["kind"] {
  if (path === "scripts" || path.startsWith("scripts/")) return "script";
  if (path === "references" || path.startsWith("references/")) return "reference";
  if (path === "assets" || path.startsWith("assets/")) return "asset";
  return "file";
}

/** Parse the Agent Skills frontmatter fields without adding a YAML dependency. */
function parseSkill(raw: string): ParsedSkill | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw);
  if (!match) return null;
  let fields: Record<string, unknown>;
  try {
    const parsed: unknown = YAML.parse(match[1], { uniqueKeys: true });
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    fields = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  const { name, description } = fields;
  if (
    typeof name !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) ||
    name.length > 64 ||
    typeof description !== "string" ||
    !description.trim() ||
    description.length > 1024
  ) {
    return null;
  }

  const metadata: Record<string, string> = {};
  if (fields.metadata && typeof fields.metadata === "object" && !Array.isArray(fields.metadata)) {
    for (const [key, value] of Object.entries(fields.metadata)) {
      if (typeof value === "string") metadata[key] = value;
    }
  }
  const allowedTools = fields["allowed-tools"];
  return {
    name,
    description,
    license: typeof fields.license === "string" ? fields.license : undefined,
    compatibility: typeof fields.compatibility === "string" ? fields.compatibility : undefined,
    metadata,
    allowedTools: typeof allowedTools === "string"
      ? allowedTools.split(/\s+/).filter(Boolean)
      : Array.isArray(allowedTools)
        ? allowedTools.filter((item): item is string => typeof item === "string")
        : [],
    disableModelInvocation: fields["disable-model-invocation"] === true,
    body: match[2].trim(),
  };
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
