import { type PackageJson } from "./packageJson.js";
import semver from "semver";
import { createRequire } from "node:module";
import { okLog, errorLog, log, lineLog, warnLog } from "./log.js";
import type { Dirs } from "./resolveDirs.js";
import { resolveDep } from "./resolveDep.js";

type TypeScriptApi = typeof import("@typescript/typescript6");

export type TS = {
  ts: TypeScriptApi;
  parsedConfig: import("@typescript/typescript6").ParsedCommandLine;
  host: import("@typescript/typescript6").CompilerHost;
};
export type DetectedModules = {
  ts?: TS;
  babel?: typeof import("@babel/core");
  react?: "legacy" | "modern";
};

type DepType = "dependencies" | "devDependencies" | "peerDependencies" | "optionalDependencies";
export function getMinVersion(
  packageJson: PackageJson,
  depName: string,
  exclude: DepType[],
): semver.SemVer | null {
  const allDepKeys = new Set<DepType>([
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ]);
  for (const e of exclude) {
    allDepKeys.delete(e);
  }

  let minVersion: semver.SemVer | null = null;
  for (const depKey of allDepKeys) {
    const depVersion = packageJson[depKey]?.[depName];
    if (depVersion) {
      const version = semver.minVersion(depVersion);
      if (!version) {
        warnLog("node-semver cannot parse version of", depName, "from", depKey);
        warnLog("Version:", depVersion);
        continue;
      }
      if (!minVersion) {
        minVersion = version;
        continue;
      }
      if (semver.lt(version, minVersion)) {
        minVersion = version;
      }
    }
  }

  return minVersion;
}

type RequireModule = (specifier: string) => any;

export class TypeScriptBridgeRequiredError extends Error {}
export class UnsupportedTypeScriptVersionError extends Error {}

export function loadTypescriptApi(requireModule: RequireModule): {
  ts: TypeScriptApi;
  installedVersion: string;
} {
  const { version: installedVersion } = requireModule("typescript/package.json") as {
    version: string;
  };
  const parsedVersion = semver.parse(installedVersion);

  if (!parsedVersion || parsedVersion.major < 5 || parsedVersion.major > 7) {
    throw new UnsupportedTypeScriptVersionError(
      `Unsupported TypeScript version ${installedVersion}. SmartBundle supports TypeScript >=5.0.0 <8.0.0.`,
    );
  }

  if (parsedVersion.major === 7) {
    try {
      return {
        ts: requireModule("@typescript/typescript6") as TypeScriptApi,
        installedVersion,
      };
    } catch {
      throw new TypeScriptBridgeRequiredError(
        "SmartBundle requires @typescript/typescript6 to build .d.ts files for TypeScript 7 projects. Please install it with `npm install --save-dev @typescript/typescript6`.",
      );
    }
  }

  return {
    ts: requireModule("typescript") as TypeScriptApi,
    installedVersion,
  };
}

async function detectBabel(
  packageJson: PackageJson,
  packagePath: string,
): Promise<typeof import("@babel/core") | undefined> {
  if ("@babel/core" in (packageJson.optionalDependencies ?? {})) {
    errorLog("babel excluded because inside optionalDependencies");
    return;
  }

  try {
    const babel = resolveDep<typeof import("@babel/core")>("@babel/core", packagePath);
    okLog("babel, version:", babel.version);
    return babel;
  } catch (e) {
    errorLog("babel:", e instanceof Error ? e.message : String(e));
  }
}

async function detectReact(packageJson: PackageJson): Promise<"legacy" | "modern" | undefined> {
  const reactVersion = getMinVersion(packageJson, "react", ["devDependencies"]);
  if (reactVersion) {
    const isLegacy = semver.lt(reactVersion, "17.0.0");
    const transform = isLegacy ? "legacy" : "modern";
    okLog(`react, min version: ${reactVersion.version}. Transform: ${transform}`);
    return transform;
  }
  errorLog("react");
}

async function detectTypescript(packageJson: PackageJson, dirs: Dirs): Promise<TS | undefined> {
  const typescriptVersion = getMinVersion(packageJson, "typescript", []);
  if (!typescriptVersion) {
    errorLog("typescript");
    return;
  }

  let ts: TypeScriptApi;
  let installedVersion: string;
  try {
    const loaded = loadTypescriptApi(createRequire(dirs.packagePath));
    ts = loaded.ts;
    installedVersion = loaded.installedVersion;
  } catch (error) {
    if (
      error instanceof TypeScriptBridgeRequiredError ||
      error instanceof UnsupportedTypeScriptVersionError
    ) {
      throw error;
    }
    errorLog("typescript");
    return;
  }

  const apiVersion = installedVersion === ts.version ? "" : ` (compiler API: ${ts.version})`;
  okLog("typescript, version:", installedVersion + apiVersion);

  const configFilePath = ts.findConfigFile(dirs.sourceDir, ts.sys.fileExists);
  if (!configFilePath) {
    throw new Error(
      "Cannot find a tsconfig.json file. You should declare it. Please, read the https://github.com/XaveScor/smartbundle/issues/131 for more information",
    );
  }
  const configFile = ts.readConfigFile(configFilePath, ts.sys.readFile);
  if (configFile.error) {
    const readableError = ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n");
    throw new Error(`Cannot read tsconfig.json file, error: ${readableError}`);
  }
  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    dirs.sourceDir,
    {
      declaration: true,
      emitDeclarationOnly: true,
      strict: false,
      strictNullChecks: false,
      strictFunctionTypes: false,
      strictPropertyInitialization: false,
      skipLibCheck: true,
      skipDefaultLibCheck: true,
      outDir: "",
      // https://github.com/XaveScor/bobrik/issues/22#issuecomment-2308552352
      noEmit: false,
    },
    configFilePath,
  );

  if (!parsedConfig.options.verbatimModuleSyntax) {
    throw new Error(
      "verbatimModuleSyntax should be enabled in tsconfig.json. Read https://github.com/XaveScor/smartbundle/issues/131 for more explanation.\n" +
        "You also can upvote the issue if you need the support of verbatimModuleSyntax: false in your library",
    );
  }

  const host = ts.createCompilerHost(parsedConfig.options);

  return { ts, parsedConfig, host };
}

export async function detectModules(
  packageJson: PackageJson,
  dirs: Dirs,
): Promise<{ error: false; modules: DetectedModules } | { error: true; errors: Array<string> }> {
  try {
    const result: DetectedModules = {};
    log("Detecting modules");

    result.ts = await detectTypescript(packageJson, dirs);
    result.babel = await detectBabel(packageJson, dirs.packagePath);
    result.react = await detectReact(packageJson);

    lineLog();
    return { error: false, modules: result };
  } catch (e: any) {
    return { error: true, errors: [e.message] };
  }
}
