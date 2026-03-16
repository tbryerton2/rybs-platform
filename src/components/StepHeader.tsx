type StepHeaderProps = {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
};

export function StepHeader({ step, total, title, subtitle }: StepHeaderProps) {
  return (
    <section className="space-y-2">
      <div className="text-sm text-muted-foreground">
        Step {step} of {total}
      </div>
      <h1 className="text-2xl font-semibold">{title}</h1>
      {subtitle ? (
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      ) : null}
    </section>
  );
}