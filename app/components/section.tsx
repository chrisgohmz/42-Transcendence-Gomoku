type SectionProps = {
  title: string;
  children: React.ReactNode;
};

export default function Section({ title, children }: SectionProps) {
  return (
    <section className="mt-6 rounded-lg border border-[var(--panel-border-soft)] bg-white/[0.035] p-5">
      <h2 className="font-serif text-xl font-semibold text-[var(--text)]">{title}</h2>

      <p className="mt-2 leading-7 text-[var(--muted-text)]">{children}</p>
    </section>
  );
}
