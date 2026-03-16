import "./globals.css";

export const metadata = {
  title: "Transcendence Frontend",
  description: "Containerized frontend for local development.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
