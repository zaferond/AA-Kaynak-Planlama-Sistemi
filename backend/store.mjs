import { auditEntries } from "./audit.mjs";
import { dataChanges } from "./change-set.mjs";
import {
  cloneMutationSnapshot,
  numericSnapshotMaps,
} from "./mutation-snapshot.mjs";
import {
  readRecordMap,
  readCompositeMap,
  revisionRecordKey,
} from "./read-records.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import catalog from "../shared/catalog.json" with { type: "json" };
import {
  validate,
  scopeData,
  visibleTeamScope,
  workdaysInMonth,
  calendarHoursInMonth,
  effectivePersonHoursInMonth,
  DEFAULT_MONTHLY_HOURS,
  HOURS_PER_WORKDAY,
} from "./domain/index.mjs";
import { publicUser, fail, admin } from "./auth.mjs";
import { SqlJsAdapter } from "./adapters/sqljs.mjs";
import { MssqlAdapter, sqlConfig } from "./adapters/mssql.mjs";
import { table, tables, ident } from "./tables.mjs";
import { entityCollections as kinds } from "../shared/entity-kinds.ts";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mapUser = (r) =>
  r && {
    _id: r.id,
    username: r.username,
    name: r.name,
    role: r.role,
    resourceId: r.resource_id || "",
    active: !!r.active,
    leaders: [],
    password: { salt: r.password_salt, hash: r.password_hash },
    revision: Number(r.revision),
    version: Number(r.version),
  };
export class Store {
  constructor(options = {}) {
    this.env = options.env || process.env;
    this.provider = this.env.DB_PROVIDER || "sqljs";
    if (!["sqljs", "mssql"].includes(this.provider))
      throw Error("DB_PROVIDER sqljs veya mssql olmalıdır.");
    if (this.env.NODE_ENV === "production" && this.provider === "sqljs")
      throw Error("Canlı ortamda DB_PROVIDER=mssql kullanın.");
    this.db =
      options.adapter ||
      (this.provider === "sqljs"
        ? new SqlJsAdapter(
            path.resolve(root, this.env.SQLJS_FILE || "data/planlama.sqlite"),
          )
        : new MssqlAdapter(sqlConfig(this.env)));
  }
  async close() {
    await this.db.close();
  }
  transaction(fn, readOnly = false) {
    return this.db.transaction(fn, readOnly);
  }
  async connect({ migrate = false } = {}) {
    await this.db.open();
    try {
      const auto =
        migrate ||
        this.provider === "sqljs" ||
        (this.env.NODE_ENV !== "production" &&
          this.env.DB_AUTO_MIGRATE === "true");
      await this.transaction(async (c) => {
        const found =
          this.provider === "sqljs"
            ? (
                await c.query(
                  "SELECT name FROM sqlite_master WHERE type='table' AND name='kp_schema_migrations'",
                )
              ).rows.length
            : (
                await c.query(
                  "SELECT OBJECT_ID(N'kp_schema_migrations',N'U') AS id",
                )
              ).rows[0]?.id;
        if (!found) {
          if (!auto)
            throw Error(
              "MSSQL şeması hazır değil. IT şema kurulumu için npm run db:migrate çalıştırmalı.",
            );
          await c.batch(
            await fs.readFile(
              new URL(
                "./migrations/001_" + this.provider + ".sql",
                import.meta.url,
              ),
              "utf8",
            ),
          );
        }
        const versions = (
          await c.query("SELECT version FROM kp_schema_migrations")
        ).rows.map((r) => Number(r.version));
        if (!versions.includes(1))
          throw Error("Desteklenmeyen veritabanı şema sürümü.");
        if (!versions.includes(3)) {
          if (!auto)
            throw Error(
              "Takım bazlı kaynak şeması için IT npm run db:migrate çalıştırmalı.",
            );
          if (versions.includes(2)) {
            const personRows = (
              await c.query("SELECT * FROM kp_person_allocations")
            ).rows;
            const resourceVersions = (
              await c.query(
                "SELECT * FROM kp_resource_versions ORDER BY effective_month DESC",
              )
            ).rows;
            const teamRows = (await c.query("SELECT * FROM kp_allocations"))
              .rows;
            const totals = new Map(
              teamRows.map((r) => [
                r.team_id + "|" + r.project_id + "|" + r.month,
                Number(r.amount),
              ]),
            );
            for (const row of personRows) {
              const version = resourceVersions.find(
                (v) =>
                  v.resource_id === row.resource_id &&
                  v.effective_month <= row.month,
              );
              if (!version?.team_id)
                throw Error(
                  "Kişi tahsisi takımına eşlenemedi: " +
                    row.resource_id +
                    " / " +
                    row.month,
                );
              const key =
                version.team_id + "|" + row.project_id + "|" + row.month;
              totals.set(key, (totals.get(key) || 0) + Number(row.amount));
            }
            await c.upsert(
              "allocations",
              [...totals].map(([key, amount]) => {
                const [team_id, project_id, month] = key.split("|");
                return { team_id, project_id, month, amount };
              }),
            );
            await c.remove("person_allocations", personRows);
            await c.query("DELETE FROM kp_revisions WHERE kind='allocation'");
            await c.upsert(
              "revisions",
              [...totals.keys()].map((key) => ({
                kind: "allocation",
                record_id: key,
                revision: 1,
              })),
            );
            if (personRows.length)
              await c.query(
                "UPDATE kp_settings SET generation=generation+1 WHERE id=1",
              );
          }
          await c.query("INSERT INTO kp_schema_migrations(version) VALUES(3)");
        }
        if (!versions.includes(4)) {
          if (!auto)
            throw Error(
              "Kilometre taşı şeması için IT npm run db:migrate çalıştırmalı.",
            );
          await c.batch(
            await fs.readFile(
              new URL(
                "./migrations/004_" + this.provider + ".sql",
                import.meta.url,
              ),
              "utf8",
            ),
          );
        }
        if (!versions.includes(5)) {
          if (!auto)
            throw Error(
              "Gün bazlı kilometre taşı şeması için IT npm run db:migrate çalıştırmalı.",
            );
          const script = await fs.readFile(
            new URL(
              "./migrations/005_" + this.provider + ".sql",
              import.meta.url,
            ),
            "utf8",
          );
          for (const batch of script
            .split(/^GO\s*$/gim)
            .filter((x) => x.trim()))
            await c.batch(batch);
        }
        if (!versions.includes(6)) {
          if (!auto)
            throw Error(
              "Gün bazlı çalışan tarihleri için IT npm run db:migrate çalıştırmalı.",
            );
          const script = await fs.readFile(
            new URL(
              "./migrations/006_" + this.provider + ".sql",
              import.meta.url,
            ),
            "utf8",
          );
          for (const batch of script
            .split(/^GO\s*$/gim)
            .filter((x) => x.trim()))
            await c.batch(batch);
        }
        if (!versions.includes(7)) {
          if (!auto)
            throw Error(
              "Gerçekleşen kişi dağılımı şeması için IT npm run db:migrate çalıştırmalı.",
            );
          await c.batch(
            await fs.readFile(
              new URL(
                "./migrations/007_" + this.provider + ".sql",
                import.meta.url,
              ),
              "utf8",
            ),
          );
        }
        if (!versions.includes(8)) {
          if (!auto)
            throw Error(
              "Takım yöneticisi şeması için IT npm run db:migrate çalıştırmalı.",
            );
          await c.batch(
            await fs.readFile(
              new URL(
                "./migrations/008_" + this.provider + ".sql",
                import.meta.url,
              ),
              "utf8",
            ),
          );
        }
        if (!versions.includes(9)) {
          if (!auto)
            throw Error(
              "Liderlik yöneticisi şeması için IT npm run db:migrate çalıştırmalı.",
            );
          await c.batch(
            await fs.readFile(
              new URL(
                "./migrations/009_" + this.provider + ".sql",
                import.meta.url,
              ),
              "utf8",
            ),
          );
        }
        if (!versions.includes(10)) {
          if (!auto)
            throw Error(
              "Kilometre taşı bar yazısı şeması için IT npm run db:migrate çalıştırmalı.",
            );
          await c.batch(
            await fs.readFile(
              new URL(
                "./migrations/010_" + this.provider + ".sql",
                import.meta.url,
              ),
              "utf8",
            ),
          );
        }
        if (!versions.includes(11)) {
          if (!auto)
            throw Error(
              "Gerçekleşen çalışma saatleri şeması için IT npm run db:migrate çalıştırmalı.",
            );
          await c.batch(
            await fs.readFile(
              new URL(
                "./migrations/011_" + this.provider + ".sql",
                import.meta.url,
              ),
              "utf8",
            ),
          );
        }
        if (!versions.includes(12)) {
          if (!auto)
            throw Error(
              "180 saatlik gerçekleşen dağılım dönüşümü için IT npm run db:migrate çalıştırmalı.",
            );
          const previous = (
            await c.query("SELECT * FROM kp_actual_allocations")
          ).rows;
          if (previous.length) {
            await c.upsert(
              "actual_allocations",
              previous.map((row) => ({
                resource_id: row.resource_id,
                project_id: row.project_id,
                month: row.month,
                amount:
                  (row.amount *
                    workdaysInMonth(row.month) *
                    HOURS_PER_WORKDAY) /
                  DEFAULT_MONTHLY_HOURS,
              })),
            );
            await c.query(
              "UPDATE kp_revisions SET revision=revision+1 WHERE kind='allocation' AND record_id LIKE '@actual:%'",
            );
            await c.query(
              "UPDATE kp_settings SET generation=generation+1 WHERE id=1",
            );
          }
          await c.query("INSERT INTO kp_schema_migrations(version) VALUES(12)");
        }
        if (!versions.includes(13)) {
          if (!auto)
            throw Error(
              "Yetkilendirme ve çalışan eşleştirme şeması için IT npm run db:migrate çalıştırmalı.",
            );
          await c.batch(
            await fs.readFile(
              new URL(
                "./migrations/013_" + this.provider + ".sql",
                import.meta.url,
              ),
              "utf8",
            ),
          );
        }
        if (!versions.includes(14)) {
          if (!auto)
            throw Error(
              "İşten Ayrıldı statüsü için IT npm run db:migrate çalıştırmalı.",
            );
          await c.batch(
            await fs.readFile(
              new URL(
                "./migrations/014_" + this.provider + ".sql",
                import.meta.url,
              ),
              "utf8",
            ),
          );
        }
        if (!versions.includes(15)) {
          if (!auto)
            throw Error(
              "Proje sorumlusu alanı için IT npm run db:migrate çalıştırmalı.",
            );
          await c.batch(
            await fs.readFile(
              new URL(
                "./migrations/015_" + this.provider + ".sql",
                import.meta.url,
              ),
              "utf8",
            ),
          );
        }
        if (!versions.includes(16)) {
          if (!auto)
            throw Error(
              "Çoklu bilgi tarihleri için IT npm run db:migrate çalıştırmalı.",
            );
          await c.batch(
            await fs.readFile(
              new URL(
                "./migrations/016_" + this.provider + ".sql",
                import.meta.url,
              ),
              "utf8",
            ),
          );
        }
        if (!versions.includes(17)) {
          if (!auto)
            throw Error(
              "Bilgi aralığı renkleri için IT npm run db:migrate çalıştırmalı.",
            );
          await c.batch(
            await fs.readFile(
              new URL(
                "./migrations/017_" + this.provider + ".sql",
                import.meta.url,
              ),
              "utf8",
            ),
          );
        }
        if (!versions.includes(18)) {
          if (!auto)
            throw Error(
              "Çoklu bilgi açıklamaları için IT npm run db:migrate çalıştırmalı.",
            );
          await c.batch(
            await fs.readFile(
              new URL(
                "./migrations/018_" + this.provider + ".sql",
                import.meta.url,
              ),
              "utf8",
            ),
          );
        }
        if (!versions.includes(19)) {
          if (!auto)
            throw Error(
              "Uzun bilgi açıklamaları için IT npm run db:migrate çalıştırmalı.",
            );
          await c.batch(
            await fs.readFile(
              new URL(
                "./migrations/019_" + this.provider + ".sql",
                import.meta.url,
              ),
              "utf8",
            ),
          );
        }
        if (!versions.includes(20)) {
          if (!auto)
            throw Error(
              "Otokar çalışma takvimi şeması için IT npm run db:migrate çalıştırmalı.",
            );
          await c.batch(
            await fs.readFile(
              new URL(
                "./migrations/020_" + this.provider + ".sql",
                import.meta.url,
              ),
              "utf8",
            ),
          );
          const actual = (await c.query("SELECT * FROM kp_actual_allocations"))
            .rows;
          const amounts = new Map(
            actual.map((row) => [
              row.resource_id + "|" + row.project_id + "|" + row.month,
              Number(row.amount),
            ]),
          );
          const overrides = new Set(
            (await c.query("SELECT * FROM kp_actual_worked_hours")).rows.map(
              (row) => row.resource_id + "|" + row.month,
            ),
          );
          const percentages = (
            await c.query("SELECT * FROM kp_actual_percent_entries")
          ).rows.filter(
            (row) => !overrides.has(row.resource_id + "|" + row.month),
          );
          if (percentages.length) {
            await c.upsert(
              "actual_percent_entries",
              percentages.map((row) => {
                const hours = calendarHoursInMonth(row.month);
                return {
                  ...row,
                  percent: hours
                    ? (((amounts.get(
                        row.resource_id +
                          "|" +
                          row.project_id +
                          "|" +
                          row.month,
                      ) || 0) *
                        DEFAULT_MONTHLY_HOURS) /
                        hours) *
                      100
                    : 0,
                };
              }),
            );
            const existing = (
              await c.query(
                "SELECT * FROM kp_revisions WHERE kind='allocation'",
              )
            ).rows;
            const revisions = new Map(
              existing.map((row) => [row.record_id, Number(row.revision)]),
            );
            await c.upsert(
              "revisions",
              percentages.map((row) => {
                const record_id =
                  "@actual:" +
                  row.resource_id +
                  "|" +
                  row.project_id +
                  "|" +
                  row.month;
                return {
                  kind: "allocation",
                  record_id,
                  revision: (revisions.get(record_id) || 0) + 1,
                };
              }),
            );
            await c.query(
              "UPDATE kp_settings SET generation=generation+1 WHERE id=1",
            );
          }
        }
        if (!versions.includes(21)) {
          if (!auto)
            throw Error(
              "Kişisel izin ve eğitim takvimi için IT npm run db:migrate çalıştırmalı.",
            );
          await c.batch(
            await fs.readFile(
              new URL(
                "./migrations/021_" + this.provider + ".sql",
                import.meta.url,
              ),
              "utf8",
            ),
          );
        }
        if (!versions.includes(22)) {
          if (!auto)
            throw Error(
              "İzin ve eğitim saat hesapları için IT npm run db:migrate çalıştırmalı.",
            );
          await c.batch(
            await fs.readFile(
              new URL(
                "./migrations/022_" + this.provider + ".sql",
                import.meta.url,
              ),
              "utf8",
            ),
          );
          const settings = (
            await c.query(
              "SELECT calendar_days,person_calendar FROM kp_settings WHERE id=1",
            )
          ).rows[0];
          if (settings) {
            const shared = settings.calendar_days
              ? JSON.parse(settings.calendar_days)
              : {};
            const personal = settings.person_calendar
              ? JSON.parse(settings.person_calendar)
              : {};
            const amounts = new Map(
              (await c.query("SELECT * FROM kp_actual_allocations")).rows.map(
                (row) => [
                  row.resource_id + "|" + row.project_id + "|" + row.month,
                  Number(row.amount),
                ],
              ),
            );
            const overrides = new Map(
              (await c.query("SELECT * FROM kp_actual_worked_hours")).rows.map(
                (row) => [row.resource_id + "|" + row.month, Number(row.hours)],
              ),
            );
            const rows = (
              await c.query("SELECT * FROM kp_actual_percent_entries")
            ).rows;
            const updates = [],
              removals = [];
            for (const row of rows) {
              const key =
                  row.resource_id + "|" + row.project_id + "|" + row.month,
                manual = overrides.get(row.resource_id + "|" + row.month);
              const hours = effectivePersonHoursInMonth(
                row.month,
                row.resource_id,
                manual,
                shared,
                personal,
              );
              const amount = amounts.get(key) || 0;
              if (hours === 0 && amount > 0) {
                removals.push({
                  resource_id: row.resource_id,
                  project_id: row.project_id,
                  month: row.month,
                });
                continue;
              }
              const percent = hours
                ? ((amount * DEFAULT_MONTHLY_HOURS) / hours) * 100
                : 0;
              if (Math.abs(Number(row.percent) - percent) > 1e-10)
                updates.push({ ...row, percent });
            }
            if (updates.length || removals.length) {
              await c.upsert("actual_percent_entries", updates);
              await c.remove("actual_percent_entries", removals);
              const existing = (
                await c.query(
                  "SELECT * FROM kp_revisions WHERE kind='allocation'",
                )
              ).rows;
              const revisions = new Map(
                existing.map((row) => [row.record_id, Number(row.revision)]),
              );
              await c.upsert(
                "revisions",
                [...updates, ...removals].map((row) => {
                  const record_id =
                    "@actual:" +
                    row.resource_id +
                    "|" +
                    row.project_id +
                    "|" +
                    row.month;
                  return {
                    kind: "allocation",
                    record_id,
                    revision: (revisions.get(record_id) || 0) + 1,
                  };
                }),
              );
              await c.query(
                "UPDATE kp_settings SET generation=generation+1 WHERE id=1",
              );
            }
          }
        }
        if (!versions.includes(24)) {
          if (!auto)
            throw Error(
              "Risk yönetimi şeması için IT npm run db:migrate çalıştırmalı.",
            );
          await c.batch(
            await fs.readFile(
              new URL(
                "./migrations/024_" + this.provider + ".sql",
                import.meta.url,
              ),
              "utf8",
            ),
          );
        }
        if (!versions.includes(23)) {
          if (!auto)
            throw Error(
              "Kritik konu olmadan bilgi kaydı için IT npm run db:migrate çalıştırmalı.",
            );
          await c.batch(
            await fs.readFile(
              new URL(
                "./migrations/023_" + this.provider + ".sql",
                import.meta.url,
              ),
              "utf8",
            ),
          );
        }
        if (!versions.includes(25)) {
          if (!auto)
            throw Error(
              "Değişiklik geçmişi için IT npm run db:migrate çalıştırmalı.",
            );
          await c.batch(
            await fs.readFile(
              new URL(
                "./migrations/025_" + this.provider + ".sql",
                import.meta.url,
              ),
              "utf8",
            ),
          );
        }
        if (!versions.includes(26)) {
          if (!auto)
            throw Error(
              "Kritik konu sıralaması için IT npm run db:migrate çalıştırmalı.",
            );
          await c.batch(
            await fs.readFile(
              new URL(
                "./migrations/026_" + this.provider + ".sql",
                import.meta.url,
              ),
              "utf8",
            ),
          );
          // Keep the order previously displayed by the project screen. All
          // further reads/writes use the persisted array positions instead.
          const rows = (
            await c.query(
              "SELECT project_id,id,name,start_date,end_date,start_month,end_month FROM kp_project_milestones ORDER BY project_id,id",
            )
          ).rows
            .map((row) => ({
              ...row,
              start_date: row.start_date || row.start_month + "-01",
              end_date:
                row.end_date ||
                new Date(
                  Date.UTC(
                    Number(row.end_month.slice(0, 4)),
                    Number(row.end_month.slice(5, 7)),
                    0,
                  ),
                )
                  .toISOString()
                  .slice(0, 10),
            }))
            .sort(
              (a, b) =>
                a.project_id.localeCompare(b.project_id) ||
                a.start_date.localeCompare(b.start_date) ||
                a.end_date.localeCompare(b.end_date) ||
                a.name.localeCompare(b.name, "tr"),
            );
          let previousProject,
            position = 0;
          for (const row of rows) {
            if (row.project_id !== previousProject) position = 0;
            previousProject = row.project_id;
            await c.query(
              "UPDATE kp_project_milestones SET sort_order=@p0 WHERE project_id=@p1 AND id=@p2",
              [position++, row.project_id, row.id],
            );
          }
          if (rows.length)
            await c.query(
              "UPDATE kp_settings SET generation=generation+1 WHERE id=1",
            );
        }
        if (
          !(await c.query("SELECT id FROM kp_settings WHERE id=1")).rows.length
        ) {
          if (!auto)
            throw Error(
              "Başlangıç listeleri yok. Önce npm run db:migrate çalıştırın.",
            );
          await c.upsert("settings", [
            {
              id: 1,
              generation: 0,
              legacy_archive: null,
              calendar_days: "{}",
              person_calendar: "{}",
            },
          ]);
          await c.upsert(
            "leaders",
            catalog.leaders.map((name) => ({ name, manager_name: "" })),
          );
          await c.upsert(
            "teams",
            catalog.teams.map((t) => ({
              id: t.id,
              name: t.name,
              leader_name: t.lead || null,
              manager_name: "",
              excel_capacity: t.excelCapacity,
              catalog: true,
            })),
          );
        }
      });
    } catch (e) {
      await this.close();
      throw e;
    }
  }
  async users(c = this.db) {
    const users = (
      await c.query("SELECT * FROM kp_users ORDER BY username")
    ).rows.map(mapUser);
    const map = new Map(users.map((u) => [u._id, u]));
    for (const r of (
      await c.query("SELECT * FROM kp_user_leaders ORDER BY leader_name")
    ).rows)
      map.get(r.user_id)?.leaders.push(r.leader_name);
    return users;
  }
  async findUser(filter, c = this.db) {
    const col = filter.id !== undefined ? "id" : "username";
    const r = (
      await c.query(`SELECT * FROM kp_users WHERE [${col}]=@p0`, [
        filter.id ?? filter.username,
      ])
    ).rows[0];
    if (!r) return null;
    const u = mapUser(r);
    u.leaders = (
      await c.query(
        "SELECT leader_name FROM kp_user_leaders WHERE user_id=@p0 ORDER BY leader_name",
        [u._id],
      )
    ).rows.map((x) => x.leader_name);
    return u;
  }
  async saveUser(u, c) {
    await c.upsert("users", [
      {
        id: u._id,
        username: u.username,
        name: u.name,
        role: u.role,
        resource_id: u.resourceId || null,
        active: u.active,
        password_salt: u.password.salt,
        password_hash: u.password.hash,
        revision: u.revision,
        version: u.version,
      },
    ]);
    await c.query("DELETE FROM kp_user_leaders WHERE user_id=@p0", [u._id]);
    await c.upsert(
      "user_leaders",
      [...new Set(u.leaders)].map((leader_name) => ({
        user_id: u._id,
        leader_name,
      })),
    );
  }
  async bootstrapUser(u) {
    await this.transaction(async (c) => {
      if (!(await this.findUser({ id: u._id }, c))) await this.saveUser(u, c);
    });
  }
  async deleteUser(id, revision, c) {
    return (
      await c.query("DELETE FROM kp_users WHERE id=@p0 AND revision=@p1", [
        id,
        revision,
      ])
    ).rowCount;
  }
  async createSession(s) {
    await this.transaction((c) =>
      c.upsert("sessions", [
        {
          token_hash: s._id,
          user_id: s.userId,
          user_version: s.userVersion,
          csrf: s.csrf,
          expires_at: s.expiresAt.toISOString(),
        },
      ]),
    );
  }
  async session(id) {
    const r = (
      await this.db.query(
        "SELECT * FROM kp_sessions WHERE token_hash=@p0 AND expires_at>@p1",
        [id, new Date().toISOString()],
      )
    ).rows[0];
    return (
      r && {
        _id: r.token_hash,
        userId: r.user_id,
        userVersion: Number(r.user_version),
        csrf: r.csrf,
      }
    );
  }
  async deleteSession(id) {
    await this.transaction((c) =>
      c.query("DELETE FROM kp_sessions WHERE token_hash=@p0", [id]),
    );
  }
  async revokeUser(id, c) {
    await c.query("DELETE FROM kp_sessions WHERE user_id=@p0", [id]);
  }
  async cleanupSessions() {
    await this.transaction((c) =>
      c.query("DELETE FROM kp_sessions WHERE expires_at<=@p0", [
        new Date().toISOString(),
      ]),
    );
  }
  async generation() {
    return Number(
      (await this.db.query("SELECT generation FROM kp_settings WHERE id=1"))
        .rows[0].generation,
    );
  }
  async read(c = this.db, viewUser) {
    const s = (await c.query("SELECT * FROM kp_settings WHERE id=1")).rows[0];
    const leaderRows = (await c.query("SELECT * FROM kp_leaders ORDER BY name"))
      .rows;
    const d = {
      teams: [],
      projects: [],
      risks: [],
      resources: [],
      allocations: {},
      actualAllocations: {},
      actualWorkedHours: {},
      actualPercentEntries: {},
      workCalendar: s.calendar_days ? JSON.parse(s.calendar_days) : {},
      personCalendar: s.person_calendar ? JSON.parse(s.person_calendar) : {},
      revisions: {},
      leaders: leaderRows.map((r) => r.name),
      leaderManagers: Object.fromEntries(
        leaderRows
          .filter((r) => r.manager_name)
          .map((r) => [r.name, r.manager_name]),
      ),
      catalogVersion: 2,
    };
    if (s.legacy_archive) d.legacyArchive = JSON.parse(s.legacy_archive);
    d.teams = (await c.query("SELECT * FROM kp_teams ORDER BY id")).rows.map(
      (r) => ({
        id: r.id,
        name: r.name,
        lead: r.leader_name || "",
        managerName: r.manager_name || "",
        excelCapacity: r.excel_capacity,
        catalog: !!r.catalog,
      }),
    );
    d.projects = (
      await c.query("SELECT * FROM kp_projects ORDER BY id")
    ).rows.map((r) => ({
      id: r.id,
      name: r.name,
      responsibleName: r.responsible_name || "",
      start: r.start_month,
      end: r.end_month,
      phases: {},
      phaseColors: {},
      milestones: [],
    }));
    const pm = new Map(d.projects.map((p) => [p.id, p]));
    d.risks = (
      await c.query("SELECT * FROM kp_project_risks ORDER BY id")
    ).rows.map((row) => JSON.parse(row.payload));
    for (const r of (await c.query("SELECT * FROM kp_project_phases")).rows) {
      const p = pm.get(r.project_id);
      if (r.label !== null) p.phases[r.month] = r.label;
      if (r.color) p.phaseColors[r.month] = r.color;
    }
    for (const r of (
      await c.query(
        "SELECT * FROM kp_project_milestones ORDER BY project_id,sort_order,id",
      )
    ).rows) {
      pm.get(r.project_id)?.milestones.push({
        id: r.id,
        name: r.name,
        start: r.start_date || r.start_month + "-01",
        end:
          r.end_date ||
          new Date(
            Date.UTC(
              Number(r.end_month.slice(0, 4)),
              Number(r.end_month.slice(5, 7)),
              0,
            ),
          )
            .toISOString()
            .slice(0, 10),
        barColor: r.bar_color || "red",
        barStyle: r.bar_style || "solid",
        ...(Number(r.has_critical_topics) === 0
          ? { hasCriticalTopics: false }
          : {}),
        ...(r.bar_text ? { barText: r.bar_text } : {}),
        ...(r.bar_notes && r.bar_notes !== "[]"
          ? { barNotes: JSON.parse(r.bar_notes) }
          : {}),
        ...(r.extra_ranges && r.extra_ranges !== "[]"
          ? { additionalRanges: JSON.parse(r.extra_ranges) }
          : {}),
      });
    }
    d.resources = (
      await c.query("SELECT * FROM kp_resources ORDER BY id")
    ).rows.map((r) => ({
      id: r.id,
      name: r.name,
      note: r.note,
      ...(r.code ? { code: r.code } : {}),
      versions: [],
    }));
    const rm = new Map(d.resources.map((r) => [r.id, r]));
    for (const r of (
      await c.query(
        "SELECT * FROM kp_resource_versions ORDER BY effective_month",
      )
    ).rows)
      rm.get(r.resource_id).versions.push({
        effective: r.effective_month,
        team: r.team_id || "",
        lead: r.leader_name || "",
        status: r.status,
        included: !!r.included,
        start: r.start_date || (r.start_month ? r.start_month + "-01" : ""),
        end:
          r.end_date ||
          (r.end_month
            ? new Date(
                Date.UTC(
                  Number(r.end_month.slice(0, 4)),
                  Number(r.end_month.slice(5, 7)),
                  0,
                ),
              )
                .toISOString()
                .slice(0, 10)
            : ""),
        amount: r.amount,
      });
    d.allocations = await readCompositeMap(
      c,
      this.provider,
      "allocations",
      "amount",
      // Legacy IDs containing a composite separator must keep the previous
      // complete-read semantics, which scopeData resolves by key prefix.
      viewUser &&
        viewUser.role !== "admin" &&
        !d.teams.some((t) => t.id.includes("|"))
        ? [...visibleTeamScope(d, viewUser).ids]
        : undefined,
    );
    d.actualAllocations = await readCompositeMap(
      c,
      this.provider,
      "actual_allocations",
      "amount",
    );
    d.actualWorkedHours = await readCompositeMap(
      c,
      this.provider,
      "actual_worked_hours",
      "hours",
    );
    d.actualPercentEntries = await readCompositeMap(
      c,
      this.provider,
      "actual_percent_entries",
      "percent",
    );
    d.revisions = await readRecordMap(
      c,
      "SELECT kind,record_id,revision FROM kp_revisions",
      ["kind", "record_id", "revision"],
      revisionRecordKey,
      Number,
    );
    return { data: d, generation: Number(s.generation) };
  }
  async view(u) {
    return this.transaction(async (c) => {
      const active = await this.findUser({ id: u._id }, c);
      if (!active?.active || active.version !== u.version)
        fail(401, "Oturum yenilenmeli.");
      // Only this authenticated read-only path may narrow planned SQL rows.
      // Mutations still validate and persist a complete snapshot; actual rows
      // remain complete here to compute historical anonymous team totals.
      const { data, generation } = await this.read(c, publicUser(active));
      return this.projectView(data, generation, active, c);
    }, true);
  }
  async projectView(data, generation, active, c) {
    if (active.role === "admin") {
      const users = await this.users(c);
      data.users = users.map(publicUser);
      for (const x of users) data.revisions["user:" + x._id] = x.revision;
    }
    const principal = publicUser(active);
    return { data: scopeData(data, principal), generation, user: principal };
  }
  async auditLog(u, { offset = 0, limit = 50 } = {}) {
    if (
      !Number.isInteger(offset) ||
      offset < 0 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      fail(400, "Geçersiz sayfa.");
    return this.transaction(async (c) => {
      const active = await this.findUser({ id: u._id }, c);
      if (!active?.active || active.version !== u.version)
        fail(401, "Oturum yenilenmeli.");
      admin(active);
      const total = Number(
        (await c.query("SELECT COUNT(*) AS n FROM kp_audit_events")).rows[0].n,
      );
      const page =
        this.provider === "mssql"
          ? "OFFSET @p0 ROWS FETCH NEXT @p1 ROWS ONLY"
          : "LIMIT @p1 OFFSET @p0";
      const rows = (
        await c.query(
          "SELECT * FROM kp_audit_events ORDER BY occurred_at DESC,id DESC " +
            page,
          [offset, limit],
        )
      ).rows;
      return {
        total,
        entries: rows.map((row) => ({
          ...row,
          changes: JSON.parse(row.changes),
        })),
      };
    }, true);
  }
  copySnapshot(data) {
    return cloneMutationSnapshot(data);
  }
  async mutate(
    u,
    fn,
    { auditUsers = false, returnView = false, planningDelta } = {},
  ) {
    return this.transaction(async (c) => {
      const active = await this.findUser({ id: u._id }, c);
      if (!active?.active || active.version !== u.version)
        fail(401, "Oturum yenilenmeli.");
      const { data, generation } = await this.read(c),
        before = this.copySnapshot(data);
      const beforeUsers = auditUsers ? await this.users(c) : [];
      const result = await fn(data, active, c, generation);
      const valid = validate(data);
      const changeSet = await this.persist(before, valid, c);
      const afterUsers = auditUsers ? await this.users(c) : [];
      await c.upsert(
        "audit_events",
        auditEntries(before, valid, active, {
          beforeUsers,
          afterUsers,
          changeSet,
        }),
      );
      const assignments = ["generation=generation+1"],
        values = [];
      // Column names are fixed here; changed JSON values remain SQL parameters.
      for (const [column, oldValue, newValue] of [
        [
          "legacy_archive",
          before.legacyArchive || null,
          valid.legacyArchive || null,
        ],
        ["calendar_days", before.workCalendar || {}, valid.workCalendar || {}],
        [
          "person_calendar",
          before.personCalendar || {},
          valid.personCalendar || {},
        ],
      ]) {
        const oldJson = JSON.stringify(oldValue),
          newJson = JSON.stringify(newValue);
        if (oldJson === newJson) continue;
        assignments.push(ident(column) + "=@p" + values.length);
        values.push(newValue === null ? null : newJson);
      }
      await c.query(
        "UPDATE kp_settings SET " + assignments.join(",") + " WHERE id=1",
        values,
      );
      if (returnView) {
        // Preserve the SQL read representation of unchanged entities. If
        // validation normalized metadata, re-read within the same transaction.
        const metadataKeys = new Set([
          ...Object.keys(before),
          ...Object.keys(valid),
        ]);
        for (const key of numericSnapshotMaps) metadataKeys.delete(key);
        const unchanged = [...metadataKeys].every(
          (key) => JSON.stringify(before[key]) === JSON.stringify(valid[key]),
        );
        const responseData = unchanged
          ? {
              ...before,
              ...Object.fromEntries(
                numericSnapshotMaps.map((key) => [key, valid[key]]),
              ),
              revisions: { ...valid.revisions },
            }
          : (await this.read(c)).data;
        const view = await this.projectView(
          responseData,
          generation + 1,
          active,
          c,
        );
        // Only an unchanged, matching base can receive a patch. Scope the entire
        // view first so values and deletion revisions follow existing permissions.
        const planningOnly =
          unchanged &&
          planningDelta?.baseGeneration === generation &&
          ["actual", "workedHours", "percent"].every(
            (kind) => changeSet[kind].length === 0,
          ) &&
          // A same-value write can advance a non-planning revision too.
          // Such revisions cannot be represented by an allocation-only patch.
          [before.revisions, valid.revisions].every((revisions) =>
            Object.keys(revisions).every(
              (key) =>
                key.startsWith("allocation:") ||
                before.revisions[key] === valid.revisions[key],
            ),
          );
        if (planningOnly) {
          const ids = new Set([
            ...planningDelta.ids,
            ...changeSet.allocation.map((change) => change.id),
          ]);
          return {
            responseMode: "planning-delta-v1",
            baseGeneration: generation,
            generation: view.generation,
            user: view.user,
            allocations: [...ids]
              .filter((id) =>
                Object.hasOwn(view.data.revisions, "allocation:" + id),
              )
              .map((id) => ({
                id,
                value: Object.hasOwn(view.data.allocations, id)
                  ? view.data.allocations[id]
                  : null,
                revision: view.data.revisions["allocation:" + id],
              })),
          };
        }
        return view;
      }
      return result;
    });
  }
  async persist(before, next, c) {
    const removedLeaders = new Set(
      (before.leaders || []).filter((name) => !next.leaders?.includes(name)),
    );
    if (removedLeaders.size) {
      const linked = (
        await c.query("SELECT DISTINCT leader_name FROM kp_user_leaders")
      ).rows.filter((row) => removedLeaders.has(row.leader_name));
      if (linked.length)
        fail(
          409,
          "Kaldırılacak liderlikler mevcut kullanıcı yetkilerinde kullanılıyor: " +
            linked.map((row) => row.leader_name).join(", ") +
            ". Önce Yetki Kontrol Ekranı'ndaki liderlik eşleştirmelerini güncelleyin.",
        );
    }
    const changed = dataChanges(before, next);
    await c.upsert(
      "leaders",
      changed.leader
        .filter((item) => item.value !== undefined)
        .map(({ value }) => ({
          name: value.name,
          manager_name: value.managerName,
        })),
    );
    const up = (kind) =>
      changed[kind].filter((x) => x.value !== undefined).map((x) => x.value);
    await c.upsert(
      "teams",
      up("team").map((t) => ({
        id: t.id,
        name: t.name,
        leader_name: t.lead || null,
        manager_name: t.managerName || "",
        excel_capacity: t.excelCapacity,
        catalog: t.catalog !== false,
      })),
    );
    const ps = up("project");
    await c.upsert(
      "projects",
      ps.map((p) => ({
        id: p.id,
        name: p.name,
        responsible_name: p.responsibleName || "",
        start_month: p.start,
        end_month: p.end,
      })),
    );
    await c.upsert(
      "project_risks",
      up("risk").map((r) => ({
        id: r.id,
        project_id: r.projectId,
        payload: JSON.stringify(r),
      })),
    );
    await c.remove(
      "project_risks",
      changed.risk
        .filter((x) => x.value === undefined)
        .map((x) => ({ id: x.id })),
    );
    const rs = up("resource");
    await c.upsert(
      "resources",
      rs.map((r) => ({
        id: r.id,
        name: r.name,
        note: r.note,
        code: r.code || null,
      })),
    );
    // Replace children for changed parents. Fixed IDs are parameters, never interpolated SQL.
    const clearChildren = async (name, field, ids) => {
      if (!Object.hasOwn(tables[name]?.columns || {}, field))
        throw Error("Unknown child field");
      const values = [...ids];
      for (let offset = 0; offset < values.length; offset += 500) {
        const batch = values.slice(offset, offset + 500);
        await c.query(
          `DELETE FROM ${table(name)} WHERE ${ident(field)} IN (${batch.map((_, i) => "@p" + i).join(",")})`,
          batch,
        );
      }
    };
    if (ps.length) {
      await clearChildren(
        "project_phases",
        "project_id",
        new Set(ps.map((p) => p.id)),
      );
      await c.upsert(
        "project_phases",
        ps.flatMap((p) =>
          [
            ...new Set([
              ...Object.keys(p.phases),
              ...Object.keys(p.phaseColors || {}),
            ]),
          ].map((month) => ({
            project_id: p.id,
            month,
            label: p.phases[month] ?? null,
            color: p.phaseColors?.[month] || null,
          })),
        ),
      );
      await clearChildren(
        "project_milestones",
        "project_id",
        new Set(ps.map((p) => p.id)),
      );
      await c.upsert(
        "project_milestones",
        ps.flatMap((p) =>
          (p.milestones || []).map((milestone, sort_order) => ({
            project_id: p.id,
            id: milestone.id,
            name: milestone.name,
            start_month: milestone.start.slice(0, 7),
            end_month: milestone.end.slice(0, 7),
            start_date: milestone.start,
            end_date: milestone.end,
            bar_color: milestone.barColor || "red",
            bar_style: milestone.barStyle || "solid",
            has_critical_topics: milestone.hasCriticalTopics === false ? 0 : 1,
            bar_text: milestone.barText || "",
            bar_notes: JSON.stringify(milestone.barNotes || []),
            extra_ranges: JSON.stringify(milestone.additionalRanges || []),
            sort_order,
          })),
        ),
      );
    }
    if (rs.length) {
      await clearChildren(
        "resource_versions",
        "resource_id",
        new Set(rs.map((r) => r.id)),
      );
      await c.upsert(
        "resource_versions",
        rs.flatMap((r) =>
          r.versions.map((v) => ({
            resource_id: r.id,
            effective_month: v.effective,
            team_id: v.team || null,
            leader_name: v.lead || null,
            status: v.status,
            included: v.included,
            start_month: v.start ? v.start.slice(0, 7) : null,
            end_month: v.end ? v.end.slice(0, 7) : null,
            start_date: v.start || null,
            end_date: v.end || null,
            amount: v.amount,
          })),
        ),
      );
    }
    const allocationKey = (id) => {
      const [team_id, project_id, month] = id.split("|");
      return { team_id, project_id, month };
    };
    await c.remove(
      "allocations",
      changed.allocation
        .filter((x) => x.value === undefined)
        .map((x) => allocationKey(x.id)),
    );
    await c.upsert(
      "allocations",
      changed.allocation
        .filter((x) => x.value !== undefined)
        .map((x) => ({ ...allocationKey(x.id), amount: x.value })),
    );
    const actualKey = (id) => {
      const [resource_id, project_id, month] = id.split("|");
      return { resource_id, project_id, month };
    };
    await c.remove(
      "actual_allocations",
      changed.actual
        .filter((x) => x.value === undefined)
        .map((x) => actualKey(x.id)),
    );
    await c.upsert(
      "actual_allocations",
      changed.actual
        .filter((x) => x.value !== undefined)
        .map((x) => ({ ...actualKey(x.id), amount: x.value })),
    );
    const worked = changed.workedHours;
    const workedKey = (id) => {
      const [resource_id, month] = id.split("|");
      return { resource_id, month };
    };
    await c.remove(
      "actual_worked_hours",
      worked.filter((x) => x.value === undefined).map((x) => workedKey(x.id)),
    );
    await c.upsert(
      "actual_worked_hours",
      worked
        .filter((x) => x.value !== undefined)
        .map((x) => ({ ...workedKey(x.id), hours: x.value })),
    );
    const percentages = changed.percent;
    await c.remove(
      "actual_percent_entries",
      percentages
        .filter((x) => x.value === undefined)
        .map((x) => actualKey(x.id)),
    );
    await c.upsert(
      "actual_percent_entries",
      percentages
        .filter((x) => x.value !== undefined)
        .map((x) => ({ ...actualKey(x.id), percent: x.value })),
    );
    for (const kind of ["resource", "project", "team"])
      await c.remove(
        kinds[kind],
        changed[kind]
          .filter((x) => x.value === undefined)
          .map((x) => ({ id: x.id })),
      );
    await c.upsert(
      "revisions",
      Object.keys(next.revisions)
        .filter(
          (k) =>
            !k.startsWith("user:") &&
            next.revisions[k] !== (before.revisions[k] || 0),
        )
        .map((k) => {
          const revision = next.revisions[k];
          const i = k.indexOf(":");
          return k.startsWith("risk:")
            ? { kind: "allocation", record_id: "@risk:" + k.slice(5), revision }
            : k.startsWith("actual:")
              ? {
                  kind: "allocation",
                  record_id: "@actual:" + k.slice(7),
                  revision,
                }
              : k.startsWith("workedHours:")
                ? {
                    kind: "allocation",
                    record_id: "@worked:" + k.slice(12),
                    revision,
                  }
                : k.startsWith("calendar:")
                  ? {
                      kind: "allocation",
                      record_id: "@calendar:" + k.slice(9),
                      revision,
                    }
                  : k.startsWith("personDay:")
                    ? {
                        kind: "allocation",
                        record_id: "@person:" + k.slice(10),
                        revision,
                      }
                    : {
                        kind: k.slice(0, i),
                        record_id: k.slice(i + 1),
                        revision,
                      };
        }),
    );
    await c.remove(
      "leaders",
      changed.leader
        .filter((item) => item.value === undefined)
        .map(({ id: name }) => ({ name })),
    );
    return changed;
  }
}
