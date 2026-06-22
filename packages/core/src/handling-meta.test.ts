import { describe, expect, it } from "vitest";
import {
  compareHandlingMetrics,
  parseHandlingMeta,
  parseVehicleDisplayName,
  parseVehicleModelNames,
} from "./handling-meta.js";

const handlingMeta = `<?xml version="1.0" encoding="UTF-8"?>
<CHandlingDataMgr>
  <HandlingData>
    <Item>
      <handlingName>meta_cvpi</handlingName>
      <fMass value="1800.000000" />
      <fInitialDriveMaxFlatVel value="145.000000" />
      <fBrakeForce value="0.900000" />
      <fTractionCurveMax value="2.450000" />
    </Item>
  </HandlingData>
</CHandlingDataMgr>`;

const vehiclesMeta = `<?xml version="1.0" encoding="UTF-8"?>
<CVehicleModelInfo__InitDataList>
  <InitDatas>
    <Item>
      <modelName>meta_cvpi</modelName>
      <gameName>CVPI</gameName>
      <vehicleMakeName>Vapid</vehicleMakeName>
    </Item>
  </InitDatas>
</CVehicleModelInfo__InitDataList>`;

describe("handling-meta", () => {
  it("parses model names and display labels from meta files", () => {
    expect(parseVehicleModelNames(vehiclesMeta)).toEqual(["meta_cvpi"]);
    expect(parseVehicleDisplayName(vehiclesMeta, "meta_cvpi")).toBe("Vapid CVPI");
  });

  it("parses handling metrics and compares deltas", () => {
    const baseline = parseHandlingMeta(handlingMeta, "meta_cvpi");
    const target = {
      ...baseline,
      driveMaxFlatVel: 151,
      brakeForce: 1.1,
    };

    const { deltas, notes } = compareHandlingMetrics(baseline, target);
    expect(deltas.driveMaxFlatVel).toBe(6);
    expect(deltas.brakeForce).toBeCloseTo(0.2);
    expect(notes.some((note) => note.includes("flat velocity"))).toBe(true);
  });
});
