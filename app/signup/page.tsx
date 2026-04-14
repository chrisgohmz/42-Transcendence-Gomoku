import { SignupForm } from "../components/signup-form";

export default function SignupPage() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Authentication</p>
        <h1>Create your account.</h1>
        <p className="lede">
          Use an email and password to start playing immediately. No third-party
          provider setup required.
        </p>
      </section>

      <section className="panel">
        <SignupForm />
      </section>
    </main>
  );
}
