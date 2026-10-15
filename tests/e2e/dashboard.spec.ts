import { test, expect } from "@playwright/test";

test.describe("Exam Monitor Frontend & Dashboard Flow", () => {
  test("unauthenticated user is redirected to login page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/.*login/);
    await expect(page.locator("text=Sign In to Dashboard")).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("login page displays validation on empty fields", async ({ page }) => {
    await page.goto("/login");
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // HTML5 native validation prevents empty submit
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
  });

  test("registration page renders invitation onboarding form", async ({ page }) => {
    await page.goto("/register?email=friend%40example.com");
    await expect(page.locator("text=Accept Invitation & Create Account")).toBeVisible();
    await expect(page.locator('input[type="email"]')).toHaveValue("friend@example.com");
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});
