import type { RemixiconComponentType } from "@remixicon/react"

export type NumberedItem = {
  icon: RemixiconComponentType
  title: string
  body: string
}

/**
 * The homepage's two five-item sections share this row layout instead of a card
 * grid: five cards in an `auto-fit` grid wrap 4 + 1 on wide viewports, leaving
 * an all-but-empty second row. Rows use the full column width, stay one item
 * per line at every size, and read as a pair across both sections.
 *
 * Each row is a large low-contrast index, then icon + title, then the body —
 * three columns on `md`, folding to number/title with the body beneath below
 * that. The index is decorative (`aria-hidden`): the list carries no order.
 */
export function NumberedList({ items }: { items: NumberedItem[] }) {
  return (
    <ul className="border-t">
      {items.map(({ icon: Icon, title, body }, i) => (
        <li
          key={title}
          className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-5 gap-y-2.5 border-b py-6 md:grid-cols-[4rem_minmax(0,1fr)_minmax(0,1.15fr)] md:items-center md:gap-x-8"
        >
          <span
            aria-hidden="true"
            className="font-mono text-[2.25rem] leading-none font-semibold text-muted-foreground/25 tabular-nums md:text-[2.75rem]"
          >
            {String(i + 1).padStart(2, "0")}
          </span>
          <div className="flex items-center gap-2.5 self-center">
            <Icon
              className="size-5 flex-none text-primary"
              aria-hidden="true"
            />
            <h3 className="text-base font-semibold md:text-[1.0625rem]">
              {title}
            </h3>
          </div>
          <p className="col-span-2 text-sm leading-relaxed text-muted-foreground md:col-span-1">
            {body}
          </p>
        </li>
      ))}
    </ul>
  )
}
