import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Argv } from "yargs";
import { helpFooter } from "./build.js";

type ReadFile = typeof readFile;

export async function findPackageRoot(moduleUrl: string, read: ReadFile = readFile) {
  let directory = dirname(fileURLToPath(moduleUrl));

  while (true) {
    try {
      const packageJson = JSON.parse(await read(join(directory, "package.json"), "utf8")) as {
        name?: string;
      };
      if (packageJson.name === "smartbundle") {
        return directory;
      }
    } catch {
      // Keep searching: compiled modules are nested several levels below root.
    }

    const parent = dirname(directory);
    if (parent === directory) {
      throw new Error('Could not find the "smartbundle" package root');
    }
    directory = parent;
  }
}

export type SkillCommandDependencies = {
  moduleUrl?: string;
  readFile?: ReadFile;
  writeOutput?: (text: string) => void;
};

export async function runSkillCommand(dependencies: SkillCommandDependencies = {}) {
  const read = dependencies.readFile ?? readFile;
  const root = await findPackageRoot(dependencies.moduleUrl ?? import.meta.url, read);
  const skillPath = join(root, "skills/SKILL.md");

  let content: string;
  try {
    content = await read(skillPath, "utf8");
  } catch (error) {
    throw new Error(`Could not read SmartBundle skill at ${skillPath}`, {
      cause: error,
    });
  }

  (dependencies.writeOutput ?? ((text) => process.stdout.write(text)))(content);
  return 0;
}

export function createSkillCommand(handler: () => void | Promise<void>) {
  return {
    command: "skill",
    describe: false as const,
    builder: (parser: Argv) => parser.epilog(helpFooter).strict(),
    handler,
  };
}
