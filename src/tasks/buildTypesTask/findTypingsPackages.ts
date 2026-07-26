import type * as ts from "@typescript/typescript6";
import * as path from "node:path";
import * as fs from "node:fs";
import type { TS } from "../../detectModules.js";

type HostFunctions = {
  getSourceFile: ts.CompilerHost["getSourceFile"];
  fileExists: ts.CompilerHost["fileExists"];
  readFile: ts.CompilerHost["readFile"];
};

function createVirtualHostFunctions(
  ts: TS["ts"],
  virtualFilePath: string,
  virtualSourceContent: string,
  originalHost: ts.CompilerHost,
): HostFunctions {
  const getSourceFile: ts.CompilerHost["getSourceFile"] = (fileName, languageVersion) => {
    if (fileName === virtualFilePath) {
      return ts.createSourceFile(fileName, virtualSourceContent, languageVersion);
    }
    return originalHost.getSourceFile(fileName, languageVersion);
  };

  const fileExists: ts.CompilerHost["fileExists"] = (fileName) => {
    if (fileName === virtualFilePath) {
      return true;
    }
    return originalHost.fileExists(fileName);
  };

  const readFile: ts.CompilerHost["readFile"] = (fileName) => {
    if (fileName === virtualFilePath) {
      return virtualSourceContent;
    }
    return originalHost.readFile(fileName);
  };

  return {
    getSourceFile,
    fileExists,
    readFile,
  };
}

function createCompilerHostWithVirtualSource(
  ts: TS["ts"],
  packages: Set<string>,
  sourceDir: string,
) {
  const compilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    baseUrl: ".",
    sourceRoot: sourceDir,
    noEmit: true,
    emitDeclarationOnly: true,
    noEmitOnError: true,
    paths: {
      "*": ["node_modules/*"],
    },
  };
  const virtualSourceContent =
    [...packages].map((p) => `import "${p}";`).join("\n") +
    // for ignoring the `Generated an empty chunk: "."` error
    "export const a = 1;\n";
  const virtualFilePath = path.join(sourceDir, "virtual.ts");

  const originalHost = ts.createCompilerHost(compilerOptions);
  const virtualFunctions = createVirtualHostFunctions(
    ts,
    virtualFilePath,
    virtualSourceContent,
    originalHost,
  );

  return {
    host: new Proxy(originalHost, {
      get(target, prop: keyof ts.CompilerHost) {
        return virtualFunctions[prop as keyof HostFunctions] || target[prop];
      },
    }),
    virtualFilePath,
    compilerOptions,
  };
}

function findPackageNameForResolvedFile(resolvedFileName: string, sourceDir: string) {
  let currentDir = path.dirname(resolvedFileName);
  const sourcePackageJsonPath = path.join(sourceDir, "package.json");

  while (true) {
    const packageJsonPath = path.join(currentDir, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      if (packageJsonPath === sourcePackageJsonPath) {
        return null;
      }

      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
        return typeof packageJson.name === "string" ? packageJson.name : null;
      } catch {
        return null;
      }
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }
    currentDir = parentDir;
  }
}

export function findTypingsPackages({ ts }: TS, packages: Set<string>, sourceDir: string) {
  const { host, virtualFilePath, compilerOptions } = createCompilerHostWithVirtualSource(
    ts,
    packages,
    sourceDir,
  );

  const program = ts.createProgram({
    rootNames: [virtualFilePath],
    options: compilerOptions,
    host: host,
  });

  const sourceFile = program.getSourceFile(virtualFilePath);
  if (!sourceFile) {
    throw new Error("[getSourceFile] Impossible error inside findMissingTypings");
  }

  const missingTypings = new Set<string>();
  const existingTypingPackages = new Set<string>();
  sourceFile.forEachChild((node) => {
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        const moduleResolution = ts.resolveModuleName(
          moduleSpecifier.text,
          virtualFilePath,
          compilerOptions,
          host,
        );

        const resolvedModule = moduleResolution?.resolvedModule;

        if (!resolvedModule) {
          missingTypings.add(moduleSpecifier.text);
        } else {
          const packageName = findPackageNameForResolvedFile(
            resolvedModule.resolvedFileName,
            sourceDir,
          );
          if (packageName) {
            existingTypingPackages.add(packageName);
          } else {
            missingTypings.add(moduleSpecifier.text);
          }
        }
      }
    }
  });

  return { missingTypings, existingTypingPackages };
}
