import { useEffect, useState } from "react";
import PathPicker from "../components/PathPicker";
import { PageAlert, PageIntro, PageStack, Panel } from "../components/ui/page";
import { fetchWorkspaces, selectWorkspace as selectWorkspaceApi } from "../lib/workspaces";
import type { CreateWorkspacePayload, WorkspaceWithConfig } from "../types/api";

const emptyForm: CreateWorkspacePayload = {
  name: "",
  workspaceDirectory: "",
  serverRoot: "",
  resourcesRoot: "",
  serverCfg: "",
};

function pathStatusClass(ok: boolean): string {
  return ok ? "path-ok" : "path-bad";
}

function artifactSourceLabel(
  source: NonNullable<WorkspaceWithConfig["serverArtifact"]>["source"],
): string {
  switch (source) {
    case "workspace.config":
      return "workspace config";
    case "fxserver-artifact-version":
      return "txAdmin artifact file";
    case "citizen-version-json":
      return "citizen/version.json";
  }
}

function frameworkSourceLabel(source: NonNullable<WorkspaceWithConfig["frameworkProfile"]>["source"]): string {
  switch (source) {
    case "manual":
      return "manual override";
    case "mixed":
      return "manual + detected";
    default:
      return "auto-detected";
  }
}

export default function WorkspacesPage({ onWorkspaceChanged }: { onWorkspaceChanged?: () => void }) {
  const [workspaces, setWorkspaces] = useState<WorkspaceWithConfig[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateWorkspacePayload>(emptyForm);
  const [registerPath, setRegisterPath] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadWorkspaces() {
    setStatus("loading");
    const data = await fetchWorkspaces();
    setWorkspaces(data.workspaces);
    setActiveWorkspaceId(data.activeWorkspaceId);
    setStatus("ready");
  }

  useEffect(() => {
    loadWorkspaces().catch(() => setStatus("error"));
  }, []);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/v1/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "Failed to create workspace");
      }

      setForm(emptyForm);
      setMessage(`Created workspace at ${payload.workspace.directory}`);
      await loadWorkspaces();
      onWorkspaceChanged?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create workspace");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/v1/workspaces/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceDirectory: registerPath }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "Failed to register workspace");
      }

      setRegisterPath("");
      setMessage(`Registered workspace ${payload.workspace.name}`);
      await loadWorkspaces();
      onWorkspaceChanged?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to register workspace");
    } finally {
      setSubmitting(false);
    }
  }

  async function selectWorkspace(id: string) {
    setMessage(null);
    try {
      const workspace = await selectWorkspaceApi(id);
      setMessage(`Active workspace: ${workspace.name}`);
      await loadWorkspaces();
      onWorkspaceChanged?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to select workspace");
    }
  }

  async function validateActive() {
    setMessage(null);
    const response = await fetch("/api/v1/workspaces/active/validate", { method: "POST" });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.message ?? "Validation failed");
      return;
    }
    setMessage(
      `Validated ${payload.summary.resourcesScanned} resources (${payload.summary.errors} errors, ${payload.summary.warnings} warnings)`,
    );
  }

  async function updateActiveFramework(input: {
    framework?: string;
    inventory?: string;
    clearManualOverride?: boolean;
  }) {
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/workspaces/active/framework", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "Failed to update framework profile");
      }
      setMessage("Framework profile updated");
      await loadWorkspaces();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update framework profile");
    } finally {
      setSubmitting(false);
    }
  }

  function updateForm<K extends keyof CreateWorkspacePayload>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function autofillFromDirectory(directory: string) {
    const normalized = directory.replace(/\\/g, "/").replace(/\/$/, "");
    updateForm("workspaceDirectory", directory);
    updateForm("serverRoot", `${normalized}/server`);
    updateForm("resourcesRoot", `${normalized}/server/resources`);
    updateForm("serverCfg", `${normalized}/server/server.cfg`);
  }

  function handleWorkspaceDirectoryChange(directory: string) {
    updateForm("workspaceDirectory", directory);
    if (!form.serverRoot || form.serverRoot.startsWith(form.workspaceDirectory)) {
      autofillFromDirectory(directory);
    }
  }

  return (
    <PageStack>
      <PageIntro
        title="Workspaces"
        description="Point FiveM DevOps Toolkit at any FiveM server directory on your machine. Use Browse to pick folders and files directly instead of typing paths manually."
      />

      {message && <PageAlert>{message}</PageAlert>}

      <div className="page-grid-2">
        <Panel className="panel-compact">
          <form onSubmit={handleCreate} className="form-stack">
            <div>
              <h3 className="panel-heading">Create New Workspace</h3>
              <p className="panel-subtext">Creates a workspace directory with config and output folders on disk.</p>
            </div>

            <label className="form-field">
              <span className="form-label">Display name</span>
              <input
                required
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                className="form-control"
                placeholder="FiveM Dev Server"
              />
            </label>

            <PathPicker
              label="Workspace directory"
              value={form.workspaceDirectory}
              onChange={handleWorkspaceDirectoryChange}
              mode="directory"
              placeholder="E:/FiveMServers/fdt"
              required
            />

            <PathPicker
              label="Server root"
              value={form.serverRoot}
              onChange={(value) => updateForm("serverRoot", value)}
              mode="directory"
              placeholder="E:/FiveMServers/fdt/server"
              required
            />

            <PathPicker
              label="Resources folder"
              value={form.resourcesRoot}
              onChange={(value) => updateForm("resourcesRoot", value)}
              mode="directory"
              placeholder="E:/FiveMServers/fdt/server/resources"
              required
            />

            <PathPicker
              label="server.cfg path"
              value={form.serverCfg}
              onChange={(value) => updateForm("serverCfg", value)}
              mode="file"
              fileExtensions={[".cfg"]}
              placeholder="E:/FiveMServers/fdt/server/server.cfg"
              required
            />

            <button type="submit" disabled={submitting} className="btn btn-primary btn-sm">
              Create workspace
            </button>
          </form>
        </Panel>

        <Panel className="panel-compact">
          <form onSubmit={handleRegister} className="form-stack">
            <div>
              <h3 className="panel-heading">Register Existing Workspace</h3>
              <p className="panel-subtext">
                Use this if you already ran <code className="inline-code">fdt init</code> in an external server
                folder.
              </p>
            </div>

            <PathPicker
              label="Workspace directory"
              value={registerPath}
              onChange={setRegisterPath}
              mode="directory"
              placeholder="E:/FiveMServers/fdt"
              required
            />

            <div className="btn-row">
              <button type="submit" disabled={submitting} className="btn btn-secondary btn-sm">
                Register workspace
              </button>
              <button
                type="button"
                onClick={() => validateActive().catch(() => setMessage("Validation failed"))}
                className="btn btn-secondary btn-sm"
              >
                Validate active workspace
              </button>
            </div>
          </form>
        </Panel>
      </div>

      <Panel className="panel-compact">
        <div className="workspace-card-head">
          <h3 className="panel-heading">Registered Workspaces</h3>
          {status === "loading" && <span className="panel-subtext">Loading…</span>}
        </div>

        {status === "error" && <PageAlert variant="error">Failed to load workspaces from the API.</PageAlert>}

        <div className="panel-section space-y-3">
          {workspaces.map((workspace) => {
            const isActive = workspace.id === activeWorkspaceId;
            return (
              <article
                key={workspace.id}
                className={`workspace-card ${isActive ? "workspace-card-active" : ""}`}
              >
                <div className="workspace-card-head">
                  <div>
                    <h4 className="workspace-card-title">{workspace.name}</h4>
                    <p className="workspace-card-path">{workspace.directory}</p>
                  </div>
                  <div className="btn-row" style={{ marginTop: 0 }}>
                    {!isActive && (
                      <button
                        type="button"
                        onClick={() => selectWorkspace(workspace.id)}
                        className="btn btn-secondary btn-sm"
                      >
                        Select
                      </button>
                    )}
                    {isActive && <span className="status-pill status-pill-active">Active</span>}
                  </div>
                </div>

                <dl className="meta-grid">
                  <div>
                    <dt>Resources</dt>
                    <dd className={`font-mono ${pathStatusClass(workspace.pathChecks.resourcesRoot)}`}>
                      {workspace.resolvedPaths.resourcesRoot}
                    </dd>
                  </div>
                  <div>
                    <dt>server.cfg</dt>
                    <dd className={`font-mono ${pathStatusClass(workspace.pathChecks.serverCfg)}`}>
                      {workspace.resolvedPaths.serverCfg}
                    </dd>
                  </div>
                  <div>
                    <dt>Server root</dt>
                    <dd className={`font-mono ${pathStatusClass(workspace.pathChecks.serverRoot)}`}>
                      {workspace.resolvedPaths.serverRoot}
                    </dd>
                  </div>
                  <div>
                    <dt>Report output</dt>
                    <dd className="font-mono">{workspace.resolvedPaths.reportPath}</dd>
                  </div>
                  <div>
                    <dt>FXServer artifact</dt>
                    <dd
                      className={workspace.serverArtifact ? "font-mono path-ok" : "text-[var(--color-muted)]"}
                      title={workspace.serverArtifact?.path}
                    >
                      {workspace.serverArtifact
                        ? `Build ${workspace.serverArtifact.build.toLocaleString()}`
                        : "Not detected"}
                    </dd>
                    {workspace.serverArtifact && (
                      <dd className="mt-1 text-[11px] text-[var(--color-muted)]">
                        via {artifactSourceLabel(workspace.serverArtifact.source)}
                      </dd>
                    )}
                  </div>
                  {workspace.frameworkProfile && (
                    <>
                      <div>
                        <dt>Framework</dt>
                        <dd className="text-[var(--color-accent-ink)]">{workspace.frameworkProfile.framework}</dd>
                        <dd className="mt-1 text-[11px] text-[var(--color-muted)]">
                          {frameworkSourceLabel(workspace.frameworkProfile.source)}
                        </dd>
                      </div>
                      <div>
                        <dt>Inventory</dt>
                        <dd className="text-[var(--color-accent-ink)]">{workspace.frameworkProfile.inventory}</dd>
                        {workspace.frameworkProfile.detectedResources.length > 0 && (
                          <dd className="mt-1 text-[11px] text-[var(--color-muted)]">
                            {workspace.frameworkProfile.detectedResources.join(", ")}
                          </dd>
                        )}
                      </div>
                    </>
                  )}
                </dl>

                {isActive && workspace.frameworkProfile && (
                  <div className="panel-section rounded-lg border border-[var(--color-line)] bg-[var(--color-input-bg)] p-3">
                    <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Framework override</p>
                    <div className="form-grid form-grid-2 panel-section">
                      <label className="form-field text-xs">
                        <span className="form-label">Framework</span>
                        <select
                          defaultValue={workspace.frameworkProfile.framework}
                          onChange={(event) => void updateActiveFramework({ framework: event.target.value })}
                          disabled={submitting}
                          className="form-control"
                        >
                          {["custom", "qbox", "qbcore", "esx", "ox"].map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="form-field text-xs">
                        <span className="form-label">Inventory</span>
                        <select
                          defaultValue={workspace.frameworkProfile.inventory}
                          onChange={(event) => void updateActiveFramework({ inventory: event.target.value })}
                          disabled={submitting}
                          className="form-control"
                        >
                          {["custom", "ox-inventory", "qbcore", "esx"].map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="btn-row">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => void updateActiveFramework({ clearManualOverride: true })}
                        className="btn btn-secondary btn-sm"
                      >
                        Reset to auto-detect
                      </button>
                      <span className="text-xs text-[var(--color-muted)]">
                        Recommended adapters: {workspace.frameworkProfile.recommendedAdapters.join(", ")}
                      </span>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </Panel>
    </PageStack>
  );
}
