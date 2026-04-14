import { LoginForm } from "../components/login-form";

export default function LoginPage() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Authentication</p>
        <h1>Welcome back.</h1>
        <p className="lede">
          Sign in to create rooms, play matches, and access your private pages.
        </p>
      </section>

      <section className="panel">
        <LoginForm />
      </section>
    </main>
  );
}
