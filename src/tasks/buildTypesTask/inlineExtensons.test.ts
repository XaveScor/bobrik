import { describe, test, expect } from "vitest";
import { type FileExists, inlineExtensionsCjs, inlineExtensionsMjs } from "./inlineExtensions.js";
import { loadTypescriptApi } from "../../detectModules.js";
import { createRequire } from "node:module";

const { ts } = loadTypescriptApi(createRequire(import.meta.url));

const inputExts = [".js", ".mjs", ".cjs"];

const fileExists: FileExists = (path) => true;
const fileIndexExists: FileExists = (path) => path.includes("index");

describe("inlineExtensionsMjs", () => {
  describe("normalizes existing extension", () => {
    describe("from file", () => {
      test.each(inputExts)("reexport all: %s", (inputExt) => {
        const input = `export * from "./resolveDirs${inputExt}";\n`;
        expect(inlineExtensionsMjs(ts, input, fileExists)).toBe(
          `export * from "./resolveDirs.mjs";\n`,
        );
      });

      test.each(inputExts)("reexport named: %s", (inputExt) => {
        const input = `export { resolveDirs } from "./resolveDirs${inputExt}";\n`;
        expect(inlineExtensionsMjs(ts, input, fileExists)).toBe(
          `export { resolveDirs } from "./resolveDirs.mjs";\n`,
        );
      });

      test.each(inputExts)("reexport named with alias: %s", (inputExt) => {
        const input = `export { resolveDirs as dirs } from "./resolveDirs${inputExt}";\n`;
        expect(inlineExtensionsMjs(ts, input, fileExists)).toBe(
          `export { resolveDirs as dirs } from "./resolveDirs.mjs";\n`,
        );
      });

      test.each(inputExts)("import default: %s", (inputExt) => {
        const input = `import resolveDirs from "./resolveDirs${inputExt}";\n`;
        expect(inlineExtensionsMjs(ts, input, fileExists)).toBe(
          `import resolveDirs from "./resolveDirs.mjs";\n`,
        );
      });

      test.each(inputExts)("import named: %s", (inputExt) => {
        const input = `import { resolveDirs } from "./resolveDirs${inputExt}";\n`;
        expect(inlineExtensionsMjs(ts, input, fileExists)).toBe(
          `import { resolveDirs } from "./resolveDirs.mjs";\n`,
        );
      });

      test.each(inputExts)("import named with alias: %s", (inputExt) => {
        const input = `import { resolveDirs as dirs } from "./resolveDirs${inputExt}";\n`;
        expect(inlineExtensionsMjs(ts, input, fileExists)).toBe(
          `import { resolveDirs as dirs } from "./resolveDirs.mjs";\n`,
        );
      });

      test.each(inputExts)("import type: %s", (inputExt) => {
        const input = `import type { Dirs } from "./resolveDirs${inputExt}";\n`;
        expect(inlineExtensionsMjs(ts, input, fileExists)).toBe(
          `import type { Dirs } from "./resolveDirs.mjs";\n`,
        );
      });

      test.each(inputExts)("import type with alias: %s", (inputExt) => {
        const input = `import type { Dirs as Directories } from "./resolveDirs${inputExt}";\n`;
        expect(inlineExtensionsMjs(ts, input, fileExists)).toBe(
          `import type { Dirs as Directories } from "./resolveDirs.mjs";\n`,
        );
      });

      test.each(inputExts)("dynamic import: %s", (inputExt) => {
        const input = `await import("./resolveDirs${inputExt}");\n`;
        expect(inlineExtensionsMjs(ts, input, fileExists)).toBe(
          `await import("./resolveDirs.mjs");\n`,
        );
      });
    });
  });

  describe("not changed", () => {
    describe("from lib", () => {
      test("import from lib", () => {
        const content = `import { something } from "test-lib";\n`;
        expect(inlineExtensionsMjs(ts, content, fileExists)).toBe(content);
      });

      test("import type from lib", () => {
        const content = `import type { Something } from "test-lib";\n`;
        expect(inlineExtensionsMjs(ts, content, fileExists)).toBe(content);
      });

      test("dynamic import from lib", () => {
        const content = `await import("test-lib");\n`;
        expect(inlineExtensionsMjs(ts, content, fileExists)).toBe(content);
      });

      test("export from lib", () => {
        const content = `export { something } from "test-lib";\n`;
        expect(inlineExtensionsMjs(ts, content, fileExists)).toBe(content);
      });
    });
  });

  describe("changed", () => {
    test("reexport all without extension", () => {
      const input = `export * from "./resolveDirs";\n`;
      const expected = `export * from "./resolveDirs.mjs";\n`;
      expect(inlineExtensionsMjs(ts, input, fileExists)).toBe(expected);
    });

    test("reexport named without extension", () => {
      const input = `export { resolveDirs } from "./resolveDirs";\n`;
      const expected = `export { resolveDirs } from "./resolveDirs.mjs";\n`;
      expect(inlineExtensionsMjs(ts, input, fileExists)).toBe(expected);
    });

    test("reexport named with alias without extension", () => {
      const input = `export { resolveDirs as dirs } from "./resolveDirs";\n`;
      const expected = `export { resolveDirs as dirs } from "./resolveDirs.mjs";\n`;
      expect(inlineExtensionsMjs(ts, input, fileExists)).toBe(expected);
    });

    test("import default without extension", () => {
      const input = `import resolveDirs from "./resolveDirs";\n`;
      const expected = `import resolveDirs from "./resolveDirs.mjs";\n`;
      expect(inlineExtensionsMjs(ts, input, fileExists)).toBe(expected);
    });

    test("import named without extension", () => {
      const input = `import { resolveDirs } from "./resolveDirs";\n`;
      const expected = `import { resolveDirs } from "./resolveDirs.mjs";\n`;
      expect(inlineExtensionsMjs(ts, input, fileExists)).toBe(expected);
    });

    test("import named with alias without extension", () => {
      const input = `import { resolveDirs as dirs } from "./resolveDirs";\n`;
      const expected = `import { resolveDirs as dirs } from "./resolveDirs.mjs";\n`;
      expect(inlineExtensionsMjs(ts, input, fileExists)).toBe(expected);
    });

    test("import type without extension", () => {
      const input = `import type { Dirs } from "./resolveDirs";\n`;
      const expected = `import type { Dirs } from "./resolveDirs.mjs";\n`;
      expect(inlineExtensionsMjs(ts, input, fileExists)).toBe(expected);
    });

    test("import type with alias without extension", () => {
      const input = `import type { Dirs as Directories } from "./resolveDirs";\n`;
      const expected = `import type { Dirs as Directories } from "./resolveDirs.mjs";\n`;
      expect(inlineExtensionsMjs(ts, input, fileExists)).toBe(expected);
    });

    test("dynamic import without extension", () => {
      const input = `await import("./resolveDirs");\n`;
      const expected = `await import("./resolveDirs.mjs");\n`;
      expect(inlineExtensionsMjs(ts, input, fileExists)).toBe(expected);
    });

    test("inside generic", () => {
      const input = `Promise<typeof import("./export")>;\n`;
      const expected = `Promise<typeof import("./export.mjs")>;\n`;
      expect(inlineExtensionsMjs(ts, input, fileExists)).toBe(expected);
    });
  });

  describe("changed + index", () => {
    test("reexport all without extension", () => {
      const input = `export * from "./resolveDirs";\n`;
      const expected = `export * from "./resolveDirs/index.mjs";\n`;
      expect(inlineExtensionsMjs(ts, input, fileIndexExists)).toBe(expected);
    });

    test("reexport named without extension", () => {
      const input = `export { resolveDirs } from "./resolveDirs";\n`;
      const expected = `export { resolveDirs } from "./resolveDirs/index.mjs";\n`;
      expect(inlineExtensionsMjs(ts, input, fileIndexExists)).toBe(expected);
    });

    test("reexport named with alias without extension", () => {
      const input = `export { resolveDirs as dirs } from "./resolveDirs";\n`;
      const expected = `export { resolveDirs as dirs } from "./resolveDirs/index.mjs";\n`;
      expect(inlineExtensionsMjs(ts, input, fileIndexExists)).toBe(expected);
    });

    test("import default without extension", () => {
      const input = `import resolveDirs from "./resolveDirs";\n`;
      const expected = `import resolveDirs from "./resolveDirs/index.mjs";\n`;
      expect(inlineExtensionsMjs(ts, input, fileIndexExists)).toBe(expected);
    });

    test("import named without extension", () => {
      const input = `import { resolveDirs } from "./resolveDirs";\n`;
      const expected = `import { resolveDirs } from "./resolveDirs/index.mjs";\n`;
      expect(inlineExtensionsMjs(ts, input, fileIndexExists)).toBe(expected);
    });

    test("import named with alias without extension", () => {
      const input = `import { resolveDirs as dirs } from "./resolveDirs";\n`;
      const expected = `import { resolveDirs as dirs } from "./resolveDirs/index.mjs";\n`;
      expect(inlineExtensionsMjs(ts, input, fileIndexExists)).toBe(expected);
    });

    test("import type without extension", () => {
      const input = `import type { Dirs } from "./resolveDirs";\n`;
      const expected = `import type { Dirs } from "./resolveDirs/index.mjs";\n`;
      expect(inlineExtensionsMjs(ts, input, fileIndexExists)).toBe(expected);
    });

    test("import type with alias without extension", () => {
      const input = `import type { Dirs as Directories } from "./resolveDirs";\n`;
      const expected = `import type { Dirs as Directories } from "./resolveDirs/index.mjs";\n`;
      expect(inlineExtensionsMjs(ts, input, fileIndexExists)).toBe(expected);
    });

    test("dynamic import without extension", () => {
      const input = `await import("./resolveDirs");\n`;
      const expected = `await import("./resolveDirs/index.mjs");\n`;
      expect(inlineExtensionsMjs(ts, input, fileIndexExists)).toBe(expected);
    });

    test("inside generic", () => {
      const input = `Promise<typeof import("./export")>;\n`;
      const expected = `Promise<typeof import("./export/index.mjs")>;\n`;
      expect(inlineExtensionsMjs(ts, input, fileIndexExists)).toBe(expected);
    });
  });
});

describe("inlineExtensionsCjs", () => {
  describe("normalizes existing extension", () => {
    describe("from file", () => {
      test.each(inputExts)("reexport all: %s", (inputExt) => {
        const input = `export * from "./resolveDirs${inputExt}";\n`;
        expect(inlineExtensionsCjs(ts, input, fileExists)).toBe(
          `export * from "./resolveDirs.js";\n`,
        );
      });

      test.each(inputExts)("reexport named: %s", (inputExt) => {
        const input = `export { resolveDirs } from "./resolveDirs${inputExt}";\n`;
        expect(inlineExtensionsCjs(ts, input, fileExists)).toBe(
          `export { resolveDirs } from "./resolveDirs.js";\n`,
        );
      });

      test.each(inputExts)("reexport named with alias: %s", (inputExt) => {
        const input = `export { resolveDirs as dirs } from "./resolveDirs${inputExt}";\n`;
        expect(inlineExtensionsCjs(ts, input, fileExists)).toBe(
          `export { resolveDirs as dirs } from "./resolveDirs.js";\n`,
        );
      });

      test.each(inputExts)("import default: %s", (inputExt) => {
        const input = `import resolveDirs from "./resolveDirs${inputExt}";\n`;
        expect(inlineExtensionsCjs(ts, input, fileExists)).toBe(
          `import resolveDirs from "./resolveDirs.js";\n`,
        );
      });

      test.each(inputExts)("import named: %s", (inputExt) => {
        const input = `import { resolveDirs } from "./resolveDirs${inputExt}";\n`;
        expect(inlineExtensionsCjs(ts, input, fileExists)).toBe(
          `import { resolveDirs } from "./resolveDirs.js";\n`,
        );
      });

      test.each(inputExts)("import named with alias: %s", (inputExt) => {
        const input = `import { resolveDirs as dirs } from "./resolveDirs${inputExt}";\n`;
        expect(inlineExtensionsCjs(ts, input, fileExists)).toBe(
          `import { resolveDirs as dirs } from "./resolveDirs.js";\n`,
        );
      });

      test.each(inputExts)("import type: %s", (inputExt) => {
        const input = `import type { Dirs } from "./resolveDirs${inputExt}";\n`;
        expect(inlineExtensionsCjs(ts, input, fileExists)).toBe(
          `import type { Dirs } from "./resolveDirs.js";\n`,
        );
      });

      test.each(inputExts)("import type with alias: %s", (inputExt) => {
        const input = `import type { Dirs as Directories } from "./resolveDirs${inputExt}";\n`;
        expect(inlineExtensionsCjs(ts, input, fileExists)).toBe(
          `import type { Dirs as Directories } from "./resolveDirs.js";\n`,
        );
      });

      test.each(inputExts)("dynamic import: %s", (inputExt) => {
        const input = `await import("./resolveDirs${inputExt}");\n`;
        expect(inlineExtensionsCjs(ts, input, fileExists)).toBe(
          `await import("./resolveDirs.js");\n`,
        );
      });
    });
  });

  describe("not changed", () => {
    describe("from lib", () => {
      test("import from lib", () => {
        const content = `import { something } from "test-lib";\n`;
        expect(inlineExtensionsCjs(ts, content, fileExists)).toBe(content);
      });

      test("import type from lib", () => {
        const content = `import type { Something } from "test-lib";\n`;
        expect(inlineExtensionsCjs(ts, content, fileExists)).toBe(content);
      });

      test("dynamic import from lib", () => {
        const content = `await import("test-lib");\n`;
        expect(inlineExtensionsCjs(ts, content, fileExists)).toBe(content);
      });

      test("export from lib", () => {
        const content = `export { something } from "test-lib";\n`;
        expect(inlineExtensionsCjs(ts, content, fileExists)).toBe(content);
      });
    });
  });

  describe("changed", () => {
    test("reexport all without extension", () => {
      const input = `export * from "./resolveDirs";\n`;
      const expected = `export * from "./resolveDirs.js";\n`;
      expect(inlineExtensionsCjs(ts, input, fileExists)).toBe(expected);
    });

    test("reexport named without extension", () => {
      const input = `export { resolveDirs } from "./resolveDirs";\n`;
      const expected = `export { resolveDirs } from "./resolveDirs.js";\n`;
      expect(inlineExtensionsCjs(ts, input, fileExists)).toBe(expected);
    });

    test("reexport named with alias without extension", () => {
      const input = `export { resolveDirs as dirs } from "./resolveDirs";\n`;
      const expected = `export { resolveDirs as dirs } from "./resolveDirs.js";\n`;
      expect(inlineExtensionsCjs(ts, input, fileExists)).toBe(expected);
    });

    test("import default without extension", () => {
      const input = `import resolveDirs from "./resolveDirs";\n`;
      const expected = `import resolveDirs from "./resolveDirs.js";\n`;
      expect(inlineExtensionsCjs(ts, input, fileExists)).toBe(expected);
    });

    test("import named without extension", () => {
      const input = `import { resolveDirs } from "./resolveDirs";\n`;
      const expected = `import { resolveDirs } from "./resolveDirs.js";\n`;
      expect(inlineExtensionsCjs(ts, input, fileExists)).toBe(expected);
    });

    test("import named with alias without extension", () => {
      const input = `import { resolveDirs as dirs } from "./resolveDirs";\n`;
      const expected = `import { resolveDirs as dirs } from "./resolveDirs.js";\n`;
      expect(inlineExtensionsCjs(ts, input, fileExists)).toBe(expected);
    });

    test("import type without extension", () => {
      const input = `import type { Dirs } from "./resolveDirs";\n`;
      const expected = `import type { Dirs } from "./resolveDirs.js";\n`;
      expect(inlineExtensionsCjs(ts, input, fileExists)).toBe(expected);
    });

    test("import type with alias without extension", () => {
      const input = `import type { Dirs as Directories } from "./resolveDirs";\n`;
      const expected = `import type { Dirs as Directories } from "./resolveDirs.js";\n`;
      expect(inlineExtensionsCjs(ts, input, fileExists)).toBe(expected);
    });

    test("dynamic import without extension", () => {
      const input = `await import("./resolveDirs");\n`;
      const expected = `await import("./resolveDirs.js");\n`;
      expect(inlineExtensionsCjs(ts, input, fileExists)).toBe(expected);
    });

    test("inside generic", () => {
      const input = `Promise<typeof import("./export")>;\n`;
      const expected = `Promise<typeof import("./export.js")>;\n`;
      expect(inlineExtensionsCjs(ts, input, fileExists)).toBe(expected);
    });
  });

  describe("changed + index", () => {
    test("reexport all without extension", () => {
      const input = `export * from "./resolveDirs";\n`;
      const expected = `export * from "./resolveDirs/index.mjs";\n`;
      expect(inlineExtensionsMjs(ts, input, fileIndexExists)).toBe(expected);
    });

    test("reexport named without extension", () => {
      const input = `export { resolveDirs } from "./resolveDirs";\n`;
      const expected = `export { resolveDirs } from "./resolveDirs/index.js";\n`;
      expect(inlineExtensionsCjs(ts, input, fileIndexExists)).toBe(expected);
    });

    test("reexport named with alias without extension", () => {
      const input = `export { resolveDirs as dirs } from "./resolveDirs";\n`;
      const expected = `export { resolveDirs as dirs } from "./resolveDirs/index.js";\n`;
      expect(inlineExtensionsCjs(ts, input, fileIndexExists)).toBe(expected);
    });

    test("import default without extension", () => {
      const input = `import resolveDirs from "./resolveDirs";\n`;
      const expected = `import resolveDirs from "./resolveDirs/index.js";\n`;
      expect(inlineExtensionsCjs(ts, input, fileIndexExists)).toBe(expected);
    });

    test("import named without extension", () => {
      const input = `import { resolveDirs } from "./resolveDirs";\n`;
      const expected = `import { resolveDirs } from "./resolveDirs/index.js";\n`;
      expect(inlineExtensionsCjs(ts, input, fileIndexExists)).toBe(expected);
    });

    test("import named with alias without extension", () => {
      const input = `import { resolveDirs as dirs } from "./resolveDirs";\n`;
      const expected = `import { resolveDirs as dirs } from "./resolveDirs/index.js";\n`;
      expect(inlineExtensionsCjs(ts, input, fileIndexExists)).toBe(expected);
    });

    test("import type without extension", () => {
      const input = `import type { Dirs } from "./resolveDirs";\n`;
      const expected = `import type { Dirs } from "./resolveDirs/index.js";\n`;
      expect(inlineExtensionsCjs(ts, input, fileIndexExists)).toBe(expected);
    });

    test("import type with alias without extension", () => {
      const input = `import type { Dirs as Directories } from "./resolveDirs";\n`;
      const expected = `import type { Dirs as Directories } from "./resolveDirs/index.js";\n`;
      expect(inlineExtensionsCjs(ts, input, fileIndexExists)).toBe(expected);
    });

    test("dynamic import without extension", () => {
      const input = `await import("./resolveDirs");\n`;
      const expected = `await import("./resolveDirs/index.js");\n`;
      expect(inlineExtensionsCjs(ts, input, fileIndexExists)).toBe(expected);
    });

    test("inside generic", () => {
      const input = `Promise<typeof import("./export")>;\n`;
      const expected = `Promise<typeof import("./export/index.js")>;\n`;
      expect(inlineExtensionsCjs(ts, input, fileIndexExists)).toBe(expected);
    });
  });
});
