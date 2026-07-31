---
name: smartbundle
description: Install and configure SmartBundle for building an npm package, then fix reported diagnostics until the build succeeds.
---

# SmartBundle

Use this skill when adding SmartBundle to a package or repairing its SmartBundle setup.

1. Detect the project's package manager and install `smartbundle` as a development dependency.
2. Add a package script: `"build": "smartbundle build"`.
3. Configure only the intended `exports`, `files`, and `bin` fields that SmartBundle cannot infer.
4. Install any optional toolchain the project actually uses, following the rules below.
5. Run the build package script.
6. If it fails, fix the configuration, dependency, or source file named by the diagnostic and run the build again.
7. Repeat until the build exits with code 0. A successful build is the installation check; do not try to predict every SmartBundle validation in advance.

## Project decisions

- `exports` defines the package's intended code entrypoints and raw public subpaths.
- `files` defines non-public static assets that must be copied into the output.
- `bin` maps public CLI names to source executable entrypoints.

SmartBundle validates the shape of these fields and whether their paths are allowed and exist. It cannot infer the package's intended public API or desired asset set. See `docs/package-json.md` for details.

## Optional toolchain

- TypeScript: install a local development dependency in the range `>=5.0.0 <8.0.0`. With TypeScript 7, also install `@typescript/typescript6`. Follow concrete build diagnostics for `tsconfig.json`; see `docs/ts-guide.md` when more context is needed.
- Babel: only when the project has a Babel configuration, install `@babel/core@^7.26.0 || ^8.0.0` as a development dependency. The project chooses its own configuration, presets, and plugins.
- React: install `react` in `dependencies`, `optionalDependencies`, or `peerDependencies`, not only in `devDependencies`, because SmartBundle uses that version to select the classic or automatic JSX transform. For TypeScript projects, add `@types/react` as a development dependency when needed. See `docs/react.md` for details.
- Vitest: install `vitest@^3.0.0` or `vitest@^4.0.0` as a development dependency. In `vitest.config.ts`, combine `await defineViteConfig()` from SmartBundle with the project's `defineConfig()` by using Vitest's `mergeConfig()`.
