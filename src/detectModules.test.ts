import { describe, test, expect } from "vitest";
import { loadTypescriptApi, TypeScriptBridgeRequiredError } from "./detectModules.js";

const ts5 = { version: "5.9.3" };
const ts6 = { version: "6.0.3" };
const bridge = { version: "6.0.3" };

function createRequireMock(installedVersion: string, modules: Record<string, unknown>) {
  return (specifier: string) => {
    if (specifier === "typescript/package.json") {
      return { version: installedVersion };
    }
    if (specifier in modules) {
      return modules[specifier];
    }
    throw new Error(`Cannot find module ${specifier}`);
  };
}

describe("loadTypescriptApi", () => {
  test.each([
    ["5.9.3", ts5],
    ["6.0.3", ts6],
  ])("uses the installed TypeScript %s API", (version, api) => {
    const result = loadTypescriptApi(createRequireMock(version, { typescript: api }));

    expect(result).toEqual({ ts: api, installedVersion: version });
  });

  test("uses the TypeScript 6 bridge for TypeScript 7", () => {
    const result = loadTypescriptApi(
      createRequireMock("7.0.2", {
        typescript: { version: "7.0.2" },
        "@typescript/typescript6": bridge,
      }),
    );

    expect(result).toEqual({ ts: bridge, installedVersion: "7.0.2" });
  });

  test("explains how to install the bridge for TypeScript 7", () => {
    expect(() => loadTypescriptApi(createRequireMock("7.0.2", {}))).toThrowError(
      TypeScriptBridgeRequiredError,
    );
    expect(() => loadTypescriptApi(createRequireMock("7.0.2", {}))).toThrowError(
      /npm install --save-dev @typescript\/typescript6/,
    );
  });

  test.each(["4.9.5", "8.0.0"])("rejects unsupported TypeScript %s", (version) => {
    expect(() => loadTypescriptApi(createRequireMock(version, {}))).toThrowError(
      `Unsupported TypeScript version ${version}. SmartBundle supports TypeScript >=5.0.0 <8.0.0.`,
    );
  });
});
