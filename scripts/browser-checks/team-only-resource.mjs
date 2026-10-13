import { statuses } from "../../shared/model.ts";
import assert from "node:assert/strict";
import { applyChanges } from "../../backend/operations.mjs";
import { selectWorkspaceTab } from "./fixture.mjs";

export async function checkTeamOnlyResource(f) {
  const independent = {
    ...f.teamA,
    id: "qa-independent-resource-team",
    name: "Synthetic independent team",
    lead: "",
    catalog: false,
  };
  await f.store.mutate(f.actor, (d, u) =>
    applyChanges(d, u, [
      { kind: "team", id: independent.id, value: independent, revision: 0 },
    ]),
  );
  await f.store.mutate(f.actor, (d, u) =>
    applyChanges(
      d,
      u,
      statuses.map((status, i) => ({
        kind: "resource",
        id: "qa-status-" + i,
        revision: 0,
        value: {
          id: "qa-status-" + i,
          name: "Synthetic status " + i,
          note: "",
          versions: [
            {
              effective: "2026-01",
              start: "2026-01-01",
              end: status === "İşten Ayrıldı" ? "2026-12-31" : "",
              team: f.teamA.id,
              lead: f.teamA.lead,
              assignmentRole: "member",
              status,
              included: !status.includes("İlan"),
              amount: 1,
            },
          ],
        },
      })),
    ),
  );
  await f.store.transaction(async (c) => {
    const user = await f.store.findUser({ id: "employee" }, c);
    await f.store.saveUser(
      {
        ...user,
        authSource: "ldap",
        directoryId: "a".repeat(32),
        email: "synthetic.long.directory.address@example.invalid",
      },
      c,
    );
  });
  const { page } = await f.client("root-admin");
  const dialog = () => page.getByRole("dialog");
  try {
    await selectWorkspaceTab(page, "Çalışan & Yetki Tanımlama");
    await f.check(
      "employee table: AD email has its own wrapping column and remains searchable",
      async () => {
        assert.equal(
          await page
            .getByRole("columnheader", { name: "E-posta Adresi", exact: true })
            .count(),
          1,
        );
        const cell = page.locator(
          '[data-account-id="employee"] .account-email',
        );
        assert.equal(
          await cell.innerText(),
          "synthetic.long.directory.address@example.invalid",
        );
        assert.equal(
          await cell.evaluate((c) => getComputedStyle(c).overflowWrap),
          "anywhere",
        );
        await page
          .getByRole("textbox", { name: "Kaynak ara", exact: true })
          .fill("synthetic.long.directory.address@example.invalid");
        assert.equal(await page.locator(".resource-table tbody tr").count(), 1);
        await page
          .getByRole("textbox", { name: "Kaynak ara", exact: true })
          .fill("");
      },
    );
    await f.check(
      "employee table: all status badges use distinct background colors",
      async () => {
        const colors = [];
        for (const status of statuses) {
          const badge = page
            .locator("[data-resource-status]")
            .filter({ hasText: status })
            .first();
          assert(await badge.count());
          colors.push(
            await badge.evaluate((e) => getComputedStyle(e).backgroundColor),
          );
        }
        assert.equal(new Set(colors).size, statuses.length);
        await f.capture(page, "employee-status-colors");
      },
    );
    for (const role of ["member", "productOwner"]) {
      for (const team of [f.teamA, independent]) {
        await f.check(
          `resource ${role}: only ${team === independent ? "independent" : "assigned"} team required, no leadership choice`,
          async () => {
            const name = `Synthetic team-only ${role} ${team.id}`;
            await page
              .getByRole("button", {
                name: "Kaynak Ekle / Yetki Tanımla",
                exact: true,
              })
              .click();
            await dialog().getByLabel("Ad Soyad", { exact: true }).fill(name);
            await dialog()
              .getByLabel("Kaynak Rolü", { exact: true })
              .selectOption(role);
            await dialog()
              .getByRole("button", { name: "Takım", exact: true })
              .click();
            const picker = page.locator('.pickerpanel[data-state="open"]');
            await picker.getByRole("textbox").fill(team.name);
            await picker
              .getByRole("button", {
                name: team.name + (team.lead ? "" : " (Bağımsız takım)"),
                exact: true,
              })
              .click();
            const response = page.waitForResponse(
              (r) =>
                r.url().endsWith("/api/changes") &&
                r.request().method() === "POST",
            );
            await dialog()
              .getByRole("button", { name: "Kaydet", exact: true })
              .click();
            assert.equal((await response).status(), 200);
            await dialog().waitFor({ state: "hidden" });
            const saved = (await f.state()).resources.find(
              (r) => r.name === name,
            );
            assert(saved);
            assert.equal(saved.versions.at(-1).team, team.id);
            assert.equal(saved.versions.at(-1).lead || "", team.lead || "");
          },
        );
      }
    }
  } finally {
    await page.close();
  }
}
