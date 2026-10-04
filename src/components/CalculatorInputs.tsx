import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { SliderField } from '@/components/inputs/SliderField';
import { SelectField } from '@/components/inputs/SelectField';
import { NumberField } from '@/components/inputs/NumberField';
import type { BreadStyle } from '@/data/styles';
import { isPizzaStyle } from '@/data/styles';
import type { RecipeParams } from '@/lib/recipe/state';
import { FRICTION_FACTOR_C } from '@/core/constants';
import type { MixingMethod, YeastForm } from '@/core/constants';
import type { FermentDriver, LeavenType, PercentBasis, ScaleMode } from '@/core/types';
import { PlanCard } from '@/components/PlanCard';
import type { PlanState } from '@/lib/recipe/plan';
import type { CalculationResults } from '@/core/types';
import { YEAST_CONVERSION, clamp, round } from '@/core/constants';
import { useI18n } from '@/i18n';
import { formatGrams, formatNumber, formatYeastPct } from '@/lib/format';

interface CalculatorInputsProps {
  style: BreadStyle;
  params: RecipeParams;
  /** The computed recipe, so the fixed side of every slider shows what it implies. */
  results: CalculationResults | null;
  onChange: <K extends keyof RecipeParams>(key: K, value: RecipeParams[K]) => void;
  onDriverChange: (driver: FermentDriver) => void;
  onReset: () => void;
  plan: PlanState;
  onPlanChange: (plan: PlanState) => void;
}

export function CalculatorInputs({
  style,
  params,
  results,
  onChange,
  onDriverChange,
  onReset,
  plan,
  onPlanChange,
}: CalculatorInputsProps) {
  const { t, lang } = useI18n();
  const num = (value: number, decimals = 1) => formatNumber(value, lang, decimals);

  const preferment = params.usePreferment ? style.preferment : undefined;
  const prefermentName = preferment ? t(`section.${preferment.type}`) : '';
  const prefermentTemp = params.prefermentTemp ?? preferment?.temp_c ?? params.roomTemp;
  // In dose mode the time is an answer, not an input; the fridge slider still
  // needs to know how long the ferment runs.
  const totalHours = results?.fermentation.totalHours ?? params.totalTime;
  const freshDose = params.yeastPct ?? results?.fermentation.freshYeastPct ?? 0.2;

  const pieceUnit = isPizzaStyle(style) ? 'unit.ball' : 'unit.loaf';
  const pieceUnitPlural = isPizzaStyle(style) ? 'unit.balls' : 'unit.loaves';
  const usesYeast = params.leavenType !== 'sourdough';
  const usesStarter = params.leavenType !== 'commercial';

  return (
    <div className="space-y-4">
      {/* ── Batch size ── */}
      <Card className="p-5" data-print-card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold">{t('params.dough')}</h3>
          <Button variant="ghost" size="sm" onClick={onReset} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">{t('params.reset')}</span>
          </Button>
        </div>

        <div className="space-y-5">
          <SelectField<ScaleMode>
            id="scaleMode"
            label={t('field.scaleMode')}
            value={params.scaleMode}
            onChange={(value) => onChange('scaleMode', value)}
            help={t('field.scaleMode.help')}
            options={[
              { value: 'pieces', label: t('field.scaleMode.pieces') },
              { value: 'flour', label: t('field.scaleMode.flour') },
              { value: 'dough', label: t('field.scaleMode.dough') },
            ]}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {params.scaleMode === 'pieces' && (
              <>
                <NumberField
                  id="ballWeight"
                  label={t('field.ballWeight', { unit: t(pieceUnit) })}
                  value={params.ballWeight}
                  onChange={(value) => onChange('ballWeight', value)}
                  min={20}
                  max={5000}
                  step={5}
                  suffix="g"
                />
                <NumberField
                  id="ballCount"
                  label={t('field.ballCount', { unit: t(pieceUnitPlural) })}
                  value={params.ballCount}
                  onChange={(value) => onChange('ballCount', value)}
                  min={1}
                  max={100}
                />
              </>
            )}
            {params.scaleMode === 'flour' && (
              <>
                <NumberField
                  id="targetFlour"
                  label={t('field.targetFlour')}
                  value={params.targetFlour}
                  onChange={(value) => onChange('targetFlour', value)}
                  min={50}
                  max={50000}
                  step={50}
                  suffix="g"
                />
                <NumberField
                  id="ballCountFlour"
                  label={t('field.ballCount', { unit: t(pieceUnitPlural) })}
                  value={params.ballCount}
                  onChange={(value) => onChange('ballCount', value)}
                  min={1}
                  max={100}
                />
              </>
            )}
            {params.scaleMode === 'dough' && (
              <>
                <NumberField
                  id="targetDough"
                  label={t('field.targetDough')}
                  value={params.targetDough}
                  onChange={(value) => onChange('targetDough', value)}
                  min={50}
                  max={50000}
                  step={50}
                  suffix="g"
                />
                <NumberField
                  id="ballCountDough"
                  label={t('field.ballCount', { unit: t(pieceUnitPlural) })}
                  value={params.ballCount}
                  onChange={(value) => onChange('ballCount', value)}
                  min={1}
                  max={100}
                />
              </>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <SliderField
              id="hydration"
              label={t('field.hydration')}
              value={params.hydration}
              min={45}
              max={100}
              step={0.5}
              display={`${num(params.hydration)}%`}
              onChange={(value) => onChange('hydration', value)}
              help={t('field.hydration.help')}
              reference={{
                value: style.defaultParams.hydration_pct,
                label: t('field.styleDefault', {
                  value: `${num(style.defaultParams.hydration_pct)}%`,
                }),
              }}
            />
            <SliderField
              id="salt"
              label={t('field.salt')}
              value={params.salt}
              min={0}
              max={4}
              step={0.1}
              display={`${num(params.salt)}%`}
              onChange={(value) => onChange('salt', value)}
              help={t('field.salt.help')}
              reference={{
                value: style.defaultParams.salt_pct,
                label: t('field.styleDefault', { value: `${num(style.defaultParams.salt_pct)}%` }),
              }}
            />
            <SliderField
              id="sugar"
              label={t('field.sugar')}
              value={params.sugar}
              min={0}
              max={30}
              step={0.5}
              display={`${num(params.sugar)}%`}
              onChange={(value) => onChange('sugar', value)}
              reference={{
                value: style.defaultParams.sugar_pct,
                label: t('field.styleDefault', { value: `${num(style.defaultParams.sugar_pct)}%` }),
              }}
            />
            <SliderField
              id="fat"
              label={t('field.fat')}
              value={params.oil}
              min={0}
              max={50}
              step={0.5}
              display={`${num(params.oil)}%`}
              onChange={(value) => onChange('oil', value)}
              reference={{
                value: style.defaultParams.oil_pct,
                label: t('field.styleDefault', { value: `${num(style.defaultParams.oil_pct)}%` }),
              }}
            />
          </div>
        </div>
      </Card>

      {/* ── Plan ── */}
      {results && (
        <PlanCard
          results={results}
          plan={plan}
          onPlanChange={onPlanChange}
          prefermentLabel={preferment ? t(`section.${preferment.type}`) : undefined}
        />
      )}

      {/* ── Fermentation ── */}
      <Card className="p-5" data-print-card>
        <h3 className="mb-4 text-base font-semibold">{t('params.fermentation')}</h3>
        <SelectField<FermentDriver>
          id="driver"
          label={t('field.driver')}
          value={params.driver}
          onChange={onDriverChange}
          help={t('field.driver.help')}
          options={[
            { value: 'time', label: t('field.driver.time') },
            { value: 'dose', label: t('field.driver.dose') },
          ]}
        />

        {/* The preferment is part of the plan, not a fixed overnight: its time,
            temperature and fridge hours are the baker's, and its yeast follows. */}
        {preferment && (
          <div className="mt-5 rounded-lg border border-dashed border-border p-4">
            <h4 className="mb-4 text-sm font-semibold">
              {t('field.preferment.title', { type: prefermentName })}
            </h4>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <SliderField
                id="prefermentHours"
                label={t('field.prefermentHours', { type: prefermentName })}
                value={params.prefermentHours}
                min={2}
                max={72}
                step={0.5}
                display={`${num(params.prefermentHours)} h`}
                onChange={(value) => onChange('prefermentHours', value)}
                help={t('field.prefermentHours.help')}
                reference={{
                  value: preferment.hours,
                  label: t('field.styleDefault', { value: `${num(preferment.hours)} h` }),
                }}
              />
              <SliderField
                id="prefermentTemp"
                label={t('field.prefermentTemp')}
                value={prefermentTemp}
                min={4}
                max={30}
                step={0.5}
                display={`${num(prefermentTemp)} °C`}
                onChange={(value) =>
                  onChange(
                    'prefermentTemp',
                    preferment.temp_c === undefined && value === params.roomTemp ? null : value,
                  )
                }
                help={t('field.prefermentTemp.help')}
                disabled={params.prefermentColdHours >= params.prefermentHours}
                reference={
                  preferment.temp_c !== undefined
                    ? {
                        value: preferment.temp_c,
                        label: t('field.styleDefault', { value: `${num(preferment.temp_c)} °C` }),
                      }
                    : {
                        value: params.roomTemp,
                        label: t('field.prefermentTemp.room', {
                          value: `${num(params.roomTemp)} °C`,
                        }),
                      }
                }
              />
              <SliderField
                id="prefermentColdHours"
                label={t('field.prefermentColdHours')}
                value={Math.min(params.prefermentColdHours, params.prefermentHours)}
                min={0}
                max={Math.max(1, params.prefermentHours)}
                step={0.5}
                display={`${num(Math.min(params.prefermentColdHours, params.prefermentHours))} h`}
                onChange={(value) => onChange('prefermentColdHours', value)}
                help={t('field.prefermentColdHours.help')}
              />
            </div>
            {results?.preferment && (
              <p className="mt-4 flex items-center gap-1.5 text-sm tabular text-muted-foreground">
                {t('field.prefermentYeast', {
                  type: prefermentName.toLowerCase(),
                  pct: formatYeastPct(results.preferment.yeastPct, lang),
                  form: t(`field.yeast.${params.yeastForm}`).toLowerCase(),
                  grams: formatGrams(
                    results.totals.flour *
                      (results.preferment.flourPct / 100) *
                      (results.preferment.yeastPct / 100),
                    lang,
                  ),
                })}
              </p>
            )}
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {params.driver === 'time' ? (
            <SliderField
              id="totalTime"
              label={t(preferment ? 'field.totalTime.dough' : 'field.totalTime')}
              value={params.totalTime}
              min={1}
              max={96}
              step={0.5}
              display={`${num(params.totalTime)} h`}
              onChange={(value) => {
                onChange('totalTime', value);
                // Cold time can never outlast the ferment it lives inside.
                if (params.coldHours > value) onChange('coldHours', value);
              }}
              help={t(preferment ? 'field.totalTime.dough.help' : 'field.totalTime.help')}
              reference={{
                value: style.defaults.totalTime,
                label: t('field.styleDefault', { value: `${num(style.defaults.totalTime)} h` }),
              }}
            />
          ) : params.leavenType === 'commercial' ? (
            <SliderField
              id="yeastPct"
              label={t('field.yeastPct')}
              value={yeastSliderPosition(freshDose)}
              min={0}
              max={100}
              step={0.5}
              display={`${formatYeastPct(freshDose * YEAST_CONVERSION[params.yeastForm], lang)}% ${t(
                `field.yeast.${params.yeastForm}`,
              ).toLowerCase()}`}
              onChange={(position) => onChange('yeastPct', yeastFromSliderPosition(position))}
              help={t('field.yeastPct.help')}
            />
          ) : (
            <SliderField
              id="leavenPct"
              label={t('field.leavenPct')}
              value={params.leavenPct}
              min={0.5}
              max={60}
              step={0.5}
              display={`${num(params.leavenPct)}%`}
              onChange={(value) => onChange('leavenPct', value)}
              help={t('field.leavenPct.help')}
              reference={
                style.defaultLevainPct
                  ? {
                      value: style.defaultLevainPct,
                      label: t('field.styleDefault', {
                        value: `${num(style.defaultLevainPct)}%`,
                      }),
                    }
                  : undefined
              }
            />
          )}
          <SliderField
            id="roomTemp"
            label={t('field.roomTemp')}
            value={params.roomTemp}
            min={14}
            max={34}
            step={0.5}
            display={`${num(params.roomTemp)} °C`}
            onChange={(value) => onChange('roomTemp', value)}
            reference={{
              value: style.defaults.roomTemp,
              label: t('field.styleDefault', { value: `${num(style.defaults.roomTemp)} °C` }),
            }}
          />
          <SliderField
            id="coldHours"
            label={t('field.coldHours')}
            value={Math.min(params.coldHours, totalHours)}
            min={0}
            max={Math.max(1, totalHours)}
            step={0.5}
            display={`${num(Math.min(params.coldHours, totalHours))} h`}
            onChange={(value) => onChange('coldHours', value)}
            help={t('field.coldHours.help')}
          />
          <SelectField<'bulk' | 'proof'>
            id="coldPhase"
            label={t('field.coldPhase')}
            value={params.coldPhase}
            onChange={(value) => onChange('coldPhase', value)}
            disabled={params.coldHours <= 0}
            options={[
              { value: 'bulk', label: t('field.coldPhase.bulk') },
              { value: 'proof', label: t('field.coldPhase.proof') },
            ]}
          />

          <ComputedReadout params={params} results={results} />
        </div>
      </Card>

      {/* ── Method ── */}
      <Card className="p-5" data-print-card>
        <h3 className="mb-4 text-base font-semibold">{t('params.method')}</h3>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SelectField<LeavenType>
            id="leavenType"
            label={t('field.leavenType')}
            value={params.leavenType}
            onChange={(value) => onChange('leavenType', value)}
            options={[
              { value: 'commercial', label: t('field.leaven.commercial') },
              { value: 'sourdough', label: t('field.leaven.sourdough') },
              { value: 'hybrid', label: t('field.leaven.hybrid') },
            ]}
          />
          <SelectField<YeastForm>
            id="yeastForm"
            label={t('field.yeastForm')}
            value={params.yeastForm}
            onChange={(value) => onChange('yeastForm', value)}
            disabled={!usesYeast}
            options={[
              { value: 'fresh', label: t('field.yeast.fresh') },
              { value: 'active_dry', label: t('field.yeast.active_dry') },
              { value: 'instant', label: t('field.yeast.instant') },
            ]}
          />
          <SelectField<MixingMethod>
            id="mixing"
            label={t('field.mixing')}
            value={params.mixing}
            onChange={(value) => onChange('mixing', value)}
            help={t('field.mixing.help', { n: FRICTION_FACTOR_C[params.mixing] })}
            options={[
              { value: 'hand', label: t('field.mixing.hand') },
              { value: 'dlx', label: t('field.mixing.dlx') },
              { value: 'planetary', label: t('field.mixing.planetary') },
              { value: 'spiral', label: t('field.mixing.spiral') },
            ]}
          />
          <SliderField
            id="doughTemp"
            label={t('field.doughTemp')}
            value={params.doughTemp}
            min={18}
            max={30}
            step={0.5}
            display={`${num(params.doughTemp)} °C`}
            onChange={(value) => onChange('doughTemp', value)}
            help={t('field.doughTemp.help')}
            reference={{
              value: style.defaults.doughTemp,
              label: t('field.styleDefault', { value: `${num(style.defaults.doughTemp)} °C` }),
            }}
          />
        </div>
      </Card>

      {/* ── Advanced ── */}
      <Accordion type="single" collapsible>
        <AccordionItem value="advanced" className="rounded-xl border border-border bg-card px-5">
          <AccordionTrigger className="text-base font-semibold hover:no-underline">
            {t('params.advanced')}
          </AccordionTrigger>
          <AccordionContent className="pb-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <SelectField<PercentBasis>
                id="percentBasis"
                label={t('field.percentBasis')}
                value={params.percentBasis}
                onChange={(value) => onChange('percentBasis', value)}
                help={t('field.percentBasis.help')}
                options={[
                  { value: 'total', label: t('field.percentBasis.total') },
                  { value: 'dough', label: t('field.percentBasis.dough') },
                ]}
              />
              <SliderField
                id="coldTemp"
                label={t('field.coldTemp')}
                value={params.coldTemp}
                min={0}
                max={14}
                step={0.5}
                display={`${num(params.coldTemp)} °C`}
                onChange={(value) => onChange('coldTemp', value)}
                disabled={params.coldHours <= 0}
              />
              <SliderField
                id="flourTemp"
                label={t('field.flourTemp')}
                value={params.flourTemp ?? params.roomTemp}
                min={2}
                max={34}
                step={0.5}
                display={`${num(params.flourTemp ?? params.roomTemp)} °C`}
                onChange={(value) => onChange('flourTemp', value)}
                help={t('field.flourTemp.help')}
                reference={{
                  value: params.roomTemp,
                  label: t('field.styleDefault', { value: `${num(params.roomTemp)} °C` }),
                }}
              />
              <SliderField
                id="starterHydration"
                label={t('field.starterHydration')}
                value={params.starterHydration}
                min={50}
                max={166}
                step={1}
                display={`${num(params.starterHydration, 0)}%`}
                onChange={(value) => onChange('starterHydration', value)}
                help={t('field.starterHydration.help')}
                disabled={!usesStarter}
              />
              {style.preferment && (
                <div className="flex items-start gap-3 pt-1">
                  <Switch
                    id="usePreferment"
                    checked={params.usePreferment}
                    onCheckedChange={(checked) => onChange('usePreferment', checked)}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="usePreferment" className="text-sm">
                      {t('field.usePreferment', { type: t(`section.${style.preferment.type}`) })}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {t('field.usePreferment.help')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

/**
 * The yeast slider runs on a logarithmic scale: the doses that matter span
 * three orders of magnitude, from a pinch for a long room ferment to a few
 * percent for a fast one, and a linear slider would spend all its travel on
 * the fast end.
 */
const YEAST_SLIDER_MIN = 0.005;
const YEAST_SLIDER_MAX = 6;
const YEAST_SLIDER_SPAN = Math.log(YEAST_SLIDER_MAX / YEAST_SLIDER_MIN);

function yeastSliderPosition(freshPct: number): number {
  const fresh = clamp(freshPct, YEAST_SLIDER_MIN, YEAST_SLIDER_MAX);
  return (100 * Math.log(fresh / YEAST_SLIDER_MIN)) / YEAST_SLIDER_SPAN;
}

function yeastFromSliderPosition(position: number): number {
  return round(YEAST_SLIDER_MIN * Math.exp((position / 100) * YEAST_SLIDER_SPAN), 4);
}

/** What the fixed end of the clock implies at the other end. */
function ComputedReadout({
  params,
  results,
}: {
  params: RecipeParams;
  results: CalculationResults | null;
}) {
  const { t, lang } = useI18n();
  if (!results) return null;
  const f = results.fermentation;
  const form = t(`field.yeast.${f.yeastForm}`).toLowerCase();

  let label: string;
  let value: string;
  let help: string;

  if (params.driver === 'dose') {
    label = t('field.computedTime');
    value = `${formatNumber(f.totalHours, lang)} h`;
    help = t('field.totalTime.help');
  } else if (params.leavenType === 'commercial') {
    label = t('field.computedYeast');
    value =
      f.yeastPct > 0
        ? `${formatYeastPct(f.yeastPct, lang)}% ${form} · ${formatGrams(
            results.totals.flour * (f.yeastPct / 100),
            lang,
          )} g`
        : t('field.computedYeast.none');
    help = t('field.computedYeast.help');
  } else {
    label = t('field.leavenPct');
    value = `${formatNumber(f.starterEquivalentPct, lang, 2)}%`;
    help = t('field.leavenPct.help');
  }

  return (
    <div className="flex flex-col justify-center rounded-lg bg-muted px-4 py-3 sm:col-span-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="mt-0.5 text-xl font-semibold tabular">{value}</span>
      {params.leavenType === 'hybrid' && params.driver === 'time' && f.yeastPct > 0 && (
        <span className="mt-0.5 text-sm tabular text-muted-foreground">
          + {formatYeastPct(f.yeastPct, lang)}% {form}
        </span>
      )}
      <span className="mt-1 text-xs text-muted-foreground">{help}</span>
    </div>
  );
}
