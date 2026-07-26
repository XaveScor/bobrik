import { describe, expect, test } from "vitest";
import type { PackageJson } from "../../packageJson.js";
import { importsPlugin } from "./index.js";
import { ImportError } from "./ImportError.js";

const packageJson = {
  name: "current-package",
  dependencies: { dependency: "1.0.0" },
  optionalDependencies: {
    optional: "1.0.0",
    "@scope/optional": "1.0.0",
  },
} as PackageJson;

function hook(name: "resolveId" | "resolveDynamicImport") {
  const value = importsPlugin(packageJson)[name];
  if (typeof value !== "function") throw new Error(`Missing ${name} hook`);
  return value as Function;
}

describe("importsPlugin", () => {
  test.each(["dependency", "dependency/subpath", "node:fs"])(
    "externalizes static import %s",
    async (id) => {
      expect(await hook("resolveId").call({}, id, undefined)).toBe(false);
    },
  );

  test.each(["optional", "optional/subpath", "@scope/optional/subpath"])(
    "rejects static optional import %s",
    async (id) => {
      const context = {
        error(error: unknown) {
          throw error;
        },
      };

      await expect(hook("resolveId").call(context, id, undefined)).rejects.toBeInstanceOf(
        ImportError,
      );
    },
  );

  test("does not match a package-name prefix", async () => {
    expect(await hook("resolveId").call({}, "optional-extra", undefined)).toBe(null);
  });

  test("externalizes dynamic optional imports", () => {
    expect(hook("resolveDynamicImport").call({}, "optional/subpath")).toBe(false);
  });
});
