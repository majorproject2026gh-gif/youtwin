import { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import InstallApp from "./InstallApp";
import { Icon } from "./ui";

const LINKS = [
  { href: "/home#features", label: "Product" },
  { href: "/home#how-it-works", label: "How it works" },
  { href: "/dashboard/twins", label: "My Twins" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/dashboard/create-video", label: "Agent" },
  { href: "/about", label: "About" },
];

/**
 * Public marketing nav (home / about / help). Floats as a translucent
 * pill that tightens and gains a border once the page scrolls.
 */
export default function SiteNav({
  signedIn = false,
  onLogout,
  ctaHref = "/login",
}: {
  signedIn?: boolean;
  onLogout?: () => void;
  ctaHref?: string;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6">
      <nav
        className={`mx-auto flex h-14 max-w-6xl items-center gap-2 rounded-2xl px-2 pl-3 sm:gap-4 sm:px-3 sm:pl-4 transition-all duration-500 ease-out-expo ${
          scrolled ? "glass-nav border border-tint/[0.08] shadow-card" : "border border-transparent"
        }`}
      >
        <Link href="/home" className="flex-shrink-0">
          <Logo />
        </Link>

        <ul className="ml-4 hidden items-center gap-0.5 lg:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="rounded-lg px-3 py-2 text-[13.5px] text-fg/60 transition-colors hover:bg-tint/[0.05] hover:text-fg">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden lg:inline-flex">
            <InstallApp />
          </span>
          <ThemeToggle />
          {signedIn ? (
            <button onClick={onLogout} className="btn btn-ghost btn-sm hidden sm:inline-flex">
              Log out
            </button>
          ) : (
            <Link href="/login" className="btn btn-ghost btn-sm hidden sm:inline-flex">
              Sign in
            </Link>
          )}
          <Link href={ctaHref} className="btn btn-primary btn-sm">
            <span className="hidden sm:inline">{signedIn ? "Open studio" : "Build your twin"}</span>
            <span className="sm:hidden">{signedIn ? "Studio" : "Start"}</span>
            <Icon name="arrow-right" size={14} strokeWidth={2.25} />
          </Link>
          <button onClick={() => setOpen((o) => !o)} className="btn btn-ghost btn-icon btn-sm lg:hidden" aria-label="Menu" aria-expanded={open}>
            <Icon name={open ? "x" : "menu"} size={17} />
          </button>
        </div>
      </nav>

      {open && (
        <div className="surface mx-auto mt-2 max-w-6xl p-2 lg:hidden animate-scale-in">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-fg/75 hover:bg-tint/[0.05]">
              {l.label}
              <Icon name="chevron-right" size={14} className="text-fg/30" />
            </Link>
          ))}
          <div className="hairline my-2" />
          <InstallApp variant="row" onDone={() => setOpen(false)} />
          {signedIn ? (
            <button onClick={onLogout} className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-fg/75 hover:bg-tint/[0.05]">Log out</button>
          ) : (
            <Link href="/login" className="block rounded-lg px-3 py-2.5 text-sm text-fg/75 hover:bg-tint/[0.05]">Sign in</Link>
          )}
        </div>
      )}
    </header>
  );
}
