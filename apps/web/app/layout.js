import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import { AuthProvider } from "./context/AuthContext";

config.autoAddCss = false; // <--- THIS LINE IS CRITICAL

import "./globals.css";
import { AlertProvider } from "./context/AlertContext";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta
          name="facebook-domain-verification"
          content="8mze9lni2dy386ipxkb22m5tp3rvxm"
        />
      </head>
      <body suppressHydrationWarning={true}>
        <AlertProvider>
          <AuthProvider>{children}</AuthProvider>
        </AlertProvider>
      </body>
    </html>
  );
}
