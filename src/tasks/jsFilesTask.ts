import type { Rolldown } from "vite";
import { dirname, join, relative } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { okLog } from "../log.js";
import { BuildError } from "../error.js";

type JsFilesTaskOption = {
  buildOutput: Rolldown.OutputChunk[];
  entrypoints: Map<string, string>;
  outDir: string;
};

function findCompiledPath(
  buildOutput: Rolldown.OutputChunk[],
  originalFile: string,
  type: "js" | "mjs",
) {
  for (const el of buildOutput) {
    if (el.facadeModuleId === originalFile) {
      if (type === "js" && el.fileName.endsWith(".js")) {
        return {
          path: el.fileName,
          hasDefault: el.exports.includes("default"),
        };
      }
      if (type === "mjs" && el.fileName.endsWith(".mjs")) {
        return {
          path: el.fileName,
          hasDefault: el.exports.includes("default"),
        };
      }
    }
  }
  throw new BuildError(
    `Cannot find the ${type === "mjs" ? "ESM" : "CommonJS"} output chunk for ${originalFile}`,
  );
}

export async function jsFilesTask({ buildOutput, entrypoints, outDir }: JsFilesTaskOption) {
  const res = new Map<string, string>();
  for (const [name, filePath] of entrypoints) {
    const totalName = join(outDir, name);

    const esmName = join(totalName, "index.mjs");
    const esmCompiled = findCompiledPath(buildOutput, filePath, "mjs");
    const esmPath = relative(totalName, join(outDir, esmCompiled.path));
    await mkdir(dirname(esmName), { recursive: true });
    let esmContent = `export * from "./${esmPath}";\n`;
    if (esmCompiled.hasDefault) {
      esmContent += `import Default from "./${esmPath}";\nexport default Default;\n`;
    }
    await writeFile(esmName, esmContent);
    res.set(relative(outDir, join(dirname(esmName), esmPath)), name);
    const cjsName = join(totalName, "index.js");
    const cjsCompiled = findCompiledPath(buildOutput, filePath, "js");
    const cjsPath = relative(totalName, join(outDir, cjsCompiled.path));
    await mkdir(dirname(esmName), { recursive: true });
    const cjsContent = `module.exports = require("./${cjsPath}");\n`;
    await writeFile(cjsName, cjsContent);
    res.set(relative(outDir, join(dirname(cjsName), cjsPath)), name);

    // moduleResolution: "node10" in tsconfig.json
    const cdtsPath = cjsName.replace(/\.js$/, ".d.ts");
    await writeFile(cdtsPath, `export * from "./${cjsPath}";\n`);
  }

  okLog("no-exports compat layer");
  return res;
}
