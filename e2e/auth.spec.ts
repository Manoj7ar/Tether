import { expect, test } from "@playwright/test";
import { installSupabaseMocks } from "./support/mockSupabase";

test.beforeEach(async ({ page }) => {
  await installSupabaseMocks(page);
});

test("protects private routes and supports sign-out", async ({ page }) => {
  await page.goto("/settings");

  await expect(page).toHaveURL(/\/auth$/);
  await page.getByRole("button", { name: "Continue with Auth0" }).click();

  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
});
