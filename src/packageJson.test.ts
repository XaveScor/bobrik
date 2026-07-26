import { describe, expect, test } from "vitest";
import { join } from "node:path";
import { parsePackageJson } from "./packageJson.js";
import { errors } from "./errors.js";
import { disableLog } from "./log.js";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

disableLog();
describe("parse package.json", () => {
  test("correct", async () => {
    const sourceDir = join(import.meta.dirname, "fixtures", "correct-package-json");
    const packagePath = join(sourceDir, "package.json");

    const packageJson = await parsePackageJson({
      sourceDir,
      packagePath,
    });
    expect(packageJson).not.toStrictEqual(expect.any(Array));
  });

  describe("exports", () => {
    test("is optional", async () => {
      const sourceDir = join(import.meta.dirname, "fixtures", "empty-package-json");
      const packagePath = join(sourceDir, "empty.json");

      const packageJson = await parsePackageJson({ sourceDir, packagePath });
      expect(packageJson).toStrictEqual(expect.any(Array));
      expect(packageJson).not.toContain(errors.exportsRequired);
    });

    test("should valid type", async () => {
      const sourceDir = join(import.meta.dirname, "fixtures", "incorrect-exports");
      const packagePath = join(sourceDir, "invalid-exports-type.json");

      const packageJson = await parsePackageJson({ sourceDir, packagePath });
      expect(packageJson).toStrictEqual(expect.any(Array));
      expect(packageJson).toContain(errors.exportsRequired);
    });

    test("can be an object", async () => {
      const sourceDir = join(import.meta.dirname, "fixtures", "incorrect-exports");
      const packagePath = join(sourceDir, "file-in-object-not-exists.json");

      const packageJson = await parsePackageJson({ sourceDir, packagePath });
      expect(packageJson).toStrictEqual(expect.any(Array));
      expect(packageJson).toContain(errors.exportsInvalid);
    });

    test("can be a path", async () => {
      const sourceDir = join(import.meta.dirname, "fixtures", "incorrect-exports");
      const packagePath = join(sourceDir, "file-not-exists.json");

      const packageJson = await parsePackageJson({ sourceDir, packagePath });
      expect(packageJson).toStrictEqual(expect.any(Array));
      expect(packageJson).toContain(errors.exportsInvalid);
    });
  });

  test("preserves files patterns", async () => {
    const sourceDir = join(import.meta.dirname, "fixtures", "raw-assets");
    const packageJson = await parsePackageJson({
      sourceDir,
      packagePath: join(sourceDir, "package.json"),
    });

    expect(packageJson).not.toStrictEqual(expect.any(Array));
    if (!Array.isArray(packageJson)) {
      expect(packageJson.files).toEqual(["docs", "assets/**", "!assets/private.txt", ".hidden"]);
    }
  });

  test("preserves contributor and funding object fields", async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), "smartbundle-metadata-"));
    try {
      await writeFile(join(sourceDir, "index.js"), "export {};");
      await writeFile(
        join(sourceDir, "package.json"),
        JSON.stringify({
          name: "metadata",
          version: "1.0.0",
          private: true,
          exports: "./index.js",
          contributors: [
            {
              name: "Alice",
              email: "alice@example.test",
              url: "https://example.test/alice",
            },
          ],
          funding: {
            type: "github",
            url: "https://github.com/sponsors/example",
          },
        }),
      );

      const packageJson = await parsePackageJson({
        sourceDir,
        packagePath: join(sourceDir, "package.json"),
      });

      expect(packageJson).not.toStrictEqual(expect.any(Array));
      if (!Array.isArray(packageJson)) {
        expect(packageJson.contributors).toEqual([
          {
            name: "Alice",
            email: "alice@example.test",
            url: "https://example.test/alice",
          },
        ]);
        expect(packageJson.funding).toEqual({
          type: "github",
          url: "https://github.com/sponsors/example",
        });
      }
    } finally {
      await rm(sourceDir, { recursive: true, force: true });
    }
  });

  test.each(["reserved-export.json", "pattern-export.json"])(
    "rejects invalid export map in %s",
    async (fileName) => {
      const sourceDir = join(import.meta.dirname, "fixtures", "raw-assets");
      const packageJson = await parsePackageJson({
        sourceDir,
        packagePath: join(sourceDir, fileName),
      });

      expect(packageJson).toStrictEqual(expect.any(Array));
      expect(packageJson).toContain(errors.exportsInvalid);
    },
  );

  test("rejects an export through a symlink outside the package", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "smartbundle-symlink-"));
    const sourceDir = join(rootDir, "package");
    const outsideDir = join(rootDir, "outside");
    try {
      await mkdir(sourceDir);
      await mkdir(outsideDir);
      await writeFile(join(outsideDir, "secret.md"), "secret");
      await symlink(outsideDir, join(sourceDir, "linked"), "dir");
      await writeFile(
        join(sourceDir, "package.json"),
        JSON.stringify({
          name: "symlink-export",
          version: "1.0.0",
          private: true,
          exports: "./linked/secret.md",
        }),
      );

      const packageJson = await parsePackageJson({
        sourceDir,
        packagePath: join(sourceDir, "package.json"),
      });
      expect(packageJson).toStrictEqual(expect.any(Array));
      expect(packageJson).toContain(errors.exportsInvalid);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test.each(["cjs", "mts", "cts"])("rejects unsupported .%s code exports", async (extension) => {
    const sourceDir = await mkdtemp(join(tmpdir(), "smartbundle-extension-"));
    try {
      const entrypoint = `./index.${extension}`;
      await writeFile(join(sourceDir, `index.${extension}`), "export {};");
      await writeFile(
        join(sourceDir, "package.json"),
        JSON.stringify({
          name: "unsupported-extension",
          version: "1.0.0",
          private: true,
          exports: entrypoint,
        }),
      );

      const packageJson = await parsePackageJson({
        sourceDir,
        packagePath: join(sourceDir, "package.json"),
      });

      expect(packageJson).toContain(errors.exportsUnsupportedExtension);
    } finally {
      await rm(sourceDir, { recursive: true, force: true });
    }
  });

  describe("name", () => {
    test("is required", async () => {
      const sourceDir = join(import.meta.dirname, "fixtures", "empty-package-json");
      const packagePath = join(sourceDir, "empty.json");

      const packageJson = await parsePackageJson({ sourceDir, packagePath });
      expect(packageJson).toStrictEqual(expect.any(Array));
      expect(packageJson).toContain(errors.nameRequired);
    });

    test("min length", async () => {
      const sourceDir = join(import.meta.dirname, "fixtures", "incorrect-name");
      const packagePath = join(sourceDir, "min-length.json");

      const packageJson = await parsePackageJson({ sourceDir, packagePath });
      expect(packageJson).toStrictEqual(expect.any(Array));
      expect(packageJson).toContain(errors.nameMinLength);
    });

    test("max length", async () => {
      const sourceDir = join(import.meta.dirname, "fixtures", "incorrect-name");
      const packagePath = join(sourceDir, "max-length.json");

      const packageJson = await parsePackageJson({ sourceDir, packagePath });
      expect(packageJson).toStrictEqual(expect.any(Array));
      expect(packageJson).toContain(errors.nameMaxLength);
    });

    test("no underscore at the beginning", async () => {
      const sourceDir = join(import.meta.dirname, "fixtures", "incorrect-name");
      const packagePath = join(sourceDir, "underscore-start.json");

      const packageJson = await parsePackageJson({ sourceDir, packagePath });
      expect(packageJson).toStrictEqual(expect.any(Array));
      expect(packageJson).toContain(errors.nameStartsIllegalChars);
    });

    test("no dot at the beginning", async () => {
      const sourceDir = join(import.meta.dirname, "fixtures", "incorrect-name");
      const packagePath = join(sourceDir, "dot-start.json");

      const packageJson = await parsePackageJson({ sourceDir, packagePath });
      expect(packageJson).toStrictEqual(expect.any(Array));
      expect(packageJson).toContain(errors.nameStartsIllegalChars);
    });

    test("is string", async () => {
      const sourceDir = join(import.meta.dirname, "fixtures", "incorrect-name");
      const packagePath = join(sourceDir, "not-string.json");

      const packageJson = await parsePackageJson({
        sourceDir,
        packagePath,
      });
      expect(packageJson).toStrictEqual(expect.any(Array));
      expect(packageJson).toContain(errors.nameRequired);
    });
  });

  describe("version", () => {
    test("is required", async () => {
      const sourceDir = join(import.meta.dirname, "fixtures", "empty-package-json");
      const packagePath = join(sourceDir, "empty.json");

      const packageJson = await parsePackageJson({ sourceDir, packagePath });
      expect(packageJson).toStrictEqual(expect.any(Array));
      expect(packageJson).toContain(errors.versionRequired);
    });
  });

  describe("private", () => {
    test("is required", async () => {
      const sourceDir = join(import.meta.dirname, "fixtures", "empty-package-json");
      const packagePath = join(sourceDir, "empty.json");

      const packageJson = await parsePackageJson({ sourceDir, packagePath });
      expect(packageJson).toStrictEqual(expect.any(Array));
      expect(packageJson).toContain(errors.privateIsTrue);
    });

    test("is boolean", async () => {
      const sourceDir = join(import.meta.dirname, "fixtures", "incorrect-private");
      const packagePath = join(sourceDir, "not-boolean.json");

      const packageJson = await parsePackageJson({ sourceDir, packagePath });
      expect(packageJson).toStrictEqual(expect.any(Array));
      expect(packageJson).toContain(errors.privateIsTrue);
    });

    test("is true", async () => {
      const sourceDir = join(import.meta.dirname, "fixtures", "incorrect-private");
      const packagePath = join(sourceDir, "not-true.json");

      const packageJson = await parsePackageJson({ sourceDir, packagePath });
      expect(packageJson).toStrictEqual(expect.any(Array));
      expect(packageJson).toContain(errors.privateIsTrue);
    });
  });

  describe("description", () => {
    test("is string", async () => {
      const sourceDir = join(import.meta.dirname, "fixtures", "incorrect-description");
      const packagePath = join(sourceDir, "not-string.json");

      const packageJson = await parsePackageJson({ sourceDir, packagePath });
      expect(packageJson).toStrictEqual(expect.any(Array));
      expect(packageJson).toContain(errors.descriptionString);
    });
  });

  describe("dependencies", () => {
    test("is object", async () => {
      const sourceDir = join(import.meta.dirname, "fixtures", "incorrect-dependencies");
      const packagePath = join(sourceDir, "not-object.json");

      const packageJson = await parsePackageJson({ sourceDir, packagePath });
      expect(packageJson).toStrictEqual(expect.any(Array));
      expect(packageJson).toContain(errors.dependenciesInvalid);
    });

    test("is optional", async () => {
      const sourceDir = join(import.meta.dirname, "fixtures", "empty-package-json");
      const packagePath = join(sourceDir, "empty.json");

      const packageJson = await parsePackageJson({ sourceDir, packagePath });
      expect(packageJson).not.toContain(errors.dependenciesInvalid);
    });

    test("not Object<string, string>", async () => {
      const sourceDir = join(import.meta.dirname, "fixtures", "incorrect-dependencies");
      const packagePath = join(sourceDir, "not-str-str.json");

      const packageJson = await parsePackageJson({ sourceDir, packagePath });
      expect(packageJson).toStrictEqual(expect.any(Array));
      expect(packageJson).toContain(errors.dependenciesInvalid);
    });
  });

  describe("bin", () => {
    test("is string", async () => {
      const sourceDir = join(import.meta.dirname, "fixtures", "incorrect-bin");
      const packagePath = join(sourceDir, "not-string.json");

      const packageJson = await parsePackageJson({ sourceDir, packagePath });
      expect(packageJson).toStrictEqual(expect.any(Array));
      expect(packageJson).toContain(errors.binFiled);
    });

    test("is optional", async () => {
      const sourceDir = join(import.meta.dirname, "fixtures", "empty-package-json");
      const packagePath = join(sourceDir, "empty.json");

      const packageJson = await parsePackageJson({ sourceDir, packagePath });
      expect(packageJson).not.toContain(errors.binFiled);
    });
  });
});
