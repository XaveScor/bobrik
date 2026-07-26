import type { Plugin } from "vite";
import type { PackageJson } from "../../packageJson.js";
import { ImportError } from "./ImportError.js";
import * as fs from "node:fs/promises";

function isNodeModule(id: string) {
  return id.startsWith("node:");
}

export function importsPlugin(packageJson: PackageJson, test?: boolean): Plugin {
  if (test) {
    return {
      name: "smartbundle:imports",
    };
  }

  const dynamicDeps = new Set<string>();
  const staticDeps = new Set<string>();
  for (const dep of Object.keys(packageJson.dependencies ?? {})) {
    dynamicDeps.add(dep);
    staticDeps.add(dep);
  }
  for (const dep of Object.keys(packageJson.peerDependencies ?? {})) {
    if (!packageJson.peerDependenciesMeta?.[dep]?.optional) {
      staticDeps.add(dep);
    }
    dynamicDeps.add(dep);
  }
  for (const dep of Object.keys(packageJson.optionalDependencies ?? {})) {
    dynamicDeps.add(dep);
  }
  dynamicDeps.add(packageJson.name);
  staticDeps.add(packageJson.name);

  function createDepResolver(depsSet: Set<string>) {
    return (id: string) => {
      const segments = id.split("/");
      let current = "";
      for (const segment of segments) {
        current += segment;
        // import {} from "a/b/c/d"; case
        if (depsSet.has(current)) {
          return true;
        }
        current += "/";
      }
      return false;
    };
  }

  const dynamicDepResolver = createDepResolver(dynamicDeps);
  const staticDepResolver = createDepResolver(staticDeps);
  return {
    name: "smartbundle:imports",
    enforce: "pre",
    async resolveId(id, importer) {
      if (isNodeModule(id) || staticDepResolver(id)) {
        return false;
      }
      if (dynamicDepResolver(id)) {
        this.error(await ImportError.create(id, importer, fs.readFile));
      }
      return null;
    },
    resolveDynamicImport(id) {
      if (typeof id !== "string") {
        return null;
      }
      if (isNodeModule(id) || dynamicDepResolver(id)) {
        return false;
      }

      return null;
    },
  };
}
