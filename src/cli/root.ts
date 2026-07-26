import yargs from "yargs";
import { createBuildCommand, helpFooter, runBuildCommand } from "./build.js";
import { formatUnexpectedError } from "./errors.js";
import { createSkillCommand, runSkillCommand } from "./skill.js";

const noBuildMessage = "No build was performed. Run `smartbundle build` to build the package.";

export type CliDependencies = {
  runBuild?: typeof runBuildCommand;
  runSkill?: typeof runSkillCommand;
  writeOutput?: (text: string) => void;
  writeError?: (text: string) => void;
};

function writeLine(write: (text: string) => void, text: string) {
  write(text.endsWith("\n") ? text : `${text}\n`);
}

export async function runCli(argv: readonly string[], dependencies: CliDependencies = {}) {
  const parseArgv = argv[0] === "--help" || argv[0] === "-h" ? [argv[0]] : argv;
  const writeOutput = dependencies.writeOutput ?? ((text: string) => process.stdout.write(text));
  const writeError = dependencies.writeError ?? ((text: string) => process.stderr.write(text));
  let exitCode = 0;
  let selectedCommand = false;
  let parserError: Error | undefined;
  let parserOutput = "";

  const parser = yargs(parseArgv)
    .scriptName("smartbundle")
    .usage("$0 [command]")
    .version(false)
    .help("help")
    .alias("help", "h")
    .strictCommands()
    .strictOptions()
    .showHelpOnFail(true)
    .exitProcess(false)
    .epilog(helpFooter)
    .command(
      createBuildCommand(async (args) => {
        selectedCommand = true;
        exitCode = await (dependencies.runBuild ?? runBuildCommand)(args);
      }),
    )
    .command(
      createSkillCommand(async () => {
        selectedCommand = true;
        exitCode = await (dependencies.runSkill ?? runSkillCommand)();
      }),
    );

  try {
    await parser.parseAsync(parseArgv, {}, (error, _parsed, output) => {
      parserError = error;
      parserOutput = output;
      if (output) {
        writeLine(error ? writeError : writeOutput, output);
      }
    });
  } catch (error) {
    if (!parserOutput) {
      writeLine(writeError, formatUnexpectedError(error));
    }
    return 1;
  }

  if (parserError) {
    return 1;
  }

  if (argv.length === 0 && !selectedCommand) {
    writeLine(writeOutput, noBuildMessage);
    writeOutput("\n");
    writeLine(writeOutput, await parser.getHelp());
  }

  return exitCode;
}
