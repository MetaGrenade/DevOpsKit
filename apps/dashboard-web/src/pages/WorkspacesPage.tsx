import { useEffect, useState } from "react";
import PathPicker from "../components/PathPicker";
import { fetchWorkspaces, selectWorkspace as selectWorkspaceApi } from "../lib/workspaces";
import type { CreateWorkspacePayload, WorkspaceWithConfig } from "../types/api";

const emptyForm: CreateWorkspacePayload = {
  name: "",
  workspaceDirectory: "",
  serverRoot: "",
  resourcesRoot: "",
  serverCfg: "",
};

function pathStatus(ok: boolean): string {
  return ok ? "text-emerald-300" : "text-rose-300";
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
    <section className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-[#111831] p-6">
        <h2 className="text-xl font-semibold">Workspaces</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          Point FiveM DevOps Toolkit at any FiveM server directory on your machine. Use Browse to pick
          folders and files directly instead of typing paths manually.
        </p>
        {message && <p className="mt-4 text-sm text-cyan-200">{message}</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleCreate}
          className="rounded-2xl border border-white/10 bg-[#111831] p-6 space-y-4"
        >
          <h3 className="font-medium">Create New Workspace</h3>
          <p className="text-sm text-slate-400">
            Creates a workspace directory with config and output folders on disk.
          </p>

          <label className="block text-sm">
            <span className="text-slate-300">Display name</span>
            <input
              required
              value={form.name}
              onChange={(event) => updateForm("name", event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
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

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-500/30 disabled:opacity-50"
          >
            Create workspace
          </button>
        </form>

        <form
          onSubmit={handleRegister}
          className="rounded-2xl border border-white/10 bg-[#111831] p-6 space-y-4"
        >
          <h3 className="font-medium">Register Existing Workspace</h3>
          <p className="text-sm text-slate-400">
            Use this if you already ran <code className="rounded bg-white/5 px-1 py-0.5">fdt init</code>{" "}
            in an external server folder.
          </p>

          <PathPicker
            label="Workspace directory"
            value={registerPath}
            onChange={setRegisterPath}
            mode="directory"
            placeholder="E:/FiveMServers/fdt"
            required
          />

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm text-slate-100 hover:bg-white/15 disabled:opacity-50"
          >
            Register workspace
          </button>

          <button
            type="button"
            onClick={() => validateActive().catch(() => setMessage("Validation failed"))}
            className="block rounded-lg border border-cyan-500/30 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-500/10"
          >
            Validate active workspace
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#111831] p-6">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-medium">Registered Workspaces</h3>
          {status === "loading" && <span className="text-xs text-slate-400">Loading…</span>}
        </div>

        {status === "error" && (
          <p className="mt-4 text-sm text-rose-300">Failed to load workspaces from the API.</p>
        )}

        <div className="mt-4 space-y-4">
          {workspaces.map((workspace) => {
            const isActive = workspace.id === activeWorkspaceId;
            return (
              <article
                key={workspace.id}
                className={`rounded-xl border p-4 ${isActive ? "border-cyan-500/40 bg-cyan-500/5" : "border-white/10 bg-[#0b1020]"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="font-medium">{workspace.name}</h4>
                    <p className="mt-1 font-mono text-xs text-slate-400">{workspace.directory}</p>
                  </div>
                  <div className="flex gap-2">
                    {!isActive && (
                      <button
                        type="button"
                        onClick={() => selectWorkspace(workspace.id)}
                        className="rounded-lg bg-white/10 px-3 py-1.5 text-xs hover:bg-white/15"
                      >
                        Select
                      </button>
                    )}
                    {isActive && (
                      <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-xs text-cyan-200">
                        Active
                      </span>
                    )}
                  </div>
                </div>

                <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">Resources</dt>
                    <dd className={`font-mono ${pathStatus(workspace.pathChecks.resourcesRoot)}`}>
                      {workspace.resolvedPaths.resourcesRoot}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">server.cfg</dt>
                    <dd className={`font-mono ${pathStatus(workspace.pathChecks.serverCfg)}`}>
                      {workspace.resolvedPaths.serverCfg}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Server root</dt>
                    <dd className={`font-mono ${pathStatus(workspace.pathChecks.serverRoot)}`}>
                      {workspace.resolvedPaths.serverRoot}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Report output</dt>
                    <dd className="font-mono text-slate-300">{workspace.resolvedPaths.reportPath}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">FXServer artifact</dt>
                    <dd
                      className={
                        workspace.serverArtifact ? "font-mono text-emerald-300" : "text-slate-400"
                      }
                      title={workspace.serverArtifact?.path}
                    >
                      {workspace.serverArtifact
                        ? `Build ${workspace.serverArtifact.build.toLocaleString()}`
                        : "Not detected"}
                    </dd>
                    {workspace.serverArtifact && (
                      <dd className="mt-1 text-[11px] text-slate-500">
                        via {artifactSourceLabel(workspace.serverArtifact.source)}
                      </dd>
                    )}
                  </div>
                  {workspace.frameworkProfile && (
                    <>
                      <div>
                        <dt className="text-slate-500">Framework</dt>
                        <dd className="text-cyan-200">{workspace.frameworkProfile.framework}</dd>
                        <dd className="mt-1 text-[11px] text-slate-500">
                          {frameworkSourceLabel(workspace.frameworkProfile.source)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Inventory</dt>
                        <dd className="text-cyan-200">{workspace.frameworkProfile.inventory}</dd>
                        {workspace.frameworkProfile.detectedResources.length > 0 && (
                          <dd className="mt-1 text-[11px] text-slate-500">
                            {workspace.frameworkProfile.detectedResources.join(", ")}
                          </dd>
                        )}
                      </div>
                    </>
                  )}
                </dl>

                {isActive && workspace.frameworkProfile && (
                  <div className="mt-4 rounded-lg border border-white/10 bg-[#111831] p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Framework override</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="block text-xs">
                        <span className="text-slate-400">Framework</span>
                        <select
                          defaultValue={workspace.frameworkProfile.framework}
                          onChange={(event) =>
                            void updateActiveFramework({ framework: event.target.value })
                          }
                          disabled={submitting}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-2 py-1.5"
                        >
                          {["custom", "qbox", "qbcore", "esx", "ox"].map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-xs">
                        <span className="text-slate-400">Inventory</span>
                        <select
                          defaultValue={workspace.frameworkProfile.inventory}
                          onChange={(event) =>
                            void updateActiveFramework({ inventory: event.target.value })
                          }
                          disabled={submitting}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-2 py-1.5"
                        >
                          {["custom", "ox-inventory", "qbcore", "esx"].map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => void updateActiveFramework({ clearManualOverride: true })}
                        className="rounded-lg border border-white/10 px-3 py-1 text-xs hover:bg-white/5 disabled:opacity-50"
                      >
                        Reset to auto-detect
                      </button>
                      <span className="text-xs text-slate-500">
                        Recommended adapters: {workspace.frameworkProfile.recommendedAdapters.join(", ")}
                      </span>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
