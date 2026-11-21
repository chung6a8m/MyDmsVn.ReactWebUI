import { useRef, type ComponentProps } from "react";
import { Input } from "../../components/ui/input";

export interface DecimalInputProps extends Omit<ComponentProps<"input">,
  "type" | "value" | "defaultValue" | "onChange" | "onCompositionStart" | "onCompositionEnd"> {
  value: string;
  composing?: boolean;
  onRawChange(raw: string, composing: boolean): void;
  onEscape?(): void;
}

/**
 * Presentation-only controlled decimal text input.
 * The caller owns raw buffers, validation, commit, and Escape restoration.
 * Never parses, truncates, rounds, formats, or uses an input[type=number].
 */
export function DecimalInput({
  value, composing = false, onRawChange, onEscape, onKeyDownCapture, ...inputProps
}: DecimalInputProps) {
  const composition = useRef(false);

  return (
    <Input
      {...inputProps}
      type="text"
      inputMode="decimal"
      value={value}
      data-composing={composing}
      onChange={event => onRawChange(
        event.currentTarget.value,
        composition.current || (event.nativeEvent as InputEvent).isComposing === true,
      )}
      onCompositionStart={event => {
        composition.current = true;
        onRawChange(event.currentTarget.value, true);
      }}
      onCompositionEnd={event => {
        composition.current = false;
        onRawChange(event.currentTarget.value, false);
      }}
      onKeyDownCapture={event => {
        if (event.key === "Escape" &&
          !composition.current && !composing && !event.nativeEvent.isComposing)
          onEscape?.();
        // Do not swallow Escape: AG Grid must finish cancelling its editor.
        onKeyDownCapture?.(event);
      }}
    />
  );
}
