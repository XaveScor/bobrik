import type { ArgumentsCamelCase, Argv } from "yargs";
import { Youch } from "youch";
import type { BuildArgs } from "../buildArgs.js";
import { run } from "../index.js";
import { PrettyError } from "../PrettyErrors.js";

export const helpFooter = "LLM agents: run `smartbundle skill` for machine-readable instructions.";

type BuildCommandArgs = ArgumentsCamelCase<BuildArgs>;

export type BuildCommandDependencies = {
  runBuild?: typeof run;
  writeError?: (text: string) => void;
};

export async function runBuildCommand(
  args: BuildCommandArgs,
  dependencies: BuildCommandDependencies = {},
) {
  const runBuild = dependencies.runBuild ?? run;
  const writeError = dependencies.writeError ?? ((text) => console.error(text));
  const result = await runBuild({
    sourceDir: args.sourceDir,
    packagePath: args.packagePath,
    outputDir: args.outputDir,
    seq: args.seq,
  });

  if (!result.error) {
    return 0;
  }

  const youch = new Youch();
  for (const error of result.errors) {
    if (error instanceof PrettyError) {
      writeError(await youch.toANSI(error));
    } else {
      writeError(`\x1b[31m[ERROR] ${String(error)} \x1b[0m`);
    }
  }

  return 1;
}

export function createBuildCommand(handler: (args: BuildCommandArgs) => void | Promise<void>) {
  return {
    command: "build",
    describe: "Build the package",
    builder: (parser: Argv) =>
      parser
        .usage("$0 build [options]")
        .option("sourceDir", {
          alias: "s",
          type: "string" as const,
          describe: "path to the project directory. Default: current working directory",
        })
        .option("packagePath", {
          alias: "p",
          type: "string" as const,
          describe: "path to the package.json. Default: cwd()/package.json",
        })
        .option("outputDir", {
          alias: "o",
          type: "string" as const,
          describe: "path to the output directory. Default: cwd()/dist",
        })
        .option("seq", {
          type: "boolean" as const,
          describe:
            "run internal tasks sequentially. It is useful for performance testing and debugging. This option is unstable and not recommended for production use.",
        })
        .epilog(helpFooter)
        .strict(),
    handler,
  };
}
