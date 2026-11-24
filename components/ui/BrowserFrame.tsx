import type { ReactNode } from 'react'

export function BrowserFrame({ host, children }: { host: string; children: ReactNode }) {
  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="absolute inset-0 translate-x-2 translate-y-2 rounded-xl opacity-60"
        style={{
          backgroundImage: 'radial-gradient(var(--color-ink) 1.1px, transparent 1.4px)',
          backgroundSize: '4px 4px',
        }}
      />
      <div className="relative overflow-hidden rounded-xl border border-black/20 bg-white">
        <div className="relative flex h-8 items-center gap-1.5 border-b border-[#e7e3d8] px-3">
          <i className="size-[9px] rounded-full bg-[#dcd8cd]" />
          <i className="size-[9px] rounded-full bg-[#dcd8cd]" />
          <i className="size-[9px] rounded-full bg-[#dcd8cd]" />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full bg-[#f1efe9] px-3 py-[3px] font-mono text-xs text-[#555]">
            {host}
          </span>
        </div>
        {children}
      </div>
    </div>
  )
}
