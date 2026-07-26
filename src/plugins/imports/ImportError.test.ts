import { expect, test } from "vitest";
import { ImportError } from "./ImportError.js";

test("points to the import instead of an earlier comment", async () => {
  const error = await ImportError.create(
    "optional",
    "/source/index.ts",
    (async () => '// optional is loaded below\nimport value from "optional";') as never,
  );

  expect(error.stack).toContain("/source/index.ts:2:0");
});

test("uses an unknown path when importer is absent", async () => {
  const error = await ImportError.create("optional", undefined, (() => {}) as never);

  expect(error.message).toContain('"unknown path"');
});
