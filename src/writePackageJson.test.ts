import { expect } from "vitest";
import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { test } from "./test-utils.js";
import { parsePackageJson } from "./packageJson.js";
import { writePackageJson } from "./writePackageJson.js";
import { disableLog } from "./log.js";

disableLog();

test("writes conditions in order and falls back to ESM for default", async ({ tmpDir }) => {
  await writeFile(join(tmpDir, "index.js"), "export {};");
  await writeFile(
    join(tmpDir, "source-package.json"),
    JSON.stringify({
      name: "esm-only",
      version: "1.0.0",
      private: true,
      exports: "./index.js",
    }),
  );
  const parsed = await parsePackageJson({
    sourceDir: tmpDir,
    packagePath: join(tmpDir, "source-package.json"),
  });
  expect(parsed).not.toStrictEqual(expect.any(Array));
  if (Array.isArray(parsed)) return;

  await writePackageJson(tmpDir, parsed, {
    exportsMap: new Map([
      [
        ".",
        {
          mjs: "./index.mjs",
          cjs: "./index.js",
          dmts: "./index.d.mts",
          dcts: "./index.d.ts",
        },
      ],
      ["./esm-only", { mjs: "./esm-only.mjs" }],
    ]),
    binsMap: new Map(),
  });

  const output = JSON.parse(await readFile(join(tmpDir, "package.json"), "utf8"));
  expect(Object.keys(output.exports["."])).toEqual(["import", "require", "types", "default"]);
  expect(output.exports["./esm-only"].default).toBe("./esm-only.mjs");
});
