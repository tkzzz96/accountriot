import { test, expect, ensureLeads } from "./fixtures";

test.describe("Leads", () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await ensureLeads(page);
  });

  test("leads list page loads", async ({ authedPage: page }) => {
    await page.goto("/leads");
    await expect(page.getByRole("heading", { name: "Leads", exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Buscar leads", exact: true })).toBeVisible();
  });

  test("search narrows results and is kept in the URL", async ({ authedPage: page }) => {
    await page.goto("/leads");
    await expect(page.locator("a[href^='/leads/']").first()).toBeVisible({ timeout: 10000 });
    await page.getByRole("textbox", { name: "Buscar leads", exact: true }).fill("__no_match_xyz_12345__");
    await expect(page.getByText("Nenhum lead encontrado")).toBeVisible({ timeout: 8000 });
    await expect(page).toHaveURL(/q=__no_match_xyz_12345__/);
  });

  test("the header search jumps to the filtered leads list", async ({ authedPage: page }) => {
    await page.goto("/dashboard");
    await page.getByRole("search").getByRole("textbox").fill("barbearia");
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/leads\?q=barbearia/);
    await expect(page.locator("a[href^='/leads/']").first()).toBeVisible({ timeout: 10000 });
  });

  test("site status filter narrows the list to leads without a site", async ({ authedPage: page }) => {
    await page.goto("/leads");
    await page.getByLabel("Situação do site").click();
    await page.getByRole("option", { name: "Sem site" }).click();
    await expect(page).toHaveURL(/siteStatus=NONE/);
    await expect(page.locator("a[href^='/leads/']").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Tem site", { exact: true })).toHaveCount(0);
  });

  test("lead detail opens from the list and shows the prospector card", async ({ authedPage: page }) => {
    await page.goto("/leads");
    await page.locator("a[href^='/leads/']").first().click();
    await page.waitForURL(/\/leads\/[a-z0-9]+$/);
    await expect(page.getByTestId("prospector-card")).toBeVisible({ timeout: 15000 });
  });

  test("update CRM status on the lead detail page", async ({ authedPage: page }) => {
    await page.goto("/leads");
    await page.locator("a[href^='/leads/']").first().click();
    await page.waitForURL(/\/leads\/[a-z0-9]+$/);
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Contatado" }).click();
    await page.getByRole("button", { name: "Atualizar status" }).click();
    await expect(page.getByText("Status atualizado").first()).toBeVisible({ timeout: 8000 });
  });

  test("bulk action moves several leads at once", async ({ authedPage: page }) => {
    await page.goto("/leads");
    await expect(page.locator("a[href^='/leads/']").first()).toBeVisible({ timeout: 10000 });
    await page.getByTestId("select-all").check();
    await expect(page.getByTestId("bulk-bar")).toBeVisible();
    await page.getByTestId("bulk-status").click();
    await page.getByRole("option", { name: "Respondeu" }).click();
    await expect(page.getByText(/lead\(s\) atualizado\(s\)/).first()).toBeVisible({ timeout: 8000 });
    await page.goto("/leads?status=replied");
    await expect(page.locator("a[href^='/leads/']").first()).toBeVisible({ timeout: 10000 });
  });

  test("bulk delete asks for confirmation and removes the selected leads", async ({ authedPage: page }) => {
    await page.goto("/leads?status=replied");
    await expect(page.locator("a[href^='/leads/']").first()).toBeVisible({ timeout: 10000 });
    page.once("dialog", (d) => void d.accept());
    await page.getByTestId("select-all").check();
    await page.getByTestId("bulk-delete").click();
    await expect(page.getByText(/lead\(s\) excluído\(s\)/).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Nenhum lead encontrado")).toBeVisible({ timeout: 8000 });
  });
});
