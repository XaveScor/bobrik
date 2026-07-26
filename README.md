# SmartBundle

<div align="center">
  <h3>The Library Bundler That Respects Your Time</h3>

  <p>
    <a href="#installation">Installation</a> •
    <a href="#features">Features</a> •
    <a href="#compatibility">Compatibility</a> •
    <a href="#tool-integration">Tool Integration</a> •
    <a href="#advanced-usage">Advanced Usage</a> •
    <a href="#faq">FAQ</a>
  </p>
</div>

Build your library for any JavaScript environment without the complexity

## Installation

Install SmartBundle as a development dependency with your project's package manager:

```bash
npm install --save-dev smartbundle
```

Add a build script and the package entrypoints and assets you intend to publish:

```json5
{
  // Your package name
  name: "my-package",
  // Package version
  version: "1.0.0",
  // Must be true to avoid accidental publishing
  private: true,
  // SmartBundle supports only ES modules
  type: "module",
  // Copy these files to the package without preprocessing
  files: ["skills/**", "docs/**/*.md"],
  // Entry point used by SmartBundle
  exports: {
    ".": "./src/index.js",
    // Raw exports can be resolved by package consumers
    "./skill": "./skills/SKILL.md",
  },
  scripts: {
    // Run this to build your package
    build: "smartbundle build",
  },
}
```

`smartbundle build` validates the package configuration and builds it into `./dist`. Run it through the package script:

```bash
npm run build
```

If the build fails, fix the configuration, dependency, or source file identified by the error and run the build again. Repeat until it succeeds. The built files, including an automatically generated `package.json`, will be in `./dist`.

See the [package.json guide](./docs/package-json.md) for a full explanation of each field. TypeScript projects should also consult the [TypeScript guide](./docs/ts-guide.md).

## Features

- **Zero Configuration** - Point to your entry file and build
- **Universal Output** - ESM and CommonJS bundles generated automatically
- **TypeScript Ready** - Full TypeScript support with type definitions
- **Raw Files** - Copy documentation, skills, schemas, and other assets without preprocessing
- **React Support** - Automatic JSX transformations for modern and legacy modes
- **Developer Friendly** - Source maps included for better debugging
- **Broad Compatibility** - Works with Node.js, Webpack, Vite, Rollup, Bun, and more

## Compatibility

SmartBundle is guaranteed to work on all active and maintenance LTS releases, plus the current release. Former LTS versions that have reached end-of-life remain supported on a best-effort basis. Every bundled package is tested in real environments — from Node.js and Bun to Webpack and Metro — to ensure it just works.

### Runtimes

| Runtime | Version | Supported | E2E Tests |
| ------- | ------- | :-------: | :-------: |
| Node.js | ^18.0.0 |     ✔     |     ✔     |
|         | ^20.0.0 |     ✔     |     ✔     |
|         | ^22.0.0 |     ✔     |     ✔     |
|         | ^24.0.0 |     ✔     |     ✔     |
| Bun     | ^1.0.0  |     ✔     |     ✔     |
| Deno    | ^2.0.0  |     ✔     |     -     |

### Bundlers

| Bundler           | Version | Supported | E2E Tests |
| ----------------- | ------- | :-------: | :-------: |
| Webpack           | ^4.47.0 |     ✔     |     ✔     |
|                   | ^5.95.0 |     ✔     |     ✔     |
| Rspack            | ^1.0.0  |     ✔     |     ✔     |
| Vite              | ^5.0.0  |     ✔     |     -     |
| Rollup            | ^4.0.0  |     ✔     |     -     |
| Parcel            | ^2.0.0  |     ✔     |     -     |
| Browserify        | ^17.0.0 |     ✔     |     -     |
| Esbuild           | ^0.24.0 |     ✔     |     -     |
| Metro             | ^0.81.0 |     ✔     |     ✔     |
| Next.js/Turbopack | ^13.0.0 |     ✔     |     -     |

### TypeScript Module Resolution

| Built with | Consumed with | bundler | node10 | node16 ESM | node16 CommonJS |
| ---------- | ------------- | :-----: | :----: | :--------: | :-------------: |
| TS 5.9.3   | TS 5.9.3      |    ✔    |   ✔    |     ✔      |        ✔        |
| TS 5.9.3   | TS 6.0.3      |    ✔    |   ✔    |     ✔      |        ✔        |
| TS 5.9.3   | TS 7.0.2      |    ✔    |   -    |     ✔      |        ✔        |
| TS 6.0.3   | TS 5.9.3      |    ✔    |   ✔    |     ✔      |        ✔        |
| TS 6.0.3   | TS 6.0.3      |    ✔    |   ✔    |     ✔      |        ✔        |
| TS 6.0.3   | TS 7.0.2      |    ✔    |   -    |     ✔      |        ✔        |
| TS 7.0.2   | TS 5.9.3      |    ✔    |   ✔    |     ✔      |        ✔        |
| TS 7.0.2   | TS 6.0.3      |    ✔    |   ✔    |     ✔      |        ✔        |
| TS 7.0.2   | TS 7.0.2      |    ✔    |   -    |     ✔      |        ✔        |

Each supported combination builds the test package with the listed build version and then type-checks an isolated consumer with the listed consumer version. The matrix tests the latest release of each supported TypeScript major. TypeScript 7 builds use `@typescript/typescript6` for SmartBundle's compiler API. TypeScript 7 consumers do not support the removed `node10` resolution strategy.

We aim to support as many bundlers and runtimes as possible. If the bundled package doesn't work with your bundler, please let us know.

## Tool Integration

SmartBundle automatically detects and integrates with your tools - just add what you need to your project.

### TypeScript

SmartBundle supports TypeScript 5, 6, and 7. Install TypeScript as a dev dependency and start creating `.ts` files:

```sh
npm install --save-dev "typescript@>=5.0.0 <8.0.0"
```

TypeScript 7.0 does not expose the compiler API that SmartBundle needs to generate declarations. TypeScript 7 projects must also install the official TypeScript 6 compatibility bridge:

```sh
npm install --save-dev "typescript@>=7.0.0 <8.0.0" @typescript/typescript6
```

SmartBundle continues to use the project's TypeScript API directly on TypeScript 5 and 6. On TypeScript 7 it uses the bridge only for declaration emit and declaration-file transforms.

### Babel

Add `@babel/core@^7.0.0` as a dev dependency and create a Babel configuration file in your project root. SmartBundle will automatically apply your transformations.

### React

Add `react` to your dependencies. SmartBundle automatically detects React and configures JSX transformations. Both modern and legacy modes are supported.

For detailed React configuration options, see our [React guide](./docs/react.md).

## Advanced Usage

SmartBundle enforces certain package.json conventions to ensure reliable builds. For detailed information about:

- Required and banned fields
- Configuration limitations
- Package.json best practices

See our [package.json guide](./docs/package-json.md).

## FAQ

### SmartBundle have an issue

Please, look at the [known fixable issues](./docs/issues.md) before creating your own one. Some bugs already have a solution but cannot be fixed without user action.

### Why don't you minify the output?

Minification is typically needed only for production. During development, readable, unminified output helps with debugging.

### Why do you require third-party tools for building?

We prioritize keeping the `node_modules` size manageable and avoid unnecessary dependencies. If your package does not require TypeScript, for instance, you don’t need to install those specific tools.

### Community and Support

If you need assistance or wish to contribute, please check out our [discussion forum](https://github.com/your-org/smartbundle/discussions) and [issue tracker](https://github.com/your-org/smartbundle/issues).
