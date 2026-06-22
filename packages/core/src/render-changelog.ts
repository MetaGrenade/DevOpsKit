import type { Release } from "@fdt/schemas";
import type { ReleaseChangeSet } from "./detect-release-changes.js";

export function renderReleaseChangelog(options: {
  release: Pick<Release, "version" | "targetEnvironment" | "validationSummary">;
  changes: ReleaseChangeSet;
  workspaceName: string;
  detectionMethod: ReleaseChangeSet["detectionMethod"];
}): string {
  const { release, changes, workspaceName, detectionMethod } = options;
  const lines: string[] = [
    `# Release ${release.version}`,
    "",
    `- Workspace: ${workspaceName}`,
    `- Environment: ${release.targetEnvironment}`,
    `- Change detection: ${detectionMethod}`,
    "",
    "## Validation summary",
    "",
    `- Errors: ${release.validationSummary.errors}`,
    `- Warnings: ${release.validationSummary.warnings}`,
    `- Passed checks: ${release.validationSummary.passed}`,
    "",
  ];

  const sections: Array<[string, string[]]> = [
    ["Resources", changes.changedResources],
    ["Content", changes.changedContent],
    ["Zones", changes.changedZones],
    ["Stream assets", changes.changedAssets],
    ["Database migrations", changes.changedDatabaseMigrations],
  ];

  for (const [title, items] of sections) {
    lines.push(`## ${title}`, "");
    if (items.length === 0) {
      lines.push("_No changes detected._", "");
      continue;
    }

    for (const item of items) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  lines.push("## QA checklist", "", "- [ ] Resource validation reviewed", "- [ ] Content exports reviewed", "- [ ] Stream asset audit reviewed", "- [ ] Smoke test on target environment", "");

  return lines.join("\n");
}
