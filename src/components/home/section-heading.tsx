export function SectionHeading({ title, jp, children }: { title: string; jp: string; children?: React.ReactNode }) {
  return (
    <div className="mb-[18px] flex items-center gap-3.5">
      <h2 className="font-display text-[30px] tracking-[2px] skew-x-[-3deg] uppercase text-blanc-casse [text-shadow:3px_3px_0_var(--color-carmin)]">
        {title}
      </h2>
      <span className="font-jp text-[13px] font-bold tracking-[2px] text-texte-faible">{jp}</span>
      <div className="flex-1" />
      {children}
    </div>
  );
}
