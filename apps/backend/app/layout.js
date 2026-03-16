export const metadata = {
  title: "Transcendence Backend",
  description: "Containerized backend service for local development.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
