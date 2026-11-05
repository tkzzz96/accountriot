import { test, expect } from "./fixtures";

test.describe("Language", () => {
  test("switching to English translates the app and persists after reload", async ({ authedPage: page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /@prospex\.test/ }).click();
    await page.getByTestId("lang-en").click();
    await expect(page.getByRole("link", { name: "Campaigns" }).first()).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.goto("/integrations");
    await expect(page.getByRole("heading", { name: "Integrations" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Integrations" })).toBeVisible();

    // restore the default for the other specs
    await page.getByRole("button", { name: /@prospex\.test/ }).click();
    await page.getByTestId("lang-pt-BR").click();
    await expect(page.getByRole("link", { name: "Campanhas" }).first()).toBeVisible();
  });
});
