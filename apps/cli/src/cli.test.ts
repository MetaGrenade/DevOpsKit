import { describe, expect, it } from "vitest";
import { Command } from "commander";
import { registerGlobalOptions } from "./lib/global-options.js";
import { registerInitCommand } from "./commands/init.js";
import { registerScanCommand } from "./commands/scan.js";
import { registerValidateCommand } from "./commands/validate.js";
import { registerPlaceholderCommands } from "./commands/placeholders.js";

function createProgram(): Command {
  const program = new Command();
  program.name("fdt").description("FiveM DevOps Toolkit CLI").version("0.0.0");
  registerGlobalOptions(program);
  registerInitCommand(program);
  registerScanCommand(program);
  registerValidateCommand(program);
  registerPlaceholderCommands(program);
  return program;
}

describe("fdt CLI", () => {
  it("shows help output with command groups", () => {
    const program = createProgram();
    const help = program.helpInformation();

    expect(help).toContain("init");
    expect(help).toContain("scan");
    expect(help).toContain("validate");
    expect(help).toContain("adapter");
  });
});
