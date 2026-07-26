import { describe, expect } from "vitest";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { run } from "./index.js";
import { test } from "./test-utils.js";
import { disableLog } from "./log.js";

disableLog();

describe("run input errors", () => {
  async function expectInputError(
    tmpDir: string,
    packageContent: string | undefined,
    expectedError: string,
  ) {
    const sourceDir = join(tmpDir, "source");
    const outputDir = join(tmpDir, "output");
    await mkdir(sourceDir);
    await mkdir(outputDir);
    await writeFile(join(outputDir, "sentinel.txt"), "keep");
    if (packageContent !== undefined) {
      await writeFile(join(sourceDir, "package.json"), packageContent);
    }

    const result = await run({ sourceDir, outputDir });

    expect(result.error).toBe(true);
    if (result.error) {
      expect(result.errors[0]).toContain(expectedError);
    }
    expect(await readFile(join(outputDir, "sentinel.txt"), "utf8")).toBe("keep");
  }

  test("preserves existing output for a missing package.json", ({ tmpDir }) =>
    expectInputError(tmpDir, undefined, "Cannot read package.json:"));

  test("preserves existing output for malformed package.json", ({ tmpDir }) =>
    expectInputError(tmpDir, "{", "Cannot parse package.json:"));

  test("preserves existing output for schema errors", async ({ tmpDir }) => {
    const sourceDir = join(tmpDir, "source");
    const outputDir = join(tmpDir, "output");
    await mkdir(sourceDir);
    await mkdir(outputDir);
    await writeFile(join(outputDir, "sentinel.txt"), "keep");
    await writeFile(join(sourceDir, "package.json"), "{}");

    const result = await run({ sourceDir, outputDir });

    expect(result.error).toBe(true);
    expect(await readFile(join(outputDir, "sentinel.txt"), "utf8")).toBe("keep");
  });
});
