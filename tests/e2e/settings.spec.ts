import { test, expect, TEST_USER, API } from "./fixtures";

test.describe("Settings", () => {
  test("settings page loads the AI and API key sections", async ({ authedPage: page }) => {
    await page.goto("/settings");
    await page.getByRole("tab", { name: "IA e chaves de API" }).click();
    await expect(page.getByRole("heading", { name: "Chaves de API do Prospector" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Configuração de IA" })).toBeVisible();
  });

  test("create API key → px_ prefix → appears in list", async ({ authedPage: page }) => {
    await page.goto("/settings");
    await page.getByRole("tab", { name: "IA e chaves de API" }).click();
    const keyName = `E2E Key ${Date.now()}`;
    await page.getByPlaceholder(/Nome da chave/i).fill(keyName);
    await page.getByRole("button", { name: "Criar chave de API" }).click();
    await expect(page.locator("input[readonly]")).toHaveValue(/^px_/, { timeout: 5000 });
    await expect(page.getByText(keyName)).toBeVisible();
  });

  test("an API key authenticates the REST API, workspace-scoped, but not user-only endpoints", async ({ authedPage: page, playwright }) => {
    await page.goto("/settings");
    await page.getByRole("tab", { name: "IA e chaves de API" }).click();
    await page.getByPlaceholder(/Nome da chave/i).fill(`REST ${Date.now()}`);
    await page.getByRole("button", { name: "Criar chave de API" }).click();
    const key = await page.locator("input[readonly]").inputValue();

    const anon = await playwright.request.newContext({ extraHTTPHeaders: { Authorization: `ApiKey ${key}` } });
    expect((await anon.get(`${API}/leads?limit=1`)).status()).toBe(200);
    expect((await anon.get(`${API}/auth/me`)).status()).toBe(403);
    expect((await anon.get(`${API}/leads?limit=1`, { headers: { Authorization: "ApiKey px_wrong" } })).status()).toBe(401);
    await anon.dispose();
  });

  test("delete API key removes it from the list", async ({ authedPage: page }) => {
    await page.goto("/settings");
    await page.getByRole("tab", { name: "IA e chaves de API" }).click();
    const keyName = `Delete Test ${Date.now()}`;
    await page.getByPlaceholder(/Nome da chave/i).fill(keyName);
    await page.getByRole("button", { name: "Criar chave de API" }).click();
    await expect(page.getByText(keyName)).toBeVisible({ timeout: 5000 });
    const row = page.getByTestId("key-row").filter({ hasText: keyName });
    await row.getByRole("button", { name: "Excluir chave de API" }).click();
    await page.getByRole("button", { name: "Excluir chave", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 8000 });
    await expect(row).not.toBeVisible();
  });

  test("the saved AI key is returned masked and a masked save keeps the stored key", async ({ authedPage: page }) => {
    await page.goto("/settings");
    await page.getByRole("tab", { name: "IA e chaves de API" }).click();
    await page.getByLabel("Chave da API (OpenAI ou compatível)").fill("sk-test-placeholder-1234");
    await page.getByRole("button", { name: "Salvar configuração de IA" }).click();
    await expect(page.getByRole("button", { name: "Salvo!" })).toBeVisible({ timeout: 5000 });
    await page.reload();
    await page.getByRole("tab", { name: "IA e chaves de API" }).click();
    const input = page.getByLabel("Chave da API (OpenAI ou compatível)");
    await expect(input).toHaveValue("••••1234");
    await page.getByRole("button", { name: "Salvar configuração de IA" }).click();
    await expect(page.getByRole("button", { name: "Salvo!" })).toBeVisible({ timeout: 5000 });
    const res = await page.request.get(`${API}/settings/integrations`);
    expect(JSON.stringify(await res.json())).not.toContain("sk-test-placeholder");
  });

  test("team tab lists the real signed-in member as owner", async ({ authedPage: page }) => {
    await page.goto("/settings");
    await page.getByRole("tab", { name: "Equipe" }).click();
    const row = page.getByTestId("member-row").filter({ hasText: TEST_USER.email });
    await expect(row).toBeVisible();
    await expect(row.getByText("Dono")).toBeVisible();
  });

  test("workspace deletion needs the typed slug; a throwaway workspace is erased and logged out", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const stamp = Date.now();
    await page.goto("/register");
    await page.fill("#name", "Temp User");
    await page.fill("#workspace", `Temp WS ${stamp}`);
    await page.fill("#reg-email", `temp-${stamp}@prospex.test`);
    await page.fill("#reg-password", "TestPass123!");
    await page.click('button[type="submit"]');
    await page.waitForURL("/dashboard", { timeout: 15000 });

    await page.goto("/settings");
    await page.getByRole("tab", { name: "Zona de perigo" }).click();
    await page.getByTestId("delete-workspace").click();
    const confirm = page.getByTestId("confirm-delete-workspace");
    await expect(confirm).toBeDisabled();
    const wsSlug = await (await page.request.get(`${API}/workspace`)).json().then((w: { slug: string }) => w.slug);
    await page.locator("#confirm-slug").fill("errado");
    await expect(confirm).toBeDisabled();
    await page.locator("#confirm-slug").fill(wsSlug);
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await page.waitForURL("/login", { timeout: 15000 });
    await ctx.close();
  });
});
