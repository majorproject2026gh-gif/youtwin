import { Html, Head, Main, NextScript } from "next/document";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

/**
 * The theme attribute is set here, before <body> paints, so every route
 * loads directly in the user's chosen theme — no flash on refresh.
 */
export default function Document() {
  return (
    <Html lang="en" data-theme="dark" suppressHydrationWarning>
      <Head>
        <meta name="color-scheme" content="dark light" />
        {/* Installable app (PWA): manifest, icons, and native-feeling
            status bar on iOS/Android. theme-color is kept in sync with
            the chosen theme by lib/theme.ts. */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
        <link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="theme-color" content="#08080A" />
        <meta name="application-name" content="YouTwin" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="YouTwin" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="format-detection" content="telephone=no" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
