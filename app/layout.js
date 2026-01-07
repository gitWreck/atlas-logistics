// app/layout.js
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
config.autoAddCss = false; // <--- THIS LINE IS CRITICAL

import "./globals.css";
// import Navbar from "@/components/Navbar"; // You need to create this
// import Footer from "@/components/Footer";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {/* <Navbar />  */}
        {children}
        {/* <Footer /> */}
      </body>
    </html>
  );
}
