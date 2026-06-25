import Image from "next/image";

/** Skeleton affiché instantanément pendant la navigation (RSC en cours). */
export default function LocaleLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6" aria-busy="true" aria-label="Chargement">
      <div className="flex flex-col items-center gap-4">
        <span className="h-[72px] w-[72px] rotate-[-4deg] overflow-hidden rounded-[16px] bg-blanc-casse shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <Image
            src="/uploads/pasted-1781200672492-0.png"
            alt="The Park"
            width={72}
            height={72}
            className="h-full w-full scale-110 object-cover"
          />
        </span>
        <div className="flex flex-col items-center leading-none">
          <span className="font-display text-[22px] tracking-[2px] text-blanc-casse">THE PARK</span>
          <span className="font-jp mt-[4px] text-[10px] font-bold tracking-[3px] text-carmin">駐車場 · DRIFT/JDM</span>
        </div>
      </div>

      <div className="flex gap-[6px]">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-[6px] w-[6px] rounded-full bg-carmin"
            style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
