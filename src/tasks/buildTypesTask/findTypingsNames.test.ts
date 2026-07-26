import { expect } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createRequire } from "node:module";
import { test } from "../../test-utils.js";
import { loadTypescriptApi, type TS } from "../../detectModules.js";
import { findTypingsNames } from "./findTypingsNames.js";

const { ts } = loadTypescriptApi(createRequire(import.meta.url));
const detectedTs = { ts } as TS;

test("finds packages through nested ESM declaration imports", async ({ tmpDir }) => {
  const nestedDir = join(tmpDir, "level1", "level2");
  await mkdir(nestedDir, { recursive: true });
  const entrypoint = join(tmpDir, "level1", "index.d.mts");
  await writeFile(entrypoint, 'export * from "./level2/value.mjs";');
  await writeFile(
    join(nestedDir, "value.d.mts"),
    'export type { External } from "external-package/subpath";',
  );

  expect(findTypingsNames(detectedTs, entrypoint, tmpDir, ".d.mts")).toEqual(
    new Set(["external-package/subpath"]),
  );
});
