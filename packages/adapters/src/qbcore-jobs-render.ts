import type { Job } from "@fdt/schemas";
import { luaBool, luaString } from "./lua-utils.js";

function renderQbJobGrade(grade: Job["grades"][number]): string {
  return [
    `            [${luaString(String(grade.level))}] = {`,
    `                name = ${luaString(grade.label)},`,
    `                payment = ${grade.payment},`,
    "            },",
  ].join("\n");
}

export function renderQbJob(job: Job): string {
  const lines = [
    `    [${luaString(job.id)}] = {`,
    `        label = ${luaString(job.label)},`,
    `        defaultDuty = ${luaBool(job.defaultDuty)},`,
    "        grades = {",
  ];

  const grades = [...job.grades].sort((a, b) => a.level - b.level);
  if (grades.length === 0) {
    lines.push(
      "            ['0'] = {",
      "                name = 'Employee',",
      "                payment = 0,",
      "            },",
    );
  } else {
    lines.push(...grades.map(renderQbJobGrade));
  }

  lines.push("        },", "    },");
  return lines.join("\n");
}

export function sortedJobs(model: { jobs: Job[] }): Job[] {
  return [...model.jobs].sort((a, b) => a.id.localeCompare(b.id));
}
