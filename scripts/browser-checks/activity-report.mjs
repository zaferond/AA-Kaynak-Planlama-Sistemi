import assert from "node:assert/strict";
import { applyChanges } from "../../backend/operations.mjs";

export async function checkActivityReport(f) {
  const ids = [
    "qa-activity-worker",
    "qa-activity-left",
    ...Array.from({ length: 32 }, (_, i) => "qa-activity-extra-" + i),
  ];
  const base = {
    effective: "2026-01",
    start: "2026-01-01",
    end: "",
    team: f.teamA.id,
    lead: f.teamA.lead,
    status: "Aktif Çalışan",
    included: true,
    amount: 1,
  };
  const resources = ids.map((id, index) => ({
    id,
    name:
      index === 0
        ? "Aktivite Test Çalışanı"
        : index === 1
          ? "Ayrılan Test Çalışanı"
          : "Test Çalışanı " + index,
    note: "",
    versions: [index === 1 ? { ...base, start: "2026-03-10" } : base],
  }));
  await f.store.mutate(f.actor, (data, actor) =>
    applyChanges(data, actor, [
      ...resources.map((value) => ({
        kind: "resource",
        id: value.id,
        value,
        revision: 0,
      })),
      { kind: "actual", id: ids[0] + "|p-a|2026-01", value: 0.5, revision: 0 },
      { kind: "actual", id: ids[0] + "|p-b|2026-01", value: 0.25, revision: 0 },
      { kind: "actual", id: ids[1] + "|p-a|2026-04", value: 0.25, revision: 0 },
      {
        kind: "personDay",
        id: ids[0] + "|2026-01-02|leave",
        value: { type: "leave", hours: 9, label: "Synthetic leave" },
        revision: 0,
      },
      {
        kind: "personDay",
        id: ids[0] + "|2026-01-05|training",
        value: { type: "training", hours: 9, label: "Synthetic training" },
        revision: 0,
      },
    ]),
  );
  const current = await f.state();
  const departed = {
    ...resources[1],
    versions: [
      { ...base, start: "2026-03-10", end: "2026-05-15" },
      {
        ...base,
        effective: "2026-05",
        start: "2026-03-10",
        end: "2026-05-15",
        status: "İşten Ayrıldı",
      },
    ],
  };
  await f.store.mutate(f.actor, (data, actor) =>
    applyChanges(data, actor, [
      {
        kind: "resource",
        id: departed.id,
        value: departed,
        revision: current.revisions["resource:" + departed.id],
      },
    ]),
  );
  const before = await f.state();
  const { page, context } = await f.client("root-admin");
  const cell = (id, month) =>
    page.locator(
      `[data-activity-resource="${id}"] [data-activity-month="${month}"]`,
    );
  async function choose(label, names) {
    await page.getByRole("button", { name: label, exact: true }).click();
    const panel = page.locator('.pickerpanel[data-state="open"]');
    await panel
      .getByRole("button", { name: "Seçimleri Kaldır", exact: true })
      .click();
    for (const name of names)
      await panel.getByRole("checkbox", { name, exact: true }).check();
    await page.keyboard.press("Escape");
  }
  try {
    await page
      .getByRole("tab", { name: "Aylık Aktivite Raporu", exact: true })
      .click();
    await page
      .locator('.planning-filterbar input[type="month"]')
      .fill("2026-01");
    await page.locator(".planning-filterbar .period select").selectOption("12");
    await f.check(
      "activity report: tab placement, planned filters and applied filter summary",
      async () => {
        const tabs = await page
          .getByRole("tablist", { name: "Ana sekmeler" })
          .getByRole("tab")
          .allTextContents();
        assert.equal(
          tabs[tabs.findIndex((t) => t.includes("Gerçekleşen")) + 1],
          "Aylık Aktivite Raporu",
        );
        for (const label of ["Liderlik", "Takım / Birim", "Proje"])
          assert.equal(
            await page
              .getByRole("button", { name: label, exact: true })
              .count(),
            1,
          );
        assert.equal(
          await page.getByRole("button", { name: "Kişi", exact: true }).count(),
          0,
        );
        const summary = page.getByRole("region", {
          name: "Aylık aktivite raporunda uygulanan filtreler",
        });
        assert.match(await summary.innerText(), /Uygulanan Filtreler/);
        assert.match(await summary.innerText(), /12 ay/);
      },
    );
    await f.check(
      "activity report: month totals and percent/day/hour units share leave and training calculations",
      async () => {
        assert.equal(
          await cell(ids[0], "2026-01").locator("strong").innerText(),
          "%76,19",
        );
        await page.getByLabel("Aktivite raporu birimi").selectOption("hours");
        assert.equal(
          await cell(ids[0], "2026-01").locator("strong").innerText(),
          "144",
        );
        await page.getByLabel("Aktivite raporu birimi").selectOption("days");
        assert.equal(
          await cell(ids[0], "2026-01").locator("strong").innerText(),
          "16",
        );
        await page.getByLabel("Aktivite raporu birimi").selectOption("hours");
        await choose("Proje", ["Browser Project A"]);
        assert.equal(
          await cell(ids[0], "2026-01").locator("strong").innerText(),
          "99",
        );
        assert.match(
          await page
            .getByRole("region", {
              name: "Aylık aktivite raporunda uygulanan filtreler",
            })
            .innerText(),
          /Browser Project A/,
        );
        await choose("Proje", []);
      },
    );
    await f.check(
      "activity report: pre-employment, departure and future months preserve history",
      async () => {
        assert.equal(
          await cell(ids[1], "2026-01").getAttribute("data-employment-state"),
          "before-start",
        );
        assert.equal(
          await cell(ids[1], "2026-04").locator("strong").innerText(),
          "45",
        );
        assert.match(
          await cell(ids[1], "2026-05").innerText(),
          /İşten Ayrıldı/,
        );
        assert.equal(
          await cell(ids[0], "2026-11").locator("strong").innerText(),
          "—",
        );
      },
    );
    await f.check(
      "activity report: leadership/team/employee ordering and team filters",
      async () => {
        const values = await page
          .locator(".activity-matrix tbody tr[data-activity-resource]")
          .evaluateAll((rows) =>
            rows.map((row) =>
              Array.from(row.querySelectorAll("td"))
                .slice(0, 3)
                .map((td) => td.textContent),
            ),
          );
        const collator = new Intl.Collator("tr-TR", {
          sensitivity: "base",
          numeric: true,
        });
        const sorted = [...values].sort(
          (a, b) =>
            collator.compare(a[0], b[0]) ||
            collator.compare(a[1], b[1]) ||
            collator.compare(a[2], b[2]),
        );
        assert.deepEqual(values, sorted);
        await choose("Takım / Birim", [f.teamB.name]);
        assert.equal(
          await page.locator(`[data-activity-resource="${ids[0]}"]`).count(),
          0,
        );
        await choose("Takım / Birim", []);
      },
    );
    await f.check(
      "activity report: frozen labels and month headers remain readable while scrolling",
      async () => {
        await page.setViewportSize({ width: 1100, height: 850 });
        const panel = page.locator(
          '.monthly-activity-report > [data-slot="table-container"]',
        );
        await panel.evaluate((el) => {
          el.scrollLeft = 500;
          el.scrollTop = 250;
        });
        const row = page
          .locator(".activity-matrix tbody tr[data-activity-resource]")
          .nth(15);
        const label = row.locator(".activity-person");
        await label.scrollIntoViewIfNeeded();
        assert(
          await label.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return el.contains(
              document.elementFromPoint(
                r.left + r.width / 2,
                r.top + r.height / 2,
              ),
            );
          }),
        );
        const head = page.locator(".activity-month-row .activity-person");

        assert(
          await head.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return el.contains(
              document.elementFromPoint(
                r.left + r.width / 2,
                r.top + r.height / 2,
              ),
            );
          }),
        );
        for (const width of [900, 1024, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          await f.wait(
            async () =>
              panel.evaluate((el) => el.scrollWidth <= el.clientWidth + 2),
            "all twelve months fit on desktop/tablet",
          );
        }
        await panel.evaluate((el) => {
          el.scrollLeft = 0;
          el.scrollTop = 0;
        });
        await page.evaluate(() => window.scrollTo(0, 0));
        for (const width of [1800, 1100, 480]) {
          await page.setViewportSize({ width, height: 900 });
          await f.capture(page, "activity-report-" + width);
        }
      },
    );
    await f.check(
      "activity report: manager and normal accounts retain API scope; reporting does not write data",
      async () => {
        for (const role of ["manager", "employee", "unmapped"]) {
          const client = await f.client(role);
          try {
            await client.page
              .getByRole("tab", { name: "Aylık Aktivite Raporu", exact: true })
              .click();
            const named = await client.page
              .locator("[data-activity-resource]")
              .evaluateAll((rows) =>
                rows.map((r) => r.dataset.activityResource),
              );
            if (role === "manager") {
              assert(named.includes(ids[0]));
              assert(!named.includes("r-other"));
            }
            if (role === "employee") assert.deepEqual(named, ["r-own"]);
            if (role === "unmapped") assert.deepEqual(named, []);
          } finally {
            await client.context.close();
          }
        }
        assert.deepEqual(await f.state(), before);
      },
    );
  } catch (error) {
    await f.capture(page, "activity-report-failed");
    throw error;
  } finally {
    await context.close();
    const latest = await f.state();
    await f.store.mutate(f.actor, (data, actor) =>
      applyChanges(
        data,
        actor,
        ids.map((id) => ({
          kind: "resource",
          id,
          operation: "delete",
          revision: latest.revisions["resource:" + id],
        })),
      ),
    );
  }
}
