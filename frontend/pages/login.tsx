import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/browser";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import CreatorAvatar from "@/components/CreatorAvatar";
import { Alert, Backdrop, Eyebrow, Icon, Spinner } from "@/components/ui";

type Mode = "login" | "signup";

const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/;
const MOBILE_RE = /^\+?[0-9]{7,15}$/;

function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (!pw) return { score: 0, label: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 10 && /[0-9]/.test(pw) && /[a-zA-Z]/.test(pw)) score++;
  if (pw.length >= 10 && /[^a-zA-Z0-9]/.test(pw)) score++;
  const labels = ["Too short", "Weak", "Good", "Strong"];
  return { score: score as 0 | 1 | 2 | 3, label: labels[score] };
}

const PROOF = [
  { icon: "wave", text: "Learns from your real captions & transcripts" },
  { icon: "clock", text: "Every answer cited to the exact second" },
  { icon: "shield", text: "Refuses to guess when your videos don't cover it" },
];

export default function LoginPage() {
  const router = useRouter();
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
    if (localStorage.getItem("youtwin_session")) {
      router.replace("/home");
    }
  }, [router]);

  const expired = router.query.expired === "1";

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
      setError(errorMessage(err, "Couldn't create your account. Try again."));
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
      setError(errorMessage(err, "Couldn't sign in. Try again."));
    } finally {
      setLoading(false);
    }
  }

  const fieldState = (key: string, valid: boolean) => (touched[key] ? (valid ? "field-valid" : "field-invalid") : "");

  const eye = (
    <button
      type="button"
      onClick={() => setShowPassword((s) => !s)}
      className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-fg/40 transition-colors hover:bg-tint/[0.06] hover:text-fg/80"
      aria-label={showPassword ? "Hide password" : "Show password"}
    >
      <Icon name={showPassword ? "eye-off" : "eye"} size={16} />
    </button>
  );

  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-x-clip text-fg">
      <Backdrop accent="#C8302B" accent2="#E0AE4E" accent3="#2DD4BF" intensity={1.1} />

      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/home"><Logo /></Link>
        <div className="flex items-center gap-2">
          <Link href="/home" className="btn btn-ghost btn-sm hidden sm:inline-flex">
            <Icon name="arrow-left" size={14} /> Back to home
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="relative flex flex-1 items-center px-5 pb-12 sm:px-8">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
          {/* Brand side */}
          <section className="text-center lg:text-left animate-fade-up">
            <Eyebrow>CSE_C_06 · GHRCE Nagpur</Eyebrow>
            <h1 className="mt-7 font-display text-6xl font-semibold leading-[0.9] tracking-tightest sm:text-8xl">
              <span className="text-gradient-soft">You</span>
              <span className="text-gradient">Twin</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl font-serif text-2xl italic leading-snug text-fg/65 sm:text-[1.75rem] lg:mx-0">
              A Digital Twin Based Interaction Framework for Content Generation and Validation using Generative AI
            </p>

            <ul className="mx-auto mt-10 hidden max-w-md space-y-3 lg:mx-0 lg:block">
              {PROOF.map((p, i) => (
                <li key={p.text} className="flex items-center gap-3 text-sm text-fg/65 animate-fade-up" style={{ animationDelay: `${200 + i * 90}ms` }}>
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-tint/10 bg-tint/[0.04] text-coral-400">
                    <Icon name={p.icon} size={15} />
                  </span>
                  {p.text}
                </li>
              ))}
            </ul>

            {/* Floating proof card */}
            <div className="relative mt-12 hidden max-w-sm lg:block">
              <div className="surface glass-panel animate-float p-4">
                <p className="mb-3 font-mono-timecode text-[10px] uppercase tracking-[0.16em] text-fg/35">Example conversation</p>
                <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-rec-400 to-rec-600 px-3 py-1.5 text-[12.5px] text-white">
                  Which mic do you use?
                </div>
                <div className="mt-2.5 flex items-end gap-2">
                  <CreatorAvatar name="Creator" size={22} />
                  <div className="rounded-2xl rounded-bl-md border border-tint/[0.08] bg-tint/[0.05] px-3 py-2 text-[12.5px] leading-snug text-fg/85">
                    The one from my desk-setup video — I explain why there.
                    <span className="ml-1.5 inline-flex items-center gap-1 rounded-md bg-sunk/30 px-1.5 py-0.5 align-middle font-mono-timecode text-[10px] text-cited-300 ring-1 ring-cited-400/25">
                      <Icon name="play" size={7} /> 04:12
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Auth card */}
          <section className="mx-auto w-full max-w-[440px] animate-fade-up" style={{ animationDelay: "120ms" }}>
            <div className="relative">
              <div className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-gradient-to-br from-rec-500/25 via-transparent to-cited-400/20 blur-2xl" />
              <div className="surface glass-panel border-gradient rounded-[1.75rem] p-7 sm:p-9">
                {/* Segmented control */}
                <div className="relative mb-8 flex rounded-xl border border-tint/10 bg-tint/[0.03] p-1 text-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)]">
                  <div
                    className="absolute inset-y-1 w-[calc(50%-4px)] rounded-[0.6rem] bg-gradient-to-b from-tint/[0.14] to-tint/[0.07] shadow-card ring-1 ring-tint/10 transition-transform duration-500 ease-out-expo"
                    style={{ transform: mode === "signup" ? "translateX(calc(100% + 0px))" : "translateX(0)" }}
                  />
                  {(["login", "signup"] as Mode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => { setMode(m); setError(null); }}
                      className={`relative z-10 flex-1 rounded-lg py-2 font-medium transition-colors ${mode === m ? "text-fg" : "text-fg/45 hover:text-fg/70"}`}
                    >
                      {m === "login" ? "Sign in" : "Sign up"}
                    </button>
                  ))}
                </div>

                {expired && (
                  <div className="mb-5">
                    <Alert tone="info">Your session expired — please sign in again.</Alert>
                  </div>
                )}
                <h2 className="font-display text-2xl font-semibold text-fg">
                  {mode === "login" ? "Welcome back" : "Create your account"}
                </h2>
                <p className="mt-1.5 mb-7 text-sm text-fg/50">
                  {mode === "login" ? "Sign in to your creator studio." : "Start training your digital twin in minutes."}
                </p>

                {mode === "signup" ? (
                  <form key="signup" onSubmit={handleSignup} className="space-y-4 animate-fade-up" noValidate>
                    <Field label="Full name" valid={touched.name ? nameValid : undefined} errorText={touched.name && !nameValid ? "Enter your name" : undefined}>
                      <input autoFocus required value={displayName} onChange={(e) => setDisplayName(e.target.value)} onBlur={() => touch("name")} className={`field ${fieldState("name", nameValid)}`} placeholder="Mayank Bambal" autoComplete="name" />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Username" valid={touched.username ? usernameValid : undefined} errorText={touched.username && !usernameValid ? "3–30 chars: letters, numbers, . _" : undefined}>
                        <input required value={username} onChange={(e) => setUsername(e.target.value)} onBlur={() => touch("username")} className={`field ${fieldState("username", usernameValid)}`} placeholder="mayankb" autoComplete="username" />
                      </Field>
                      <Field label="Mobile number" valid={touched.mobile ? mobileValid : undefined} errorText={touched.mobile && !mobileValid ? "Enter a valid number" : undefined}>
                        <input required value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} onBlur={() => touch("mobile")} className={`field ${fieldState("mobile", mobileValid)}`} placeholder="+91 98765 43210" type="tel" autoComplete="tel" />
                      </Field>
                    </div>
                    <Field label="Password">
                      <div className="relative">
                        <input required value={password} onChange={(e) => setPassword(e.target.value)} onBlur={() => touch("password")} className="field pr-12" type={showPassword ? "text" : "password"} placeholder="At least 8 characters" minLength={8} autoComplete="new-password" />
                        {eye}
                      </div>
                      {password.length > 0 && (
                        <div className="mt-2.5 flex items-center gap-3">
                          <div className="flex h-1 flex-1 gap-1">
                            {[0, 1, 2].map((i) => (
                              <div
                                key={i}
                                className={`flex-1 rounded-full transition-all duration-500 ${
                                  strength.score > i
                                    ? strength.score === 1
                                      ? "bg-cited-400 shadow-[0_0_8px_rgba(224,174,78,0.6)]"
                                      : "bg-verified-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                                    : "bg-tint/10"
                                }`}
                              />
                            ))}
                          </div>
                          <span className="w-16 text-right text-xs text-fg/50">{strength.label}</span>
                        </div>
                      )}
                    </Field>
                    <Field label="Confirm password" valid={touched.confirm ? passwordsMatch : undefined} errorText={touched.confirm && confirmPassword.length > 0 && !passwordsMatch ? "Passwords don't match" : undefined}>
                      <input required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onBlur={() => touch("confirm")} className={`field ${touched.confirm && confirmPassword ? (passwordsMatch ? "field-valid" : "field-invalid") : ""}`} type={showPassword ? "text" : "password"} autoComplete="new-password" />
                    </Field>
                    {error && <Alert>{error}</Alert>}
                    <button type="submit" disabled={loading} className="btn btn-primary btn-lg mt-2 w-full">
                      {loading ? <><Spinner size={16} /> Creating account…</> : <>Create account <Icon name="arrow-right" size={16} strokeWidth={2.25} /></>}
                    </button>
                  </form>
                ) : (
                  <form key="login" onSubmit={handleLogin} className="space-y-4 animate-fade-up" noValidate>
                    <Field label="Username or mobile number">
                      <div className="relative">
                        <Icon name="user" size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg/35" />
                        <input autoFocus required value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="field pl-10" placeholder="mayankb or +91 98765 43210" autoComplete="username" />
                      </div>
                    </Field>
                    <Field label="Password">
                      <div className="relative">
                        <Icon name="lock" size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg/35" />
                        <input required value={password} onChange={(e) => setPassword(e.target.value)} className="field pl-10 pr-12" type={showPassword ? "text" : "password"} placeholder="••••••••" autoComplete="current-password" />
                        {eye}
                      </div>
                    </Field>
                    {error && <Alert>{error}</Alert>}
                    <button type="submit" disabled={loading} className="btn btn-primary btn-lg mt-2 w-full">
                      {loading ? <><Spinner size={16} /> Signing in…</> : <>Sign in <Icon name="arrow-right" size={16} strokeWidth={2.25} /></>}
                    </button>
                  </form>
                )}

                <p className="mt-7 text-center text-[13px] text-fg/45">
                  {mode === "login" ? "New to YouTwin? " : "Already have an account? "}
                  <button
                    type="button"
                    onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); }}
                    className="font-medium text-coral-400 hover:text-coral-300"
                  >
                    {mode === "login" ? "Create an account" : "Sign in"}
                  </button>
                </p>
              </div>
            </div>
            <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-fg/35">
              <Icon name="lock" size={12} /> Your YouTwin login is separate from the Google account you link later.
            </p>
          </section>
        </div>
      </main>

      <footer className="relative border-t border-tint/[0.06] px-6 py-5 text-center text-xs text-fg/35">
        YouTwin — CSE_C_06, GHRCE Nagpur · Built by Mayank Bambal, Sadiyanureen Hussain, Virender Singh &amp; Harvinder Singh
        <span className="mx-2">·</span>
        <Link href="/about" className="hover:text-fg/70">About</Link>
        <span className="mx-2">·</span>
        <Link href="/help" className="hover:text-fg/70">Help</Link>
      </footer>
    </div>
  );
}

function Field({ label, children, valid, errorText }: {
  label: string; children: React.ReactNode; valid?: boolean; errorText?: string;
}) {
  return (
    <label className="block">
      <span className="label flex items-center justify-between">
        {label}
        {valid === true && <Icon name="check-circle" size={14} className="text-verified-500 animate-scale-in" />}
      </span>
      {children}
      {errorText && <p className="mt-1.5 text-xs text-rec-300 animate-fade-up">{errorText}</p>}
    </label>
  );
}
