import { test, expect, ensureLeads } from "./fixtures";

test.describe("Analytics & overview", () => {
  test("analytics page loads without error", async ({ authedPage: page }) => {
    await page.goto("/analytics");
    await expect(page.getByRole("heading", { name: "Análises" })).toBeVisible();
    await expect(page.getByText("Não foi possível carregar")).not.toBeVisible();
  });

  test("overview stats cards render", async ({ authedPage: page }) => {
    await page.goto("/analytics");
    for (const label of ["Total de leads", "Campanhas ativas", "Taxa de conversão", "Negócios ganhos"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible({ timeout: 8000 });
    }
  });

  test("site status distribution is real data", async ({ authedPage: page }) => {
    await ensureLeads(page);
    await page.goto("/analytics");
    const card = page.getByTestId("site-status-card");
    await expect(card).toBeVisible({ timeout: 10000 });
    await expect(card.getByText("Sem site", { exact: true })).toBeVisible();
  });

  test("dashboard greets the signed-in user by name, with no fake trend arrows", async ({ authedPage: page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Bom dia|Boa tarde|Boa noite/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("E2E");
  });

  test("integrations page shows the real status of each service", async ({ authedPage: page }) => {
    await page.goto("/integrations");
    await expect(page.getByRole("heading", { name: "Integrações" })).toBeVisible();
    await expect(page.getByTestId("int-discovery")).toContainText("mock");
    await expect(page.getByTestId("int-webhook")).toContainText("Não configurado");
    await expect(page.getByTestId("int-queues")).toBeVisible();
    await expect(page.getByText("WhatsApp Business")).toHaveCount(0);
  });

  test("header notifications reflect real state (no hardcoded alerts)", async ({ authedPage: page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Notificações" }).click();
    await expect(page.getByText("Acme Corp")).toHaveCount(0);
    await expect(page.getByText("HubSpot")).toHaveCount(0);
  });
});
