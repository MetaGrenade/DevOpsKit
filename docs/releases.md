# Releases

The Release Manager tracks release candidates, QA status, changelogs, bundles, and deployment checklists for your server workspace.

## Concepts

| Term | Meaning |
| --- | --- |
| **Release candidate** | Snapshot tied to validation reports at a point in time |
| **Status** | Workflow state: draft → qa-ready → qa-approved → deployed |
| **Bundle** | Exportable folder of artifacts for a version |
| **Diff** | Compare resources/reports between two versions |
| **Checklist** | Generated QA/deploy steps for a release |

Metadata stores under `<workspace>/.fdt/releases/`.

## CLI workflow

```bash
# Create candidate from current reports
fdt release create --workspace <path>

# Advance status
fdt release mark --status qa-ready --workspace <path>

# Compare versions
fdt release diff --from 1.0.0 --to 1.1.0 --workspace <path>

# Generate checklist
fdt release checklist --workspace <path>

# Export bundle
fdt release bundle --out ./bundle-out --workspace <path>
```

## Dashboard

**Releases** page shows:

- Release history and current status
- Linked validation/security/QA report summaries
- Actions to create, mark status, diff, and export

Run Resource Doctor, Security, and QA validation before creating a candidate so the release record reflects current quality gates.

## Recommended gate order

```txt
validate resources → security scan → qa validate → release create
```

Or use:

```bash
fdt ci run --workspace <path>
```

## Bundles

Bundles collect reports, export manifests, and metadata needed for handoff to staging/production. Output path is configurable; default uses `.fdt/exports/releases/<version>/`.

Review bundle contents before deploying — FDT never pushes to remote servers automatically.

## Related

- [QA Scenarios](./qa-scenarios.md)
- [Security Auditor](./security-auditor.md)
- [CLI Reference — release](./cli-reference.md#release)
