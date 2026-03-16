export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        margin: 0,
        fontFamily: '"Space Grotesk", "Avenir Next", sans-serif',
        background:
          "linear-gradient(160deg, #050b14 0%, #0b1628 55%, #10203a 100%)",
        color: "#edf4ff",
      }}
    >
      <section
        style={{
          maxWidth: "680px",
          padding: "2rem",
          borderRadius: "24px",
          background: "rgba(9, 18, 34, 0.88)",
          border: "1px solid rgba(166, 194, 255, 0.16)",
          boxShadow: "0 24px 70px rgba(0, 0, 0, 0.35)",
        }}
      >
        <p
          style={{
            marginTop: 0,
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            color: "#4ee8c2",
            fontSize: "0.78rem",
          }}
        >
          Backend Service
        </p>
        <h1 style={{ marginTop: 0 }}>Next.js, Prisma, PostgreSQL, and Socket.IO are live.</h1>
        <p style={{ color: "#a8bad9", lineHeight: 1.7 }}>
          Use <code>/api/health</code> for the container health check and connect to
          Socket.IO on this same service at port 3001.
        </p>
      </section>
    </main>
  );
}
