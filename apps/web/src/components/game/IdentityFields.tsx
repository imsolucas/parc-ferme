import { Field } from '../ui/Field';
import { InitialsInput } from '../ui/InitialsInput';

export interface IdentityDraft {
  displayName: string;
  initials: string;
}

/** Display name + three-character high-score initials. Side by side from 640px of shell. */
export function IdentityFields({ value, onChange }: { value: IdentityDraft; onChange: (v: IdentityDraft) => void }) {
  return (
    <div className="grid gap-4 @min-[640px]/shell:grid-cols-[1fr_200px]">
      <Field
        label="DISPLAY NAME"
        required
        maxLength={24}
        autoComplete="nickname"
        value={value.displayName}
        onChange={(e) => onChange({ ...value, displayName: e.target.value })}
      />
      <InitialsInput value={value.initials} onChange={(initials) => onChange({ ...value, initials })} />
    </div>
  );
}
