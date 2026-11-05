import { test, expect, ensureLeads } from "./fixtures";

test.describe("CRM kanban", () => {
  test("shows one column per status and moves a card between columns", async ({ authedPage: page }) => {
    await ensureLeads(page);
    await page.goto("/crm");
    const board = page.getByTestId("kanban");
    await expect(board).toBeVisible();
    for (const s of ["new", "contacted", "replied", "meeting", "proposal", "won", "lost"]) {
      await expect(page.getByTestId(`col-${s}`)).toBeVisible();
    }
    const card = page.getByTestId("col-new").getByTestId("kanban-card").first();
    await expect(card).toBeVisible({ timeout: 10000 });
    const name = (await card.locator("a").first().textContent())!.trim();
    await card.getByRole("combobox").click();
    await page.getByRole("option", { name: "Proposta" }).click();
    await expect(page.getByText(/movido para Proposta/).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId("col-proposal").getByText(name)).toBeVisible();
  });

  test("drag and drop moves a card and persists after reload", async ({ authedPage: page }) => {
    await ensureLeads(page);
    await page.goto("/crm");
    const card = page.getByTestId("col-new").getByTestId("kanban-card").first();
    await expect(card).toBeVisible({ timeout: 10000 });
    const name = (await card.locator("a").first().textContent())!.trim();
    // Grab the card by its title area: a native <button> (the "move to" select) does not start a drag.
    await card.dragTo(page.getByTestId("col-meeting"), { sourcePosition: { x: 20, y: 10 } });
    await expect(page.getByTestId("col-meeting").getByText(name)).toBeVisible({ timeout: 8000 });
    await page.reload();
    await expect(page.getByTestId("col-meeting").getByText(name)).toBeVisible({ timeout: 10000 });
  });
});
