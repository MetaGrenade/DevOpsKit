import { describe, expect, it } from "vitest";
import { ClothingPackSchema } from "./clothing.js";

describe("ClothingPackSchema", () => {
  it("parses a clothing pack with drawables", () => {
    const pack = ClothingPackSchema.parse({
      id: "meta_jackets",
      label: "Meta Jackets",
      resourceName: "meta_clothing_a",
      drawables: [
        {
          id: "meta_jacket_001",
          category: "tops",
          gender: "male",
          fileName: "mp_m_freemode_01^meta_jacket_001.ydd",
          relativePath: "stream/mp_m_freemode_01^meta_jacket_001.ydd",
          textures: [
            {
              id: "tex_001",
              fileName: "mp_m_freemode_01^meta_jacket_001.ytd",
              relativePath: "stream/mp_m_freemode_01^meta_jacket_001.ytd",
            },
          ],
        },
      ],
    });

    expect(pack.drawables).toHaveLength(1);
    expect(pack.drawables[0]?.textures).toHaveLength(1);
  });
});
