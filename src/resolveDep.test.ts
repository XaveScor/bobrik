import { describe, expect } from "vitest";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { $ } from "zx";
import { test } from "./test-utils.js";
import { resolveDep } from "./resolveDep.js";

const fixture4 = resolve("src/fixtures/4-babel-support");
const fixture179 = resolve("src/fixtures/179-babel-8-support");

describe("resolveDep", () => {
  test("resolves @babel/core from the 4-babel-support fixture's node_modules", async () => {
    $.sync`pnpm install --dir ${fixture4}`;

    const babel = resolveDep<{ version: string }>("@babel/core", join(fixture4, "package.json"));

    expect(babel.version).toBe("7.26.0");
  });

  test("resolves @babel/core from the 179-babel-8-support fixture's node_modules", async () => {
    $.sync`pnpm install --dir ${fixture179}`;

    const babel = resolveDep<{ version: string }>("@babel/core", join(fixture179, "package.json"));

    expect(babel.version).toBe("8.0.1");
  });

  test("returns different modules for the same name depending on `from`", async () => {
    $.sync`pnpm install --dir ${fixture4}`;
    $.sync`pnpm install --dir ${fixture179}`;

    const from7 = resolveDep<{ version: string }>("@babel/core", join(fixture4, "package.json"));
    const from8 = resolveDep<{ version: string }>("@babel/core", join(fixture179, "package.json"));

    expect(from7.version).toBe("7.26.0");
    expect(from8.version).toBe("8.0.1");
  });

  test("throws when the module is not installed in the target directory", async ({ tmpDir }) => {
    await writeFile(join(tmpDir, "package.json"), JSON.stringify({ name: "host" }));

    expect(() => resolveDep("nonexistent-pkg", join(tmpDir, "package.json"))).toThrow(
      /Cannot find module/,
    );
  });
});
