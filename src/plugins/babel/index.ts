import type { Plugin } from "vite";
import * as path from "node:path";
import { join } from "node:path";
import * as fs from "node:fs/promises";
import { isCodeExport } from "../../exports.js";
import { type PackageJson } from "../../packageJson.js";
import { type Dirs } from "../../resolveDirs.js";
import { type DetectedModules } from "../../detectModules.js";
import { okLog, log } from "../../log.js";

type BabelModule = typeof import("@babel/core");
type PartialConfig = NonNullable<Awaited<ReturnType<BabelModule["loadPartialConfigAsync"]>>>;

type BabelPluginOptions = {
  packageJson: PackageJson;
  dirs: Dirs;
  modules: DetectedModules;
};

const babelConfigFilenames = [
  ".babelrc",
  ".babelrc.json",
  ".babelrc.js",
  ".babelrc.cjs",
  ".babelrc.mjs",
  "babel.config.json",
  "babel.config.js",
  "babel.config.cjs",
  "babel.config.mjs",
];

function collectCodeEntries(packageJson: PackageJson, dirs: Dirs): string[] {
  const entries: string[] = [];
  if (packageJson.exports) {
    for (const value of packageJson.exports.values()) {
      if (isCodeExport(value)) entries.push(join(dirs.sourceDir, value));
    }
  }
  if (packageJson.bin) {
    for (const value of packageJson.bin.values()) {
      entries.push(join(dirs.sourceDir, value));
    }
  }
  return entries;
}

// Diagnostic-only: surfaces a forgotten config when @babel/core is not installed.
// Real config resolution uses Babel's native loadPartialConfigAsync below.
async function findAnyBabelConfigFile(
  dir: string,
  packageJson: PackageJson,
): Promise<string | undefined> {
  for (const file of babelConfigFilenames) {
    try {
      const stat = await fs.stat(path.join(dir, file));
      if (stat.isFile()) return file;
    } catch {}
  }
  if (packageJson.babel) return "package.json (babel field)";
  return undefined;
}

function artifactsOf(partial: PartialConfig | null): string {
  const found = [partial?.config, partial?.babelrc, partial?.babelignore].filter(
    (v): v is string => typeof v === "string",
  );
  return found.length > 0 ? found.join(", ") : "<no config>";
}

export function babelPlugin({ packageJson, dirs, modules }: BabelPluginOptions): Plugin {
  let hasBabelConfig = false;

  return {
    name: "smartbundle:babel",
    async buildStart() {
      if (modules.babel) {
        const entries = collectCodeEntries(packageJson, dirs);
        const groups = new Map<string, string[]>();

        for (const entry of entries) {
          let partial: PartialConfig | null;
          try {
            partial = await modules.babel.loadPartialConfigAsync({
              cwd: dirs.sourceDir,
              root: dirs.sourceDir,
              filename: entry,
            });
          } catch (e) {
            this.error(
              new Error(
                `Failed to load Babel config for ${entry}: ${e instanceof Error ? e.message : String(e)}`,
              ),
            );
            return;
          }
          const artifacts = artifactsOf(partial);
          const list = groups.get(artifacts);
          if (list) list.push(entry);
          else groups.set(artifacts, [entry]);
        }

        hasBabelConfig = ![...groups.keys()].every((k) => k === "<no config>");

        if (!hasBabelConfig) {
          this.warn("Found @babel/core but no Babel config file. Skipping Babel transform.");
        } else if (groups.size === 1) {
          const [artifacts] = [...groups.keys()];
          if (artifacts !== "<no config>") okLog("babel config:", artifacts);
        } else {
          okLog("babel configs (per entrypoint):");
          for (const [artifacts, entryFiles] of groups) {
            log(`  ${artifacts}  <-  ${entryFiles.join(", ")}`);
          }
        }
      } else {
        const configFile = await findAnyBabelConfigFile(dirs.sourceDir, packageJson);
        if (configFile) {
          this.error(
            new Error(
              `Found ${configFile} but @babel/core is not installed. Install it: npm install --save-dev @babel/core`,
            ),
          );
        }
      }
    },
    async transform(code, id) {
      if (!modules.babel || !hasBabelConfig) {
        return null;
      }

      const extname = path.extname(id);
      if (![".js", ".ts"].includes(extname)) {
        return null;
      }

      const map = this.getCombinedSourcemap();

      let result;
      try {
        result = await modules.babel.transformAsync(code, {
          filename: id,
          sourceMaps: true,
          inputSourceMap: map,
        });
      } catch (e) {
        throw new Error(
          `Babel transformation failed for ${id}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }

      if (!result?.code) {
        throw new Error(`Babel transformation produced no output for ${id}`);
      }

      return {
        code: result.code,
        map: result.map,
      };
    },
    buildEnd() {
      if (modules.babel && hasBabelConfig) {
        okLog("Babel");
      }
    },
  };
}
