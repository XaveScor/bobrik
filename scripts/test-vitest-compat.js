import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const projects = [
  ["3.2.7", "smartbundle-vitest-3-2-7"],
  ["4.1.10", "smartbundle-vitest-4-1-10"],
];

function run(command, args, cwd = projectRoot) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed${result.signal ? ` with signal ${result.signal}` : ""}`,
    );
  }
}

run(pnpm, ["build"]);
const workspaceDir = resolve(projectRoot, "e2e/vitest");
run(pnpm, ["install", "--frozen-lockfile", "--strict-peer-dependencies"], workspaceDir);

for (const [version, projectName] of projects) {
  console.log(`\nTesting Vitest ${version}`);
  run(pnpm, ["--filter", projectName, "exec", "tsc", "--noEmit"], workspaceDir);
  run(pnpm, ["--filter", projectName, "exec", "vitest", "run"], workspaceDir);
}
