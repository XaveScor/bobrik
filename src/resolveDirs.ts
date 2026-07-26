import { isAbsolute, join } from "node:path";
import { type BuildArgs } from "./buildArgs.js";

function myResolve(path1: string, path2: string) {
  if (isAbsolute(path2)) {
    return path2;
  }

  return join(path1, path2);
}

export function resolveDirs(args: BuildArgs) {
  const sourceDir = myResolve(process.cwd(), args.sourceDir ?? ".");
  const packagePath = myResolve(sourceDir, args.packagePath ?? "./package.json");
  const outDir = myResolve(process.cwd(), args.outputDir ?? "./dist");
  const esmOutDir = myResolve(outDir, "__compiled__/esm");
  const cjsOutDir = myResolve(outDir, "__compiled__/cjs");
  const outBinsDir = myResolve(outDir, "__bin__");

  return { sourceDir, packagePath, outDir, outBinsDir, cjsOutDir, esmOutDir };
}

export type Dirs = ReturnType<typeof resolveDirs>;
