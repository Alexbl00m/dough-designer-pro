import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}

export function NumberField({
  id,
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  suffix,
}: NumberFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          value={Number.isFinite(value) ? value : ''}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            const next = Number(event.target.value);
            // A half-typed or empty field must never poison the recipe with NaN.
            onChange(Number.isFinite(next) ? next : min);
          }}
          onBlur={(event) => {
            const next = Number(event.target.value);
            if (!Number.isFinite(next) || next < min) onChange(min);
            else if (max !== undefined && next > max) onChange(max);
          }}
          className={suffix ? 'pr-10 tabular' : 'tabular'}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
