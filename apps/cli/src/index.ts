#!/usr/bin/env node
import { Command } from "commander";
import { registerGlobalOptions } from "./lib/global-options.js";
import { registerInitCommand } from "./commands/init.js";
import { registerScanCommand } from "./commands/scan.js";
import { registerValidateCommand } from "./commands/validate.js";
import { registerContentCommands } from "./commands/content.js";
import { registerAuditCommand } from "./commands/audit.js";
import { registerReleaseCommand } from "./commands/release.js";
import { registerSecurityCommand } from "./commands/security.js";
import { registerQaCommand } from "./commands/qa.js";
import { registerCiCommand } from "./commands/ci.js";
import { registerDomainCommand } from "./commands/domain.js";
import { registerClothingCommand } from "./commands/clothing.js";
import { registerNuiCommand } from "./commands/nui.js";
import { registerPerfCommand } from "./commands/perf.js";
import { registerVehicleCommand } from "./commands/vehicle.js";
import { registerMapCommand } from "./commands/map.js";
import { registerEconomyCommand } from "./commands/economy.js";
import { registerWorldCommand } from "./commands/world.js";
import { registerEnvCommand } from "./commands/env.js";
import { registerStateBagCommand } from "./commands/statebag.js";
import { registerGraphCommand } from "./commands/graph.js";
import { registerPlaceholderCommands } from "./commands/placeholders.js";

const program = new Command();

program
  .name("fdt")
  .description("FiveM DevOps Toolkit — FiveM server development operations suite")
  .version("0.0.0");

registerGlobalOptions(program);
registerInitCommand(program);
registerScanCommand(program);
registerValidateCommand(program);
registerContentCommands(program);
registerAuditCommand(program);
registerReleaseCommand(program);
registerSecurityCommand(program);
registerQaCommand(program);
registerCiCommand(program);
registerDomainCommand(program);
registerPerfCommand(program);
registerClothingCommand(program);
registerNuiCommand(program);
registerVehicleCommand(program);
registerMapCommand(program);
registerGraphCommand(program);
registerEconomyCommand(program);
registerWorldCommand(program);
registerEnvCommand(program);
registerStateBagCommand(program);
registerPlaceholderCommands(program, ["content", "release"]);

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(10);
});
