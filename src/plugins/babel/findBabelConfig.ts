import * as path from "node:path";
import * as fs from "node:fs/promises";
import { type PackageJson } from "../../packageJson.js";

const configFiles = [
  ".babelrc",
  ".babelrc.json",
  ".babelrc.js",
  ".babelrc.cjs",
  ".babelrc.mjs",
  "babel.config.json",
  "babel.config.js",
  "babel.config.cjs",
  "babel.config.mjs",
  "package.json",
];

// We need to check the existance only for better error reporting
// It helps if a user made the config but forgot to install babel/core

export async function findBabelConfig(dir: string, packageJson: PackageJson): Promise<boolean> {
  try {
    for (const file of configFiles) {
      const configPath = path.join(dir, file);
      try {
        const stat = await fs.stat(configPath);
        if (stat.isFile()) {
          if (file === "package.json") {
            if (packageJson.babel) {
              return true;
            }
          } else {
            return true;
          }
        }
      } catch {}
    }
    return false;
  } catch {
    return false;
  }
}
