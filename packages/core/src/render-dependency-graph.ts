import type { DependencyGraphReport } from "@fdt/schemas";

function escapeDot(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function renderDependencyGraphDot(graph: DependencyGraphReport): string {
  const lines = ["digraph fdt_dependency_graph {", '  rankdir="LR";', "  node [shape=box];"];

  for (const node of graph.nodes) {
    const shape = node.type === "event" ? "ellipse" : node.type === "file" ? "note" : "box";
    lines.push(`  "${escapeDot(node.id)}" [label="${escapeDot(node.label)}" shape=${shape}];`);
  }

  for (const edge of graph.edges) {
    lines.push(
      `  "${escapeDot(edge.source)}" -> "${escapeDot(edge.target)}" [label="${escapeDot(edge.type)}"];`,
    );
  }

  lines.push("}");
  return `${lines.join("\n")}\n`;
}

export function renderDependencyGraphHtml(graph: DependencyGraphReport): string {
  const rows = graph.edges
    .slice(0, 500)
    .map(
      (edge) =>
        `<tr><td>${edge.type}</td><td>${edge.source.replace(/^resource:/, "")}</td><td>${edge.target.replace(/^(resource|event|file|external_resource):/, "")}</td></tr>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>FDT Dependency Graph — ${graph.workspaceName}</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 2rem; background: #0b1020; color: #e2e8f0; }
    table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
    th, td { border: 1px solid #334155; padding: 0.5rem 0.75rem; text-align: left; }
    th { background: #111831; }
  </style>
</head>
<body>
  <h1>Dependency Graph</h1>
  <p>${graph.workspaceName} · ${graph.summary.resources} resources · ${graph.summary.edges} edges</p>
  <ul>
    <li>${graph.summary.dependencyEdges} dependency edges</li>
    <li>${graph.summary.fileReferenceEdges} manifest file references</li>
    <li>${graph.summary.eventEdges} Lua event edges</li>
  </ul>
  <table>
    <thead><tr><th>Type</th><th>Source</th><th>Target</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}
