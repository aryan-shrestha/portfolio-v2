export type DiagramId = 'napa' | 'bevlytics' | 'bevlytics-cloudwatch' | 'dti' | 'dti-tenant'

const LABELS: Record<DiagramId, string> = {
  napa: 'Diagram: the browser talks to a Next.js front end, which calls a Python FastAPI back end.',
  bevlytics:
    'Diagram: raw distributor data runs through an ETL job on AWS Lambda into Snowflake. CloudWatch sits beside Lambda and receives its logs.',
  'bevlytics-cloudwatch':
    'Diagram: raw distributor data runs through an ETL job on AWS Lambda into Snowflake. CloudWatch, highlighted, sits beside Lambda and receives its logs.',
  dti: 'Diagram: a React front end calls a NestJS back end with TypeORM, which stores data in PostgreSQL with row-level security. Connectors in the back end read from Snowflake and Google Drive.',
  'dti-tenant':
    'Diagram: a React front end calls a NestJS back end, whose tenant unit of work and PostgreSQL row-level security, highlighted, keep each tenant to its own data. Connectors read from Snowflake and Google Drive.',
}

const INK = 'var(--ink)'
const ACCENT = 'var(--accent)'

type NodeProps = {
  x: number
  y: number
  w: number
  h: number
  label: string[]
  caption?: string
  size: number
  shade: string
  hl?: boolean
}

/** A white card with a 2.5px ink border and the site's dotted offset shadow. */
function Node({ x, y, w, h, label, caption, size, shade, hl }: NodeProps) {
  const lineH = size * 1.02
  const block = label.length * lineH + (caption ? 30 : 0)
  const first = y + (h - block) / 2 + size * 0.8
  return (
    <g>
      <rect x={x + 7} y={y + 7} width={w} height={h} rx={14} fill={`url(#${shade})`} opacity={0.6} />
      <rect x={x} y={y} width={w} height={h} rx={14} fill={hl ? ACCENT : '#fff'} stroke={INK} strokeWidth={2.5} />
      {label.map((t, i) => (
        <text
          key={t}
          x={x + w / 2}
          y={first + i * lineH}
          textAnchor="middle"
          fontSize={size}
          fontWeight={800}
          letterSpacing="-0.03em"
          fill={INK}
          className="font-display"
        >
          {t}
        </text>
      ))}
      {caption ? (
        <text
          x={x + w / 2}
          y={first + (label.length - 1) * lineH + 32}
          textAnchor="middle"
          fontSize={20}
          fill={hl ? INK : 'var(--muted)'}
          className="font-mono"
        >
          {caption}
        </text>
      ) : null}
    </g>
  )
}

/** A dotted (dithered) connector with an open arrowhead at (x2, y2). */
function Flow({ x1, y1, x2, y2, hl }: { x1: number; y1: number; x2: number; y2: number; hl?: boolean }) {
  const a = Math.atan2(y2 - y1, x2 - x1)
  const head = (da: number) => `${x2 - 13 * Math.cos(a + da)},${y2 - 13 * Math.sin(a + da)}`
  const c = hl ? ACCENT : INK
  return (
    <g stroke={c} strokeLinecap="round" fill="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={5} strokeDasharray="0 9" />
      <polyline points={`${head(-0.6)} ${x2},${y2} ${head(0.6)}`} strokeWidth={3} strokeLinejoin="round" />
    </g>
  )
}

/**
 * Architecture diagrams shown in the chapter's browser frame (spec §6.3), drawn in the site's
 * ink/paper/accent system on a dotted ground. Facts only from §6.3 / §6.6.
 */
export function Diagram({ id }: { id: DiagramId }) {
  const shade = `shade-${id}`
  return (
    <div
      className="h-full w-full bg-paper"
      style={{
        backgroundImage: 'radial-gradient(rgb(17 17 16 / 0.18) 1px, transparent 1.3px)',
        backgroundSize: '8px 8px',
      }}
    >
      <svg viewBox="0 0 640 400" role="img" aria-label={LABELS[id]} className="block h-full w-full">
        <defs>
          <pattern id={shade} width="4" height="4" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.1" fill={INK} />
          </pattern>
        </defs>
        {id === 'napa' ? (
          <>
            <Node x={24} y={145} w={168} h={110} label={['Browser']} caption="couples" size={34} shade={shade} />
            <Flow x1={204} y1={200} x2={226} y2={200} />
            <Node x={236} y={145} w={168} h={110} label={['Next.js']} caption="front end" size={34} shade={shade} />
            <Flow x1={416} y1={200} x2={438} y2={200} />
            <Node x={448} y={145} w={168} h={110} label={['FastAPI']} caption="back end" size={34} shade={shade} />
          </>
        ) : id === 'dti' || id === 'dti-tenant' ? (
          <>
            <Node x={20} y={70} w={176} h={116} label={['React']} caption="front end" size={25} shade={shade} />
            <Flow x1={204} y1={128} x2={224} y2={128} />
            <Node
              x={232}
              y={70}
              w={176}
              h={116}
              label={['NestJS']}
              caption={id === 'dti-tenant' ? 'tenant UoW' : 'TypeORM'}
              size={25}
              shade={shade}
            />
            <Flow x1={416} y1={128} x2={436} y2={128} hl={id === 'dti-tenant'} />
            <Node
              x={444}
              y={70}
              w={176}
              h={116}
              label={['PostgreSQL']}
              caption="RLS"
              size={25}
              shade={shade}
              hl={id === 'dti-tenant'}
            />
            <Node x={128} y={262} w={176} h={96} label={['Snowflake']} caption="connector" size={25} shade={shade} />
            <Flow x1={232} y1={254} x2={286} y2={196} />
            <Node x={336} y={262} w={176} h={96} label={['Google Drive']} caption="connector" size={25} shade={shade} />
            <Flow x1={408} y1={254} x2={354} y2={196} />
          </>
        ) : (
          <>
            <Node x={20} y={70} w={176} h={116} label={['Distributor', 'data']} caption="raw" size={25} shade={shade} />
            <Flow x1={204} y1={128} x2={224} y2={128} />
            <Node x={232} y={70} w={176} h={116} label={['AWS Lambda']} caption="ETL" size={25} shade={shade} />
            <Flow x1={416} y1={128} x2={436} y2={128} />
            <Node x={444} y={70} w={176} h={116} label={['Snowflake']} size={25} shade={shade} />
            <Flow x1={320} y1={196} x2={320} y2={250} hl={id === 'bevlytics-cloudwatch'} />
            <Node
              x={232}
              y={262}
              w={176}
              h={96}
              label={['CloudWatch']}
              caption="logs"
              size={25}
              shade={shade}
              hl={id === 'bevlytics-cloudwatch'}
            />
          </>
        )}
      </svg>
    </div>
  )
}
