import * as path from "node:path";
import * as fs from "node:fs";
import { inlineExtensionsMjs, inlineExtensionsCjs } from "./inlineExtensions.js";
import { type PackageJson } from "../../packageJson.js";
import { getMinVersion, type TS } from "../../detectModules.js";
import { BuildError } from "../../error.js";
import { findTypingsPackages } from "./findTypingsPackages.js";
import { findTypingsNames } from "./findTypingsNames.js";
import { type Dirs } from "../../resolveDirs.js";

type BuildTypesOptions = {
  ts: TS;
  dirs: Dirs;
  packageJson: PackageJson;
  tsEntrypoints: string[];
  outDir: string;
};

function makeFileExists(outDir: string, filePath: string) {
  return (p: string) => {
    const dir = path.join(outDir, path.dirname(filePath));
    return fs.existsSync(path.join(dir, p));
  };
}

export async function callTypescript({ ts, dirs, tsEntrypoints, packageJson }: BuildTypesOptions) {
  const { sourceDir, outDir, esmOutDir, cjsOutDir } = dirs;

  // <build d.ts>
  const sourceToCjsDtsMap = new Map<string, string>();
  const sourceToEsmDtsMap = new Map<string, string>();
  const program = ts.ts.createProgram(tsEntrypoints, ts.parsedConfig.options, ts.host);
  const emitResult = program.emit(undefined, (fileName, data) => {
    // .d.ts for cjs because "type": "commonjs" in package.json
    // .d.mts for esm
    const relativePath = path.relative(sourceDir, fileName);
    // we create maps for ts and tsx because it can have any of these extensions
    // I don't want to detect the original ext,
    // so I've decided just create two maps and calculate the original file name outside of this function
    const sourceFileNameTS = fileName.replace(/\.d\.ts$/, ".ts"); // Assuming source files have .ts extension
    const sourceFileNameTSX = fileName.replace(/\.d\.ts$/, ".tsx"); // Assuming source files have .ts extension

    const finalEsmPath = path.join(esmOutDir, relativePath);
    const esmFinalPath = finalEsmPath.replace(/\.d\.ts$/, ".d.mts");
    sourceToEsmDtsMap.set(sourceFileNameTS, esmFinalPath);
    sourceToEsmDtsMap.set(sourceFileNameTSX, esmFinalPath);
    fs.mkdirSync(path.dirname(esmFinalPath), { recursive: true });
    fs.writeFileSync(esmFinalPath, data);

    const finalCjsPath = path.join(cjsOutDir, relativePath);
    fs.mkdirSync(path.dirname(finalCjsPath), { recursive: true });
    const cjsFinalPath = finalCjsPath;
    fs.writeFileSync(cjsFinalPath, data);
    sourceToCjsDtsMap.set(sourceFileNameTS, cjsFinalPath);
    sourceToCjsDtsMap.set(sourceFileNameTSX, cjsFinalPath);
  });
  const diagnostics = [...ts.ts.getPreEmitDiagnostics(program), ...emitResult.diagnostics];
  if (emitResult.emitSkipped) {
    const diagnosticHost: import("@typescript/typescript6").FormatDiagnosticsHost = {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => sourceDir,
      getNewLine: () => ts.ts.sys.newLine,
    };
    throw new BuildError(
      `TypeScript declaration emit failed:\n${ts.ts.formatDiagnostics(
        diagnostics,
        diagnosticHost,
      )}`,
    );
  }
  // </build d.ts>

  // <fix vscode typings>
  for (const file of [...sourceToCjsDtsMap.values(), ...sourceToEsmDtsMap.values()]) {
    const content = fs.readFileSync(file, "utf-8");
    const relativePath = path.relative(outDir, file);
    if (file.endsWith(".d.ts")) {
      const transformedCode = inlineExtensionsCjs(
        ts.ts,
        content,
        makeFileExists(outDir, relativePath),
      );
      fs.writeFileSync(file, transformedCode);
    }
    if (file.endsWith(".d.mts")) {
      const transformedCode = inlineExtensionsMjs(
        ts.ts,
        content,
        makeFileExists(outDir, relativePath),
      );
      fs.writeFileSync(file, transformedCode);
    }
  }
  // </fix vscode typings>

  // <find all libraries names>
  const packages = new Set<string>();
  for (const sourceEntrypoint of tsEntrypoints) {
    const esmEntrypoint = sourceToEsmDtsMap.get(sourceEntrypoint);
    if (esmEntrypoint) {
      const localPackages = findTypingsNames(ts, esmEntrypoint, esmOutDir, ".d.mts");
      for (const p of localPackages) {
        packages.add(p);
      }
    }

    const cjsEntrypoint = sourceToCjsDtsMap.get(sourceEntrypoint);
    if (cjsEntrypoint) {
      const localPackages = findTypingsNames(ts, cjsEntrypoint, cjsOutDir, ".d.ts");
      for (const p of localPackages) {
        packages.add(p);
      }
    }
  }
  // </find all libraries names>

  // <check not installed typings libraries>
  const { missingTypings, existingTypingPackages } = findTypingsPackages(ts, packages, sourceDir);
  for (const lib of existingTypingPackages) {
    if (getMinVersion(packageJson, lib, ["optionalDependencies", "devDependencies"]) == null) {
      missingTypings.add(lib);
    }
  }
  if (missingTypings.size > 0) {
    const libsList = [...missingTypings].map((x) => `"${x}"`).join(", ");
    throw new BuildError(
      `The typings won't installed in bundled package: ${libsList}. Please install them into dependencies or peerDependencies.`,
    );
  }
  // </check not installed typings libraries>

  return {
    sourceToCjsDtsMap,
    sourceToEsmDtsMap,
  };
}
