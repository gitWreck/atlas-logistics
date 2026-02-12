import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import { AuthProvider } from "./context/AuthContext";

config.autoAddCss = false; // <--- THIS LINE IS CRITICAL

import "./globals.css";
import { AlertProvider } from "./context/AlertContext";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AlertProvider>
          <AuthProvider>{children}</AuthProvider>
        </AlertProvider>
      </body>
    </html>
  );
}
