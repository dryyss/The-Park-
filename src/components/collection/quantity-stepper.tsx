"use client";

export function QuantityStepper({
  quantity,
  min = 0,
  max = 99,
  pending,
  error,
  onIncrease,
  onDecrease,
  increaseLabel,
  decreaseLabel,
  compact = false,
}: {
  quantity: number;
  min?: number;
  max?: number;
  pending?: boolean;
  error?: string | null;
  onIncrease: () => void;
  onDecrease: () => void;
  increaseLabel: string;
  decreaseLabel: string;
  compact?: boolean;
}) {
  const btnClass = compact
    ? "flex h-7 w-7 items-center justify-center rounded-md border border-charbon-500 bg-charbon-700 text-[16px] font-bold text-blanc-casse transition hover:border-carmin hover:bg-carmin/15 disabled:cursor-not-allowed disabled:opacity-40"
    : "flex h-8 w-8 items-center justify-center rounded-lg border border-charbon-500 bg-charbon-700 text-[18px] font-bold text-blanc-casse transition hover:border-carmin hover:bg-carmin/15 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className={`flex flex-col items-stretch gap-1 ${compact ? "" : "mt-2"}`}>
      <div className="flex items-center justify-center gap-1.5">
        <button
          type="button"
          disabled={pending || quantity <= min}
          onClick={onDecrease}
          aria-label={decreaseLabel}
          className={btnClass}
        >
          −
        </button>
        <span
          className={`min-w-[2.5rem] text-center font-extrabold tabular-nums text-blanc-casse ${compact ? "text-[13px]" : "text-[14px]"}`}
          aria-live="polite"
        >
          {quantity}
        </span>
        <button
          type="button"
          disabled={pending || quantity >= max}
          onClick={onIncrease}
          aria-label={increaseLabel}
          className={btnClass}
        >
          +
        </button>
      </div>
      {error && <p className="text-center text-[10px] font-bold text-neon-rouge">{error}</p>}
    </div>
  );
}
