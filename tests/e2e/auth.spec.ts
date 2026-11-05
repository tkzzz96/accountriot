import { test, expect, TEST_USER, loginOnly, API } from "./fixtures";

test.describe("Auth", () => {
  test("register creates account and redirects to dashboard", async ({ authedPage: page }) => {
    await expect(page).toHaveURL("/dashboard");
    await expect(page.getByText(TEST_USER.workspace)).toBeVisible();
  });

  test("login with correct credentials redirects to dashboard", async ({ authedPage: page }) => {
    await page.getByRole("button", { name: TEST_USER.email, exact: false }).click();
    await page.getByRole("menuitem", { name: "Sair" }).click();
    await page.waitForURL("/login");
    await loginOnly(page, TEST_USER);
    await expect(page).toHaveURL("/dashboard");
  });

  test("login with wrong password shows error and stays on /login", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", TEST_USER.email);
    await page.fill("#password", "WrongPassword999!");
    await page.click('button[type="submit"]');
    await expect(page.locator('[class*="text-red"]').first()).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL("/login");
  });

  test("accessing /dashboard without a session redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("/login", { timeout: 8000 });
  });

  test("logout clears the session", async ({ authedPage: page }) => {
    await page.getByRole("button", { name: TEST_USER.email, exact: false }).click();
    await page.getByRole("menuitem", { name: "Sair" }).click();
    await page.waitForURL("/login");
    await page.goto("/dashboard");
    await page.waitForURL("/login", { timeout: 8000 });
  });

  test("the session lives in an httpOnly cookie, never in localStorage", async ({ authedPage: page, context }) => {
    const cookies = await context.cookies();
    const session = cookies.find((c) => c.name === "prospector_session");
    const csrf = cookies.find((c) => c.name === "prospector_csrf");
    expect(session?.httpOnly).toBe(true);
    expect(csrf?.httpOnly).toBe(false);
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    expect(stored).not.toContain("token");
    expect(await page.evaluate(() => document.cookie)).not.toContain("prospector_session");
  });
});

test.describe("CSRF, Bearer and security headers", () => {
  test("a cookie-authenticated POST without the CSRF header is rejected, with it is accepted", async ({ authedPage: page, context }) => {
    const csrf = (await context.cookies()).find((c) => c.name === "prospector_csrf")!.value;
    const blocked = await page.request.post(`${API}/settings/api-keys`, { data: { name: "csrf-probe" } });
    expect(blocked.status()).toBe(403);
    const ok = await page.request.post(`${API}/settings/api-keys`, { data: { name: "csrf-probe" }, headers: { "x-csrf-token": csrf } });
    expect(ok.status()).toBe(201);
  });

  test("GET with the cookie needs no CSRF header; unauthenticated GET is 401", async ({ authedPage: page, playwright }) => {
    expect((await page.request.get(`${API}/auth/me`)).status()).toBe(200);
    const anon = await playwright.request.newContext();
    expect((await anon.get(`${API}/leads`)).status()).toBe(401);
    await anon.dispose();
  });

  test("the web app is served with a Content-Security-Policy that blocks framing and plugins", async ({ page }) => {
    const res = await page.goto("/login");
    const csp = res!.headers()["content-security-policy"];
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("connect-src 'self'");
  });

  test("API responses carry a request id", async ({ authedPage: page }) => {
    const res = await page.request.get(`${API}/auth/me`);
    expect(res.headers()["x-request-id"]).toBeTruthy();
  });
});

test.describe("Public routes", () => {
  test("/login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "Bem-vindo de volta" })).toBeVisible();
  });

  test("/register page renders", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator("#name")).toBeVisible();
    await expect(page.locator("#reg-email")).toBeVisible();
    await expect(page.locator("#reg-password")).toBeVisible();
  });
});
