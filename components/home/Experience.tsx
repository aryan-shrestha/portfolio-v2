import { certifications, roles } from '@/content/experience'

const label = 'font-mono text-[13px] tracking-wide text-muted'

/**
 * Experience + Licenses & certifications (content/experience.ts), between the last chapter and Contact.
 * Plain paper background: no grid, which fought the small text. Dense rows on rules: dates | company,
 * skills | place. Job titles are kept in the data but not shown (owner's call). The character stays
 * in his badge here (the first badge section on the home page). Phones: one column, dates above the company.
 */
export function Experience() {
  return (
    <section
      id="experience"
      data-place="badge"
      data-gesture="thumbs"
      aria-labelledby="experience-h"
      className="bg-paper px-(--m) pt-[8svh] pb-[24svh]"
    >
      <h2 id="experience-h" className="display text-[clamp(44px,7vw,120px)] font-extrabold">
        Experience
      </h2>

      <ol className="mt-[clamp(32px,6svh,64px)] border-t-2 border-ink">
        {roles.map((r) => (
          <li
            key={`${r.company}-${r.start}`}
            className="grid grid-cols-[minmax(150px,1fr)_3fr_minmax(150px,1fr)] gap-x-6 gap-y-1 border-b border-ink/20 py-5 phone:grid-cols-1"
          >
            <p className={`${label} pt-1.5`}>
              {r.start} – {r.end ?? <span className="text-[#c43a22]">Present</span>}
            </p>
            <div>
              <h3 className="font-display text-[clamp(20px,1.8vw,28px)] leading-tight font-bold tracking-[-0.02em]">
                {r.company}
              </h3>
              {r.skills.length > 0 ? (
                <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Skills">
                  {r.skills.map((s) => (
                    <li key={s} className="rounded-full border border-ink/25 px-2.5 py-0.5 text-[13px]">
                      {s}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <p className={`${label} pt-1.5 text-right phone:pt-0 phone:text-left`}>
              {r.location} · {r.mode}
            </p>
          </li>
        ))}
      </ol>

      <h2
        id="certifications"
        className="display mt-[clamp(64px,12svh,140px)] text-[clamp(32px,4vw,64px)] font-extrabold"
      >
        Licenses &amp; certifications
      </h2>
      <ul className="mt-[clamp(24px,4svh,40px)] grid grid-cols-2 gap-[clamp(12px,1.6vw,20px)] phone:grid-cols-1">
        {certifications.map((c) => (
          <li
            key={c.credentialId}
            className="flex flex-col justify-between gap-4 rounded-[10px] border-2 border-ink bg-paper p-5 shadow-[5px_5px_0_rgba(0,0,0,0.25)]"
          >
            <div>
              <p className={label}>
                {c.issuer} · {c.issued}
              </p>
              <h3 className="mt-1.5 font-display text-xl leading-tight font-bold tracking-[-0.02em]">{c.name}</h3>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <span className="font-mono text-xs break-all text-muted">ID {c.credentialId}</span>
              <a
                href={c.url}
                target="_blank"
                rel="noopener"
                className="inline-flex min-h-11 items-center text-[15px] font-medium underline decoration-1 underline-offset-4 hover:decoration-2"
              >
                Show credential ↗<span className="sr-only"> for {c.name} (opens in a new tab)</span>
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
