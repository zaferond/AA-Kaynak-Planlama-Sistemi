import assert from "node:assert/strict";
import { applyChanges } from "../../backend/operations.mjs";

export async function loginUI(page, id, password) {
  await page.getByLabel("Kullanıcı Adı", { exact: true }).fill("qa." + id);
  await page.getByLabel("Şifre", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Giriş Yap", exact: true }).click();
  await page
    .getByRole("tab", { name: "AA Risk Yönetimi", exact: true })
    .waitFor();
}
const openAccess = (page) =>
  page.getByRole("tab", { name: "Yetki Kontrol Ekranı", exact: true }).click();
async function editAccount(page, id) {
  await page
    .getByRole("textbox", { name: "Kullanıcı ara", exact: true })
    .fill("qa." + id);
  await page
    .locator(".accesstable tbody tr")
    .getByRole("button", { name: "Yetkileri Düzenle", exact: true })
    .click();
  await page.locator(".access-permission-form").waitFor();
  return page.locator(".access-permission-form");
}
export async function checkAccess(f) {
  const admin = await f.client("root-admin"),
    page = admin.page;
  try {
    await f.check(
      "auth: login errors, remember/reload, password visibility and logout",
      async () => {
        const c = await f.client("employee", { login: false }),
          p = c.page;
        await p
          .getByLabel("Kullanıcı Adı", { exact: true })
          .fill("qa.employee");
        await p
          .getByLabel("Şifre", { exact: true })
          .fill("Wrong test password");
        await p.getByRole("button", { name: "Giriş Yap", exact: true }).click();
        await p.getByRole("alert").waitFor();
        await p
          .getByRole("button", { name: "Şifreyi Göster", exact: true })
          .click();
        assert.equal(
          await p.getByLabel("Şifre", { exact: true }).getAttribute("type"),
          "text",
        );
        await p
          .getByRole("button", { name: "Şifreyi Gizle", exact: true })
          .click();
        await p
          .getByRole("checkbox", { name: "Beni Hatırla", exact: true })
          .check();
        await loginUI(p, "employee", f.password);
        await p.reload();
        await p
          .getByRole("tab", { name: "AA Risk Yönetimi", exact: true })
          .waitFor();
        const cookies = await c.context.cookies();
        assert(cookies.some((cookie) => cookie.httpOnly));
        assert.equal(
          await p
            .getByRole("tab", { name: "Yetki Kontrol Ekranı", exact: true })
            .count(),
          0,
        );
        assert.equal(
          await p
            .getByRole("button", { name: "Veri Yedeği İndir", exact: true })
            .count(),
          0,
        );
        assert(
          !(await p.evaluate(() => JSON.stringify(localStorage))).includes(
            f.password,
          ),
        );
        await p.getByRole("button", { name: "Çıkış", exact: true }).click();
        await p.getByLabel("Kullanıcı Adı", { exact: true }).waitFor();
        await p.reload();
        await p.getByLabel("Kullanıcı Adı", { exact: true }).waitFor();
        await c.context.close();
      },
    );
    await openAccess(page);
    await f.check(
      "access: root admin is protected; role/resource edits revoke the employee's old session",
      async () => {
        await page
          .getByRole("textbox", { name: "Kullanıcı ara", exact: true })
          .fill("qa.root-admin");
        assert.equal(
          await page
            .locator(".accesstable tbody tr")
            .getByRole("button", { name: "Yetkileri Düzenle", exact: true })
            .count(),
          0,
        );
        const employee = await f.client("employee");
        const form = await editAccount(page, "employee");
        await form.locator("select").first().selectOption("manager");
        await form.getByRole("button", { name: "Kaydet", exact: true }).click();
        await form.waitFor({ state: "hidden" });
        assert.equal(
          (await f.store.findUser({ id: "employee" })).role,
          "manager",
        );
        assert.equal(
          (await f.store.findUser({ id: "employee" })).resourceId,
          "",
        );
        await employee.page.reload();
        await employee.page
          .getByLabel("Kullanıcı Adı", { exact: true })
          .waitFor();
        await loginUI(employee.page, "employee", f.password);
        assert(
          await employee.page
            .getByRole("tab", {
              name: "AA Planlanan Kaynak Dağılımı",
              exact: true,
            })
            .isVisible(),
        );
        assert.equal(
          await employee.page
            .getByRole("tab", { name: "Yetki Kontrol Ekranı", exact: true })
            .count(),
          0,
        );
        const restoreForm = await editAccount(page, "employee");
        await restoreForm.locator("select").first().selectOption("normal");
        await restoreForm.locator("select").nth(1).selectOption("r-own");
        await page.route(
          "**/api/users",
          (route) =>
            route.fulfill({
              status: 503,
              contentType: "application/json",
              body: JSON.stringify({ error: "Synthetic permission failure" }),
            }),
          { times: 1 },
        );
        await restoreForm
          .getByRole("button", { name: "Kaydet", exact: true })
          .click();
        await restoreForm
          .getByRole("alert")
          .filter({ hasText: "Synthetic permission failure" })
          .waitFor();
        assert.equal(
          (await f.store.findUser({ id: "employee" })).role,
          "manager",
        );
        await restoreForm
          .getByRole("button", { name: "Kaydet", exact: true })
          .click();
        await restoreForm.waitFor({ state: "hidden" });
        assert.equal(
          (await f.store.findUser({ id: "employee" })).resourceId,
          "r-own",
        );
        await employee.page.reload();
        await employee.page
          .getByLabel("Kullanıcı Adı", { exact: true })
          .waitFor();
        await employee.context.close();
      },
    );
    await f.check(
      "access: stale permission revision cannot overwrite another admin's change",
      async () => {
        const otherAdmin = await f.client("root-admin");
        await openAccess(otherAdmin.page);
        const a = await editAccount(page, "other"),
          b = await editAccount(otherAdmin.page, "other");
        await b.locator("select").first().selectOption("admin");
        await b.getByRole("button", { name: "Kaydet", exact: true }).click();
        await b.waitFor({ state: "hidden" });
        await a.locator("select").first().selectOption("manager");
        await a.getByRole("button", { name: "Kaydet", exact: true }).click();
        await a.getByRole("alert").waitFor();
        assert.equal((await f.store.findUser({ id: "other" })).role, "admin");
        await f.capture(page, "access-conflict");
        await otherAdmin.context.close();
        await page.reload();
        await openAccess(page);
      },
    );
    await f.check(
      "access: editing own admin role commits then requires login with the new permissions",
      async () => {
        const c = await f.client("admin-edit");
        await openAccess(c.page);
        const form = await editAccount(c.page, "admin-edit");
        await form.locator("select").first().selectOption("manager");
        await form
          .getByRole("checkbox", { name: f.teamA.lead, exact: true })
          .check();
        await form.getByRole("button", { name: "Kaydet", exact: true }).click();
        await c.page.getByLabel("Kullanıcı Adı", { exact: true }).waitFor();
        assert.equal(
          (await f.store.findUser({ id: "admin-edit" })).role,
          "manager",
        );
        await loginUI(c.page, "admin-edit", f.password);
        assert.equal(
          await c.page
            .getByRole("tab", { name: "Yetki Kontrol Ekranı", exact: true })
            .count(),
          0,
        );
        await c.context.close();
      },
    );
    await f.check(
      "audit: pagination, field diffs, private data masking and retry after read failure",
      async () => {
        const d = await f.state(),
          teams = d.teams.slice(0, 4);
        await f.store.mutate(f.actor, (data, user) =>
          applyChanges(
            data,
            user,
            Array.from({ length: 40 }, (_, i) => {
              const id =
                teams[Math.floor(i / 12)].id +
                "|p-a|2026-" +
                String((i % 12) + 1).padStart(2, "0");
              return {
                kind: "allocation",
                id,
                value: 0.2,
                revision: data.revisions["allocation:" + id] || 0,
              };
            }),
          ),
        );
        await page.route(
          "**/api/audit?*",
          (route) =>
            route.fulfill({
              status: 503,
              contentType: "application/json",
              body: JSON.stringify({ error: "Synthetic audit failure" }),
            }),
          { times: 1 },
        );
        await page
          .getByRole("button", { name: "Değişiklik Geçmişi", exact: true })
          .click();
        await page
          .getByRole("dialog")
          .getByRole("alert")
          .filter({ hasText: "Synthetic audit failure" })
          .waitFor();
        await page.keyboard.press("Escape");
        await page
          .getByRole("button", { name: "Değişiklik Geçmişi", exact: true })
          .click();
        const audit = page.getByRole("dialog");
        await audit.locator(".audit-log-entry").first().waitFor();
        assert.equal(await audit.locator(".audit-log-entry").count(), 30);
        await audit.locator("details summary").first().click();
        assert(await audit.locator("details[open] table").isVisible());
        assert(
          !/PRIVATE_LEAVE_LABEL|PRIVATE_HR_TEST_NOTE|Browser-check-only/.test(
            await audit.innerText(),
          ),
        );
        await audit
          .getByRole("button", { name: "Sonraki", exact: true })
          .click();
        await f.wait(
          async () =>
            (await audit.locator(".audit-log-footer").innerText()).includes(
              "Sayfa 2",
            ),
          "audit page two",
        );
        await audit.locator(".audit-log-entry").first().waitFor();
        await audit
          .getByRole("button", { name: "Önceki", exact: true })
          .click();
        await f.wait(
          async () =>
            (await audit.locator(".audit-log-footer").innerText()).includes(
              "Sayfa 1",
            ),
          "audit first page",
        );
        await f.capture(page, "audit-log");
      },
    );
  } catch (error) {
    await f.capture(page, "access-failure").catch(() => {});
    throw error;
  }
}
