import { relative } from "node:path";
import { mkdir, rm } from "node:fs/promises";
import { parsePackageJson } from "./packageJson.js";
import { type ExportsObject, writePackageJson } from "./writePackageJson.js";
import { resolveDirs } from "./resolveDirs.js";
import { createViteConfig } from "./createViteConfig.js";
import { copyStaticFilesTask, createCopyManifest } from "./tasks/copyStaticFilesTask.js";
import { buildTypesTask } from "./tasks/buildTypesTask/buildTypesTask.js";
import { BuildError } from "./error.js";
import { jsFilesTask } from "./tasks/jsFilesTask.js";
import { binsTask } from "./tasks/binsTask.js";
import { detectModules } from "./detectModules.js";
import { disableLog, lineLog, log, okLog } from "./log.js";
import { runSettled, type Task } from "./pipeline.js";
import { type BuildArgs } from "./buildArgs.js";
import { viteTask } from "./tasks/viteTask.js";
import { promiseSettledResultErrors } from "./promiseSettledResultErrors.js";
import { PrettyError } from "./PrettyErrors.js";

function setExports(
  exportsMap: Map<string, ExportsObject>,
  exportName: string,
  mapFn: (entry: ExportsObject) => ExportsObject,
) {
  const entry = exportsMap.get(exportName) ?? ({} as ExportsObject);
  exportsMap.set(exportName, mapFn(entry));
}

export async function defineViteConfig(args: BuildArgs = {}) {
  disableLog();
  const dirs = resolveDirs(args);
  const { sourceDir, packagePath } = dirs;

  const packageJson = await parsePackageJson({ sourceDir, packagePath });

  if (Array.isArray(packageJson)) {
    console.error(packageJson);
    throw new Error("Failed to parse package.json");
  }

  const modulesResult = await detectModules(packageJson, dirs);
  if (modulesResult.error) {
    return { error: true, errors: modulesResult.errors };
  }
  const { modules } = modulesResult;
  const { viteConfig } = createViteConfig({
    dirs,
    packageJson,
    modules,
    test: true,
  });

  return viteConfig;
}

type RunResult =
  | {
      error: false;
    }
  | {
      error: true;
      errors: Array<string | PrettyError>;
    };

export async function run(args: BuildArgs): Promise<RunResult> {
  const dirs = resolveDirs(args);
  const { sourceDir, outDir, packagePath, outBinsDir } = dirs;

  const packageJson = await parsePackageJson({ sourceDir, packagePath });

  if (Array.isArray(packageJson)) {
    return { error: true, errors: packageJson };
  }

  const modulesResult = await detectModules(packageJson, dirs);
  if (modulesResult.error) {
    return { error: true, errors: modulesResult.errors };
  }
  const { modules } = modulesResult;
  const { viteConfig, entrypoints, rawExports, bins } = createViteConfig({
    dirs,
    packageJson,
    modules,
  });

  const exportsMap = new Map<string, ExportsObject>();
  const binsMap = new Map<string, string>();
  for (const [name, target] of rawExports) {
    exportsMap.set(name, { raw: target });
  }
  let copyManifest;
  try {
    copyManifest = await createCopyManifest(dirs, packageJson, rawExports);
  } catch (error) {
    const message = error instanceof BuildError ? error.error : String(error);
    return { error: true, errors: [message] };
  }

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const tasks: Task<unknown>[] = [
    () =>
      buildTypesTask({
        dirs,
        packageJson,
        entrypoints,
        modules,
      }).then(({ entrypointToEsDtsMap, entrypointToCjsDtsMap }) => {
        for (const [entrypoint, dts] of entrypointToEsDtsMap) {
          setExports(exportsMap, entrypoint, (entry) => {
            entry.dmts = "./" + relative(outDir, dts);
            return entry;
          });
        }

        for (const [entrypoint, dts] of entrypointToCjsDtsMap) {
          setExports(exportsMap, entrypoint, (entry) => {
            entry.dcts = "./" + relative(outDir, dts);
            return entry;
          });
        }
      }),
  ];

  if (entrypoints.size > 0 || bins.size > 0) {
    tasks.push(() =>
      viteTask({ viteConfig }).then((viteOutput) =>
        runSettled(args, [
          () =>
            jsFilesTask({ buildOutput: viteOutput, entrypoints, outDir }).then((res) => {
              for (const [filePath, name] of res) {
                setExports(exportsMap, name, (entry) => {
                  const format = filePath.endsWith(".js") ? "cjs" : "es";
                  if (format === "es") {
                    entry.mjs = "./" + filePath;
                  } else if (format === "cjs") {
                    entry.cjs = "./" + filePath;
                  }
                  return entry;
                });
              }
            }),
          () =>
            binsTask({
              outBinsDir,
              bins,
              buildOutput: viteOutput,
              outDir,
            }).then((res) => {
              for (const [value, key] of res) {
                binsMap.set(key, value);
              }
            }),
        ]),
      ),
    );
  }

  const tasksRes = await runSettled(args, tasks);

  const errors = promiseSettledResultErrors(tasksRes).map((res) => {
    if (res instanceof PrettyError) {
      return res;
    }

    if (res instanceof BuildError) {
      return res.error;
    }

    return res instanceof Error ? res.message : String(res);
  });

  if (errors.length > 0) {
    return { error: true, errors };
  }

  const copyResults = await runSettled(args, [() => copyStaticFilesTask(copyManifest)]);
  const copyErrors = promiseSettledResultErrors(copyResults).map((error) =>
    error instanceof Error ? error.message : String(error),
  );
  if (copyErrors.length > 0) {
    return { error: true, errors: copyErrors };
  }

  await writePackageJson(outDir, packageJson, {
    exportsMap,
    binsMap,
  });

  lineLog();
  log(`Build finished: ./${relative(sourceDir, outDir)}`);
  return { error: false };
}
