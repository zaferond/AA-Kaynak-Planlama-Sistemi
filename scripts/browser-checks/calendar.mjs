import assert from "node:assert/strict";

const actualTab = (page) =>
  page.getByRole("tab", {
    name: "AA Gerçekleşen Kaynak Dağılımı",
    exact: true,
  });
const dialog = (page) => page.getByRole("dialog");
const calendarMonth = (page) =>
  dialog(page).locator(".work-calendar-months > div").first();

export async function checkCalendar(f) {
  const { page } = await f.client("root-admin");
  try {
    await actualTab(page).click();
    await f.check(
      "calendar: shared full/half-day holidays preview then save; weekends are not subtracted twice",
      async () => {
        await page
          .getByRole("button", { name: "Çalışma Takvimi'ni aç", exact: true })
          .click();
        assert((await calendarMonth(page).innerText()).includes("198 saat"));
        async function add(date, fraction, label) {
          await dialog(page)
            .getByLabel("Başlangıç", { exact: true })
            .fill(date);
          await dialog(page).getByLabel("Bitiş", { exact: true }).fill(date);
          await dialog(page)
            .locator(".work-calendar-fields select")
            .nth(1)
            .selectOption(fraction);
          await dialog(page)
            .getByLabel("Açıklama", { exact: true })
            .fill(label);
          await dialog(page)
            .getByRole("button", { name: "Ekle", exact: true })
            .click();
        }
        await add("2026-01-07", "1", "Shared full day");
        await add("2026-01-08", "0.5", "Shared half day");
        await add("2026-01-10", "1", "Weekend marker");
        assert((await calendarMonth(page).innerText()).includes("184,5 saat"));
        assert.equal((await f.state()).workCalendar["2026-01-07"], undefined);
        await dialog(page)
          .getByRole("button", { name: "Takvimi Kaydet", exact: true })
          .click();
        await dialog(page).waitFor({ state: "hidden" });
        assert.equal(
          (await f.state()).workCalendar["2026-01-08"].fraction,
          0.5,
        );
        await page
          .getByRole("button", { name: "Çalışma Takvimi'ni aç", exact: true })
          .click();
        await dialog(page)
          .getByRole("button", {
            name: "2026-01-07 tarihini kaldır",
            exact: true,
          })
          .click();
        await dialog(page)
          .getByRole("button", { name: "Kapat", exact: true })
          .click();
        assert((await f.state()).workCalendar["2026-01-07"]);
      },
    );
    const employee = await f.client("employee"),
      other = await f.client("other"),
      manager = await f.client("manager"),
      unmapped = await f.client("unmapped");
    const p = employee.page;
    await actualTab(p).click();
    await f.check(
      "calendar: normal user owns personal entry controls; shared/other records remain inaccessible",
      async () => {
        assert.equal(
          await p
            .getByRole("button", { name: "Çalışma Takvimi'ni aç", exact: true })
            .count(),
          0,
        );
        assert.equal(
          await p
            .getByRole("button", {
              name: "Browser Other Employee izin ve eğitim takvimini aç",
              exact: true,
            })
            .count(),
          0,
        );
        await p
          .getByRole("button", {
            name: "Browser Employee izin ve eğitim takvimini aç",
            exact: true,
          })
          .first()
          .click();
        assert.equal(
          await dialog(p)
            .getByRole("button", { name: "Takvimi Kaydet", exact: true })
            .count(),
          0,
        );
        assert((await calendarMonth(p).innerText()).includes("184,5 saat"));
      },
    );
    await f.check(
      "calendar: hourly leave and training coexist; weekend entries do not change hours",
      async () => {
        async function add(date, type, hours, label) {
          await dialog(p).getByLabel("Tarih", { exact: true }).fill(date);
          await dialog(p)
            .locator(".work-calendar-fields select")
            .selectOption(type);
          await dialog(p).getByLabel("Saat", { exact: true }).fill(hours);
          await dialog(p).getByLabel("Açıklama", { exact: true }).fill(label);
          await dialog(p)
            .getByRole("button", { name: "Kaydet", exact: true })
            .click();
          await f.wait(
            async () =>
              Boolean(
                (await f.state()).personCalendar["r-own|" + date + "|" + type],
              ),
            "personal day saved",
          );
          await f.wait(
            async () =>
              !(await dialog(p)
                .getByRole("button", { name: "Kaydet", exact: true })
                .isDisabled()),
            "personal save settled",
          );
        }
        await add("2026-01-05", "leave", "4", "PRIVATE_LEAVE_LABEL");
        await add("2026-01-05", "training", "2", "Training label");
        await add("2026-01-10", "leave", "9", "Weekend leave");
        assert(
          (await calendarMonth(p).innerText()).includes(
            "İzin 4 sa · Eğitim 2 sa",
          ),
        );
        assert((await calendarMonth(p).innerText()).includes("180,5 saat"));
        await dialog(p).getByLabel("Tarih", { exact: true }).fill("2026-01-05");
        await dialog(p)
          .locator(".work-calendar-fields select")
          .selectOption("training");
        await dialog(p).getByLabel("Saat", { exact: true }).fill("6");
        await dialog(p)
          .getByRole("button", { name: "Kaydet", exact: true })
          .click();
        await dialog(p).getByRole("alert").waitFor();
        assert.equal(
          (await f.state()).personCalendar["r-own|2026-01-05|training"].hours,
          2,
        );
        await dialog(p)
          .getByRole("button", {
            name: "2026-01-10 kaydını kaldır",
            exact: true,
          })
          .click();
        await f.wait(
          async () =>
            !(await f.state()).personCalendar["r-own|2026-01-10|leave"],
          "remove personal weekend",
        );
        assert((await calendarMonth(p).innerText()).includes("180,5 saat"));
      },
    );
    await f.check(
      "calendar: delayed save freezes form fields and retry keeps failed input",
      async () => {
        await dialog(p).getByLabel("Tarih", { exact: true }).fill("2026-01-06");
        await dialog(p).getByLabel("Saat", { exact: true }).fill("1");
        await p.route(
          "**/api/changes",
          (route) =>
            route.fulfill({
              status: 503,
              contentType: "application/json",
              body: JSON.stringify({ error: "Synthetic calendar failure" }),
            }),
          { times: 1 },
        );
        await dialog(p)
          .getByRole("button", { name: "Kaydet", exact: true })
          .click();
        await dialog(p)
          .getByRole("alert")
          .filter({ hasText: "Synthetic calendar failure" })
          .waitFor();
        assert.equal(
          await dialog(p).getByLabel("Tarih", { exact: true }).inputValue(),
          "2026-01-06",
        );
        let release,
          held = false;
        const gate = new Promise((resolve) => {
          release = resolve;
        });
        const hold = async (route) => {
          held = true;
          await gate;
          await route.continue();
        };
        await p.route("**/api/changes", hold);
        try {
          await dialog(p)
            .getByRole("button", { name: "Kaydet", exact: true })
            .click();
          await f.wait(() => held, "calendar save held");
          assert(
            await dialog(p).getByLabel("Tarih", { exact: true }).isDisabled(),
          );
          assert(
            await dialog(p).getByLabel("Saat", { exact: true }).isDisabled(),
          );
          release();
          await f.wait(
            async () =>
              Boolean(
                (await f.state()).personCalendar["r-own|2026-01-06|training"],
              ),
            "calendar retry committed",
          );
          await f.wait(
            async () =>
              !(await dialog(p)
                .getByRole("button", { name: "Kaydet", exact: true })
                .isDisabled()),
            "calendar retry settled",
          );
        } finally {
          release();
          await p.unrouteAll({ behavior: "wait" });
        }
        await dialog(p)
          .getByRole("button", {
            name: "2026-01-06 kaydını kaldır",
            exact: true,
          })
          .click();
        await f.wait(
          async () =>
            !(await f.state()).personCalendar["r-own|2026-01-06|training"],
          "temporary training removed",
        );
        await dialog(p)
          .getByRole("button", { name: "Kapat", exact: true })
          .click();
      },
    );
    await f.check(
      "calendar: training contributes to total percent, leave to monthly hours, and capacity limit prevents over-allocation",
      async () => {
        const amount = p.getByRole("textbox", {
          name: "Browser Employee / Browser Project A / 2026-01 / %",
          exact: true,
        });
        await amount.click();
        const hours = p.getByRole("textbox", {
          name: "Browser Employee / 2026-01 çalışılan saat",
          exact: true,
        });
        assert.equal(await hours.inputValue(), "180,5");
        const total = p
          .locator(
            '.actual-person-total td[title="Browser Employee · 2026-01 · projeler ve 2 saat eğitim"]',
          )
          .first();
        assert.equal((await total.innerText()).trim(), "%1,11");
        await amount.fill("100");
        await amount.press("Enter");
        await p
          .getByRole("heading", { name: "Kaynak Dağılımı Sınırı", exact: true })
          .waitFor();
        assert.equal(
          (await f.state()).actualAllocations["r-own|p-a|2026-01"] || 0,
          0,
        );
        await p.getByRole("button", { name: "Tamam", exact: true }).click();
        await amount.fill("50");
        await amount.press("Enter");
        await f.wait(
          async () =>
            (await f.state()).actualPercentEntries["r-own|p-a|2026-01"] === 50,
          "actual percent saved",
        );
        assert(
          Math.abs(
            (await f.state()).actualAllocations["r-own|p-a|2026-01"] * 180 -
              90.25,
          ) < 1e-7,
        );
        await amount.click();
        assert.equal((await total.innerText()).trim(), "%51,11");
        await hours.fill("80");
        await hours.press("Enter");
        await p
          .getByRole("heading", { name: "Çalışma Saati Sınırı", exact: true })
          .waitFor();
        assert.equal(
          (await f.state()).actualWorkedHours["r-own|2026-01"],
          undefined,
        );
        await p.getByRole("button", { name: "Tamam", exact: true }).click();
        await f.capture(p, "calendar-actual-percent");
      },
    );
    await f.check(
      "calendar: reports reflect saved labels/dates; manager and unmapped user cannot edit personal records",
      async () => {
        await page.reload();
        await page
          .getByRole("tab", { name: "Çalışan & Kaynak", exact: true })
          .click();
        const report = page.locator(".absence-report");
        await report.waitFor();
        assert((await report.innerText()).includes("PRIVATE_LEAVE_LABEL"));
        assert((await report.innerText()).includes("Training label"));
        assert.equal(await report.locator("tbody tr").count(), 2);
        await f.capture(page, "calendar-report");
        await actualTab(manager.page).click();
        await manager.page
          .getByRole("button", {
            name: "Browser Employee izin ve eğitim takvimini aç",
            exact: true,
          })
          .first()
          .click();
        assert.equal(
          await dialog(manager.page)
            .getByRole("button", { name: "Kaydet", exact: true })
            .count(),
          0,
        );
        await dialog(manager.page)
          .getByRole("button", { name: "Kapat", exact: true })
          .click();
        await actualTab(other.page).click();
        assert.equal(
          await other.page
            .getByRole("button", {
              name: "Browser Employee izin ve eğitim takvimini aç",
              exact: true,
            })
            .count(),
          0,
        );
        await actualTab(unmapped.page).click();
        assert.equal(
          await unmapped.page.locator(".person-calendar-trigger").count(),
          0,
        );
      },
    );
    await Promise.all(
      [employee, other, manager, unmapped].map((c) => c.context.close()),
    );
  } catch (error) {
    await f.capture(page, "calendar-failure").catch(() => {});
    throw error;
  }
}
