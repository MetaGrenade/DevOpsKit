# Security Auditor

The Security Auditor scans Lua source in your resources for risky patterns: unprotected net events, dangerous natives, SQL/HTTP concatenation, and common exploit footguns.

## Quick start

```bash
fdt security scan --workspace <path>
```

Report:

```txt
<workspace>/.fdt/reports/security-audit.json
```

SARIF output for GitHub code scanning:

```bash
fdt security scan --format sarif --out security.sarif --workspace <path>
```

## Dashboard

Open **Security** with an active workspace.

| Action | Description |
| --- | --- |
| **Run scan** | Full workspace Lua scan |
| **Save baseline** | Record current findings as accepted/suppressed |
| **Refresh** | Reload report from disk |

Findings group by resource with severity (critical → info), category, code, file/line snippets, and remediation hints.

## Baselines

After an initial scan, save a baseline to suppress known acceptable findings:

```bash
fdt security baseline create --workspace <path>
fdt security baseline compare --workspace <path>
```

Baseline fingerprints live at:

```txt
<workspace>/.fdt/reports/security-baseline.json
```

Subsequent scans mark new findings with `isNew: true` so CI can fail only on regressions.

Dashboard **Save baseline** writes the same file via the API.

## Scan scope

By default all resources under `resourcesRoot` are scanned. Limit to one resource:

```bash
fdt security scan --resource my-resource --workspace <path>
```

Respects `resourceIgnore` globs from workspace config.

## CI

```bash
fdt security scan --workspace . --ci
fdt security baseline compare --workspace . --ci
```

Included in `fdt ci run` gate sequence.

## Interpreting findings

| Severity | Typical meaning |
| --- | --- |
| **Critical** | Likely exploitable without extra gates |
| **High** | Serious pattern; review before release |
| **Medium** | May be safe with proper server checks |
| **Low / Info** | Style or defense-in-depth suggestions |

Always verify context — some patterns are false positives in admin-only or internal resources.

## Related

- [Resource Doctor](./resource-doctor.md)
- [Releases](./releases.md) — block release on new critical findings
- [CLI Reference — security](./cli-reference.md#security)
