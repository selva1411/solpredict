import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[2px] border px-2 py-0.5 font-mono text-[10px] font-medium tracking-[.08em] whitespace-nowrap transition-all duration-150 ease-[cubic-bezier(.22,.61,.36,1)] focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-void focus-visible:outline-none has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-bordeaux aria-invalid:ring-bordeaux/20 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "border-gold/30 bg-gold/10 text-gold-lite [a]:hover:bg-gold/20",
        secondary:
          "border-hairline-2 bg-panel-2 text-ash [a]:hover:border-gold-deep [a]:hover:text-ivory",
        destructive:
          "border-bordeaux/30 bg-bordeaux/10 text-bordeaux [a]:hover:bg-bordeaux/20",
        success:
          "border-verdigris/30 bg-verdigris/10 text-verdigris [a]:hover:bg-verdigris/20",
        outline:
          "border-hairline text-ivory [a]:hover:border-gold-deep [a]:hover:text-gold-lite",
        ghost:
          "text-ash-dim [a]:hover:text-ivory",
        link: "text-gold underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }