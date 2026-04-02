import { expect, test } from "@playwright/test";
import { installSupabaseMocks } from "./support/mockSupabase";

test.beforeEach(async ({ page }) => {
  await installSupabaseMocks(page);
});

test("connects an account through the Auth0 token-vault flow", async ({ page }) => {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "Continue with Auth0" }).click();

  await expect(page).toHaveURL(/\/accounts$/);
  await page.getByRole("button", { name: /GitHub/i }).click();

  await expect(page.getByText(/Account connected/i).first()).toBeVisible();
  await expect(page.getByText(/operator@tether\.test/i).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Disconnect" })).toBeVisible();
  await expect(page.getByText(/Auth0-backed token exchange/i)).toBeVisible();
});
