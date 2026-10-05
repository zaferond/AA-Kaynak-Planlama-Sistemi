import assert from "node:assert/strict";
import { applyChanges } from "../../backend/operations.mjs";

export async function checkDirectoryManagement(f) {
  const c = await f.client("root-admin"),
    page = c.page;
  const original = (await f.state()).projects.find((p) => p.id === "p-a");
  const leaderName = "QA Manual Leadership",
    teamName = "QA Manual Team";
  const dialog = () => page.getByRole("dialog");
  async function save(path, name, status = 200) {
    const response = page.waitForResponse(
      (r) => r.url().endsWith(path) && r.request().method() === "POST",
    );
    await dialog().getByRole("button", { name, exact: true }).click();
    const result = await response;
    assert.equal(result.status(), status);
    return result;
  }
  async function close() {
    await dialog().getByRole("button", { name: "Kapat", exact: true }).click();
    await dialog().waitFor({ state: "hidden" });
  }
  try {
    await page
      .getByRole("tab", { name: "Liderlik ve Takımlar", exact: true })
      .click();
    await f.check(
      "directory: dedicated leadership/team lists create records and refresh combo choices",
      async () => {
        await page
          .getByRole("button", { name: "Liderlikleri Yönet", exact: true })
          .click();
        await dialog()
          .getByRole("button", { name: "Yeni Liderlik Ekle", exact: true })
          .click();
        await dialog()
          .getByLabel("Liderlik Adı", { exact: true })
          .fill(leaderName);
        await dialog()
          .getByLabel("Liderlik Yöneticisi", { exact: true })
          .fill("QA Manager");
        await save("/api/leaders/change", "Ekle");
        await dialog()
          .getByRole("button", { name: "Liderlik: " + leaderName, exact: true })
          .waitFor();
        await close();
        await page
          .getByRole("button", { name: "Takımları Yönet", exact: true })
          .click();
        await dialog()
          .getByRole("button", { name: "Yeni Takım Ekle", exact: true })
          .click();
        await dialog().getByLabel("Takım Adı", { exact: true }).fill(teamName);
        await dialog()
          .getByLabel("Liderlik", { exact: true })
          .selectOption(leaderName);
        await dialog()
          .getByLabel("Takım Yöneticisi", { exact: true })
          .fill("QA Team Manager");
        await save("/api/changes", "Ekle");
        await dialog()
          .getByRole("button", { name: "Takım: " + teamName, exact: true })
          .waitFor();
        const team = (await f.state()).teams.find((t) => t.name === teamName);
        assert.equal(team.lead, leaderName);
        assert.equal(team.catalog, true);
        await f.capture(page, "directory-team-management");
        await close();
      },
    );
    await f.check(
      "directory: leader draft retains opening generation, explains conflict and reloads explicitly",
      async () => {
        await page
          .getByRole("button", { name: "Liderlikleri Yönet", exact: true })
          .click();
        await dialog()
          .getByRole("button", { name: "Liderlik: " + leaderName, exact: true })
          .click();
        await dialog()
          .getByLabel("Liderlik Adı", { exact: true })
          .fill(leaderName + " Renamed");
        const state = await f.state();
        await f.store.mutate(f.actor, (d, u) =>
          applyChanges(d, u, [
            {
              kind: "project",
              id: original.id,
              revision: state.revisions["project:" + original.id],
              value: { ...original, responsibleName: "Remote QA owner" },
            },
          ]),
        );
        await page.evaluate(() =>
          window.dispatchEvent(
            new StorageEvent("storage", { key: "kaynak-planlama-offline-v1" }),
          ),
        );
        await save("/api/leaders/change", "Değişiklikleri Kaydet", 409);
        assert.equal(
          await dialog()
            .getByLabel("Liderlik Adı", { exact: true })
            .inputValue(),
          leaderName + " Renamed",
        );
        await dialog().getByRole("alert").waitFor();
        page.once("dialog", (d) => d.accept());
        await dialog()
          .getByRole("button", { name: "Güncel Listeyi Yükle", exact: true })
          .click();
        await f.wait(
          async () =>
            (await dialog()
              .getByLabel("Liderlik Adı", { exact: true })
              .inputValue()) === leaderName,
          "explicit leader reload",
        );
        await dialog()
          .getByLabel("Liderlik Adı", { exact: true })
          .fill(leaderName + " Renamed");
        await save("/api/leaders/change", "Değişiklikleri Kaydet");
        await dialog()
          .getByRole("button", {
            name: "Liderlik: " + leaderName + " Renamed",
            exact: true,
          })
          .waitFor();
        assert.equal(
          (await f.state()).teams.find((t) => t.name === teamName).lead,
          leaderName + " Renamed",
        );
        await f.capture(page, "directory-leadership-management");
        await close();
      },
    );
    await f.check(
      "directory: team draft keeps stale revision and remote rename; explicit reload permits a new edit",
      async () => {
        await page
          .getByRole("button", { name: "Takımları Yönet", exact: true })
          .click();
        await dialog()
          .getByRole("button", { name: "Takım: " + teamName, exact: true })
          .click();
        await dialog()
          .getByLabel("Takım Adı", { exact: true })
          .fill("QA Local Team Draft");
        const state = await f.state(),
          team = state.teams.find((t) => t.name === teamName);
        await f.store.mutate(f.actor, (d, u) =>
          applyChanges(d, u, [
            {
              kind: "team",
              id: team.id,
              revision: state.revisions["team:" + team.id],
              value: { ...team, name: "QA Remote Team" },
            },
          ]),
        );
        const response = await save(
          "/api/changes",
          "Değişiklikleri Kaydet",
          409,
        );
        assert.equal(
          response.request().postDataJSON().changes[0].revision,
          state.revisions["team:" + team.id],
        );
        assert.equal(
          await dialog().getByLabel("Takım Adı", { exact: true }).inputValue(),
          "QA Local Team Draft",
        );
        page.once("dialog", (d) => d.accept());
        await dialog()
          .getByRole("button", { name: "Güncel Listeyi Yükle", exact: true })
          .click();
        await f.wait(
          async () =>
            (await dialog()
              .getByLabel("Takım Adı", { exact: true })
              .inputValue()) === "QA Remote Team",
          "explicit team reload",
        );
        await dialog()
          .getByLabel("Takım Adı", { exact: true })
          .fill(teamName + " Renamed");
        await save("/api/changes", "Değişiklikleri Kaydet");
        await dialog()
          .getByRole("button", {
            name: "Takım: " + teamName + " Renamed",
            exact: true,
          })
          .waitFor();
        await close();
      },
    );
    await f.check(
      "directory: referenced team deletion is rejected and unused manual records can be deleted",
      async () => {
        await page
          .getByRole("button", { name: "Takımları Yönet", exact: true })
          .click();
        await dialog()
          .getByRole("button", { name: "Takım: " + f.teamA.name, exact: true })
          .click();
        page.once("dialog", (d) => d.accept());
        await save("/api/changes", "Takımı Sil", 409);
        await dialog().getByRole("alert").waitFor();
        assert((await f.state()).teams.some((t) => t.id === f.teamA.id));
        await dialog()
          .getByRole("button", {
            name: "Takım: " + teamName + " Renamed",
            exact: true,
          })
          .click();
        page.once("dialog", (d) => d.accept());
        await save("/api/changes", "Takımı Sil");
        await f.wait(
          async () =>
            !(await f.state()).teams.some(
              (t) => t.name === teamName + " Renamed",
            ),
          "manual team deleted",
        );
        await close();
        await page
          .getByRole("button", { name: "Liderlikleri Yönet", exact: true })
          .click();
        await dialog()
          .getByRole("button", {
            name: "Liderlik: " + leaderName + " Renamed",
            exact: true,
          })
          .click();
        page.once("dialog", (d) => d.accept());
        await save("/api/leaders/change", "Liderliği Sil");
        await f.wait(
          async () =>
            !(await f.state()).leaders.includes(leaderName + " Renamed"),
          "manual leader deleted",
        );
        await close();
      },
    );
  } catch (error) {
    await f.capture(page, "directory-management-failed");
    throw error;
  } finally {
    await c.context.close();
    await f.store.mutate(f.actor, (d, u) =>
      applyChanges(d, u, [
        {
          kind: "project",
          id: original.id,
          revision: d.revisions["project:" + original.id],
          value: original,
        },
      ]),
    );
  }
}
