import { useState } from "react";
import { nuiFetch } from "./nui";

interface Coords {
  x: number;
  y: number;
  z: number;
}

interface Blip {
  id: string;
  label: string;
  sprite: number;
  color: number;
  scale: number;
  coords: Coords;
}

interface PropPlacement {
  id: string;
  label: string;
  model: string;
  coords: Coords & { w?: number };
}

interface Door {
  id: string;
  label: string;
  model?: string;
  group?: string;
  locked: boolean;
  coords: Coords & { w?: number };
}

type WorldTab = "blips" | "props" | "doors";

interface WorldToolsPanelProps {
  activeTab: WorldTab;
  coords: Coords;
  heading: number;
  blips: Blip[];
  props: PropPlacement[];
  doors: Door[];
  exportPreview: string;
  status: string | null;
  onStatus: (message: string) => void;
}

const defaultBlipForm = { id: "", label: "", sprite: "52", color: "2", scale: "0.8" };
const defaultPropForm = { id: "", label: "", model: "prop_cs_box_clothes" };
const defaultDoorForm = { id: "", label: "", model: "", group: "", locked: true };

export default function WorldToolsPanel({
  activeTab,
  coords,
  heading,
  blips,
  props,
  doors,
  exportPreview,
  status,
  onStatus,
}: WorldToolsPanelProps) {
  const [blipForm, setBlipForm] = useState(defaultBlipForm);
  const [propForm, setPropForm] = useState(defaultPropForm);
  const [doorForm, setDoorForm] = useState(defaultDoorForm);

  async function createBlip() {
    await nuiFetch("createBlip", {
      id: blipForm.id || blipForm.label,
      label: blipForm.label || blipForm.id,
      sprite: Number(blipForm.sprite) || 1,
      color: Number(blipForm.color) || 0,
      scale: Number(blipForm.scale) || 0.8,
      coords: { x: coords.x, y: coords.y, z: coords.z },
      shortRange: true,
    });
    onStatus("Blip saved to session.");
    setBlipForm(defaultBlipForm);
    await nuiFetch("requestWorld");
  }

  async function createProp() {
    await nuiFetch("createProp", {
      id: propForm.id || propForm.label,
      label: propForm.label || propForm.id,
      model: propForm.model,
      coords: { x: coords.x, y: coords.y, z: coords.z, w: heading },
    });
    onStatus("Prop spawned in session.");
    setPropForm(defaultPropForm);
    await nuiFetch("requestWorld");
  }

  async function createDoor() {
    await nuiFetch("createDoor", {
      id: doorForm.id || doorForm.label,
      label: doorForm.label || doorForm.id,
      model: doorForm.model || undefined,
      group: doorForm.group || undefined,
      locked: doorForm.locked,
      coords: { x: coords.x, y: coords.y, z: coords.z, w: heading },
    });
    onStatus("Door record saved to session.");
    setDoorForm(defaultDoorForm);
    await nuiFetch("requestWorld");
  }

  async function deleteBlip(id: string) {
    await nuiFetch("deleteBlip", { id });
    onStatus(`Removed blip ${id}.`);
    await nuiFetch("requestWorld");
  }

  async function deleteProp(id: string) {
    await nuiFetch("deleteProp", { id });
    onStatus(`Removed prop ${id}.`);
    await nuiFetch("requestWorld");
  }

  async function deleteDoor(id: string) {
    await nuiFetch("deleteDoor", { id });
    onStatus(`Removed door ${id}.`);
    await nuiFetch("requestWorld");
  }

  async function exportWorld() {
    await nuiFetch("exportWorld");
  }

  if (activeTab === "blips") {
    return (
      <>
        <h3 style={{ marginTop: 20 }}>Create Blip</h3>
        <label>
          ID
          <input value={blipForm.id} onChange={(e) => setBlipForm({ ...blipForm, id: e.target.value })} />
        </label>
        <label>
          Label
          <input value={blipForm.label} onChange={(e) => setBlipForm({ ...blipForm, label: e.target.value })} />
        </label>
        <div className="grid-2">
          <label>
            Sprite
            <input value={blipForm.sprite} onChange={(e) => setBlipForm({ ...blipForm, sprite: e.target.value })} />
          </label>
          <label>
            Color
            <input value={blipForm.color} onChange={(e) => setBlipForm({ ...blipForm, color: e.target.value })} />
          </label>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" onClick={() => void createBlip()}>
            Add blip here
          </button>
          <button type="button" onClick={() => void exportWorld()}>
            Export world JSON
          </button>
        </div>
        <h3 style={{ marginTop: 20 }}>Session Blips ({blips.length})</h3>
        <div className="zone-list">
          {blips.map((blip) => (
            <article key={blip.id} className="zone-card">
              <strong>{blip.label}</strong>
              <div className="mono">{blip.id}</div>
              <div className="status">
                sprite {blip.sprite} · color {blip.color}
              </div>
              <button type="button" className="danger" style={{ marginTop: 8 }} onClick={() => void deleteBlip(blip.id)}>
                Delete
              </button>
            </article>
          ))}
        </div>
        {status && <p className="status">{status}</p>}
        {exportPreview && <textarea readOnly rows={10} value={exportPreview} />}
      </>
    );
  }

  if (activeTab === "props") {
    return (
      <>
        <h3 style={{ marginTop: 20 }}>Spawn Prop</h3>
        <label>
          ID
          <input value={propForm.id} onChange={(e) => setPropForm({ ...propForm, id: e.target.value })} />
        </label>
        <label>
          Label
          <input value={propForm.label} onChange={(e) => setPropForm({ ...propForm, label: e.target.value })} />
        </label>
        <label>
          Model
          <input value={propForm.model} onChange={(e) => setPropForm({ ...propForm, model: e.target.value })} />
        </label>
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" onClick={() => void createProp()}>
            Spawn at current position
          </button>
          <button type="button" onClick={() => void exportWorld()}>
            Export world JSON
          </button>
        </div>
        <h3 style={{ marginTop: 20 }}>Session Props ({props.length})</h3>
        <div className="zone-list">
          {props.map((prop) => (
            <article key={prop.id} className="zone-card">
              <strong>{prop.label}</strong>
              <div className="mono">{prop.model}</div>
              <button type="button" className="danger" style={{ marginTop: 8 }} onClick={() => void deleteProp(prop.id)}>
                Delete
              </button>
            </article>
          ))}
        </div>
        {status && <p className="status">{status}</p>}
        {exportPreview && <textarea readOnly rows={10} value={exportPreview} />}
      </>
    );
  }

  return (
    <>
      <h3 style={{ marginTop: 20 }}>Place Door</h3>
      <label>
        ID
        <input value={doorForm.id} onChange={(e) => setDoorForm({ ...doorForm, id: e.target.value })} />
      </label>
      <label>
        Label
        <input value={doorForm.label} onChange={(e) => setDoorForm({ ...doorForm, label: e.target.value })} />
      </label>
      <label>
        Model (optional)
        <input value={doorForm.model} onChange={(e) => setDoorForm({ ...doorForm, model: e.target.value })} />
      </label>
      <label>
        Group (optional)
        <input value={doorForm.group} onChange={(e) => setDoorForm({ ...doorForm, group: e.target.value })} />
      </label>
      <label>
        <input
          type="checkbox"
          checked={doorForm.locked}
          onChange={(e) => setDoorForm({ ...doorForm, locked: e.target.checked })}
        />{" "}
        Locked by default
      </label>
      <div className="row" style={{ marginTop: 12 }}>
        <button type="button" onClick={() => void createDoor()}>
          Add door here
        </button>
        <button type="button" onClick={() => void exportWorld()}>
          Export world JSON
        </button>
      </div>
      <h3 style={{ marginTop: 20 }}>Session Doors ({doors.length})</h3>
      <div className="zone-list">
        {doors.map((door) => (
          <article key={door.id} className="zone-card">
            <strong>{door.label}</strong>
            <div className="mono">{door.id}</div>
            <div className="status">{door.locked ? "locked" : "unlocked"}</div>
            <button type="button" className="danger" style={{ marginTop: 8 }} onClick={() => void deleteDoor(door.id)}>
              Delete
            </button>
          </article>
        ))}
      </div>
      {status && <p className="status">{status}</p>}
      {exportPreview && <textarea readOnly rows={10} value={exportPreview} />}
    </>
  );
}
