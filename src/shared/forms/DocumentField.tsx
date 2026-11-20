import type { ReactNode } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "../../components/ui/field";

export interface DocumentFieldControlProps {
  id: string;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
  required?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
}

export interface DocumentFieldProps {
  id: string;
  label: string;
  helper?: string;
  errors?: readonly string[];
  required?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  // Lookup owns its label/input/popup; only the surrounding helper and errors
  // belong to DocumentField. Never create a second label around the combobox.
  labelOwner?: "field" | "control";
  children(control: DocumentFieldControlProps): ReactNode;
}

export function DocumentField({
  id, label, helper, errors = [], required, readOnly, disabled,
  labelOwner = "field", children,
}: DocumentFieldProps) {
  const error = errors.length > 0;
  const helperId = id + "-helper";
  const errorId = id + "-error";
  const describedBy = [
    helper ? helperId : undefined,
    error ? errorId : undefined,
  ].filter(Boolean).join(" ") || undefined;
  return (
    <Field data-invalid={error || undefined} data-readonly={readOnly || undefined}>
      {labelOwner === "field" && (
        <FieldLabel htmlFor={id}>
          {label}{required && <span aria-hidden="true" className="ml-1 text-destructive before:content-['*']" />}
        </FieldLabel>
      )}
      {children({ id, "aria-invalid": error || undefined, "aria-describedby": describedBy,
        required, readOnly, disabled })}
      {helper && <FieldDescription id={helperId}>{helper}</FieldDescription>}
      {error && <FieldError id={errorId}>{errors.join(" ")}</FieldError>}
    </Field>
  );
}
