import { createRequire } from "node:module";

/**
 * Resolves a module from the target project's `node_modules` rather than from
 * SmartBundle's own install location. `from` should be a path inside the
 * target project (typically the package.json path or a source file).
 *
 * Uses `createRequire` so the standard Node resolution algorithm walks up
 * from `from` to find the nearest `node_modules` belonging to the project
 * being bundled.
 *
 * @example
 * const babel = resolveDep<typeof import("@babel/core")>(
 *   "@babel/core",
 *   dirs.packagePath,
 * );
 */
export function resolveDep<T>(name: string, from: string): T {
  return createRequire(from)(name) as T;
}
