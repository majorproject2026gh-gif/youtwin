import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { api } from "@/lib/api";
import Footer from "@/components/Footer";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { Theme, applyTheme, getStoredTheme } from "@/lib/theme";

type Mode = "login" | "signup";

const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/;
const MOBILE_RE = /^\+?[0-9]{7,15}$/;

function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (!pw) return { score: 0, label: "" };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10 && /[0-9]/.test(pw) && /[a-zA-Z]/.test(pw)) score++;
  if (pw.length >= 10 && /[^a-zA-Z0-9]/.test(pw)) score++;
  const labels = ["Too short", "Weak", "Good", "Strong"];
  return { score: score as 0 | 1 | 2 | 3, label: labels[score] };
}

export default function LoginPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>("dark");
  const [mode, setMode] = useState<Mode>("login");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (field: string) => setTouched((t) => ({ ...t, [field]: true }));

  const usernameValid = USERNAME_RE.test(username);
  const mobileValid = MOBILE_RE.test(mobileNumber.trim());
  const nameValid = displayName.trim().length > 0;
  const strength = useMemo(() => passwordStrength(password), [password]);
  const passwordsMatch = confirmPassword.length > 0 && confirmPassword === password;

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  useEffect(() => {
    if (localStorage.getItem("youtwin_session")) {
      router.replace("/home");
    }
  }, [router]);

  function goHome(session: string, creator: unknown) {
    localStorage.setItem("youtwin_session", session);
    localStorage.setItem("youtwin_creator", JSON.stringify(creator));
    localStorage.removeItem("youtwin_twinId");
    router.push("/home");
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/auth/signup", { displayName, username, mobileNumber, password });
      goHome(data.session, data.creator);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't create your account. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { identifier, password });
      goHome(data.session, data.creator);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't sign in. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`theme-aware min-h-screen flex flex-col relative overflow-hidden transition-colors duration-300 ${theme === "dark" ? "bg-ink-950" : "bg-paper-50"}`}>
      {/* Rich, colorful, LIVING backdrop — this is what makes the glass
          panel actually read as premium: real color and motion behind
          it, not a muted static photo. */}
      <img
        src="https://images.unsplash.com/photo-1598550476439-6847785fcea6?auto=format&fit=crop&w=2400&q=75"
        alt=""
        className={`absolute inset-0 h-full w-full object-cover animate-hue-drift transition-opacity duration-300 ${theme === "dark" ? "opacity-40" : "opacity-[0.14]"}`}
      />
      <div className={`absolute inset-0 transition-colors duration-300 ${theme === "dark" ? "bg-gradient-to-b from-ink-950/60 via-ink-950/80 to-ink-950" : "bg-gradient-to-b from-paper-50/70 via-paper-50/85 to-paper-50"}`} />
      <div
        className="bg-orb-a pointer-events-none absolute -left-24 top-[5%] h-[500px] w-[500px] rounded-full opacity-50 blur-[110px]"
        style={{ background: "radial-gradient(circle, #C22A2A 0%, transparent 70%)" }}
      />
      <div
        className="bg-orb-b pointer-events-none absolute right-[-15%] top-[35%] h-[460px] w-[460px] rounded-full opacity-40 blur-[110px]"
        style={{ background: "radial-gradient(circle, #D9A441 0%, transparent 70%)" }}
      />
      <div
        className="bg-orb-a pointer-events-none absolute left-[30%] bottom-[-10%] h-[420px] w-[420px] rounded-full opacity-35 blur-[110px]"
        style={{ background: "radial-gradient(circle, #5EEAD4 0%, transparent 70%)" }}
      />
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            theme === "dark"
              ? "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)"
              : "linear-gradient(rgba(36,30,23,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(36,30,23,0.06) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative flex items-center justify-between px-8 py-6">
        <Link href="/home"><Logo dark={theme === "dark"} /></Link>
        <ThemeToggle theme={theme} onToggle={toggleTheme} className={theme === "dark" ? "text-paper-100" : "text-ink-900"} />
      </div>

      <div className="relative flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-2xl text-center mb-10">
          <span className={`glass-pill inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 font-mono-timecode text-xs tracking-[0.2em] mb-6 transition-colors duration-300 ${theme === "dark" ? "text-paper-300" : "text-ink-500"}`}>
            CSE_C_06 &middot; GHRCE NAGPUR
          </span>
          <h1 className={`font-display text-6xl sm:text-7xl font-bold leading-[0.95] tracking-tight transition-colors duration-300 ${theme === "dark" ? "text-paper-100" : "text-ink-900"}`}>
            You<span className="bg-gradient-to-r from-coral-400 via-rec-500 to-cited-500 bg-clip-text text-transparent">Twin</span>
          </h1>
          <p className={`mt-6 font-serif italic text-2xl sm:text-3xl max-w-xl mx-auto leading-snug transition-colors duration-300 ${theme === "dark" ? "text-paper-300" : "text-ink-500"}`}>
            A Digital Twin Based Interaction Framework for Content Generation
            and Validation using Generative AI
          </p>
        </div>
      </div>

      <div className="relative flex items-start justify-center px-6 pb-16">
        <div className="w-full max-w-[440px]">
          <div className="glass-panel rounded-3xl border border-white/15 bg-white/10 px-8 py-10 sm:px-10">
              <div className="mb-7 relative flex rounded-full border border-white/15 bg-black/20 p-1 text-sm">
                <div
                  className="absolute inset-y-1 w-[calc(50%-4px)] rounded-full bg-paper-100 transition-transform duration-300 ease-out"
                  style={{ transform: mode === "signup" ? "translateX(calc(100% + 4px))" : "translateX(0)" }}
                />
                <button
                  onClick={() => { setMode("login"); setError(null); }}
                  className={`relative z-10 flex-1 rounded-full py-2.5 font-medium transition-colors ${mode === "login" ? "text-ink-900" : theme === "dark" ? "text-paper-300" : "text-ink-500"}`}
                >
                  Sign in
                </button>
                <button
                  onClick={() => { setMode("signup"); setError(null); }}
                  className={`relative z-10 flex-1 rounded-full py-2.5 font-medium transition-colors ${mode === "signup" ? "text-ink-900" : theme === "dark" ? "text-paper-300" : "text-ink-500"}`}
                >
                  Sign up
                </button>
              </div>

              <h2 className={`font-display text-2xl font-bold mb-6 transition-colors ${theme === "dark" ? "text-paper-100" : "text-ink-900"}`}>
                {mode === "login" ? "Welcome back" : "Create your account"}
              </h2>

              {mode === "signup" ? (
                <form onSubmit={handleSignup} className="space-y-5" noValidate>
                  <Field theme={theme} label="Full name" valid={touched.name ? nameValid : undefined} errorText={touched.name && !nameValid ? "Enter your name" : undefined}>
                    <input autoFocus required value={displayName} onChange={(e) => setDisplayName(e.target.value)} onBlur={() => touch("name")} className="input" placeholder="Mayank Bambal" />
                  </Field>
                  <Field theme={theme} label="Username" valid={touched.username ? usernameValid : undefined} errorText={touched.username && !usernameValid ? "3-30 characters — letters, numbers, . and _ only" : undefined}>
                    <input required value={username} onChange={(e) => setUsername(e.target.value)} onBlur={() => touch("username")} className="input" placeholder="mayankb" />
                  </Field>
                  <Field theme={theme} label="Mobile number" valid={touched.mobile ? mobileValid : undefined} errorText={touched.mobile && !mobileValid ? "Enter a valid mobile number" : undefined}>
                    <input required value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} onBlur={() => touch("mobile")} className="input" placeholder="+91 98765 43210" type="tel" />
                  </Field>
                  <Field theme={theme} label="Password">
                    <div className="relative">
                      <input required value={password} onChange={(e) => setPassword(e.target.value)} onBlur={() => touch("password")} className="input pr-14" type={showPassword ? "text" : "password"} placeholder="At least 6 characters" />
                      <button type="button" onClick={() => setShowPassword((s) => !s)} className={`absolute right-0 bottom-2.5 text-xs transition-colors ${theme === "dark" ? "text-paper-300 hover:text-paper-100" : "text-ink-500 hover:text-ink-900"}`}>
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                    {password.length > 0 && (
                      <div className="mt-2">
                        <div className="flex h-1 gap-1">
                          {[0, 1, 2].map((i) => (
                            <div key={i} className={`flex-1 rounded-full transition-colors ${strength.score > i ? (strength.score === 1 ? "bg-cited-500" : strength.score === 2 ? "bg-verified-500" : "bg-emerald-500") : "bg-white/15"}`} />
                          ))}
                        </div>
                        <p className={`mt-1 text-xs transition-colors ${theme === "dark" ? "text-paper-300" : "text-ink-500"}`}>{strength.label}</p>
                      </div>
                    )}
                  </Field>
                  <Field theme={theme} label="Confirm password" valid={touched.confirm ? passwordsMatch : undefined} errorText={touched.confirm && confirmPassword.length > 0 && !passwordsMatch ? "Passwords don't match" : undefined}>
                    <input required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onBlur={() => touch("confirm")} className="input" type={showPassword ? "text" : "password"} />
                  </Field>
                  {error && <p className="rounded-lg bg-rec-500/20 px-3 py-2.5 text-sm text-rec-400">{error}</p>}
                  <button type="submit" disabled={loading} className="btn-primary w-full">
                    {loading ? "Creating account…" : "Create account"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleLogin} className="space-y-5" noValidate>
                  <Field theme={theme} label="Username or mobile number">
                    <input autoFocus required value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="input" placeholder="mayankb or +91 98765 43210" />
                  </Field>
                  <Field theme={theme} label="Password">
                    <div className="relative">
                      <input required value={password} onChange={(e) => setPassword(e.target.value)} className="input pr-14" type={showPassword ? "text" : "password"} />
                      <button type="button" onClick={() => setShowPassword((s) => !s)} className={`absolute right-0 bottom-2.5 text-xs transition-colors ${theme === "dark" ? "text-paper-300 hover:text-paper-100" : "text-ink-500 hover:text-ink-900"}`}>
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </Field>
                  {error && <p className="rounded-lg bg-rec-500/20 px-3 py-2.5 text-sm text-rec-400">{error}</p>}
                  <button type="submit" disabled={loading} className="btn-primary w-full">
                    {loading ? "Signing in…" : "Sign in"}
                  </button>
                </form>
              )}
            </div>

          <Link href="/home" className={`mt-6 block text-center text-sm transition-colors ${theme === "dark" ? "text-paper-300 hover:text-paper-100" : "text-ink-500 hover:text-ink-900"}`}>
            ← Back to home
          </Link>
        </div>
      </div>
      <div className="relative"><Footer /></div>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          border: none;
          border-bottom: 1.5px solid rgba(255, 255, 255, 0.22);
          padding: 0.6rem 0 0.7rem;
          font-size: 1rem;
          background: transparent;
          color: #f5f5f0;
          transition: border-color 0.15s ease;
        }
        :global(.input::placeholder) { color: rgba(245, 245, 240, 0.35); }
        :global(.input:focus) {
          outline: none;
          border-color: #ff8266;
        }
        :global([data-theme="light"] .input) {
          border-bottom-color: rgba(36, 30, 23, 0.2);
          color: #241e17;
        }
        :global([data-theme="light"] .input::placeholder) {
          color: rgba(36, 30, 23, 0.35);
        }
        :global(.btn-primary) {
          border-radius: 9999px;
          background: linear-gradient(135deg, #c22a2a, #a31f1f);
          color: white;
          font-weight: 600;
          font-size: 1rem;
          padding: 0.9rem 1rem;
          box-shadow: 0 10px 26px rgba(194, 42, 42, 0.4);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        :global(.btn-primary:hover:not(:disabled)) {
          transform: scale(1.02);
          box-shadow: 0 14px 32px rgba(194, 42, 42, 0.5);
        }
        :global(.btn-primary:active:not(:disabled)) { transform: scale(0.98); }
        :global(.btn-primary:disabled) { opacity: 0.6; }
      `}</style>
    </div>
  );
}

function Field({ label, children, valid, errorText, theme }: {
  label: string; children: React.ReactNode; valid?: boolean; errorText?: string; theme: Theme;
}) {
  return (
    <label className="block">
      <span className={`mb-1.5 flex items-center justify-between text-sm transition-colors ${theme === "dark" ? "text-paper-300" : "text-ink-500"}`}>
        {label}
        {valid === true && <span className="text-emerald-400">✓</span>}
      </span>
      {children}
      {errorText && <p className="mt-1 text-xs text-rec-400">{errorText}</p>}
    </label>
  );
}
