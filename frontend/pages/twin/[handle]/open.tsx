import { useEffect } from "react";
import { useRouter } from "next/router";
import ViewerShell from "@/components/ViewerShell";
import { Spinner } from "@/components/ui";

/**
 * The old "twin page opens" step. The share link now opens the name step
 * (/twin/[handle]) directly, so this only forwards older links there,
 * keeping any ?v=&t= playtime context.
 */
export default function OpenStep() {
  const router = useRouter();
  useEffect(() => {
    if (!router.isReady) return;
    const { handle, ...rest } = router.query;
    const qs = new URLSearchParams(
      Object.entries(rest).filter((e): e is [string, string] => typeof e[1] === "string"),
    ).toString();
    router.replace(`/twin/${handle}${qs ? `?${qs}` : ""}`);
  }, [router]);
  return (
    <ViewerShell step={2}>
      <div className="flex min-h-[60vh] items-center justify-center text-fg/50">
        <Spinner size={22} />
      </div>
    </ViewerShell>
  );
}
