import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

interface CalculatorInputsProps {
  values: {
    hydration: number;
    salt: number;
    totalTime: number;
    roomTemp: number;
    ballWeight: number;
    ballCount: number;
    leavenType: string;
    yeastForm: string;
    mixing: string;
    desiredDoughTemp: number;
    coldHours: number;
  };
  onValueChange: (key: string, value: number | string) => void;
  selectedStyle: any;
}

export function CalculatorInputs({ values, onValueChange, selectedStyle }: CalculatorInputsProps) {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-card-foreground mb-4">Dough Parameters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="hydration">Hydrering: {values.hydration}%</Label>
            <Slider
              id="hydration"
              min={50}
              max={90}
              step={1}
              value={[values.hydration]}
              onValueChange={([value]) => onValueChange('hydration', value)}
              className="w-full"
            />
            <div className="text-xs text-muted-foreground">
              Rekommenderat för {selectedStyle?.name}: {selectedStyle?.defaultParams.hydration_pct}%
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="salt">Salt: {values.salt}%</Label>
            <Slider
              id="salt"
              min={1.5}
              max={4}
              step={0.1}
              value={[values.salt]}
              onValueChange={([value]) => onValueChange('salt', value)}
              className="w-full"
            />
            <div className="text-xs text-muted-foreground">
              Rekommenderat: {selectedStyle?.defaultParams.salt_pct}%
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ballWeight">{selectedStyle?.category === 'pizza' ? 'Pizzabollvikt' : 'Bröd vikt'} (g)</Label>
            <Input
              id="ballWeight"
              type="number"
              value={values.ballWeight}
              onChange={(e) => onValueChange('ballWeight', parseInt(e.target.value) || 0)}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ballCount">Antal {selectedStyle?.category === 'pizza' ? 'pizzor' : 'bröd'}</Label>
            <Input
              id="ballCount"
              type="number"
              value={values.ballCount}
              onChange={(e) => onValueChange('ballCount', parseInt(e.target.value) || 0)}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="desiredDoughTemp">Önskad degtemperatur: {values.desiredDoughTemp}°C</Label>
            <Slider
              id="desiredDoughTemp"
              min={20}
              max={28}
              step={1}
              value={[values.desiredDoughTemp]}
              onValueChange={([value]) => onValueChange('desiredDoughTemp', value)}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="coldHours">Kyltid: {values.coldHours}h</Label>
            <Slider
              id="coldHours"
              min={0}
              max={Math.max(0, values.totalTime)}
              step={1}
              value={[values.coldHours]}
              onValueChange={([value]) => onValueChange('coldHours', value)}
              className="w-full"
            />
            <div className="text-xs text-muted-foreground">
              Tid i kylskåp (4°C) - resten av tiden i rumstemperatur
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-card-foreground mb-4">Jäsningsinställningar</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="space-y-2">
            <Label htmlFor="totalTime">Total tid: {values.totalTime}h</Label>
            <Slider
              id="totalTime"
              min={1}
              max={72}
              step={0.5}
              value={[values.totalTime]}
              onValueChange={([value]) => onValueChange('totalTime', value)}
              className="w-full"
            />
            <div className="text-xs text-muted-foreground">
              Total jäsningstid från start till redo att grädda
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="roomTemp">Rumstemperatur: {values.roomTemp}°C</Label>
            <Slider
              id="roomTemp"
              min={18}
              max={28}
              step={1}
              value={[values.roomTemp]}
              onValueChange={([value]) => onValueChange('roomTemp', value)}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="leavenType">Jäsningstyp</Label>
            <Select value={values.leavenType} onValueChange={(value) => onValueChange('leavenType', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Välj jäsningstyp" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="commercial">Kommersiell jäst</SelectItem>
                <SelectItem value="sourdough">Surdeg</SelectItem>
                <SelectItem value="hybrid">Hybrid (båda)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {values.leavenType === 'commercial' && (
            <div className="space-y-2">
              <Label htmlFor="yeastForm">Jästtyp</Label>
              <Select value={values.yeastForm} onValueChange={(value) => onValueChange('yeastForm', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj jästtyp" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fresh">Färsk jäst</SelectItem>
                  <SelectItem value="active_dry">Torrjäst (aktiv)</SelectItem>
                  <SelectItem value="instant">Torrjäst (instant)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="mixing">Blandningsmetod</Label>
            <Select value={values.mixing} onValueChange={(value) => onValueChange('mixing', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Välj blandningsmetod" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hand">För hand</SelectItem>
                <SelectItem value="spiral">Spiralmixer</SelectItem>
                <SelectItem value="planetary">Hushållsmaskin</SelectItem>
                <SelectItem value="dlx">DLX-maskin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>
    </div>
  );
}