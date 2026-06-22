import { useEffect, useMemo, useState } from "react";
import { nuiFetch } from "./nui";
import QaPanel from "./QaPanel";
import StateBagPanel from "./StateBagPanel";
import WorldToolsPanel from "./WorldToolsPanel";

interface Coords {
  x: number;
  y: number;
  z: number;
}

interface Zone {
  id: string;
  label: string;
  type: "sphere" | "box" | "poly";
  purpose: string;
  coords: Coords[];
  heading?: number;
  radius?: number;
  width?: number;
  length?: number;
  metadata: Record<string, unknown>;
}

interface QaScenario {
  id: string;
  label: string;
  category: string;
  preconditions: string[];
  steps: Array<{
    id: string;
    type: string;
    label: string;
    coords?: { x: number; y: number; z: number; heading?: number };
  }>;
  expectedResults: string[];
}

interface QaRun {
  id: string;
  scenarioId: string;
  scenarioLabel?: string;
  status: string;
  stepResults: Array<{ stepId: string; status: string; note?: string }>;
}

interface StateBagSnapshot {
  target: {
    kind: string;
    bagName: string;
    entityId?: number;
    networkId?: number;
    model?: string;
  };
  entries: Array<{
    key: string;
    value: unknown;
    replicated?: boolean;
    lastUpdatedMs?: number;
    updateCount?: number;
    stale?: boolean;
  }>;
  watchedKeys: string[];
}

interface ExportResult {
  ok: boolean;
  message: string;
  payload?: unknown;
}

type ToolTab = "zones" | "blips" | "props" | "doors";

interface WorldBlip {
  id: string;
  label: string;
  sprite: number;
  color: number;
  scale: number;
  coords: Coords;
}

interface WorldProp {
  id: string;
  label: string;
  model: string;
  coords: Coords & { w?: number };
}

interface WorldDoor {
  id: string;
  label: string;
  model?: string;
  group?: string;
  locked: boolean;
  coords: Coords & { w?: number };
}

const defaultForm = {
  id: "",
  label: "",
  type: "sphere" as Zone["type"],
  purpose: "custom",
  radius: "2.5",
  width: "4",
  length: "4",
};

export default function App() {
  const [visible, setVisible] = useState(false);
  const [qaVisible, setQaVisible] = useState(false);
  const [stateBagVisible, setStateBagVisible] = useState(false);
  const [coords, setCoords] = useState<Coords>({ x: 0, y: 0, z: 0 });
  const [heading, setHeading] = useState(0);
  const [vector3, setVector3] = useState("vector3(0, 0, 0)");
  const [vector4, setVector4] = useState("vector4(0, 0, 0, 0)");
  const [zones, setZones] = useState<Zone[]>([]);
  const [blips, setBlips] = useState<WorldBlip[]>([]);
  const [props, setProps] = useState<WorldProp[]>([]);
  const [doors, setDoors] = useState<WorldDoor[]>([]);
  const [activeTab, setActiveTab] = useState<ToolTab>("zones");
  const [qaScenarios, setQaScenarios] = useState<QaScenario[]>([]);
  const [activeScenario, setActiveScenario] = useState<QaScenario | null>(null);
  const [activeRun, setActiveRun] = useState<QaRun | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [status, setStatus] = useState<string | null>(null);
  const [qaStatus, setQaStatus] = useState<string | null>(null);
  const [exportPreview, setExportPreview] = useState("");
  const [worldExportPreview, setWorldExportPreview] = useState("");
  const [qaExportPreview, setQaExportPreview] = useState("");
  const [stateBagSnapshot, setStateBagSnapshot] = useState<StateBagSnapshot | null>(null);
  const [stateBagTargetMode, setStateBagTargetMode] = useState("player");
  const [stateBagStatus, setStateBagStatus] = useState<string | null>(null);
  const [stateBagExportPreview, setStateBagExportPreview] = useState("");

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data as {
        type?: string;
        visible?: boolean;
        coords?: Coords;
        heading?: number;
        vector3?: string;
        vector4?: string;
        zones?: Zone[];
        scenarios?: QaScenario[];
        result?: ExportResult & { run?: QaRun; scenario?: QaScenario };
        snapshot?: StateBagSnapshot;
        targetMode?: string;
        tab?: ToolTab;
      };

      const anyVisible = Boolean(data.visible) || qaVisible || stateBagVisible;

      if (data.type === "visible") {
        setVisible(Boolean(data.visible));
        if (data.visible) {
          setQaVisible(false);
          setStateBagVisible(false);
        }
        document.body.classList.toggle("hidden", !anyVisible);
      }

      if (data.type === "qaVisible") {
        setQaVisible(Boolean(data.visible));
        if (data.visible) {
          setVisible(false);
          setStateBagVisible(false);
        }
        document.body.classList.toggle("hidden", !(Boolean(data.visible) || visible || stateBagVisible));
      }

      if (data.type === "stateBagVisible") {
        setStateBagVisible(Boolean(data.visible));
        if (data.visible) {
          setVisible(false);
          setQaVisible(false);
        }
        document.body.classList.toggle("hidden", !(Boolean(data.visible) || visible || qaVisible));
      }

      if (data.type === "stateBagSnapshot" && data.snapshot) {
        setStateBagSnapshot(data.snapshot);
        if (data.targetMode) {
          setStateBagTargetMode(data.targetMode);
        }
      }

      if (data.type === "stateBagExportResult" && data.result) {
        setStateBagStatus(data.result.message);
        if (data.result.payload) {
          setStateBagExportPreview(JSON.stringify(data.result.payload, null, 2));
        }
      }

      if (data.type === "openTab" && data.tab) {
        setActiveTab(data.tab);
      }

      if (data.type === "coords" && data.coords) {
        setCoords(data.coords);
        setHeading(data.heading ?? 0);
        setVector3(data.vector3 ?? "");
        setVector4(data.vector4 ?? "");
      }

      if (data.type === "zones" && data.zones) {
        setZones(data.zones);
      }

      if (data.type === "blips" && data.blips) {
        setBlips(data.blips as WorldBlip[]);
      }

      if (data.type === "props" && data.props) {
        setProps(data.props as WorldProp[]);
      }

      if (data.type === "doors" && data.doors) {
        setDoors(data.doors as WorldDoor[]);
      }

      if (data.type === "qaScenarios" && data.scenarios) {
        setQaScenarios(data.scenarios);
      }

      if (data.type === "qaRunUpdated" && data.result) {
        if (data.result.run) {
          setActiveRun(data.result.run);
        }
        if (data.result.scenario) {
          setActiveScenario(data.result.scenario);
        }
        if (data.result.message) {
          setQaStatus(data.result.message);
        }
      }

      if (data.type === "exportResult" && data.result) {
        setStatus(data.result.message);
        if (data.result.payload) {
          setExportPreview(JSON.stringify(data.result.payload, null, 2));
        }
      }

      if (data.type === "worldExportResult" && data.result) {
        setStatus(data.result.message);
        if (data.result.payload) {
          setWorldExportPreview(JSON.stringify(data.result.payload, null, 2));
        }
      }

      if (data.type === "qaExportResult" && data.result) {
        setQaStatus(data.result.message);
        if (data.result.payload) {
          setQaExportPreview(JSON.stringify(data.result.payload, null, 2));
        }
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [qaVisible, visible, stateBagVisible]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && (visible || qaVisible || stateBagVisible)) {
        void closeOverlay();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible, qaVisible, stateBagVisible]);

  const coordSummary = useMemo(
    () => `${coords.x.toFixed(2)}, ${coords.y.toFixed(2)}, ${coords.z.toFixed(2)}`,
    [coords],
  );

  async function closeOverlay() {
    const closingQa = qaVisible;
    const closingStateBag = stateBagVisible;
    setVisible(false);
    setQaVisible(false);
    setStateBagVisible(false);
    document.body.classList.add("hidden");
    if (closingStateBag) {
      await nuiFetch("stateBagClose");
      return;
    }
    await nuiFetch(closingQa ? "qaClose" : "close");
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("Copied to clipboard.");
      await nuiFetch("copyText", { value });
    } catch {
      setStatus("Clipboard copy failed in NUI.");
    }
  }

  async function createZone() {
    const payload = {
      id: form.id || form.label,
      label: form.label || form.id,
      type: form.type,
      purpose: form.purpose,
      coords: [coords],
      heading,
      radius: Number(form.radius),
      width: Number(form.width),
      length: Number(form.length),
    };

    await nuiFetch("createZone", payload);
    setStatus("Zone saved to session.");
    setForm(defaultForm);
    await nuiFetch("requestZones");
  }

  async function deleteZone(id: string) {
    await nuiFetch("deleteZone", { id });
    setStatus(`Removed zone ${id}.`);
    await nuiFetch("requestZones");
  }

  async function exportZones() {
    await nuiFetch("exportZones");
  }

  if (stateBagVisible) {
    return (
      <StateBagPanel
        snapshot={stateBagSnapshot}
        targetMode={stateBagTargetMode}
        status={stateBagStatus}
        exportPreview={stateBagExportPreview}
        onClose={() => void closeOverlay()}
      />
    );
  }

  if (qaVisible) {
    return (
      <QaPanel
        scenarios={qaScenarios}
        activeScenario={activeScenario}
        activeRun={activeRun}
        status={qaStatus}
        exportPreview={qaExportPreview}
        onClose={() => void closeOverlay()}
      />
    );
  }

  if (!visible) {
    return null;
  }

  return (
    <>
      <button type="button" className="close-btn" onClick={() => void closeOverlay()}>
        Close (Esc)
      </button>

      <div className="overlay">
        <section className="panel">
          <h2>FDT DevTools</h2>
          <p className="mono">{coordSummary}</p>
          <p className="mono">heading: {heading.toFixed(2)}</p>

          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" onClick={() => void copyText(vector3)}>
              Copy vector3
            </button>
            <button type="button" onClick={() => void copyText(vector4)}>
              Copy vector4
            </button>
          </div>

          <div className="row" style={{ marginTop: 16 }}>
            {(["zones", "blips", "props", "doors"] as ToolTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                className={activeTab === tab ? "active-tab" : undefined}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "zones" ? (
            <>
          <h3 style={{ marginTop: 20 }}>Create Zone</h3>
          <label>
            ID
            <input
              value={form.id}
              onChange={(e) => setForm({ ...form, id: e.target.value })}
              placeholder="shop_downtown"
            />
          </label>
          <label>
            Label
            <input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="Downtown Shop"
            />
          </label>
          <div className="grid-2">
            <label>
              Type
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as Zone["type"] })}
              >
                <option value="sphere">sphere</option>
                <option value="box">box</option>
              </select>
            </label>
            <label>
              Purpose
              <select
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              >
                {["shop", "stash", "garage", "interaction", "territory", "job", "event", "custom"].map(
                  (purpose) => (
                    <option key={purpose} value={purpose}>
                      {purpose}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>

          {form.type === "sphere" ? (
            <label>
              Radius
              <input value={form.radius} onChange={(e) => setForm({ ...form, radius: e.target.value })} />
            </label>
          ) : (
            <div className="grid-2">
              <label>
                Width
                <input value={form.width} onChange={(e) => setForm({ ...form, width: e.target.value })} />
              </label>
              <label>
                Length
                <input value={form.length} onChange={(e) => setForm({ ...form, length: e.target.value })} />
              </label>
            </div>
          )}

          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" onClick={() => void createZone()}>
              Add at current position
            </button>
            <button type="button" onClick={() => void exportZones()}>
              Export JSON
            </button>
          </div>

          {status && <p className="status">{status}</p>}
            </>
          ) : (
            <WorldToolsPanel
              activeTab={activeTab}
              coords={coords}
              heading={heading}
              blips={blips}
              props={props}
              doors={doors}
              exportPreview={worldExportPreview}
              status={status}
              onStatus={setStatus}
            />
          )}
        </section>

        <section className="panel">
          {activeTab === "zones" ? (
            <>
          <h3>Session Zones ({zones.length})</h3>
          <div className="zone-list">
            {zones.length === 0 ? (
              <p className="status">No zones yet. Stand where you want the zone and click add.</p>
            ) : (
              zones.map((zone) => (
                <article key={zone.id} className="zone-card">
                  <strong>{zone.label}</strong>
                  <div className="mono">{zone.id}</div>
                  <div className="status">
                    {zone.type} · {zone.purpose}
                  </div>
                  <button
                    type="button"
                    className="danger"
                    style={{ marginTop: 8 }}
                    onClick={() => void deleteZone(zone.id)}
                  >
                    Delete
                  </button>
                </article>
              ))
            )}
          </div>

          {exportPreview && (
            <>
              <h3 style={{ marginTop: 16 }}>Export Preview</h3>
              <textarea readOnly rows={12} value={exportPreview} />
            </>
          )}
            </>
          ) : (
            <>
              <h3>World Tools</h3>
              <p className="status">
                Use /fdt_blip, /fdt_prop, or /fdt_door to jump directly to a tab. Export writes blips, props, and
                doors to JSON for dashboard import.
              </p>
              {worldExportPreview && (
                <>
                  <h3 style={{ marginTop: 16 }}>World Export Preview</h3>
                  <textarea readOnly rows={12} value={worldExportPreview} />
                </>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
