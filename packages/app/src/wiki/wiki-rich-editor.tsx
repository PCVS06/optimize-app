import { FormTextInput } from "@/components/ui/form-field";
import type { WikiIndexEntry } from "@getpaseo/protocol/optimize-wiki";

export interface WikiRichEditorProps {
  initialValue: string;
  onChange: (markdown: string) => void;
  disabled: boolean;
  pages: readonly WikiIndexEntry[];
}
// Native clients retain a text editor; the Mac and browser use the rich web editor.
export function WikiRichEditor({ initialValue, onChange, disabled }: WikiRichEditorProps) {
  return (
    <FormTextInput
      initialValue={initialValue}
      onChangeText={onChange}
      editable={!disabled}
      multiline
      accessibilityLabel="Article content"
      testID="wiki-body-input"
    />
  );
}
