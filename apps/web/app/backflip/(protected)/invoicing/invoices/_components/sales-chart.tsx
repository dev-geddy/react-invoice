"use client"

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@workspace/ui/components/chart"

import { money } from "../../_lib/calc"
import type { CumulativePoint, SeriesStat } from "../_lib/ledger-stats"

/**
 * Cumulative sales across the tax year, one line per series.
 *
 * Series bill in their own currencies, so the axis is deliberately unitless and
 * every value is formatted with its series' symbol — the lines track each
 * series' own run rate rather than claiming £1 and €1 are the same thing.
 *
 * Palette: three categorical hues validated for CVD separation and contrast
 * against both surfaces (the theme's own chart ramp is a single blue hue —
 * right for magnitude, wrong for identity).
 *
 * @spec L2-INVOICE-34
 */

const HUES = [
  { light: "#2563eb", dark: "#3b82f6" },
  { light: "#0d9488", dark: "#0d9488" },
  { light: "#c2410c", dark: "#ea580c" },
]

/**
 * Direct label at the end of each line (identity is never colour-alone). Ink
 * stays in text tokens; the line beside it carries the colour.
 */
function endLabel(code: string, lastIndex: number) {
  return function EndLabel(props: {
    x?: number | string
    y?: number | string
    index?: number
  }) {
    if (props.index !== lastIndex) return null
    return (
      <text
        x={Number(props.x) - 4}
        y={Number(props.y) - 8}
        textAnchor="end"
        className="fill-muted-foreground text-[10px] font-medium"
      >
        {code}
      </text>
    )
  }
}

export function SalesChart({
  points,
  stats,
  taxYear,
}: {
  points: CumulativePoint[]
  stats: SeriesStat[]
  taxYear: string
}) {
  // Colour follows the series, never its position in a filtered list. The
  // legend carries each series' tax-year total, so the chart reads without
  // tracing a line back to its card — symbol included, since totals never mix.
  const config: ChartConfig = Object.fromEntries(
    stats.map((stat, index) => [
      stat.code,
      {
        label: `${stat.code} · ${stat.currency}${money(stat.taxYearTotal)}`,
        theme: HUES[index % HUES.length]!,
      },
    ])
  )

  const currencyOf = (code: string) =>
    stats.find((stat) => stat.code === code)?.currency ?? ""

  if (stats.length === 0) {
    return null
  }

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">
          Cumulative sales · tax year {taxYear}
        </h2>
        <p className="text-xs text-muted-foreground">
          Payable totals, each series in its own currency — not converted.
        </p>
      </div>

      <ChartContainer config={config} className="mt-3 h-[220px] w-full">
        <LineChart data={points} margin={{ left: 4, right: 12, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(value: number) =>
              value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)
            }
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) =>
                  `${currencyOf(String(name))}${money(Number(value))}`
                }
              />
            }
          />
          <ChartLegend
            content={<ChartLegendContent className="flex-wrap tabular-nums" />}
          />
          {stats.map((stat) => (
            <Line
              key={stat.code}
              dataKey={stat.code}
              type="monotone"
              stroke={`var(--color-${stat.code})`}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              label={endLabel(stat.code, points.length - 1)}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ChartContainer>
    </section>
  )
}
