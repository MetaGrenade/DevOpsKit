import { createHash } from "node:crypto";

export function buildSecurityFingerprint(input: {
  code: string;
  resource?: string;
  file?: string;
  line?: number;
}): string {
  const payload = [input.code, input.resource ?? "", input.file ?? "", String(input.line ?? "")].join("|");
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export function buildSecurityFindingId(fingerprint: string): string {
  return `sec_${fingerprint}`;
}

export function applySecurityBaseline(
  findings: Array<{ fingerprint: string; suppressed?: boolean; isNew?: boolean; severity: string }>,
  baselineFingerprints: string[],
): void {
  const baseline = new Set(baselineFingerprints);

  for (const finding of findings) {
    if (baseline.has(finding.fingerprint)) {
      finding.suppressed = true;
      finding.isNew = false;
    } else {
      finding.suppressed = false;
      finding.isNew = true;
    }
  }
}

export function summarizeSecurityFindings(
  findings: Array<{
    severity: string;
    suppressed?: boolean;
    isNew?: boolean;
  }>,
): {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  suppressed: number;
  newFindings: number;
  newCritical: number;
  newHigh: number;
} {
  const counts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    suppressed: 0,
    newFindings: 0,
    newCritical: 0,
    newHigh: 0,
  };

  for (const finding of findings) {
    if (finding.severity === "critical") counts.critical += 1;
    if (finding.severity === "high") counts.high += 1;
    if (finding.severity === "medium") counts.medium += 1;
    if (finding.severity === "low") counts.low += 1;
    if (finding.severity === "info") counts.info += 1;
    if (finding.suppressed) counts.suppressed += 1;
    if (finding.isNew !== false) {
      counts.newFindings += 1;
      if (finding.severity === "critical") counts.newCritical += 1;
      if (finding.severity === "high") counts.newHigh += 1;
    }
  }

  return counts;
}
