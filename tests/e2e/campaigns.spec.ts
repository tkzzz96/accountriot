import { test, expect } from "./fixtures";

const CAMPAIGN = {
  name: `E2E Campaign ${Date.now()}`,
  niche: "barbearia",
  city: "Curitiba",
  country: "Brasil",
};

// Requires the API to run with DISCOVERY_DRIVER=mock (deterministic offline data).
test.describe("Campaigns", () => {
  test("campaigns list page loads", async ({ authedPage: page }) => {
    await page.goto("/campaigns");
    await expect(page.getByRole("heading", { name: /campaigns/i })).toBeVisible();
  });

  test("create campaign form renders the prospector filter", async ({ authedPage: page }) => {
    await page.goto("/campaigns/new");
    await expect(page.locator("#name")).toBeVisible();
    await expect(page.getByText("Nicho", { exact: true })).toBeVisible();
    await expect(page.getByText("Cidade", { exact: true })).toBeVisible();
    await expect(page.getByText("Somente empresas sem site")).toBeVisible();
  });

  test("create campaign -> leads reach READY -> card shows evidence, draft and 3 references", async ({ authedPage: page }) => {
    await page.goto("/campaigns/new");
    await page.fill("#name", CAMPAIGN.name);
    await page.getByTestId("niche-input").fill(CAMPAIGN.niche);
    await page.getByTestId("city-input").fill(CAMPAIGN.city);
    await page.fill("#country", CAMPAIGN.country);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/campaigns\/(?!new$)[a-z0-9-]+$/, { timeout: 15000 });
    await expect(page.getByText(CAMPAIGN.name)).toBeVisible();
    await expect(page.getByText("Completed")).toBeVisible({ timeout: 90000 });

    // Open the first lead of the campaign
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
    const completedBadge = page.locator("text=Completed").first();
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
