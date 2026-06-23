import { expect, test, type Page } from "@playwright/test";

async function bootDashboard(page: Page, theme: "light" | "dark") {
  await page.addInitScript((mode) => {
    localStorage.setItem("fdt.theme", mode);
  }, theme);

  await page.goto("/");
  await expect(page.getByText("FiveM DevOps Toolkit").first()).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("dashboard shell", () => {
  test("overview loads with onboarding checklist", async ({ page }) => {
    await bootDashboard(page, "dark");
    await expect(page.getByText(/Getting started/i).first()).toBeVisible();
    await expect(page.getByText(/Register a workspace|Run resource validation/i).first()).toBeVisible();
  });

  test("command palette opens and finds modules", async ({ page }) => {
    await bootDashboard(page, "dark");
    await page.getByRole("button", { name: "Open command palette" }).click();
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
    await page.getByRole("textbox", { name: "Search commands" }).fill("items");
    await expect(page.getByText("Items").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeHidden();
  });

  test("theme toggle switches to light mode", async ({ page }) => {
    await bootDashboard(page, "dark");
    await page.getByRole("button", { name: "Light theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
});

test.describe("visual snapshots", () => {
  test("overview light theme", async ({ page }) => {
    await bootDashboard(page, "light");
    await expect(page).toHaveScreenshot("overview-light.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  test("overview dark theme", async ({ page }) => {
    await bootDashboard(page, "dark");
    await expect(page).toHaveScreenshot("overview-dark.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});
