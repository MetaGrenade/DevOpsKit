import { useState } from "react";
import { nuiFetch } from "./nui";

interface StateBagEntry {
  key: string;
  value: unknown;
  replicated?: boolean;
  lastUpdatedMs?: number;
  updateCount?: number;
  stale?: boolean;
}

interface StateBagSnapshot {
  target: {
    kind: string;
    bagName: string;
    entityId?: number;
    networkId?: number;
    model?: string;
  };
  entries: StateBagEntry[];
  watchedKeys: string[];
}

interface StateBagPanelProps {
  snapshot: StateBagSnapshot | null;
  targetMode: string;
  status: string | null;
  exportPreview: string;
  onClose: () => void;
}

export default function StateBagPanel({
  snapshot,
  targetMode,
  status,
  exportPreview,
  onClose,
}: StateBagPanelProps) {
  const [watchKey, setWatchKey] = useState("");

  async function setTarget(mode: "player" | "vehicle" | "crosshair") {
    await nuiFetch("stateBagSetTarget", { mode });
  }

  async function addWatchKey() {
    if (!watchKey.trim()) {
      return;
    }
    await nuiFetch("stateBagWatchKey", { key: watchKey.trim() });
    setWatchKey("");
  }

  async function exportSnapshot() {
    await nuiFetch("stateBagExport");
  }

  return (
    <>
      <button type="button" className="close-btn" onClick={() => void onClose()}>
        Close (Esc)
      </button>

      <div className="overlay">
        <section className="panel">
          <h2>State Bag Visualizer</h2>
          <p className="status">Inspect replicated player, vehicle, or crosshair entity state.</p>

          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className={targetMode === "player" ? "active" : ""} onClick={() => void setTarget("player")}>
              Player
            </button>
            <button type="button" className={targetMode === "vehicle" ? "active" : ""} onClick={() => void setTarget("vehicle")}>
              Vehicle
            </button>
            <button type="button" className={targetMode === "crosshair" ? "active" : ""} onClick={() => void setTarget("crosshair")}>
              Crosshair
            </button>
          </div>

          {snapshot && (
            <div className="status" style={{ marginTop: 12 }}>
              <div className="mono">{snapshot.target.bagName}</div>
              <div>
                {snapshot.target.kind}
                {snapshot.target.networkId ? ` · net ${snapshot.target.networkId}` : ""}
                {snapshot.target.model ? ` · model ${snapshot.target.model}` : ""}
              </div>
            </div>
          )}

          <label style={{ marginTop: 16 }}>
            Watch key
            <div className="row">
              <input value={watchKey} onChange={(e) => setWatchKey(e.target.value)} placeholder="job" />
              <button type="button" onClick={() => void addWatchKey()}>
                Add
              </button>
            </div>
          </label>

          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" onClick={() => void exportSnapshot()}>
              Export JSON
            </button>
          </div>

          {status && <p className="status">{status}</p>}
        </section>

        <section className="panel">
          <h3>State entries ({snapshot?.entries.length ?? 0})</h3>
          <div className="zone-list">
            {!snapshot || snapshot.entries.length === 0 ? (
              <p className="status">No state entries yet. Add watch keys or move around to capture updates.</p>
            ) : (
              snapshot.entries.map((entry) => (
                <article key={entry.key} className="zone-card">
                  <strong>{entry.key}</strong>
                  <div className="mono">{JSON.stringify(entry.value)}</div>
                  <div className="status">
                    {entry.stale ? "stale · " : ""}
                    updates {entry.updateCount ?? 0}
                    {entry.replicated === false ? " · local" : ""}
                  </div>
                </article>
              ))
            )}
          </div>

          {exportPreview && (
            <>
              <h3 style={{ marginTop: 16 }}>Export Preview</h3>
              <textarea readOnly rows={10} value={exportPreview} />
            </>
          )}
        </section>
      </div>
    </>
  );
}
