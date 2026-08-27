import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface SliderFieldProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Rendered next to the label, e.g. "72%" or "24 h". */
  display: ReactNode;
  onChange: (value: number) => void;
  help?: string;
  /** The style's own value; clicking the hint snaps back to it. */
  reference?: { value: number; label: string };
  disabled?: boolean;
  className?: string;
}

/**
 * A slider that always shows its current value and — when the baker has drifted
 * away from it — what the style itself recommends, as a one-click way back.
 */
export function SliderField({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  display,
  onChange,
  help,
  reference,
  disabled,
  className,
}: SliderFieldProps) {
  const offReference = reference !== undefined && Math.abs(reference.value - value) > step / 2;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="flex items-center gap-1.5 text-sm">
          {label}
          {help && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={help}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-sm">{help}</TooltipContent>
            </Tooltip>
          )}
        </Label>
        <span className="text-sm font-semibold tabular">{display}</span>
      </div>

      <Slider
        id={id}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([next]) => onChange(next)}
        disabled={disabled}
        aria-label={label}
        aria-valuetext={typeof display === 'string' ? display : undefined}
      />

      {reference && (
        <button
          type="button"
          onClick={() => onChange(reference.value)}
          disabled={disabled || !offReference}
          className={cn(
            'text-xs transition-colors',
            offReference
              ? 'text-primary underline-offset-2 hover:underline'
              : 'cursor-default text-muted-foreground',
          )}
        >
          {reference.label}
        </button>
      )}
    </div>
  );
}
