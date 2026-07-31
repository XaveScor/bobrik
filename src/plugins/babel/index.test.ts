import { describe, expect, vi } from "vitest";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "../../test-utils.js";
import { babelPlugin } from "./index.js";
import type { PackageJson } from "../../packageJson.js";
import type { Dirs } from "../../resolveDirs.js";
import type { DetectedModules } from "../../detectModules.js";

type PartialConfigMock = {
  config?: string;
  babelrc?: string;
  babelignore?: string;
  hasFilesystemConfig: () => boolean;
};

function partialConfig(p: {
  config?: string;
  babelrc?: string;
  babelignore?: string;
}): PartialConfigMock {
  return {
    ...p,
    hasFilesystemConfig: () => Boolean(p.config || p.babelrc || p.babelignore),
  };
}

function makeDirs(sourceDir: string): Dirs {
  return {
    sourceDir,
    packagePath: join(sourceDir, "package.json"),
    outDir: join(sourceDir, "dist"),
    outBinsDir: join(sourceDir, "dist", "__bin__"),
    cjsOutDir: join(sourceDir, "dist", "__compiled__", "cjs"),
    esmOutDir: join(sourceDir, "dist", "__compiled__", "esm"),
  };
}

function makePackageJson(entries: Record<string, string>): PackageJson {
  return {
    name: "test-pkg",
    version: "0.0.0",
    private: true,
    exports: new Map(Object.entries(entries)),
  } as PackageJson;
}

type BabelApiMock = {
  version: string;
  loadPartialConfigAsync: ReturnType<typeof vi.fn>;
  transformAsync: ReturnType<typeof vi.fn>;
};

function makeBabel(resolver: (filename: string) => PartialConfigMock | null) {
  const calls: string[] = [];
  const transformAsync = vi.fn(async (code: string) => ({ code, map: null }));
  const api: BabelApiMock = {
    version: "8.0.1",
    loadPartialConfigAsync: vi.fn(async (opts: { filename: string }) => {
      calls.push(opts.filename);
      return resolver(opts.filename);
    }),
    transformAsync,
  };
  return { calls, transformAsync, api };
}

function makePluginContext() {
  const warnings: string[] = [];
  const errors: unknown[] = [];
  return {
    warnings,
    errors,
    ctx: {
      warn: (msg: string) => warnings.push(msg),
      error: (e: unknown) => errors.push(e),
    },
  };
}

function getHook<K extends "buildStart" | "transform">(
  plugin: ReturnType<typeof babelPlugin>,
  name: K,
): (...args: unknown[]) => unknown {
  const hook = plugin[name];
  if (typeof hook !== "function") throw new Error(`Missing ${name} hook`);
  return hook as unknown as (...args: unknown[]) => unknown;
}

function asBabel(api: BabelApiMock) {
  return api as unknown as DetectedModules["babel"];
}

function transformCtx() {
  return { getCombinedSourcemap: () => null };
}

describe("babelPlugin", () => {
  test("resolves a shared config and runs transform when @babel/core is installed", async () => {
    const babel = makeBabel(() => partialConfig({ config: "/proj/babel.config.js" }));
    const plugin = babelPlugin({
      packageJson: makePackageJson({ ".": "./entry.ts" }),
      dirs: makeDirs("/proj"),
      modules: { babel: asBabel(babel.api) },
    });
    const c = makePluginContext();

    await getHook(plugin, "buildStart").call(c.ctx);

    expect(c.errors).toHaveLength(0);
    expect(c.warnings).toHaveLength(0);
    expect(babel.calls).toEqual(["/proj/entry.ts"]);

    const result = await getHook(plugin, "transform").call(
      transformCtx(),
      "export const a = 1;",
      "/proj/entry.ts",
    );
    expect(result).toEqual({ code: "export const a = 1;", map: null });
    expect(babel.transformAsync).toHaveBeenCalledWith(
      "export const a = 1;",
      expect.objectContaining({
        filename: "/proj/entry.ts",
        cwd: "/proj",
        root: "/proj",
      }),
    );
  });

  test("queries every entrypoint when configs differ per directory", async () => {
    const babel = makeBabel((fn) =>
      fn === "/proj/a/entry.ts"
        ? partialConfig({ config: "/proj/babel.config.js", babelrc: "/proj/a/.babelrc" })
        : partialConfig({ config: "/proj/babel.config.js", babelrc: "/proj/b/.babelrc" }),
    );
    const plugin = babelPlugin({
      packageJson: makePackageJson({ ".": "./a/entry.ts", "./b": "./b/entry.ts" }),
      dirs: makeDirs("/proj"),
      modules: { babel: asBabel(babel.api) },
    });
    const c = makePluginContext();

    await getHook(plugin, "buildStart").call(c.ctx);

    expect(c.errors).toHaveLength(0);
    expect(babel.calls).toEqual(["/proj/a/entry.ts", "/proj/b/entry.ts"]);
  });

  test("also collects bin entrypoints", async () => {
    const babel = makeBabel(() => partialConfig({ config: "/proj/babel.config.js" }));
    const pj = makePackageJson({ ".": "./entry.ts" });
    pj.bin = new Map([["cli", "./cli.ts"]]);
    const plugin = babelPlugin({
      packageJson: pj,
      dirs: makeDirs("/proj"),
      modules: { babel: asBabel(babel.api) },
    });
    const c = makePluginContext();

    await getHook(plugin, "buildStart").call(c.ctx);

    expect(babel.calls).toEqual(["/proj/entry.ts", "/proj/cli.ts"]);
  });

  test("warns and skips transform when @babel/core is installed but no config exists", async () => {
    const babel = makeBabel(() => null);
    const plugin = babelPlugin({
      packageJson: makePackageJson({ ".": "./entry.ts" }),
      dirs: makeDirs("/proj"),
      modules: { babel: asBabel(babel.api) },
    });
    const c = makePluginContext();

    await getHook(plugin, "buildStart").call(c.ctx);

    expect(c.errors).toHaveLength(0);
    expect(c.warnings[0]).toMatch(/no Babel config/);

    const result = await getHook(plugin, "transform").call(
      transformCtx(),
      "code",
      "/proj/entry.ts",
    );
    expect(result).toBeNull();
    expect(babel.transformAsync).not.toHaveBeenCalled();
  });

  test("reports error when @babel/core is missing but a config file exists", async ({ tmpDir }) => {
    await writeFile(join(tmpDir, "babel.config.js"), "export default {};");
    const plugin = babelPlugin({
      packageJson: makePackageJson({ ".": "./entry.ts" }),
      dirs: makeDirs(tmpDir),
      modules: {},
    });
    const c = makePluginContext();

    await getHook(plugin, "buildStart").call(c.ctx);

    expect(c.errors).toHaveLength(1);
    expect((c.errors[0] as Error).message).toMatch(/babel\.config\.js/);
    expect((c.errors[0] as Error).message).toMatch(/npm install --save-dev @babel\/core/);
  });

  test("does nothing when @babel/core is missing and no config file exists", async ({ tmpDir }) => {
    const plugin = babelPlugin({
      packageJson: makePackageJson({ ".": "./entry.ts" }),
      dirs: makeDirs(tmpDir),
      modules: {},
    });
    const c = makePluginContext();

    await getHook(plugin, "buildStart").call(c.ctx);

    expect(c.errors).toHaveLength(0);
    expect(c.warnings).toHaveLength(0);

    const result = await getHook(plugin, "transform").call(
      transformCtx(),
      "code",
      join(tmpDir, "entry.ts"),
    );
    expect(result).toBeNull();
  });

  test("reports error with filename when loadPartialConfigAsync throws", async () => {
    const babel = makeBabel(() => {
      throw new Error("plugin not found");
    });
    const plugin = babelPlugin({
      packageJson: makePackageJson({ ".": "./entry.ts" }),
      dirs: makeDirs("/proj"),
      modules: { babel: asBabel(babel.api) },
    });
    const c = makePluginContext();

    await getHook(plugin, "buildStart").call(c.ctx);

    expect(c.errors).toHaveLength(1);
    expect((c.errors[0] as Error).message).toMatch(
      /Failed to load Babel config for \/proj\/entry\.ts/,
    );
    expect((c.errors[0] as Error).message).toMatch(/plugin not found/);
  });
});
