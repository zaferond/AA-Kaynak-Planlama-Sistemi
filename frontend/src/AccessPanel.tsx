import AuditLogDialog from "./AuditLogDialog";
import { useEffect, useState } from "react";
import { ShieldCheck, UserRound, Users, Search } from "lucide-react";
import type { Data } from "./model";
import { fold } from "./model";
import type { Account, Role } from "./access";
import { ROOT_ADMIN_ID, isEmployeeResource } from "./access";
import { saveUser, createUser, type UserInput } from "./storage";
type PermissionForm = UserInput & {
  username?: string;
  name?: string;
  password?: string;
  confirmation?: string;
};
const roleLabel: Record<Role, string> = {
  admin: "Admin",
  manager: "Yönetici",
  normal: "Normal Kullanıcı",
};
export default function AccessPanel({
  data,
  onSaved,
}: {
  data: Data;
  onSaved: (d: Data) => void;
}) {
  const [form, setForm] = useState<PermissionForm | null>(null),
    [query, setQuery] = useState(""),
    [leaderQuery, setLeaderQuery] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const selected = data.users?.find((user) => user.id === form?.id);
  const users = (data.users || []).filter((user) =>
    fold(user.username + " " + user.name).includes(fold(query)),
  );
  const people = data.resources
    .filter(isEmployeeResource)
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const creating = !!form && !form.id;
  const linkedUsers = new Map(
    (data.users || [])
      .filter((u) => u.resourceId)
      .map((u) => [u.resourceId, u]),
  );
  const availablePeople = people.filter((p) => !linkedUsers.has(p.id));
  const selectedPerson = people.find((p) => p.id === form?.resourceId);
  function startAccount() {
    setError("");
    setNotice("");
    setLeaderQuery("");
    setForm({
      id: "",
      role: "normal",
      leaders: [],
      resourceId: "",
      revision: 0,
      name: "",
      username: "",
      password: "",
      confirmation: "",
    });
  }
  useEffect(() => {
    if (form && window.innerWidth <= 1000)
      document
        .querySelector(".access-permission-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [form?.id]);
  function edit(user: Account) {
    if (user.id === ROOT_ADMIN_ID) return;
    setError("");
    setNotice("");
    setLeaderQuery("");
    setForm({
      id: user.id,
      role: user.role,
      leaders: [...user.leaders],
      resourceId: user.resourceId || "",
      revision: data.revisions["user:" + user.id] || 0,
    });
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form || busy) return;
    setError("");
    if (creating && form.password !== form.confirmation) {
      setError("Şifreler eşleşmiyor.");
      return;
    }
    setBusy(true);
    try {
      const updated = creating
        ? await createUser({
            username: form.username || "",
            name: form.name || "",
            password: form.password || "",
            role: form.role === "manager" ? "manager" : "normal",
            leaders: form.leaders,
            resourceId: form.resourceId,
          })
        : await saveUser({
            id: form.id,
            role: form.role,
            leaders: form.leaders,
            resourceId: form.resourceId,
            revision: form.revision,
          });
      onSaved(updated);
      setForm(null);
      setNotice(
        creating
          ? "Çalışanın hesabı oluşturuldu ve yetkileri tanımlandı."
          : "Yetkiler kaydedildi. Kullanıcının açık oturumları yenilendi.",
      );
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel accesspanel access-control-panel">
      <div className="panelhead">
        <div>
          <h2>Yetkilendirme</h2>
          <p>
            Çalışanlara hesap açın; kullanıcıların rol, liderlik ve çalışan
            eşleştirmelerini yönetin.
          </p>
        </div>
        <button
          className="button primary"
          disabled={busy || !availablePeople.length}
          onClick={startAccount}
        >
          Çalışana Yetki Tanımla
        </button>
        <button className="button" onClick={() => setShowAudit(true)}>
          Değişiklik Geçmişi
        </button>
        <span className="access-user-count">
          <Users size={15} />
          {data.users?.length || 0} Kullanıcı
        </span>
      </div>
      <div className="access-role-overview" aria-label="Rol özeti">
        <div>
          <ShieldCheck size={17} />
          <strong>Admin</strong>
          <span>Tüm veriler ve yetkilendirme</span>
        </div>
        <div>
          <Users size={17} />
          <strong>Yönetici</strong>
          <span>
            Yetkili liderliklerde planlama, gerçekleşen giriş ve raporlar
          </span>
        </div>
        <div>
          <UserRound size={17} />
          <strong>Normal Kullanıcı</strong>
          <span>Projeleri görüntüleme ve kendi gerçekleşen kaydını girme</span>
        </div>
      </div>
      <div className="access-content">
        <div className="access-list">
          <label className="access-search">
            <Search size={16} />
            <input
              aria-label="Kullanıcı ara"
              placeholder="Kullanıcı adı veya ad soyad ara"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          {notice && (
            <p className="access-notice" role="status">
              {notice}
            </p>
          )}
          <div className="accesstable">
            <table>
              <thead>
                <tr>
                  <th>Kullanıcı</th>
                  <th>Rol</th>
                  <th>Yetki Kapsamı</th>
                  <th>Durum</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className={
                      form?.id === user.id ? "access-selected-row" : ""
                    }
                  >
                    <td>
                      <strong>{user.name}</strong>
                      <small>{user.username}</small>
                    </td>
                    <td>
                      <span className={"access-role-badge role-" + user.role}>
                        {roleLabel[user.role]}
                      </span>
                    </td>
                    <td>
                      {user.role === "admin"
                        ? "Tüm liderlikler"
                        : user.leaders.length
                          ? user.leaders.length + " liderlik"
                          : "Tüm liderlikler · Plan salt okunur"}
                      {user.role !== "admin" && (
                        <small>
                          {user.resourceId
                            ? data.resources.find(
                                (resource) => resource.id === user.resourceId,
                              )?.name || "Çalışan kaydı bulunamadı"
                            : "Çalışan kaydı eşleştirilmedi"}
                        </small>
                      )}
                    </td>
                    <td>{user.active ? "Aktif" : "Pasif"}</td>
                    <td>
                      {user.id === ROOT_ADMIN_ID ? (
                        <small>Ana yönetici</small>
                      ) : (
                        <button
                          type="button"
                          className="button access-edit-button"
                          disabled={busy}
                          onClick={() => edit(user)}
                        >
                          Yetkileri Düzenle
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!users.length && (
              <p className="emptymsg">Aramanıza uygun kullanıcı bulunamadı.</p>
            )}
          </div>
        </div>
        {form && (selected || creating) && (
          <form className="access-permission-form" onSubmit={submit}>
            <div className="access-form-heading">
              <div>
                <span>
                  {creating ? "HESAP VE YETKİ TANIMLAMA" : "YETKİ DÜZENLEME"}
                </span>
                <h3>
                  {selected?.name || selectedPerson?.name || "Çalışan seçin"}
                </h3>
                <p>
                  {creating
                    ? "Mevcut çalışan kaydı için yeni kullanıcı hesabı"
                    : selected?.username}
                </p>
              </div>
              <span className="access-role-badge">
                {creating ? "Yeni Hesap" : selected?.active ? "Aktif" : "Pasif"}
              </span>
            </div>
            {creating && (
              <>
                <label className="access-field">
                  Hesap Açılacak Çalışan
                  <select
                    required
                    disabled={busy}
                    value={form.resourceId}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        resourceId: event.target.value,
                        ...(creating
                          ? {
                              name:
                                people.find((p) => p.id === event.target.value)
                                  ?.name || "",
                            }
                          : {}),
                      })
                    }
                  >
                    <option value="">Çalışan seçin</option>
                    {availablePeople.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </select>
                  <small>
                    Hesabı olan çalışanların yetkilerini kullanıcı listesinden
                    düzenleyebilirsiniz.
                  </small>
                </label>
                <label className="access-field">
                  Hesap Görünen Adı
                  <input
                    required
                    disabled={busy}
                    maxLength={150}
                    value={form.name || ""}
                    onChange={(event) =>
                      setForm({ ...form, name: event.target.value })
                    }
                  />
                  <small>
                    Hesapta gösterilecek ad; çalışan kaydındaki adı değiştirmez.
                    En fazla 150 karakter.
                  </small>
                </label>
                <label className="access-field">
                  Kullanıcı Adı
                  <input
                    required
                    disabled={busy}
                    autoComplete="off"
                    minLength={3}
                    maxLength={100}
                    pattern="[a-zA-Z0-9._@+\-]{3,100}"
                    value={form.username || ""}
                    onChange={(event) =>
                      setForm({ ...form, username: event.target.value })
                    }
                  />
                  <small>
                    3–100 karakter; harf, rakam ve . _ @ + - kullanılabilir.
                  </small>
                </label>
                <label className="access-field">
                  İlk Şifre
                  <input
                    required
                    disabled={busy}
                    type="password"
                    autoComplete="new-password"
                    minLength={10}
                    maxLength={256}
                    value={form.password || ""}
                    onChange={(event) =>
                      setForm({ ...form, password: event.target.value })
                    }
                  />
                  <small>10–256 karakter.</small>
                </label>
                <label className="access-field">
                  Şifre Tekrarı
                  <input
                    required
                    disabled={busy}
                    type="password"
                    autoComplete="new-password"
                    minLength={10}
                    maxLength={256}
                    value={form.confirmation || ""}
                    onChange={(event) =>
                      setForm({ ...form, confirmation: event.target.value })
                    }
                  />
                </label>
              </>
            )}
            <label className="access-field">
              Rol
              <select
                aria-label="Rol"
                value={form.role}
                disabled={busy}
                onChange={(event) =>
                  setForm({
                    ...form,
                    role: event.target.value as Role,
                    resourceId:
                      event.target.value === "admin" ? "" : form.resourceId,
                  })
                }
              >
                <option value="normal">Normal Kullanıcı</option>
                <option value="manager">Yönetici</option>
                {!creating && <option value="admin">Admin</option>}
              </select>
            </label>
            {form.role !== "admin" && (
              <fieldset className="access-leader-field">
                <legend>Liderlik Erişimi</legend>
                <p>
                  Boş bırakılırsa tüm liderlikler görüntülenir. Yönetici bu
                  durumda planı düzenleyemez.
                </p>
                <input
                  aria-label="Liderlik ara"
                  placeholder="Liderlik ara"
                  value={leaderQuery}
                  onChange={(event) => setLeaderQuery(event.target.value)}
                />
                <div className="accessleaders">
                  {data.leaders
                    ?.filter((leader) =>
                      fold(leader).includes(fold(leaderQuery)),
                    )
                    .map((leader) => (
                      <label key={leader}>
                        <input
                          type="checkbox"
                          disabled={busy}
                          checked={form.leaders.includes(leader)}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              leaders: event.target.checked
                                ? [...form.leaders, leader]
                                : form.leaders.filter(
                                    (value) => value !== leader,
                                  ),
                            })
                          }
                        />
                        {leader}
                      </label>
                    ))}
                </div>
              </fieldset>
            )}
            {!creating && form.role !== "admin" && (
              <label className="access-field">
                Çalışan Kaydı
                <select
                  value={form.resourceId}
                  disabled={busy}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      resourceId: event.target.value,
                      ...(creating
                        ? {
                            name:
                              people.find((p) => p.id === event.target.value)
                                ?.name || "",
                          }
                        : {}),
                    })
                  }
                >
                  <option value="">Eşleştirilmedi</option>
                  {people.map((person) => (
                    <option
                      key={person.id}
                      value={person.id}
                      disabled={
                        !!linkedUsers.get(person.id) &&
                        linkedUsers.get(person.id)?.id !== form.id
                      }
                    >
                      {person.name}
                      {linkedUsers.get(person.id) &&
                      linkedUsers.get(person.id)?.id !== form.id
                        ? " · Başka hesaba bağlı"
                        : ""}
                    </option>
                  ))}
                </select>
                <small>
                  {form.role === "manager"
                    ? "Yönetici kendi gerçekleşen dağılımını, izin ve eğitim kayıtlarını da yönetebilir. Liderlik yetkileri korunur."
                    : "Gerçekleşen kaynak dağılımı yalnızca eşleştirilen çalışan için düzenlenebilir."}
                </small>
              </label>
            )}
            {form.role === "admin" && (
              <p className="access-admin-note">
                Admin tüm liderliklerdeki verileri ve yetkilendirmeyi yönetir.
              </p>
            )}
            {error && (
              <p className="negative" role="alert">
                {error}
              </p>
            )}
            <div className="access-form-actions">
              <button className="button primary" disabled={busy}>
                {busy
                  ? "Kaydediliyor…"
                  : creating
                    ? "Hesap Oluştur ve Yetkilendir"
                    : "Kaydet"}
              </button>
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={() => setForm(null)}
              >
                Vazgeç
              </button>
            </div>
          </form>
        )}
      </div>
      <AuditLogDialog open={showAudit} onOpenChange={setShowAudit} />
    </section>
  );
}
