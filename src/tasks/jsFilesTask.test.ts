import { expect } from "vitest";
import { join } from "node:path";
import { test } from "../test-utils.js";
import { BuildError } from "../error.js";
import { jsFilesTask } from "./jsFilesTask.js";

test("fails when an entrypoint output chunk is missing", async ({ tmpDir }) => {
  const entrypoint = join(tmpDir, "source", "index.ts");

  await expect(
    jsFilesTask({
      buildOutput: [],
      entrypoints: new Map([[".", entrypoint]]),
      outDir: tmpDir,
    }),
  ).rejects.toEqual(new BuildError(`Cannot find the ESM output chunk for ${entrypoint}`));
});
