import AuditLogDialog from "./AuditLogDialog";
import { useEffect, useState } from "react";
import { ShieldCheck, UserRound, Users, Search } from "lucide-react";
import type { Data } from "./model";
import { fold } from "./model";
import type { Account, Role } from "./access";
import { ROOT_ADMIN_ID, isEmployeeResource } from "./access";
import { saveUser, createUser, type UserInput } from "./storage";
import { useDirectoryUsers } from "./features/useDirectoryUsers";
import type { DirectoryUser } from "../../shared/directory-identity";
type PermissionForm = UserInput & { directoryUser?: DirectoryUser };
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
    [directoryQuery, setDirectoryQuery] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const selected = data.users?.find((user) => user.id === form?.id);
  const users = (data.users || []).filter((user) =>
    fold(user.username + " " + user.name + " " + (user.email || "")).includes(
      fold(query),
    ),
  );
  const people = data.resources
    .filter(isEmployeeResource)
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const creating = !!form && !form.id;
  const directory = useDirectoryUsers(creating);
  const linkedUsers = new Map(
    (data.users || [])
      .filter((u) => u.resourceId)
      .map((u) => [u.resourceId, u]),
  );
  const availablePeople = people.filter((p) => !linkedUsers.has(p.id));

  function startAccount() {
    setError("");
    setNotice("");
    setLeaderQuery("");
    setDirectoryQuery("");
    setForm({
      id: "",
      role: "normal",
      leaders: [],
      resourceId: "",
      revision: 0,
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
    if (creating && !form.directoryUser) {
      setError("Active Directory kullanıcısı seçin.");
      return;
    }
    setBusy(true);
    try {
      const updated = creating
        ? await createUser({
            directoryId: form.directoryUser!.id,
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
          ? "Active Directory kullanıcısı yetkilendirildi ve çalışan kaydı eşleştirildi."
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
            Active Directory kullanıcılarına rol ve liderlik yetkisi tanımlayın;
            çalışan kayıtlarını eşleştirin.
          </p>
        </div>
        <button
          className="button primary"
          disabled={busy}
          onClick={startAccount}
        >
          AD Kullanıcısına Yetki Tanımla
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
                      <small>
                        {user.username}
                        {user.authSource === "ldap"
                          ? " · Active Directory"
                          : " · Yerel Hesap"}
                      </small>
                      {user.email && <small>{user.email}</small>}
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
                  {selected?.name ||
                    form.directoryUser?.name ||
                    "AD kullanıcısı seçin"}
                </h3>
                <p>
                  {creating
                    ? "Kurumsal kullanıcı için uygulama erişimi"
                    : selected?.username}
                </p>
              </div>
              <span className="access-role-badge">
                {creating ? "Yeni Hesap" : selected?.active ? "Aktif" : "Pasif"}
              </span>
            </div>
            {creating && (
              <>
                <div className="access-directory-search">
                  <label className="access-field">
                    Active Directory Kullanıcısı Ara
                    <input
                      maxLength={100}
                      disabled={busy || directory.busy}
                      value={directoryQuery}
                      onChange={(event) =>
                        setDirectoryQuery(event.target.value)
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="button"
                    disabled={busy || directory.busy}
                    onClick={() => {
                      setForm({ ...form, directoryUser: undefined });
                      void directory.search(directoryQuery);
                    }}
                  >
                    Ara / Yenile
                  </button>
                </div>
                {directory.busy && (
                  <p className="access-admin-note" role="status">
                    AD kullanıcıları yükleniyor…
                  </p>
                )}
                {directory.error && (
                  <p className="negative" role="alert">
                    {directory.error}
                  </p>
                )}
                {!directory.busy &&
                  !directory.error &&
                  !directory.configured && (
                    <p className="access-admin-note" role="status">
                      Active Directory bağlantısı henüz tanımlanmadı. Bağlantı
                      etkinleştirildiğinde kurumsal kullanıcılar burada
                      listelenecek.
                    </p>
                  )}
                {directory.configured &&
                  !directory.busy &&
                  !directory.users.length && (
                    <p className="access-admin-note" role="status">
                      Aramanıza uygun aktif AD kullanıcısı bulunamadı.
                    </p>
                  )}
                <label className="access-field">
                  Hesap Açılacak Çalışan
                  <select
                    aria-label="Hesap Açılacak Çalışan"
                    required
                    disabled={busy || directory.busy || !directory.configured}
                    value={form.directoryUser?.id || ""}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        directoryUser: directory.users.find(
                          (u) => u.id === event.target.value,
                        ),
                      })
                    }
                  >
                    <option value="">Active Directory kullanıcısı seçin</option>
                    {directory.users.map((person) => {
                      const assigned = data.users?.some(
                        (u) => u.directoryId === person.id,
                      );
                      return (
                        <option
                          key={person.id}
                          value={person.id}
                          disabled={assigned}
                        >
                          {person.name} · {person.username}
                          {assigned ? " · Yetki tanımlı" : ""}
                        </option>
                      );
                    })}
                  </select>
                  <small>
                    {directory.hasMore
                      ? "İlk 50 sonuç gösteriliyor. Kullanıcı adı, ad veya e-posta ile aramayı daraltın."
                      : "Bu liste yalnızca Active Directory'den alınır."}
                  </small>
                </label>
                <label className="access-field">
                  Ad Soyad
                  <input readOnly value={form.directoryUser?.name || ""} />
                </label>
                <label className="access-field">
                  Kullanıcı Adı
                  <input
                    readOnly
                    autoComplete="off"
                    value={form.directoryUser?.username || ""}
                  />
                </label>
                <label className="access-field">
                  E-posta
                  <input readOnly value={form.directoryUser?.email || ""} />
                </label>
                <p className="access-admin-note">
                  Kullanıcı bilgileri AD tarafından yönetilir. Şifre burada
                  girilmez veya saklanmaz; giriş sırasında AD'ye doğrulatılır.
                </p>
                <label className="access-field">
                  Uygulamadaki Çalışan Kaydı
                  <select
                    aria-label="Uygulamadaki Çalışan Kaydı"
                    required
                    disabled={busy}
                    value={form.resourceId}
                    onChange={(event) =>
                      setForm({ ...form, resourceId: event.target.value })
                    }
                  >
                    <option value="">Çalışan kaydı seçin</option>
                    {availablePeople.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </select>
                  <small>
                    AD kullanıcısının kendi gerçekleşen dağılımı, izin ve eğitim
                    kayıtları bu çalışanla ilişkilendirilir.
                  </small>
                </label>
              </>
            )}
            {!creating && selected?.authSource === "ldap" && (
              <p className="access-admin-note">
                Active Directory · {selected.email || "AD kaydında e-posta yok"}
                . Kullanıcı bilgileri kurumsal dizinden alınır.
              </p>
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
              <button
                className="button primary"
                disabled={
                  busy ||
                  (creating &&
                    (directory.busy ||
                      !directory.configured ||
                      !form.directoryUser ||
                      !form.resourceId))
                }
              >
                {busy
                  ? "Kaydediliyor…"
                  : creating
                    ? "Yetki Tanımla ve Eşleştir"
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
