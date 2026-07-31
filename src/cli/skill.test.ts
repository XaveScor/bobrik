import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect } from "vitest";
import { test } from "../test-utils.js";
import { findPackageRoot, runSkillCommand } from "./skill.js";

describe("skill command", () => {
  test("prints the source skill byte for byte without extra output", async () => {
    const expected = await readFile(resolve("skills/SKILL.md"), "utf8");
    let output = "";

    expect(await runSkillCommand({ writeOutput: (text) => (output += text) })).toBe(0);
    expect(output).toBe(expected);
  });

  test("finds package root from source and compiled layouts", async ({ tmpDir }) => {
    await writeFile(join(tmpDir, "package.json"), JSON.stringify({ name: "smartbundle" }));
    const sourceModule = join(tmpDir, "src/cli/skill.js");
    const compiledModule = join(tmpDir, "__compiled__/esm/src/cli/skill.js");
    await mkdir(join(tmpDir, "src/cli"), { recursive: true });
    await mkdir(join(tmpDir, "__compiled__/esm/src/cli"), { recursive: true });

    expect(await findPackageRoot(pathToFileURL(sourceModule).href)).toBe(tmpDir);
    expect(await findPackageRoot(pathToFileURL(compiledModule).href)).toBe(tmpDir);
  });

  test("reports a missing skill asset clearly", async ({ tmpDir }) => {
    await writeFile(join(tmpDir, "package.json"), JSON.stringify({ name: "smartbundle" }));
    const modulePath = join(tmpDir, "src/cli/skill.js");
    await mkdir(join(tmpDir, "src/cli"), { recursive: true });

    await expect(runSkillCommand({ moduleUrl: pathToFileURL(modulePath).href })).rejects.toThrow(
      "Could not read SmartBundle skill",
    );
  });

  test("contains the decisions and toolchain rules, not a diagnostics catalog", async () => {
    const skill = await readFile(resolve("skills/SKILL.md"), "utf8");

    expect(skill).toContain("Repeat until the build exits with code 0");
    expect(skill).toContain("`exports`");
    expect(skill).toContain("`files`");
    expect(skill).toContain("`bin`");
    expect(skill).toContain("@typescript/typescript6");
    expect(skill).toContain("@babel/core@^7.26.0 || ^8.0.0");
    expect(skill).toContain("@types/react");
    expect(skill).toContain("mergeConfig()");
    expect(skill).not.toContain("Known errors");
  });
});
