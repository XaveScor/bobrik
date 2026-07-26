import { describe, expect, test } from "vitest";
import { isCodeExport, isUnsupportedCodeExport } from "./exports.js";

describe("isCodeExport", () => {
  test.each(["index.js", "index.mjs", "index.jsx", "index.ts", "index.tsx"])(
    "treats %s as code",
    (filePath) => expect(isCodeExport(filePath)).toBe(true),
  );

  test.each(["SKILL.md", "schema.json", "styles.css", "module.wasm", "LICENSE"])(
    "treats %s as raw",
    (filePath) => expect(isCodeExport(filePath)).toBe(false),
  );
});

describe("isUnsupportedCodeExport", () => {
  test.each(["index.cjs", "index.mts", "index.cts", "INDEX.MTS"])(
    "rejects %s instead of treating it as a raw asset",
    (filePath) => expect(isUnsupportedCodeExport(filePath)).toBe(true),
  );

  test.each(["index.js", "index.ts", "schema.json", "types.d.ts"])("allows %s", (filePath) =>
    expect(isUnsupportedCodeExport(filePath)).toBe(false),
  );
});
