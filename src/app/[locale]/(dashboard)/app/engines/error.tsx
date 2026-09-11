'use client';

// Route-level error boundary for the engines hub. Catches a failed catalog /
// balance fetch and offers a retry instead of bubbling to the generic app
// error page. Keeps the user inside the workspace chrome.

export default function EnginesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="cc-scroll">
      <div className="mt-6 rounded-[14px] border border-[var(--cc-red)]/30 bg-[var(--cc-red-g)] p-10 text-center">
        <div className="text-[15px] font-semibold text-[var(--cc-txt)]">
          No pudimos cargar tus engines
        </div>
        <p className="mx-auto mt-2 max-w-md text-[13px] text-[var(--cc-txt-2)]">
          Hubo un problema al traer el catálogo. Reintenta en un momento — si persiste, avísanos
          desde <span className="text-[var(--cc-txt)]">/contacto</span>.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-lg bg-[var(--cc-green)] px-5 py-2 text-[13px] font-bold text-[#070809] transition-[filter] hover:brightness-110"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
