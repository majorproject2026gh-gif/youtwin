import { useEffect } from "react";
import { useRouter } from "next/router";

export default function DashboardRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/connect");
  }, [router]);
  return null;
}
