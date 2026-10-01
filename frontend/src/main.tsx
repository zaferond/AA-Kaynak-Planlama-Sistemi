import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowRight, Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";
import { SYSTEM_NAME } from "./settings";
import Portal from "./App";
import { login, resumeRemembered } from "./storage";

const LOGIN_NAME = "Askeri Araçlar Kaynak Yönetimi Sistemi";

function App() {
  const [ready, setReady] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    resumeRemembered()
      .then((ok) => {
        if (active) {
          setReady(ok);
          setChecking(false);
        }
      })
      .catch(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const expired = () => setReady(false);
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, []);
  useEffect(() => {
    document.title = ready ? SYSTEM_NAME : LOGIN_NAME;
  }, [ready]);

  if (ready) return <Portal />;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(username, password, remember);
      setPassword("");
      setReady(true);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-shell">
        <aside className="auth-brand">
          <img
            className="auth-logo"
            src="/assets/otokar-logo.svg"
            alt="Otokar"
          />
          <div className="auth-brand-content">
            <h1>{LOGIN_NAME}</h1>
            <p>
              Proje, takım ve çalışan kaynaklarını tek çalışma alanında yönetin.
            </p>
          </div>
          <div className="auth-brand-footer">
            Planlama - Kaynak Yönetimi - Raporlama
          </div>
          <div className="auth-brand-art" aria-hidden="true" />
        </aside>

        <section className="auth-panel" aria-label="Hesap Girişi">
          <div className="auth-panel-inner">
            <form
              className="auth-form"
              aria-label="Giriş Formu"
              onSubmit={submit}
            >
              <label htmlFor="login-username">Kullanıcı Adı</label>
              <div className="auth-field">
                <UserRound size={19} aria-hidden="true" />
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="Kullanıcı adınız"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                  disabled={checking || busy}
                />
              </div>
              <label htmlFor="login-password">Şifre</label>
              <div className="auth-field">
                <LockKeyhole size={19} aria-hidden="true" />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Şifreniz"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  disabled={checking || busy}
                />
                <button
                  className="auth-visibility"
                  type="button"
                  aria-label={showPassword ? "Şifreyi Gizle" : "Şifreyi Göster"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
              <label className="auth-remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  disabled={checking || busy}
                />
                <span>Beni Hatırla</span>
              </label>
              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="auth-submit"
                type="submit"
                disabled={checking || busy}
              >
                <span>
                  {checking
                    ? "Oturum Kontrol Ediliyor…"
                    : busy
                      ? "Giriş Yapılıyor…"
                      : "Giriş Yap"}
                </span>
                {!checking && !busy && (
                  <ArrowRight size={19} aria-hidden="true" />
                )}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
