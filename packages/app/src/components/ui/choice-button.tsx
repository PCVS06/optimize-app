import { useCallback, type ComponentProps } from "react";
import { Button } from "./button";

/** A value-bearing button keeps callbacks stable in selectable lists. */
export function ChoiceButton<T extends string>({
  value,
  onSelect,
  ...props
}: Omit<ComponentProps<typeof Button>, "onPress"> & { value: T; onSelect: (value: T) => void }) {
  const onPress = useCallback(() => onSelect(value), [onSelect, value]);
  return <Button {...props} onPress={onPress} />;
}
