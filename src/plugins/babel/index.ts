import type { Plugin } from "vite";
import * as path from "node:path";
import { findBabelConfig } from "./findBabelConfig.js";
import { type PackageJson } from "../../packageJson.js";
import { type Dirs } from "../../resolveDirs.js";
import { type DetectedModules } from "../../detectModules.js";
import { okLog } from "../../log.js";

type BabelPluginOptions = {
  packageJson: PackageJson;
  dirs: Dirs;
  modules: DetectedModules;
};

export function babelPlugin({ packageJson, dirs, modules }: BabelPluginOptions): Plugin {
  let hasBabelConfig = false;

  return {
    name: "smartbundle:babel",
    async buildStart() {
      hasBabelConfig = await findBabelConfig(dirs.sourceDir, packageJson);
      if (modules.babel && !hasBabelConfig) {
        this.warn(
          "We have found a @babel/core package, but config was not found. It could be a bug",
        );
      } else if (!modules.babel && hasBabelConfig) {
        this.error(
          new Error(
            "We have found a babel config. Please install @babel/core to devDeps or remove the config file",
          ),
        );
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

      const result = await modules.babel.transformAsync(code, {
        filename: id,
        sourceMaps: true,
        inputSourceMap: map,
      });

      if (!result?.code) {
        throw new Error("Babel transformation failed");
      }

      return {
        code: result.code,
        map: result.map,
      };
    },
    buildEnd(error) {
      if (modules.babel && hasBabelConfig) {
        okLog("Babel");
      }
    },
  };
}
