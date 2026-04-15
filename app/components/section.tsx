type SectionProps = {
  title: string;
  children: React.ReactNode;
};

export default function Section({ title, children }: SectionProps) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-slate-300">{title}</h2>

      <p className="mt-2 text-slate-200">{children}</p>
    </section>
  );
}
