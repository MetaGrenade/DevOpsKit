import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  browseDirectory,
  browseFilesystemRoots,
  FILESYSTEM_ROOTS_PATH,
  getFilesystemRoots,
  getParentPath,
} from "./browse.js";

describe("filesystem browse", () => {
  it("returns at least one root", () => {
    const roots = getFilesystemRoots();
    expect(roots.length).toBeGreaterThan(0);
  });

  it("lists directories from the temp folder", async () => {
    const listing = await browseDirectory(os.tmpdir(), "all");
    expect(listing.path).toBe(path.resolve(os.tmpdir()));
    expect(listing.scope).toBe("directory");
    expect(Array.isArray(listing.entries)).toBe(true);
  });

  it("returns a virtual drive picker on Windows", async () => {
    if (process.platform !== "win32") {
      return;
    }

    const listing = await browseFilesystemRoots();
    expect(listing.path).toBe(FILESYSTEM_ROOTS_PATH);
    expect(listing.scope).toBe("roots");
    expect(listing.entries.length).toBeGreaterThan(0);
  });

  it("uses the drive picker as parent for drive roots on Windows", () => {
    if (process.platform !== "win32" || getFilesystemRoots().length <= 1) {
      return;
    }

    const driveRoot = getFilesystemRoots()[0]!.path;
    expect(getParentPath(driveRoot)).toBe(FILESYSTEM_ROOTS_PATH);
  });
});
