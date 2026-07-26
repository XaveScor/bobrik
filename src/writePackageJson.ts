import { writeFile } from "node:fs/promises";
import { type PackageJson } from "./packageJson.js";
import { okLog } from "./log.js";

export type ExportsObject = {
  mjs?: string;
  dmts?: string;
  dcts?: string;
  cjs?: string;
  raw?: string;
};

type BuildResult = {
  exportsMap: Map<string, ExportsObject>;
  binsMap: Map<string, string>;
};

type ExportsPackageJsonObj =
  | {
      import?: ExportsPackageJsonObj;
      require?: ExportsPackageJsonObj;
      types?: string;
      default?: string;
    }
  | string;

function extractValue(value?: ExportsPackageJsonObj) {
  if (!value) {
    return undefined;
  }
  if (typeof value === "string") {
    return value;
  }
  return value.default;
}

export async function writePackageJson(
  outDir: string,
  parsed: PackageJson,
  { exportsMap, binsMap }: BuildResult,
) {
  // we always want to have `exports` property in the target package.json
  // If you want to export something, please, specify them
  const allExports: Record<string, ExportsPackageJsonObj> = {};
  for (const [key, value] of exportsMap) {
    if (value.raw) {
      allExports[key] = value.raw;
      continue;
    }

    const anExport: ExportsPackageJsonObj = {};

    if (value.mjs) {
      anExport.import = {};
      if (value.dmts) {
        anExport.import.types = value.dmts;
      }
      anExport.import.default = value.mjs;
    }
    if (value.cjs) {
      anExport.require = {};
      if (value.dcts) {
        anExport.require.types = value.dcts;
      }
      anExport.require.default = value.cjs;
    }

    anExport.types = value.dcts ?? value.dmts;
    anExport.default = value.cjs ?? value.mjs;

    allExports[key] = anExport;
  }
  allExports["./package.json"] = "./package.json";

  const bin = binsMap.size > 0 ? Object.fromEntries(binsMap) : undefined;

  const rootExport = typeof allExports["."] === "object" ? allExports["."] : undefined;
  const res = {
    name: parsed.name,
    type: "commonjs",
    version: parsed.version,
    bin,
    types: rootExport?.types,
    module: extractValue(rootExport?.import),
    main: extractValue(rootExport?.require),
    description: parsed.description ?? "",
    exports: allExports,
    dependencies: parsed.dependencies ?? undefined,
    optionalDependencies: parsed.optionalDependencies ?? undefined,
    repository: parsed.repository,
    keywords: parsed.keywords,
    author: parsed.author,
    contributors: parsed.contributors,
    license: parsed.license,
    peerDependencies: parsed.peerDependencies,
    engines: parsed.engines,
    browser: parsed.browser,
    funding: parsed.funding,
    os: parsed.os,
    cpu: parsed.cpu,
    maintainers: parsed.maintainers,
    bugs: parsed.bugs,
    sideEffects: parsed.sideEffects,
    unpkg: parsed.unpkg,
    homepage: parsed.homepage,
    devDependencies: parsed.devDependencies,
    peerDependenciesMeta: parsed.peerDependenciesMeta,
  };

  await writeFile(`${outDir}/package.json`, JSON.stringify(res, null, 2));

  okLog("package.json");
}
