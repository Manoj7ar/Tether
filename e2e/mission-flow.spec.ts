import { expect, test } from "@playwright/test";
import { installSupabaseMocks } from "./support/mockSupabase";

test.setTimeout(60_000);

test.beforeEach(async ({ page }) => {
  await installSupabaseMocks(page);
});

test("creates and approves a mission", async ({ page }) => {
  await page.goto("/mission/new");
  await page.getByRole("button", { name: "Continue with Auth0" }).click();

  await expect(page).toHaveURL(/\/mission\/new$/);
  await page.getByPlaceholder(/Triage my open GitHub issues/i).fill("Summarize open GitHub issues and email the team");
  await page.getByRole("button", { name: /Generate Manifest/i }).click();

  await expect(page.getByRole("heading", { name: "Mission Manifest" })).toBeVisible();
  await page.getByRole("button", { name: /Request Approval/i }).click();

  await expect(page).toHaveURL(/\/mission\/mission-1$/);
  await page.getByRole("button", { name: /Approve Mission/i }).click();

  await expect(page.getByText(/Agent is authorized to act/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Complete Mission/i })).toBeVisible();
});
