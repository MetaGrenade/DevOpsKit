import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import type { SecurityAuditReport, SecurityFinding, Workspace } from "@fdt/schemas";
import { scanResources } from "@fdt/scanner";
import { preferWorkspaceRelativePath } from "@fdt/core";
import {
  applySecurityBaseline,
  buildSecurityFindingId,
  buildSecurityFingerprint,
  summarizeSecurityFindings,
} from "./security-baseline.js";

export interface ScanSecurityOptions {
  workspaceRoot: string;
  workspace: Workspace;
  resourceFilter?: string;
  baselineFingerprints?: string[];
}

interface LuaFileRef {
  resource: string;
  resourcePath: string;
  relativePath: string;
  absolutePath: string;
  content: string;
  lines: string[];
  side: "client" | "server" | "shared" | "unknown";
}

const GUARD_PATTERNS = [
  /IsPlayerAceAllowed/i,
  /source\s*==/,
  /GetPlayerPed/i,
  /GetEntityCoords/i,
  /#\(/,
  /HasPermission/i,
  /getJob/i,
  /Player\(source\)/i,
  /QBCore\.Functions\.GetPlayer/i,
  /exports\[[^\]]+\]:GetPlayer/i,
  /distance/i,
  /cooldown/i,
  /rate.?limit/i,
];

const REWARD_PATTERNS = [
  /\baddMoney\b/i,
  /\bAddMoney\b/,
  /\baddAccountMoney\b/i,
  /\baddItem\b/i,
  /\bAddItem\b/,
  /\bxPlayer\.add/i,
  /\bGiveMoney\b/i,
];

const DANGEROUS_PATTERNS: Array<{
  pattern: RegExp;
  code: string;
  severity: SecurityFinding["severity"];
  confidence: SecurityFinding["confidence"];
  category: SecurityFinding["category"];
  message: string;
  remediation: string;
}> = [
  {
    pattern: /\bloadstring\s*\(/,
    code: "security.dangerous_loadstring",
    severity: "critical",
    confidence: "high",
    category: "filesystem",
    message: "Use of loadstring() can execute arbitrary code.",
    remediation: "Remove loadstring or restrict to trusted, static input only.",
  },
  {
    pattern: /\bos\.execute\s*\(/,
    code: "security.dangerous_os_execute",
    severity: "critical",
    confidence: "high",
    category: "filesystem",
    message: "Use of os.execute() can run shell commands on the host.",
    remediation: "Remove os.execute or gate behind strict admin-only server checks.",
  },
  {
    pattern: /\bio\.popen\s*\(/,
    code: "security.dangerous_io_popen",
    severity: "critical",
    confidence: "high",
    category: "filesystem",
    message: "Use of io.popen() can run shell commands on the host.",
    remediation: "Remove io.popen from runtime scripts.",
  },
  {
    pattern: /\bPerformHttpRequest\s*\([^)]*\.\./,
    code: "security.unsafe_http_concat",
    severity: "high",
    confidence: "medium",
    category: "network",
    message: "HTTP request URL appears to use string concatenation.",
    remediation: "Validate and allowlist outbound URLs before PerformHttpRequest.",
  },
  {
    pattern: /MySQL\.(?:Async\.)?(?:execute|query|insert|update)\s*\([^)]*\.\./i,
    code: "security.unsafe_sql_concat",
    severity: "high",
    confidence: "high",
    category: "database",
    message: "SQL call appears to concatenate untrusted input.",
    remediation: "Use parameterized queries or ORM helpers instead of string concatenation.",
  },
];

function inferSide(relativePath: string, content: string): LuaFileRef["side"] {
  if (relativePath.includes("/client/") || relativePath.includes("client.lua")) {
    return "client";
  }
  if (relativePath.includes("/server/") || relativePath.includes("server.lua")) {
    return "server";
  }
  if (relativePath.includes("/shared/") || relativePath.includes("shared.lua")) {
    return "shared";
  }
  if (content.includes("RegisterNetEvent") && content.includes("AddEventHandler")) {
    return "server";
  }
  if (content.includes("TriggerServerEvent")) {
    return "client";
  }
  return "unknown";
}

function hasNearbyGuard(lines: string[], startIndex: number, window = 20): boolean {
  const slice = lines.slice(startIndex, startIndex + window).join("\n");
  return GUARD_PATTERNS.some((pattern) => pattern.test(slice));
}

function hasRewardMutation(lines: string[], startIndex: number, window = 25): boolean {
  const slice = lines.slice(startIndex, startIndex + window).join("\n");
  return REWARD_PATTERNS.some((pattern) => pattern.test(slice));
}

function pushFinding(
  findings: SecurityFinding[],
  input: Omit<SecurityFinding, "id" | "fingerprint" | "suppressed" | "isNew">,
): void {
  const fingerprint = buildSecurityFingerprint({
    code: input.code,
    resource: input.resource,
    file: input.file,
    line: input.line,
  });

  findings.push({
    ...input,
    fingerprint,
    id: buildSecurityFindingId(fingerprint),
    suppressed: false,
    isNew: true,
  });
}

function scanDangerousFunctions(file: LuaFileRef, findings: SecurityFinding[]): void {
  for (const rule of DANGEROUS_PATTERNS) {
    file.lines.forEach((line, index) => {
      if (!rule.pattern.test(line)) {
        return;
      }

      pushFinding(findings, {
        severity: rule.severity,
        confidence: rule.confidence,
        category: rule.category,
        code: rule.code,
        message: rule.message,
        resource: file.resource,
        file: file.relativePath,
        line: index + 1,
        snippet: line.trim(),
        remediation: rule.remediation,
      });
    });
  }
}

function scanNetEvents(file: LuaFileRef, findings: SecurityFinding[]): void {
  if (file.side !== "server" && file.side !== "unknown") {
    return;
  }

  file.lines.forEach((line, index) => {
    const registerMatch = line.match(/RegisterNetEvent\s*\(\s*['"]([^'"]+)['"]/);
    if (registerMatch) {
      if (!hasNearbyGuard(file.lines, index)) {
        pushFinding(findings, {
          severity: "medium",
          confidence: "medium",
          category: "events",
          code: "security.net_event_no_guard",
          message: `RegisterNetEvent('${registerMatch[1]}') has no obvious permission, distance, or source validation nearby.`,
          resource: file.resource,
          file: file.relativePath,
          line: index + 1,
          snippet: line.trim(),
          remediation:
            "Validate source, permissions, distance, and rate limits before mutating player state.",
        });
      }
    }

    const handlerMatch = line.match(/AddEventHandler\s*\(\s*['"]([^'"]+)['"]/);
    if (handlerMatch && hasRewardMutation(file.lines, index) && !hasNearbyGuard(file.lines, index)) {
      pushFinding(findings, {
        severity: "critical",
        confidence: "high",
        category: "economy",
        code: "security.client_triggered_reward",
        message: `Event handler '${handlerMatch[1]}' appears to grant rewards without nearby validation.`,
        resource: file.resource,
        file: file.relativePath,
        line: index + 1,
        snippet: line.trim(),
        remediation:
          "Never trust client-triggered events for money/items. Validate job, distance, inventory capacity, and cooldown server-side.",
      });
    }
  });
}

function scanNuiCallbacks(file: LuaFileRef, findings: SecurityFinding[]): void {
  file.lines.forEach((line, index) => {
    if (!/RegisterNUICallback\s*\(\s*['"][^'"]+['"]/.test(line)) {
      return;
    }

    if (!hasNearbyGuard(file.lines, index)) {
      pushFinding(findings, {
        severity: "medium",
        confidence: "medium",
        category: "permissions",
        code: "security.nui_callback_no_guard",
        message: "NUI callback lacks obvious permission or validation checks nearby.",
        resource: file.resource,
        file: file.relativePath,
        line: index + 1,
        snippet: line.trim(),
        remediation: "Validate player permissions server-side before applying NUI callback mutations.",
      });
    }
  });
}

function scanClientTriggerPatterns(file: LuaFileRef, findings: SecurityFinding[]): void {
  if (file.side !== "client") {
    return;
  }

  file.lines.forEach((line, index) => {
    if (/TriggerServerEvent\s*\(\s*['"][^'"]*(?:money|cash|reward|item|give|add)[^'"]*['"]/i.test(line)) {
      pushFinding(findings, {
        severity: "high",
        confidence: "medium",
        category: "economy",
        code: "security.client_reward_trigger",
        message: "Client script triggers a server event that looks reward-related.",
        resource: file.resource,
        file: file.relativePath,
        line: index + 1,
        snippet: line.trim(),
        remediation: "Ensure the matching server handler validates all inputs and never trusts client amounts.",
      });
    }
  });
}

async function collectLuaFiles(
  workspaceRoot: string,
  workspace: Workspace,
  resourceFilter?: string,
): Promise<LuaFileRef[]> {
  const scanResult = await scanResources({ workspaceRoot, workspace });
  const ignore = (workspace.resourceIgnore ?? []).map((pattern) => pattern.replace(/\\/g, "/"));
  const files: LuaFileRef[] = [];

  for (const resource of scanResult.resources) {
    if (resourceFilter && resource.name !== resourceFilter) {
      continue;
    }

    const resourceAbsolute = path.resolve(workspaceRoot, resource.path);
    if (!existsSync(resourceAbsolute)) {
      continue;
    }

    const luaPaths = await fg("**/*.{lua,lua54}", {
      cwd: resourceAbsolute,
      absolute: true,
      onlyFiles: true,
      ignore,
    });

    for (const absolutePath of luaPaths) {
      const content = await readFile(absolutePath, "utf8");
      const relativePath = preferWorkspaceRelativePath(workspaceRoot, absolutePath);
      files.push({
        resource: resource.name,
        resourcePath: resource.path,
        relativePath,
        absolutePath,
        content,
        lines: content.split(/\r?\n/),
        side: inferSide(relativePath, content),
      });
    }
  }

  return files;
}

export async function scanSecurity(options: ScanSecurityOptions): Promise<SecurityAuditReport> {
  const { workspaceRoot, workspace, resourceFilter, baselineFingerprints = [] } = options;
  const luaFiles = await collectLuaFiles(workspaceRoot, workspace, resourceFilter);
  const findings: SecurityFinding[] = [];

  for (const file of luaFiles) {
    scanDangerousFunctions(file, findings);
    scanNetEvents(file, findings);
    scanNuiCallbacks(file, findings);
    scanClientTriggerPatterns(file, findings);
  }

  applySecurityBaseline(findings, baselineFingerprints);

  const resourceNames = new Set(luaFiles.map((file) => file.resource));
  const summary = summarizeSecurityFindings(findings);

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    workspaceName: workspace.name,
    workspaceRoot,
    summary: {
      resourcesScanned: resourceNames.size,
      luaFilesScanned: luaFiles.length,
      ...summary,
    },
    findings,
  };
}

export function renderSecuritySarif(report: SecurityAuditReport): string {
  const rules = new Map<string, { id: string; name: string; shortDescription: { text: string } }>();

  for (const finding of report.findings) {
    if (!rules.has(finding.code)) {
      rules.set(finding.code, {
        id: finding.code,
        name: finding.code,
        shortDescription: { text: finding.message },
      });
    }
  }

  const sarif = {
    version: "2.1.0",
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "fdt-security-auditor",
            version: "0.1.0",
            rules: [...rules.values()],
          },
        },
        results: report.findings
          .filter((finding) => !finding.suppressed)
          .map((finding) => ({
            ruleId: finding.code,
            level:
              finding.severity === "critical" || finding.severity === "high"
                ? "error"
                : finding.severity === "medium"
                  ? "warning"
                  : "note",
            message: { text: finding.message },
            locations: finding.file
              ? [
                  {
                    physicalLocation: {
                      artifactLocation: { uri: finding.file },
                      region: finding.line ? { startLine: finding.line } : undefined,
                    },
                  },
                ]
              : [],
            properties: {
              severity: finding.severity,
              confidence: finding.confidence,
              category: finding.category,
              resource: finding.resource,
              isNew: finding.isNew,
            },
          })),
      },
    ],
  };

  return `${JSON.stringify(sarif, null, 2)}\n`;
}
