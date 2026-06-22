import { useEffect, useState } from "react";
import {
  EmptyState,
  PageAlert,
  PageIntro,
  PageStack,
  Panel,
} from "../components/ui/page";
import type { WorkspaceWithConfig } from "../types/api";

interface Vehicle {
  spawnName: string;
  displayName: string;
  category: string;
  price?: number;
  shop?: string;
}

interface Business {
  id: string;
  label: string;
  type: string;
  zoneId?: string;
}

interface MapChecklistItem {
  id: string;
  label: string;
  passed: boolean;
  required: boolean;
}

interface MapPackage {
  id: string;
  label: string;
  resourceName: string;
  status: string;
  checklist: MapChecklistItem[];
}

interface ZoneOption {
  id: string;
  label: string;
  purpose: string;
}

interface Job {
  id: string;
  label: string;
  type: string;
  zoneId?: string;
  grades: Array<{ level: number; label: string }>;
}

interface Gang {
  id: string;
  label: string;
  type: string;
  zoneIds: string[];
  territoryIds: string[];
}

interface ExportFile {
  relativePath: string;
  content: string;
}

const EMPTY_VEHICLE = {
  spawnName: "",
  displayName: "",
  category: "car",
  price: "",
  shop: "",
};

const EMPTY_MAP = {
  id: "",
  label: "",
  resourceName: "",
};

type Tab = "vehicles" | "businesses" | "jobs" | "gangs" | "maps";

export default function DomainsPage() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceWithConfig | null>(null);
  const [tab, setTab] = useState<Tab>("vehicles");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [gangs, setGangs] = useState<Gang[]>([]);
  const [maps, setMaps] = useState<MapPackage[]>([]);
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [vehicleForm, setVehicleForm] = useState(EMPTY_VEHICLE);
  const [mapForm, setMapForm] = useState(EMPTY_MAP);
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [exportPreview, setExportPreview] = useState<ExportFile[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    setMessage(null);

    try {
      const wsRes = await fetch("/api/v1/workspaces/active");
      if (wsRes.status === 404) {
        setActiveWorkspace(null);
        return;
      }
      if (!wsRes.ok) throw new Error("Failed to load active workspace");
      setActiveWorkspace((await wsRes.json()) as WorkspaceWithConfig);

      const [vehiclesRes, businessesRes, jobsRes, gangsRes, mapsRes, zonesRes] = await Promise.all([
        fetch("/api/v1/domains/vehicles"),
        fetch("/api/v1/domains/businesses"),
        fetch("/api/v1/domains/jobs"),
        fetch("/api/v1/domains/gangs"),
        fetch("/api/v1/domains/maps"),
        fetch("/api/v1/zones"),
      ]);

      if (vehiclesRes.ok) {
        setVehicles(((await vehiclesRes.json()) as { vehicles: Vehicle[] }).vehicles);
      }
      if (businessesRes.ok) {
        setBusinesses(((await businessesRes.json()) as { businesses: Business[] }).businesses);
      }
      if (jobsRes.ok) {
        setJobs(((await jobsRes.json()) as { jobs: Job[] }).jobs);
      }
      if (gangsRes.ok) {
        setGangs(((await gangsRes.json()) as { gangs: Gang[] }).gangs);
      }
      if (mapsRes.ok) {
        setMaps(((await mapsRes.json()) as { maps: MapPackage[] }).maps);
      }
      if (zonesRes.ok) {
        const data = (await zonesRes.json()) as { zones: ZoneOption[] };
        setZones(data.zones);
        if (data.zones[0]) setSelectedZoneId(data.zones[0].id);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function saveVehicle(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/v1/domains/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spawnName: vehicleForm.spawnName.trim(),
        displayName: vehicleForm.displayName.trim(),
        category: vehicleForm.category,
        price: vehicleForm.price ? Number(vehicleForm.price) : undefined,
        shop: vehicleForm.shop.trim() || undefined,
        metadata: {},
      }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { message?: string };
      setMessage(payload.message ?? "Failed to save vehicle");
      return;
    }

    setVehicleForm(EMPTY_VEHICLE);
    setMessage(`Saved vehicle ${vehicleForm.spawnName}`);
    await loadData();
  }

  async function createBusinessFromZone() {
    if (!selectedZoneId) return;
    const response = await fetch("/api/v1/domains/businesses/from-zone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zoneId: selectedZoneId }),
    });

    const payload = (await response.json()) as { message?: string; business?: Business };
    if (!response.ok) {
      setMessage(payload.message ?? "Failed to create business from zone");
      return;
    }

    setMessage(`Created business ${payload.business?.id ?? ""} from zone ${selectedZoneId}`);
    await loadData();
  }

  async function createJobFromZone() {
    if (!selectedZoneId) return;
    const response = await fetch("/api/v1/domains/jobs/from-zone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zoneId: selectedZoneId }),
    });

    const payload = (await response.json()) as { message?: string; job?: Job };
    if (!response.ok) {
      setMessage(payload.message ?? "Failed to create job from zone");
      return;
    }

    setMessage(`Created job ${payload.job?.id ?? ""} from zone ${selectedZoneId}`);
    await loadData();
  }

  async function createGangFromZone() {
    if (!selectedZoneId) return;
    const response = await fetch("/api/v1/domains/gangs/from-zone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zoneId: selectedZoneId }),
    });

    const payload = (await response.json()) as { message?: string; gang?: Gang };
    if (!response.ok) {
      setMessage(payload.message ?? "Failed to create gang from zone");
      return;
    }

    setMessage(`Created gang ${payload.gang?.id ?? ""} from zone ${selectedZoneId}`);
    await loadData();
  }

  async function createMap(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/v1/domains/maps/new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mapForm),
    });

    const payload = (await response.json()) as { message?: string };
    if (!response.ok) {
      setMessage(payload.message ?? "Failed to create map package");
      return;
    }

    setMapForm(EMPTY_MAP);
    setMessage(`Created map package ${mapForm.id}`);
    await loadData();
  }

  async function refreshChecklist(mapId: string) {
    const response = await fetch(`/api/v1/domains/maps/${encodeURIComponent(mapId)}/checklist`, {
      method: "POST",
    });

    if (!response.ok) {
      const payload = (await response.json()) as { message?: string };
      setMessage(payload.message ?? "Failed to refresh checklist");
      return;
    }

    setMessage(`Refreshed checklist for ${mapId}`);
    await loadData();
  }

  async function previewExport() {
    const response = await fetch("/api/v1/domains/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adapter: "custom-json", dryRun: true }),
    });

    if (!response.ok) {
      setMessage("Export preview failed");
      return;
    }

    const payload = (await response.json()) as { files: ExportFile[] };
    setExportPreview(payload.files);
  }

  if (loading) {
    return (
      <PageStack>
        <p className="panel-subtext">Loading domain builders…</p>
      </PageStack>
    );
  }

  if (!activeWorkspace) {
    return (
      <PageStack>
        <EmptyState
          title="Domain Builders"
          description="Select an active workspace to manage vehicles, businesses, and maps."
        />
      </PageStack>
    );
  }

  return (
    <PageStack>
      <PageIntro
        title="Domain Builders"
        description={
          <>
            Manage vehicles, businesses, jobs, gangs, and map/MLO release checklists derived from devtools zones.
            Export through custom-json or QBCore adapters to{" "}
            <code className="inline-code">.fdt/exports/</code>.
          </>
        }
      />

      <Panel className="panel-compact">
        <div className="tab-row">
          {(["vehicles", "businesses", "jobs", "gangs", "maps"] as Tab[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`tab-btn capitalize ${tab === item ? "tab-btn-active" : ""}`}
            >
              {item}
            </button>
          ))}
          <button type="button" onClick={() => void previewExport()} className="btn btn-secondary btn-sm">
            Preview export
          </button>
        </div>
        {message && <PageAlert>{message}</PageAlert>}
      </Panel>

      {tab === "vehicles" && (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Panel className="panel-compact">
            <h3 className="panel-heading">Add Vehicle</h3>
            <form className="form-stack panel-section" onSubmit={saveVehicle}>
              <label className="form-field">
                <span className="form-label">Spawn name</span>
                <input
                  required
                  value={vehicleForm.spawnName}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, spawnName: e.target.value })}
                  className="form-control"
                />
              </label>
              <label className="form-field">
                <span className="form-label">Display name</span>
                <input
                  required
                  value={vehicleForm.displayName}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, displayName: e.target.value })}
                  className="form-control"
                />
              </label>
              <label className="form-field">
                <span className="form-label">Category</span>
                <input
                  value={vehicleForm.category}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, category: e.target.value })}
                  className="form-control"
                />
              </label>
              <button type="submit" className="btn btn-accent btn-sm">
                Save vehicle
              </button>
            </form>
          </Panel>
          <Panel className="panel-compact">
            <h3 className="panel-heading">Vehicle Registry ({vehicles.length})</h3>
            <div className="panel-section space-y-2">
              {vehicles.map((vehicle) => (
                <article key={vehicle.spawnName} className="finding-card text-sm">
                  <div className="font-medium">{vehicle.displayName}</div>
                  <div className="text-xs text-[var(--color-muted)]">
                    {vehicle.spawnName} · {vehicle.category}
                  </div>
                </article>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {tab === "businesses" && (
        <Panel className="panel-compact">
          <h3 className="panel-heading">Businesses from Zones</h3>
          <p className="panel-subtext">
            Import a zone exported from the devtools overlay to create a business location record.
          </p>
          <div className="btn-row panel-section">
            <label className="form-field">
              <span className="form-label">Zone</span>
              <select
                value={selectedZoneId}
                onChange={(e) => setSelectedZoneId(e.target.value)}
                className="form-control"
              >
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.label} ({zone.purpose})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void createBusinessFromZone()}
              className="btn btn-accent btn-sm"
            >
              Create business from zone
            </button>
          </div>
          <div className="panel-section space-y-2">
            {businesses.map((business) => (
              <article key={business.id} className="finding-card text-sm">
                <div className="font-medium">{business.label}</div>
                <div className="text-xs text-[var(--color-muted)]">
                  {business.id} · {business.type}
                  {business.zoneId ? ` · zone ${business.zoneId}` : ""}
                </div>
              </article>
            ))}
          </div>
        </Panel>
      )}

      {tab === "jobs" && (
        <Panel className="panel-compact">
          <h3 className="panel-heading">Jobs from Zones</h3>
          <p className="panel-subtext">
            Create a job record with a default grade and duty location from a devtools zone export.
          </p>
          <div className="btn-row panel-section">
            <label className="form-field">
              <span className="form-label">Zone</span>
              <select
                value={selectedZoneId}
                onChange={(e) => setSelectedZoneId(e.target.value)}
                className="form-control"
              >
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.label} ({zone.purpose})
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => void createJobFromZone()} className="btn btn-accent btn-sm">
              Create job from zone
            </button>
          </div>
          <div className="panel-section space-y-2">
            {jobs.map((job) => (
              <article key={job.id} className="finding-card text-sm">
                <div className="font-medium">{job.label}</div>
                <div className="text-xs text-[var(--color-muted)]">
                  {job.id} · {job.type} · {job.grades.length} grades
                  {job.zoneId ? ` · zone ${job.zoneId}` : ""}
                </div>
              </article>
            ))}
          </div>
        </Panel>
      )}

      {tab === "gangs" && (
        <Panel className="panel-compact">
          <h3 className="panel-heading">Gangs & Territories from Zones</h3>
          <p className="panel-subtext">
            Build gang or territory records from territory-purpose zones exported in-game.
          </p>
          <div className="btn-row panel-section">
            <label className="form-field">
              <span className="form-label">Zone</span>
              <select
                value={selectedZoneId}
                onChange={(e) => setSelectedZoneId(e.target.value)}
                className="form-control"
              >
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.label} ({zone.purpose})
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => void createGangFromZone()} className="btn btn-accent btn-sm">
              Create gang from zone
            </button>
          </div>
          <div className="panel-section space-y-2">
            {gangs.map((gang) => (
              <article key={gang.id} className="finding-card text-sm">
                <div className="font-medium">{gang.label}</div>
                <div className="text-xs text-[var(--color-muted)]">
                  {gang.id} · {gang.type} · {gang.territoryIds.length} territories
                </div>
              </article>
            ))}
          </div>
        </Panel>
      )}

      {tab === "maps" && (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Panel className="panel-compact">
            <h3 className="panel-heading">New Map Package</h3>
            <form className="form-stack panel-section" onSubmit={createMap}>
              <label className="form-field">
                <span className="form-label">ID</span>
                <input
                  required
                  value={mapForm.id}
                  onChange={(e) => setMapForm({ ...mapForm, id: e.target.value })}
                  className="form-control"
                />
              </label>
              <label className="form-field">
                <span className="form-label">Label</span>
                <input
                  required
                  value={mapForm.label}
                  onChange={(e) => setMapForm({ ...mapForm, label: e.target.value })}
                  className="form-control"
                />
              </label>
              <label className="form-field">
                <span className="form-label">Resource name</span>
                <input
                  required
                  value={mapForm.resourceName}
                  onChange={(e) => setMapForm({ ...mapForm, resourceName: e.target.value })}
                  className="form-control"
                />
              </label>
              <button type="submit" className="btn btn-accent btn-sm">
                Create checklist
              </button>
            </form>
          </Panel>
          <Panel className="panel-compact">
            <h3 className="panel-heading">Map Packages ({maps.length})</h3>
            <div className="panel-section space-y-3">
              {maps.map((mapPackage) => (
                <article key={mapPackage.id} className="finding-card text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{mapPackage.label}</div>
                      <div className="text-xs text-[var(--color-muted)]">
                        {mapPackage.resourceName} · {mapPackage.status}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void refreshChecklist(mapPackage.id)}
                      className="btn btn-secondary btn-sm"
                    >
                      Refresh checklist
                    </button>
                  </div>
                  <ul className="list-plain mt-2 text-xs text-[var(--color-muted)]">
                    {mapPackage.checklist.map((item) => (
                      <li key={item.id} className={item.passed ? "path-ok" : ""}>
                        [{item.passed ? "x" : " "}] {item.label}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {exportPreview && (
        <Panel className="panel-compact">
          <h3 className="panel-heading">Export Preview</h3>
          {exportPreview.map((file) => (
            <div key={file.relativePath} className="panel-section">
              <h4 className="text-sm font-medium text-[var(--color-accent-ink)]">{file.relativePath}</h4>
              <pre className="code-block mt-2">{file.content}</pre>
            </div>
          ))}
        </Panel>
      )}
    </PageStack>
  );
}
