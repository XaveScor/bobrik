import * as fs from "node:fs/promises";
import z from "zod";
import { errors } from "./errors.js";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { isUnsupportedCodeExport } from "./exports.js";

// <region>
// For AI completion. Don't remove.
const allPackageJsonFields = [
  "exports",
  "files",
  "name",
  "version",
  "private",
  "description",
  "dependencies",
  "optionalDependencies",
  "bin",
  "repository",
  "keywords",
  "author",
  "contributors",
  "license",
  "devDependencies",
  "peerDependencies",
  "engines",
  "browser",
  "funding",
  "os",
  "cpu",
];

const requiredFields = ["exports", "name", "version", "private"];

const optionalFields = [
  "files",
  "description",
  "dependencies",
  "optionalDependencies",
  "bin",
  "repository",
  "keywords",
  "author",
  "contributors",
  "license",
  "devDependencies",
  "peerDependencies",
  "engines",
  "browser",
  "funding",
  "os",
  "cpu",
];
// </region>

function isInside(baseDir: string, filePath: string) {
  const relativePath = relative(baseDir, filePath);
  return (
    relativePath !== "" &&
    relativePath !== ".." &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  );
}

function dependencies(errorText: string) {
  return z.record(z.string(), z.string({ error: errorText }), { error: errorText }).optional();
}

function createPathValidator(sourceDir: string, requirePackagePath = false) {
  return async (path: string) => {
    if (requirePackagePath && !isPackagePath(path)) {
      return false;
    }

    const finalPath = resolve(sourceDir, path);
    if (!isInside(sourceDir, finalPath)) return false;

    try {
      const stats = await fs.lstat(finalPath);
      if (!stats.isFile()) return false;
      const [realSourceDir, realFilePath] = await Promise.all([
        fs.realpath(sourceDir),
        fs.realpath(finalPath),
      ]);
      return isInside(realSourceDir, realFilePath);
    } catch {
      return false;
    }
  };
}

function isPackagePath(path: string) {
  if (!path.startsWith("./") || path.includes("\\") || path.includes("%") || path.includes("*")) {
    return false;
  }

  return path
    .slice(2)
    .split("/")
    .every(
      (segment) =>
        segment !== "" &&
        segment !== "." &&
        segment !== ".." &&
        segment.toLowerCase() !== "node_modules",
    );
}

function isExportKey(key: string) {
  return key === "." || (key !== "./package.json" && isPackagePath(key));
}

const PackageJsonNameField: string = "___NAME___";
function fillPackageJson(packageJson: PackageJson) {
  if (packageJson.bin) {
    const binName = packageJson.bin.get(PackageJsonNameField);
    if (binName) {
      packageJson.bin.set(packageJson.name, binName);
      packageJson.bin.delete(PackageJsonNameField);
    }
  }
}

function createPackageJsonSchema(sourceDir: string) {
  const pathValidator = createPathValidator(sourceDir);
  const exportPathValidator = createPathValidator(sourceDir, true);

  const schema = z.object({
    exports: z
      .union(
        [
          z.string().transform((path) => new Map([[".", path]])),
          z.record(z.string(), z.string()).transform((obj) => new Map(Object.entries(obj))),
        ],
        {
          error() {
            return errors.exportsRequired;
          },
        },
      )
      .refine(
        (obj) => [...obj.values()].every((value) => !isUnsupportedCodeExport(value)),
        errors.exportsUnsupportedExtension,
      )
      .refine(async (obj) => {
        for (const [key, value] of obj.entries()) {
          if (!isExportKey(key)) return false;
          if (!(await exportPathValidator(value))) {
            return false;
          }
        }
        return true;
      }, errors.exportsInvalid)
      .optional(),
    files: z.array(z.string(), { error: errors.filesInvalid }).optional(),
    name: z
      .string({ error: errors.nameRequired })
      .min(1, errors.nameMinLength)
      .max(214, errors.nameMaxLength)
      .refine(
        (name) => ["_", "."].every((start) => !name.startsWith(start)),
        errors.nameStartsIllegalChars,
      ),
    version: z.string({ error: errors.versionRequired }),
    private: z
      .boolean({ error: errors.privateIsTrue })
      .refine((value) => value, errors.privateIsTrue),
    description: z.string({ error: errors.descriptionString }).optional(),
    dependencies: dependencies(errors.dependenciesInvalid),
    optionalDependencies: dependencies(errors.optionalDependenciesInvalid),
    bin: z
      .union(
        [
          z.string().transform((value) => new Map([[PackageJsonNameField, value]])),
          z.record(z.string(), z.string()).transform((record) => new Map(Object.entries(record))),
        ],
        {
          error() {
            return errors.binFiled;
          },
        },
      )
      .refine(
        async (map) => {
          for (const [, value] of map.entries()) {
            if (!(await pathValidator(value))) {
              return false;
            }
          }
          return true;
        },
        { error: errors.binFiled },
      )
      .optional(),
    repository: z.any().optional(),
    keywords: z.array(z.string(), { error: errors.keywordsInvalid }).optional(),
    author: z.any().optional(),
    maintainers: z.any().optional(),
    contributors: z
      .array(
        z.union([
          z.string({ error: errors.contributorsInvalid }),
          z.looseObject({}, { error: errors.contributorsInvalid }),
        ]),
      )
      .optional(),
    license: z.any().optional(),
    devDependencies: dependencies(errors.devDependenciesInvalid),
    peerDependencies: dependencies(errors.peerDependenciesInvalid),
    engines: z.record(z.string(), z.string(), { error: errors.enginesInvalid }).optional(),
    browser: z
      .union([
        z.string({ error: errors.browserInvalid }),
        z.record(z.string(), z.string(), { error: errors.browserInvalid }),
      ])
      .optional(),
    bugs: z.any().optional(),
    funding: z
      .union([
        z.string({ error: errors.fundingInvalid }),
        z.looseObject({}, { error: errors.fundingInvalid }),
      ])
      .optional(),
    os: z.array(z.string(), { error: errors.osInvalid }).optional(),
    cpu: z.array(z.string(), { error: errors.cpuInvalid }).optional(),
    sideEffects: z.any().optional(),
    unpkg: z.any().optional(),
    homepage: z.any().optional(),
    babel: z.any().optional(),
    peerDependenciesMeta: z.any().optional(),
  });

  // Add custom logic so that at least one of exports or bin is provided
  return schema.superRefine((data, ctx) => {
    if (!data.exports && !data.bin) {
      ctx.addIssue({
        code: "custom",
        message: errors.exportsRequired,
        path: ["exports"],
      });
    }
  });
}
type PackageJsonSchema = ReturnType<typeof createPackageJsonSchema>;

export type PackageJson = z.infer<PackageJsonSchema>;
type Errors = Array<string>;

type ParsePackageJsonArg = {
  packagePath: string;
  sourceDir: string;
};

export async function parsePackageJson({
  sourceDir,
  packagePath,
}: ParsePackageJsonArg): Promise<PackageJson | Errors> {
  let packageString: string;
  try {
    packageString = await fs.readFile(packagePath, "utf-8");
  } catch (error) {
    return [`Cannot read package.json: ${String(error)}`];
  }

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(packageString);
  } catch (error) {
    return [`Cannot parse package.json: ${String(error)}`];
  }

  const packageJsonSchema = createPackageJsonSchema(sourceDir);
  const packageJson = await packageJsonSchema.safeParseAsync(rawJson);
  if (!packageJson.success) {
    return packageJson.error.issues.map((issue) => issue.message);
  }

  fillPackageJson(packageJson.data);
  return packageJson.data;
}
