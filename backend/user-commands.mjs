import { z } from "zod";
import { ROOT_ADMIN_ID, isEmployeeResource } from "../shared/access.ts";
import { admin, fail, token } from "./auth.mjs";

export const permissionInput = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,120}$/),
    role: z.enum(["admin", "manager", "normal"]),
    leaders: z.array(z.string()).max(100),
    resourceId: z.string().max(120).default(""),
    revision: z.number().int().nonnegative(),
  })
  .strict();
export const accountInput = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9._@+-]{3,100}$/),
    password: z.string().min(10).max(256),
    role: z.enum(["manager", "normal"]),
    leaders: z.array(z.string()).max(100),
    resourceId: z.string().min(1).max(120),
  })
  .strict();

async function checkScope(d, session, input, id) {
  if (input.leaders.some((leader) => !d.leaders.includes(leader)))
    fail(400, "Geçersiz liderlik seçimi.");
  const resourceId = input.role === "admin" ? "" : input.resourceId;
  const resource = d.resources.find((r) => r.id === resourceId);
  if (resourceId && (!resource || !isEmployeeResource(resource)))
    fail(400, "Çalışan kaydı bulunamadı veya ilan kaydı seçildi.");
  if (resourceId) {
    const linked = (
      await session.query(
        "SELECT id FROM kp_users WHERE resource_id=@p0 AND id<>@p1",
        [resourceId, id],
      )
    ).rows;
    if (linked.length)
      fail(409, "Bu çalışan kaydı başka bir kullanıcıya bağlı.");
  }
  return { resource, resourceId };
}

export async function updatePermissions(store, d, u, session, input) {
  admin(u);
  if (input.id === ROOT_ADMIN_ID)
    fail(403, "Ana yönetici yetkileri değiştirilemez.");
  const old = await store.findUser({ id: input.id }, session);
  if (!old) fail(404, "Kullanıcı bulunamadı.");
  if (old.revision !== input.revision)
    fail(409, "Yetkiler başka kullanıcı tarafından değiştirildi. Yenileyin.");
  const { resourceId } = await checkScope(d, session, input, input.id);
  await store.saveUser(
    {
      ...old,
      role: input.role,
      leaders: input.role === "admin" ? [] : input.leaders,
      resourceId,
      revision: old.revision + 1,
      version: old.version + 1,
    },
    session,
  );
  await store.revokeUser(input.id, session);
}

export async function createEmployeeAccount(
  store,
  d,
  u,
  session,
  input,
  password,
) {
  admin(u);
  if (await store.findUser({ username: input.username }, session))
    fail(409, "Bu kullanıcı adı zaten kullanılıyor.");
  const id = "user-" + token();
  const { resource, resourceId } = await checkScope(d, session, input, id);
  const name = input.name || resource.name;
  if (name.length > 150)
    fail(400, "Hesapta gösterilecek ad en fazla 150 karakter olmalıdır.");
  await store.saveUser(
    {
      _id: id,
      username: input.username,
      name,
      role: input.role,
      leaders: input.leaders,
      resourceId,
      active: true,
      password,
      revision: 1,
      version: 1,
    },
    session,
  );
}
