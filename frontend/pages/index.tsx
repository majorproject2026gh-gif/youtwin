import { useEffect } from "react";
import { useRouter } from "next/router";

/**
 * The app opens straight into auth, not a marketing page — visiting
 * localhost:3000 sends you to /login, or to the homepage if you're
 * already signed in (from there, "Build your twin" starts the actual
 * YouTube channel connection).
 */
export default function IndexRedirect() {
  const router = useRouter();

  useEffect(() => {
    const session = localStorage.getItem("youtwin_session");
    router.replace(session ? "/home" : "/login");
  }, [router]);

  return null;
}
