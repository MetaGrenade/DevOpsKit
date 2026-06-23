import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

async function bootDashboard(page: Page, theme: "light" | "dark" = "dark") {
  await page.addInitScript((mode) => {
    localStorage.setItem("fdt.theme", mode);
  }, theme);

  await page.goto("/");
  await expect(page.getByText("FiveM DevOps Toolkit").first()).toBeVisible({
    timeout: 15_000,
  });
}

async function openModule(page: Page, label: string) {
  await page.getByRole("button", { name: "Open command palette" }).click();
  await page.getByRole("textbox", { name: "Search commands" }).fill(label.toLowerCase());
  await page.keyboard.press("Enter");
}

test.describe("workspace switcher", () => {
  test("lists the sample workspace and opens the switcher menu", async ({ page }) => {
    await bootDashboard(page);
    await expect(page.getByText("Sample FiveM Server").first()).toBeVisible({ timeout: 15_000 });

    await page.locator(".workspace-switcher-trigger").click();
    await expect(page.getByRole("listbox", { name: "Registered workspaces" })).toBeVisible();
    await expect(page.getByRole("option", { name: /Sample FiveM Server/i })).toBeVisible();
  });

  test("manage workspaces navigates to the workspaces module", async ({ page }) => {
    await bootDashboard(page);
    await page.locator(".workspace-switcher-trigger").click();
    await page.getByRole("button", { name: "Manage workspaces" }).click();
    await expect(page.getByRole("heading", { name: "Workspaces", level: 1 })).toBeVisible();
  });
});

test.describe("items content smoke", () => {
  test("creates and removes a neutral item", async ({ page }) => {
    const itemId = `e2e_item_${Date.now()}`;

    await bootDashboard(page);
    await openModule(page, "Items");

    await expect(page.getByRole("heading", { name: "Item Workbench", level: 1 })).toBeVisible();

    await page.getByPlaceholder("water_bottle").fill(itemId);
    await page.getByPlaceholder("Water Bottle").fill("E2E Test Item");
    await page.getByRole("button", { name: "Save item" }).click();

    await expect(page.locator("tr", { hasText: itemId })).toBeVisible({ timeout: 10_000 });

    await page.locator("tr", { hasText: itemId }).getByRole("button", { name: "Delete" }).click();
    await expect(page.locator("tr", { hasText: itemId })).toHaveCount(0, { timeout: 10_000 });
  });
});

test.describe("saved table views", () => {
  test("persists a filter and saved view after creating an item", async ({ page }) => {
    const itemId = `e2e_view_${Date.now()}`;

    await bootDashboard(page);
    await openModule(page, "Items");

    await page.getByPlaceholder("water_bottle").fill(itemId);
    await page.getByPlaceholder("Water Bottle").fill("View Test Item");
    await page.getByRole("button", { name: "Save item" }).click();
    await expect(page.locator("tr", { hasText: itemId })).toBeVisible({ timeout: 10_000 });

    const filterInput = page.getByRole("searchbox", { name: "Filter item registry" });
    await filterInput.fill(itemId);
    await expect(filterInput).toHaveValue(itemId);

    await page.getByRole("button", { name: "Views" }).click();
    await page.locator(".saved-views-add").click();
    await page.getByPlaceholder("View name…").fill("E2E view");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator(".saved-views-item-label", { hasText: "E2E view" })).toBeVisible();

    await filterInput.fill("");
    await page.locator(".saved-views-item-label", { hasText: "E2E view" }).click();
    await expect(filterInput).toHaveValue(itemId);

    await page.locator("tr", { hasText: itemId }).getByRole("button", { name: "Delete" }).click();
    await expect(page.locator("tr", { hasText: itemId })).toHaveCount(0, { timeout: 10_000 });
  });
});
