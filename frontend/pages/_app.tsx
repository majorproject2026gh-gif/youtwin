import type { AppProps } from "next/app";
import Head from "next/head";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "../styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        {/* Runs before hydration so the page never flashes the wrong
            theme — must be a synchronous inline script, not useEffect. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
