import type { Bar } from "@/lib/staff-stats";

/** A single-series magnitude chart, rendered as a real table.
 *
 *  One hue (length carries the magnitude, so colour has no second job to do), every bar directly
 *  labelled, and the track recessive. Because the markup is a `<table>` with a real header, the
 *  accessible "table view" and the chart are the same object: a screen reader reads rows and values,
 *  a sighted reader sees bars. That also means no tooltip and no client component is needed, since
 *  no value is hidden behind a hover. */
export function BarList({
  caption,
  valueLabel,
  bars,
  unit,
}: {
  caption: string;
  /** Header for the value column, e.g. "Gäste". */
  valueLabel: string;
  bars: Bar[];
  unit?: string;
}) {
  const max = Math.max(...bars.map((b) => b.value), 0);

  if (bars.length === 0 || max === 0) {
    return (
      <figure className="m-0">
        <figcaption className="mb-2 text-sm font-semibold">{caption}</figcaption>
        <p className="text-sm text-muted">Dafür gibt es noch keine Daten.</p>
      </figure>
    );
  }

  return (
    <figure className="m-0">
      <figcaption className="mb-2 text-sm font-semibold">{caption}</figcaption>
      <table className="w-full border-collapse text-sm">
        <thead className="sr-only">
          <tr>
            <th scope="col">Kategorie</th>
            <th scope="col">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((bar) => (
            <tr key={bar.label}>
              <th scope="row" className="w-24 py-[3px] pr-3 text-left align-middle font-normal text-muted">
                {bar.label}
              </th>
              <td className="py-[3px] align-middle">
                <span className="flex items-center gap-2">
                  {/* The track is the surface, so the fill reads as length rather than as a divided whole. */}
                  <span className="h-2.5 min-w-0 flex-1 rounded-sm bg-mint" aria-hidden="true">
                    <span
                      className="block h-full rounded-sm bg-blue-dark"
                      style={{ width: `${Math.max((bar.value / max) * 100, 2)}%` }}
                    />
                  </span>
                  <span className="w-14 shrink-0 text-right font-semibold tabular-nums">
                    {bar.value}
                    {unit ? ` ${unit}` : ""}
                  </span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
