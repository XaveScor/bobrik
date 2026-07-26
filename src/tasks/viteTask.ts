import { build, type UserConfig, type Rolldown } from "vite";
import { errors } from "../errors.js";
import { okLog } from "../log.js";
import { BuildError } from "../error.js";
import { PrettyError } from "../PrettyErrors.js";

type ViteTaskParams = {
  viteConfig: UserConfig;
};

type BuildSuccess = {
  error: false;
  output: Rolldown.OutputChunk[];
};
type BuildErrorType = {
  error: true;
  errors: Array<string | PrettyError>;
};

type BuildResult = BuildSuccess | BuildErrorType;

type NestedBuildError = Error & {
  frame?: string;
  loc?: { column?: number; file?: string; line?: number };
  plugin?: string;
};

function formatBuildError(error: NestedBuildError) {
  const details = [`${error.plugin ? `[${error.plugin}] ` : ""}${error.message}`];
  if (error.loc) {
    const position = [error.loc.line, error.loc.column].filter((value) => value != null).join(":");
    details.push(`${error.loc.file ?? ""}${position ? `:${position}` : ""}`);
  }
  if (error.frame) {
    details.push(error.frame);
  }
  return details.join("\n");
}

async function buildVite({ viteConfig }: ViteTaskParams): Promise<BuildResult> {
  try {
    const outputs = await build(viteConfig);
    if (!Array.isArray(outputs)) {
      return {
        error: true,
        errors: [errors.rollupError],
      };
    }

    return {
      error: false,
      output: outputs.flatMap((x) => x.output.filter((x) => x.type === "chunk")),
    };
  } catch (e) {
    if (e instanceof PrettyError) {
      return {
        error: true,
        errors: [e],
      };
    }
    if (e instanceof Error) {
      const nestedErrors = (e as Error & { errors?: unknown[] }).errors;
      if (
        nestedErrors &&
        nestedErrors.length > 0 &&
        nestedErrors.every((error) => error instanceof Error)
      ) {
        return {
          error: true,
          errors: nestedErrors.map((error) => formatBuildError(error as NestedBuildError)),
        };
      }
      return {
        error: true,
        errors: [e.message],
      };
    }
  }
  return {
    error: true,
    errors: [errors.rollupError],
  };
}

export async function viteTask({ viteConfig }: ViteTaskParams) {
  const outputs = await buildVite({ viteConfig });
  if (outputs.error) {
    throw outputs.errors.map((e) => (e instanceof PrettyError ? e : new BuildError(e)));
  }

  okLog("Vite");
  return outputs.output;
}
