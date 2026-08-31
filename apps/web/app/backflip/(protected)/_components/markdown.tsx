"use client"

import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"

import { cn } from "@workspace/ui/lib/utils"

/**
 * Minimal markdown renderer for model output. No typography plugin in the
 * design system, so each element is styled explicitly and kept tight — this
 * renders inside a scrolling box, not a document page.
 *
 * Raw HTML is not enabled (react-markdown escapes it by default): model output
 * is untrusted text.
 */
const COMPONENTS: Components = {
  h1: ({ className, ...props }) => (
    <h2
      className={cn("mt-3 mb-1.5 text-sm font-semibold first:mt-0", className)}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h3
      className={cn("mt-3 mb-1.5 text-sm font-semibold first:mt-0", className)}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h4
      className={cn("mt-3 mb-1 text-xs font-semibold first:mt-0", className)}
      {...props}
    />
  ),
  p: ({ className, ...props }) => (
    <p className={cn("my-1.5 first:mt-0 last:mb-0", className)} {...props} />
  ),
  ul: ({ className, ...props }) => (
    <ul
      className={cn(
        "my-1.5 ml-4 list-disc space-y-1 marker:text-muted-foreground",
        className
      )}
      {...props}
    />
  ),
  ol: ({ className, ...props }) => (
    <ol
      className={cn(
        "my-1.5 ml-4 list-decimal space-y-1 marker:text-muted-foreground",
        className
      )}
      {...props}
    />
  ),
  li: ({ className, ...props }) => (
    <li className={cn("pl-0.5", className)} {...props} />
  ),
  a: ({ className, ...props }) => (
    <a
      className={cn(
        "underline underline-offset-3 hover:text-foreground",
        className
      )}
      target="_blank"
      rel="noreferrer noopener"
      {...props}
    />
  ),
  strong: ({ className, ...props }) => (
    <strong className={cn("font-semibold", className)} {...props} />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn("my-2 border-l-2 pl-3 text-muted-foreground", className)}
      {...props}
    />
  ),
  hr: ({ className, ...props }) => (
    <hr className={cn("my-3 border-border", className)} {...props} />
  ),
  // Fenced blocks arrive as <pre><code>; only the inline case needs a chip.
  code: ({ className, ...props }) => (
    <code
      className={cn(
        "rounded bg-muted px-1 py-0.5 font-mono text-[11px] in-[pre]:bg-transparent in-[pre]:p-0 in-[pre]:text-inherit",
        className
      )}
      {...props}
    />
  ),
  pre: ({ className, ...props }) => (
    <pre
      className={cn(
        "my-2 overflow-x-auto rounded-lg border bg-muted/50 p-3 font-mono text-[11px] leading-relaxed",
        className
      )}
      {...props}
    />
  ),
  table: ({ className, ...props }) => (
    <div className="my-2 overflow-x-auto rounded-lg border">
      {/* Row separators, not cell separators: the last row drops its border so
          the rule doesn't double up with the wrapper's bottom edge. */}
      <table
        className={cn(
          "w-full text-left [&>tbody>tr:last-child>td]:border-0",
          className
        )}
        {...props}
      />
    </div>
  ),
  th: ({ className, ...props }) => (
    <th
      className={cn("border-b px-2.5 py-1.5 font-semibold", className)}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td className={cn("border-b px-2.5 py-1.5", className)} {...props} />
  ),
}

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
      {children}
    </ReactMarkdown>
  )
}
