import { describe, expect, test, vi } from "vitest";
import { runCli } from "./root.js";

function setup() {
  let stdout = "";
  let stderr = "";
  const runBuild = vi.fn(async () => 0);
  const runSkill = vi.fn(async () => 0);
  const execute = (argv: string[]) =>
    runCli(argv, {
      runBuild,
      runSkill,
      writeOutput: (text) => (stdout += text),
      writeError: (text) => (stderr += text),
    });

  return {
    execute,
    runBuild,
    runSkill,
    stdout: () => stdout,
    stderr: () => stderr,
  };
}

describe("runCli", () => {
  test("bare invocation explains that no build ran and shows root help", async () => {
    const cli = setup();

    expect(await cli.execute([])).toBe(0);
    expect(cli.stdout()).toContain(
      "No build was performed. Run `smartbundle build` to build the package.\n\n",
    );
    expect(cli.stdout()).toContain("smartbundle [command]");
    expect(cli.stdout()).toContain("smartbundle build  Build the package");
    expect(cli.stdout()).not.toContain("--sourceDir");
    expect(cli.stdout()).not.toContain("smartbundle skill  ");
    expect(cli.stderr()).toBe("");
    expect(cli.runBuild).not.toHaveBeenCalled();
    expect(cli.runSkill).not.toHaveBeenCalled();
  });

  test.each([["--help"], ["-h"]])("shows only root help for %j", async (...argv) => {
    const cli = setup();

    expect(await cli.execute(argv)).toBe(0);
    expect(cli.stdout()).toMatch(/^smartbundle \[command\]/);
    expect(cli.stdout()).not.toContain("No build was performed");
    expect(cli.stdout()).not.toContain("--sourceDir");
    expect(cli.stdout()).toContain("smartbundle skill` for machine-readable");
    expect(cli.stderr()).toBe("");
  });

  test("routes commands to their handlers", async () => {
    const buildCli = setup();
    const skillCli = setup();

    expect(await buildCli.execute(["build", "-s", "src", "--seq"])).toBe(0);
    expect(buildCli.runBuild).toHaveBeenCalledWith(
      expect.objectContaining({ sourceDir: "src", seq: true }),
    );
    expect(await skillCli.execute(["skill"])).toBe(0);
    expect(skillCli.runSkill).toHaveBeenCalledOnce();
  });

  test.each([["unknown"], ["--unknown"]])(
    "reports root parse errors once for %j",
    async (...argv) => {
      const cli = setup();

      expect(await cli.execute(argv)).toBe(1);
      expect(cli.stdout()).toBe("");
      expect(cli.stderr()).toContain("smartbundle [command]");
      expect(cli.stderr().match(/Unknown (?:command|argument): unknown/g)).toHaveLength(1);
      expect(cli.runBuild).not.toHaveBeenCalled();
      expect(cli.runSkill).not.toHaveBeenCalled();
    },
  );

  test.each([
    ["build", "--help"],
    ["build", "-h"],
    ["skill", "--help"],
    ["skill", "-h"],
  ])("shows contextual help without running a handler for %j %j", async (...argv) => {
    const cli = setup();

    expect(await cli.execute(argv)).toBe(0);
    expect(cli.stdout()).toMatch(
      argv[0] === "build" ? /^smartbundle build \[options\]/ : /^smartbundle skill/,
    );
    expect(cli.stdout()).toContain("smartbundle skill` for machine-readable");
    if (argv[0] === "build") {
      expect(cli.stdout()).toContain("--sourceDir");
      expect(cli.stdout()).not.toContain("Commands:");
    } else {
      expect(cli.stdout()).not.toContain("--sourceDir");
    }
    expect(cli.runBuild).not.toHaveBeenCalled();
    expect(cli.runSkill).not.toHaveBeenCalled();
  });

  test.each([
    ["build", "--unknown"],
    ["build", "extra"],
    ["skill", "--unknown"],
    ["skill", "extra"],
  ])("rejects options and positionals in their command context: %j %j", async (...argv) => {
    const cli = setup();

    expect(await cli.execute(argv)).toBe(1);
    expect(cli.stdout()).toBe("");
    expect(cli.stderr()).toMatch(new RegExp(`^smartbundle ${argv[0]}`));
    expect(cli.stderr().match(/Unknown (?:command|argument):/g)).toHaveLength(1);
    expect(cli.runBuild).not.toHaveBeenCalled();
    expect(cli.runSkill).not.toHaveBeenCalled();
  });

  test("returns handler status and prints unexpected errors once", async () => {
    const failed = setup();
    failed.runBuild.mockResolvedValue(1);
    expect(await failed.execute(["build"])).toBe(1);

    const thrown = setup();
    thrown.runBuild.mockRejectedValue(new Error("unexpected failure"));
    expect(await thrown.execute(["build"])).toBe(1);
    expect(thrown.stderr().match(/unexpected failure/g)).toHaveLength(1);
  });

  test("treats --help before a command as root help", async () => {
    const cli = setup();

    expect(await cli.execute(["--help", "build"])).toBe(0);
    expect(cli.stdout()).toMatch(/^smartbundle \[command\]/);
    expect(cli.runBuild).not.toHaveBeenCalled();
  });
});
