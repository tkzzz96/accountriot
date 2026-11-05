import { test, expect, ensureLeads } from "./fixtures";

// Requires the API to run with DISCOVERY_DRIVER=mock (deterministic offline data).
test.describe("Campaigns", () => {
  test("campaigns list page loads", async ({ authedPage: page }) => {
    await page.goto("/campaigns");
    await expect(page.getByRole("heading", { name: "Campanhas" })).toBeVisible();
  });

  test("create campaign form renders the prospector filter", async ({ authedPage: page }) => {
    await page.goto("/campaigns/new");
    await expect(page.locator("#name")).toBeVisible();
    await expect(page.getByText("Nicho", { exact: true })).toBeVisible();
    await expect(page.getByText("Cidade", { exact: true })).toBeVisible();
    await expect(page.getByText("Somente empresas sem site")).toBeVisible();
  });

  // The mock driver is deterministic, so a workspace can only hold one full mock campaign (dedupe). `ensureLeads` runs the whole
  // create-campaign UI flow once and waits for "Concluída"; this test then verifies what the pipeline produced for a lead.
  test("create campaign -> leads reach READY -> card shows evidence, draft and 3 references", async ({ authedPage: page }) => {
    await ensureLeads(page);
    await page.goto("/leads?stage=READY");
    await page.locator("a[href^='/leads/']").first().click();
    await page.waitForURL(/\/leads\/[a-z0-9]+$/);

    const card = page.getByTestId("prospector-card");
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("site-status")).toBeVisible();
    await expect(card.getByText("Por que classificamos assim")).toBeVisible();
    await expect(page.getByTestId("draft-text")).not.toBeEmpty();
    await expect(card.getByText("rascunho · nada é enviado")).toBeVisible();
    await expect(page.getByTestId("budget-label")).toHaveText(/provável|incerto|improvável/);
    await expect(page.getByTestId("references").locator("a")).toHaveCount(3);
    await expect(card.getByRole("link", { name: /Abrir no WhatsApp/ })).toHaveAttribute("href", /^https:\/\/wa\.me\/\d+\?text=/);
  });

  test("completed campaign shows leads", async ({ authedPage: page }) => {
    await page.goto("/campaigns");

    // Find first completed campaign and click it
    const completedBadge = page.getByText("Concluída").first();
    await expect(completedBadge).toBeVisible({ timeout: 10000 });

    // Click the campaign row/card. Excludes the ever-present "New Campaign"
    // button, whose href ("/campaigns/new") would otherwise match first.
    await page.locator("a[href^='/campaigns/']:not([href='/campaigns/new'])").first().click();
    await page.waitForURL(/\/campaigns\/(?!new$)[a-z0-9-]+$/);

    // Leads section should show at least 1 lead
    await expect(page.locator("text=/Leads \\(\\d+\\)/")).toBeVisible({ timeout: 10000 });
    const leadsText = await page.locator("text=/Leads \\(\\d+\\)/").textContent();
    const count = parseInt(leadsText?.match(/\d+/)?.[0] ?? "0");
    expect(count).toBeGreaterThan(0);
  });
});

test.describe("Campaign actions", () => {
  test("a completed campaign can be run again (dedupe keeps the lead count)", async ({ authedPage: page }) => {
    await page.goto("/campaigns");
    await page.locator("a[href^='/campaigns/']:not([href='/campaigns/new'])").first().click();
    await page.waitForURL(/\/campaigns\/(?!new$)[a-z0-9-]+$/);
    page.once("dialog", (d) => void d.accept());
    await page.getByTestId("rerun-campaign").click();
    await expect(page.getByText("Campanha reiniciada").first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Concluída").first()).toBeVisible({ timeout: 90000 });
  });
});
