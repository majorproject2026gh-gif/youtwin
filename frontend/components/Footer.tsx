import Link from "next/link";
import Logo from "./Logo";
import InstallApp from "./InstallApp";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/dashboard/connect", label: "Build a twin" },
      { href: "/dashboard/twins", label: "My Twins" },
      { href: "/dashboard/analytics", label: "Analytics" },
      { href: "/dashboard/create-video", label: "Video Studio" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/about", label: "About" },
      { href: "/help", label: "Help & Support" },
      { href: "/home#how-it-works", label: "How it works" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative border-t border-tint/[0.07]">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.6fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-fg/50">
            A digital twin trained on a creator&apos;s real videos — every answer grounded in something they actually said,
            cited to the second.
          </p>
          <p className="mt-6 text-xs leading-relaxed text-fg/40">
            YouTwin — CSE_C_06, GHRCE Nagpur · Built by Mayank Bambal, Sadiyanureen Hussain, Virender Singh &amp; Harvinder Singh
          </p>
        </div>
        {COLUMNS.map((c) => (
          <div key={c.title}>
            <p className="font-mono-timecode text-[11px] uppercase tracking-[0.16em] text-fg/35">{c.title}</p>
            <ul className="mt-4 space-y-2.5">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="-my-1.5 inline-block py-1.5 text-sm text-fg/60 transition-colors hover:text-fg max-sm:-my-2.5 max-sm:py-2.5">
                    {l.label}
                  </Link>
                </li>
              ))}
              {c.title === "Resources" && (
                <li>
                  <InstallApp variant="link" />
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-tint/[0.05]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-5 text-xs text-fg/35 sm:flex-row">
          <span>© {new Date().getFullYear()} YouTwin · Academic capstone project</span>
          <span className="font-mono-timecode">GROUNDED · CITED · GUARDED</span>
        </div>
      </div>
    </footer>
  );
}
