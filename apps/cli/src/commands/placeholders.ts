import type { Command } from "commander";

const PLACEHOLDER_GROUPS: Array<{ name: string; description: string; commands: string[] }> = [
  {
    name: "doctor",
    description: "Run health checks across the workspace",
    commands: ["doctor"],
  },
  {
    name: "assets",
    description: "Stream asset auditing and cataloging",
    commands: ["assets audit", "assets index"],
  },
  {
    name: "content",
    description: "Framework-agnostic content builders",
    commands: ["content jobs", "content zones"],
  },
  {
    name: "adapter",
    description: "Export content through framework adapters",
    commands: ["adapter export <target>"],
  },
  {
    name: "release",
    description: "Release bundles, changelogs, and rollbacks",
    commands: ["release create", "release validate"],
  },
];

function registerComingSoon(parent: Command, subcommand: string, description: string): void {
  const [cmd, ...rest] = subcommand.split(" ");
  const chain = rest.reduce(
    (current, part) => current.command(part),
    parent.command(cmd!),
  );

  chain
    .description(description)
    .action(() => {
      console.error(`Command not yet implemented: fdt ${subcommand}`);
      console.error("This command is planned for a future implementation phase.");
      process.exit(1);
    });
}

export function registerPlaceholderCommands(program: Command, skipGroups: string[] = []): void {
  for (const group of PLACEHOLDER_GROUPS) {
    if (skipGroups.includes(group.name)) {
      continue;
    }

    const groupCmd = program.command(group.name).description(group.description);

    for (const subcommand of group.commands) {
      const relative = subcommand.startsWith(`${group.name} `)
        ? subcommand.slice(group.name.length + 1)
        : subcommand;
      registerComingSoon(groupCmd, relative, `(${group.name}) ${relative}`);
    }
  }
}
