import type { AppProps } from "next/app";
import type { NextPage } from "next";
import { useEffect, type ReactElement, type ReactNode } from "react";
import Head from "next/head";
import { ThemeProvider } from "@/lib/theme";
import { registerServiceWorker } from "@/lib/pwa";
import { api } from "@/lib/api";
import "../styles/globals.css";

/**
 * Pages can declare a persistent layout via `Page.getLayout`. The layout
 * stays mounted while navigating between pages that share it — that's
 * what lets the Studio sidebar, backdrop and workspace stay put while
 * only the active panel changes, instead of the whole screen reloading.
 */
export type NextPageWithLayout<P = object> = NextPage<P> & {
  getLayout?: (page: ReactElement) => ReactNode;
};

type AppPropsWithLayout = AppProps & { Component: NextPageWithLayout };

export default function App({ Component, pageProps }: AppPropsWithLayout) {
  const getLayout = Component.getLayout ?? ((page) => page);
  useEffect(() => registerServiceWorker(), []);
  // Wake the free-tier servers as soon as anyone opens the site.
  useEffect(() => {
    api.get("/warmup", { timeout: 90_000 }).catch(() => {});
  }, []);
  return (
    <ThemeProvider>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>YouTwin</title>
      </Head>
      {getLayout(<Component {...pageProps} />)}
    </ThemeProvider>
  );
}
