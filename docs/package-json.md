# Package.json Configuration for SmartBundle

This document outlines the required package.json configuration for SmartBundle and explains the rationale behind each constraint.

## Overview

SmartBundle is a modern JavaScript bundler that enforces strict package.json configurations for reliable builds. Benefits include:

- Consistent ESM-to-CommonJS compatibility.
- Elimination of module resolution ambiguities.
- Prevention of accidental source code publishing.
- Automated generation of package.json for distribution.

This guide explains the required configuration and why certain constraints exist.

- [Overview](#overview)
- [Banned Fields](#banned-fields)
- [SmartBundle-specific Fields](#smartbundle-specific-fields)
- [Files](#files)
- [Exports](#exports)

## Banned Fields

> [!WARNING]
> The following fields must not be included in your source package.json as they conflict with SmartBundle’s automated handling.

### main, module, types Fields

These fields create ambiguity in module resolution. SmartBundle uses only the `exports` field for entry points, and the distributed package.json automatically includes the correct values, ensuring consistent behavior across environments.

## SmartBundle-specific Fields

#### private Field

- Declaration: "private": true
- Requirement: This field must be set to true to prevent accidental publishing.

> [!INFO]  
> When you run SmartBundle, it generates a new package.json in the output directory containing only the fields needed for publishing.

#### type Field

- Declaration: "type": "module"
- Requirement: SmartBundle only bundles ESM sources. Setting "type": "module" ensures that Node.js treats your .js files as ES modules, which is mandatory.

#### Required Entry Points

- **Requirement:** Your package.json must include _either_ the `bin` field or the `exports` field. At least one of these is required so that SmartBundle can correctly determine the entry points for bundling and publishing.

#### bin Field

- Declaration Example:

```json5
{
  bin: {
    "my-command": "./src/bin.js",
  },
}
```

- Requirement: SmartBundle supports bin specifications (except for `.sh` files). If defined, they are processed to generate executable scripts for your package.
- For more details, see the [npm package.json bin specification](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#bin).

## Files

The standard npm `files` field selects files that SmartBundle copies to the output package without preprocessing. Entries are resolved relative to the source package directory and may be files, directories, glob patterns, or ordered exclusions starting with `!`.

```json5
{
  files: ["skills/**", "docs/**/*.md", "schemas", "!docs/internal/**"],
}
```

Directories are copied recursively and relative paths are preserved. JavaScript and TypeScript files selected by `files` are also copied as-is; this does not change how the same file is processed when it is a code entry in `exports`.

SmartBundle intentionally does not evaluate `.npmignore` or `.gitignore` while building. Generated paths, package manager lock files, VCS directories, `node_modules`, the output directory, and the source `package.json` are never copied. The generated output `package.json` does not retain `files`, because the output directory is already the complete publishable package.

Root README, LICENSE/LICENCE, and COPYING files are copied automatically and do not need to be listed.

## Exports

The `exports` field defines the package’s entry points for SmartBundle’s ESM-only output. This field is automatically regenerated during bundling. It can be defined using either a simple string path or an object notation for subpath mappings.

### Overview

- Declaration: "exports": "./src/index.js" (or object notation)
- Requirement: Defines the package entry point(s) that SmartBundle uses.
- "." key: Denotes the root address of the package.

> [!IMPORTANT]
> The "exports" field defines the entry points—and only the entry points—that SmartBundle uses.  
> During bundling, SmartBundle regenerates this field with the correct values for the output package.

For more information, see the [Node.js Documentation: Package Exports](https://nodejs.org/api/packages.html#exports).

> [!IMPORTANT]  
> SmartBundle supports only direct string mappings in the exports field. Conditional keys (such as "import" or "require") and glob patterns (e.g. "\*\*") are not supported.

Export keys must be `.` or start with `./`. Targets must start with `./`, stay inside the package, and point to an existing file.

### Raw Exports

Exports ending in `.js`, `.mjs`, `.jsx`, `.ts`, or `.tsx` are code entry points and are compiled. Every other export target is copied byte-for-byte and emitted as a direct string mapping in the generated `package.json`.

```json5
{
  exports: {
    ".": "./src/index.ts",
    "./skill": "./skills/SKILL.md",
    "./schema": "./schemas/config.json",
  },
}
```

Raw export targets are copied automatically, even when they are not selected by `files`. Use `files` for resources that should be present in the package but do not need a public package subpath.

Node's filesystem APIs do not resolve package exports themselves. Resolve the public subpath first, then read the returned URL:

```js
import { readFile } from "node:fs/promises";

const skill = await readFile(new URL(import.meta.resolve("my-package/skill")), "utf8");
```

Importing a raw file as a module, for example `import "my-package/skill"`, still fails for extensions such as `.md`. Use `import.meta.resolve()` in ESM or `require.resolve()` in CommonJS and pass the result to `fs`.

### Simple String Notation

Example – Simple String Notation:

```json5
{
  exports: "./src/index.js",
}
```

Ensure that your ESM source file follows this format:

```js
// ./src/index.js
export default function greet() {
  console.log("Hello, world!");
}
export function farewell() {
  console.log("Goodbye!");
}
```

Client Usage Examples:

- ESM Import:

```js
import greet, { farewell } from "your-package";
greet();
farewell();
```

- CommonJS Import:

```js
const pkg = require("your-package");
pkg.default(); // for the default export
pkg.farewell();
```

### Object Notation for Subpath Exports

Example – Object Notation for Subpath Exports:

```json5
{
  exports: {
    ".": "./src/index.js",
    "./feature": "./src/feature/entrypoint.js",
  },
}
```

Usage Examples:

- Main Import (ESM):

```js
import main from "your-package";
```

- Feature Import (ESM):

```js
import feature from "your-package/feature";
```

For CommonJS, access the default export:

```js
const mainPkg = require("your-package");
mainPkg.default();
```

For additional TypeScript-related setup and best practices, please refer to our [TS Guide](./ts-guide.md).
