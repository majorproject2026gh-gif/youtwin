import { ReactNode } from "react";

export default function BrowserFrame({
  children,
  url,
}: {
  children: ReactNode;
  url?: string;
}) {
  return (
    <div className="rounded-lg border border-paper-300 bg-paper-50 overflow-hidden">
      <div className="flex items-center gap-2 bg-paper-200 px-4 py-2 border-b border-paper-300">
        <span className="h-2.5 w-2.5 rounded-full bg-paper-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-paper-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-paper-400" />
        {url && (
          <div className="ml-3 flex-1 truncate rounded bg-paper-50 px-3 py-1 text-xs font-mono-timecode text-ink-500 border border-paper-300">
            {url}
          </div>
        )}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}
