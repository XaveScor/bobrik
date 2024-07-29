import { describe, expect } from "vitest";
import { run } from "./index.js";
// @ts-expect-error
import { test } from "vitest-directory-snapshot";

describe("build", () => {
  test("simple-build", async ({ tmpDir }: { tmpDir: string }) => {
    const res = await run({
      outputDir: tmpDir,
      sourceDir: "./src/fixtures/simple-build",
    });

    expect(res.error).toBeFalsy();
    // @ts-expect-error
    expect(tmpDir).toMatchDirSnapshot();
  });

  test("es-js-import", async ({ tmpDir }: { tmpDir: string }) => {
    const res = await run({
      outputDir: tmpDir,
      sourceDir: "./src/fixtures/es-js-import",
    });

    expect(res.error).toBeFalsy();
    // @ts-expect-error
    expect(tmpDir).toMatchDirSnapshot();
  });

  test("ts-import", async ({ tmpDir }: { tmpDir: string }) => {
    const res = await run({
      outputDir: tmpDir,
      sourceDir: "./src/fixtures/ts-import",
    });

    expect(res.error).toBeFalsy();
    // @ts-expect-error
    expect(tmpDir).toMatchDirSnapshot();
  });
});
