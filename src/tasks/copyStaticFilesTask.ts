import { constants } from "node:fs";
import { copyFile, lstat, mkdir, readdir, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { escape, glob } from "glob";
import { type PackageJson } from "../packageJson.js";
import { type Dirs } from "../resolveDirs.js";
import { okLog } from "../log.js";
import { BuildError } from "../error.js";

const generatedRoots = new Set(["package.json", "__compiled__", "__bin__"]);
const ignoredRoots = new Set([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
]);

type CopyEntry = {
  source: string;
  destination: string;
};

function toRelativePath(sourceDir: string, filePath: string) {
  return relative(sourceDir, resolve(sourceDir, filePath)).replaceAll("\\", "/");
}

function isInsideSource(sourceDir: string, filePath: string) {
  const path = relative(sourceDir, filePath);
  return path !== "" && !path.startsWith("..") && !isAbsolute(path);
}

async function isCanonicalPathInside(realSourceDir: string, filePath: string) {
  try {
    return isInsideSource(realSourceDir, await realpath(filePath));
  } catch {
    return false;
  }
}

function canCopy(relativePath: string, outRelativePath: string | undefined) {
  const root = relativePath.split("/")[0];
  if (!root || ignoredRoots.has(root) || generatedRoots.has(root)) {
    return false;
  }
  return (
    !outRelativePath ||
    (relativePath !== outRelativePath && !relativePath.startsWith(`${outRelativePath}/`))
  );
}

async function expandPattern(sourceDir: string, realSourceDir: string, pattern: string) {
  const matches = await glob(pattern, {
    cwd: sourceDir,
    dot: true,
    follow: false,
    ignore: { childrenIgnored: (path) => path.isSymbolicLink() },
    nodir: false,
    posix: true,
  });
  const files = new Set<string>();

  for (const match of matches) {
    const source = resolve(sourceDir, match);
    if (!isInsideSource(sourceDir, source)) continue;
    const info = await lstat(source);
    if (!(await isCanonicalPathInside(realSourceDir, source))) continue;
    if (info.isFile()) {
      files.add(toRelativePath(sourceDir, source));
    } else if (info.isDirectory()) {
      for (const child of await glob(`${escape(match)}/**/*`, {
        cwd: sourceDir,
        dot: true,
        follow: false,
        ignore: { childrenIgnored: (path) => path.isSymbolicLink() },
        nodir: true,
        posix: true,
      })) {
        files.add(toRelativePath(sourceDir, child));
      }
    }
  }

  return files;
}

async function packageFiles(
  sourceDir: string,
  realSourceDir: string,
  patterns: string[] | undefined,
) {
  const files = new Set<string>();
  for (const rawPattern of patterns ?? []) {
    const exclude = rawPattern.startsWith("!");
    const pattern = exclude ? rawPattern.slice(1) : rawPattern;
    if (!pattern) continue;
    for (const file of await expandPattern(sourceDir, realSourceDir, pattern)) {
      if (exclude) files.delete(file);
      else files.add(file);
    }
  }
  return files;
}

async function rootStaticFiles(sourceDir: string) {
  const files = new Set<string>();
  const staticNames = /^(readme(?:\..*)?|licen[cs]e(?:\..*)?|copying(?:\..*)?)$/i;
  for (const entry of await readdir(sourceDir, { withFileTypes: true })) {
    if (entry.isFile() && staticNames.test(entry.name)) files.add(entry.name);
  }
  return files;
}

export async function createCopyManifest(
  { sourceDir, outDir }: Pick<Dirs, "sourceDir" | "outDir">,
  packageJson: PackageJson,
  rawExports: Map<string, string>,
) {
  const realSourceDir = await realpath(sourceDir);
  const selected = await packageFiles(sourceDir, realSourceDir, packageJson.files);
  for (const target of rawExports.values()) {
    const relativeTarget = toRelativePath(sourceDir, target);
    if (generatedRoots.has(relativeTarget.split("/")[0])) {
      throw new BuildError(`Raw export target conflicts with generated output: ${target}`);
    }
    selected.add(relativeTarget);
  }
  for (const file of await rootStaticFiles(sourceDir)) selected.add(file);

  const outRelative = isInsideSource(sourceDir, outDir)
    ? toRelativePath(sourceDir, outDir)
    : undefined;
  const manifest = new Map<string, CopyEntry>();
  for (const relativePath of selected) {
    if (!canCopy(relativePath, outRelative)) continue;
    const source = resolve(sourceDir, relativePath);
    if (
      !isInsideSource(sourceDir, source) ||
      !(await lstat(source)).isFile() ||
      !(await isCanonicalPathInside(realSourceDir, source))
    )
      continue;
    const destination = resolve(outDir, relativePath);
    manifest.set(relativePath, { source, destination });
  }
  return manifest;
}

export async function copyStaticFilesTask(manifest: Map<string, CopyEntry>) {
  for (const { source, destination } of manifest.values()) {
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination, constants.COPYFILE_EXCL);
  }
  okLog("Static files:", [...manifest.keys()].join(", "));
}
