export function PageHeader({
  kicker,
  title,
  jp,
  children,
}: {
  kicker?: string;
  title: string;
  jp?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-wrap items-end justify-between gap-4 sm:gap-5">
      {jp && (
        <div className="font-jp pointer-events-none absolute -top-4 right-0 hidden text-[80px] leading-none font-black text-blanc-casse/3 select-none sm:-top-7 sm:text-[110px] lg:block lg:text-[130px]">
          {jp}
        </div>
      )}
      <div>
        {kicker && (
          <div className="mb-2.5 text-[12px] font-bold tracking-[4px] text-carmin uppercase">{kicker}</div>
        )}
        <h1 className="font-display text-[clamp(32px,8vw,74px)] leading-[0.95] wrap-break-word -skew-x-6 uppercase text-blanc-casse [text-shadow:4px_4px_0_var(--color-carmin)]">
          {title}
        </h1>
      </div>
      {children}
    </div>
  );
}
