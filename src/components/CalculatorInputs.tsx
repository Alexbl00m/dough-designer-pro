import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
import type { RecipeParams } from '@/lib/recipe/state';
import { FRICTION_FACTOR_C } from '@/core/constants';
import type { MixingMethod, YeastForm } from '@/core/constants';
import type { LeavenType, ScaleMode } from '@/core/types';
import { useI18n } from '@/i18n';
import { formatNumber, toDateTimeLocal } from '@/lib/format';

interface CalculatorInputsProps {
  style: BreadStyle;
  params: RecipeParams;
  onChange: <K extends keyof RecipeParams>(key: K, value: RecipeParams[K]) => void;
  onReset: () => void;
  startTime: Date;
  onStartTimeChange: (date: Date) => void;
}

export function CalculatorInputs({
  style,
  params,
  onChange,
  onReset,
  startTime,
  onStartTimeChange,
}: CalculatorInputsProps) {
  const { t, lang } = useI18n();
  const num = (value: number, decimals = 1) => formatNumber(value, lang, decimals);

  const pieceUnit = style.category === 'pizza' ? 'unit.ball' : 'unit.loaf';
  const pieceUnitPlural = style.category === 'pizza' ? 'unit.balls' : 'unit.loaves';
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

      {/* ── Fermentation ── */}
      <Card className="p-5" data-print-card>
        <h3 className="mb-4 text-base font-semibold">{t('params.fermentation')}</h3>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SliderField
            id="totalTime"
            label={t('field.totalTime')}
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
            help={t('field.totalTime.help')}
            reference={{
              value: style.defaults.totalTime,
              label: t('field.styleDefault', { value: `${num(style.defaults.totalTime)} h` }),
            }}
          />
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
            value={Math.min(params.coldHours, params.totalTime)}
            min={0}
            max={Math.max(1, params.totalTime)}
            step={0.5}
            display={`${num(Math.min(params.coldHours, params.totalTime))} h`}
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

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="startTime" className="text-sm">
              {t('field.startTime')}
            </Label>
            <Input
              id="startTime"
              type="datetime-local"
              value={toDateTimeLocal(startTime)}
              onChange={(event) => {
                const next = new Date(event.target.value);
                if (!Number.isNaN(next.getTime())) onStartTimeChange(next);
              }}
              className="tabular"
            />
            <p className="text-xs text-muted-foreground">{t('field.startTime.help')}</p>
          </div>
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
