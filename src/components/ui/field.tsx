import * as React from "react";
import { cn } from "cn";

// Nova/Base UI field presentation. No form state or validator lives here.
export function Field({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="field" role="group" className={cn("group/field flex min-w-0 flex-col gap-1.5", className)} {...props} />;
}
export function FieldLabel({ className, ...props }: React.ComponentProps<"label">) {
  return <label data-slot="field-label" className={cn("text-sm leading-none font-medium group-data-[invalid=true]/field:text-destructive", className)} {...props} />;
}
export function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="field-description" className={cn("text-xs leading-snug text-muted-foreground", className)} {...props} />;
}
export function FieldError({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="field-error" className={cn("text-xs leading-snug text-destructive", className)} {...props} />;
}
