import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import {
  computeInoculationPct,
  computeRoomEquivTime,
  REFERENCE_LEVAIN_TIME,
  REFERENCE_LEVAIN_TEMP,
  INOCULATION_MIN,
  INOCULATION_MAX,
  CalculationResults,
} from "@/core/calculations";

interface SourdoughPanelProps {
  params: CalculationResults["params"];
  totalFlour: number;
}

const TIMES = [6, 8, 12, 18, 24, 36, 48];
const TEMPS = [18, 21, 24, 27];

export function SourdoughPanel({ params, totalFlour }: SourdoughPanelProps) {
  const {
    baseInoculationPct,
    inoculationPct,
    leavenType,
    roomTemp,
    totalTime,
    coldHours,
    roomEquivTime,
  } = params;

  if (inoculationPct <= 0) return null;

  const starterPct = Math.round(inoculationPct * 2 * 10) / 10;
  const starterGrams = totalFlour * (inoculationPct / 100) * 2;
  const coldShare = coldHours > 0 ? ` (${coldHours}h i kyl → ${roomEquivTime}h rumsekvivalent)` : "";

  const checklist = [
    "Matad 1:5:5 (t.ex. 10g surdeg + 50g mjöl + 50g vatten) vid 23–25°C",
    "Har minst dubblat i volym – helst 2,5–3x sedan matningen",
    "Kupolen är på topp eller precis börjat plana ut, inte insjunken",
    "Flyttest: en klick flyter i rumstempererat vatten",
    "Doft: syrlig-yoghurtaktig och fruktig, inte skarp ättika eller aceton",
    "Nätverk av bubblor syns på sidorna av burken",
  ];

  return (
    <Card className="p-6 space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-lg font-semibold text-card-foreground">Surdeg – ratio</h4>
          <Badge variant="secondary">{starterPct}% surdeg på mjölet</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {inoculationPct}% av det totala mjölet kommer från surdegen, dvs{" "}
          <span className="font-medium text-card-foreground">
            {starterGrams < 10 ? starterGrams.toFixed(2) : Math.round(starterGrams)}g
          </span>{" "}
          färdig surdeg vid 100% hydrering.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Basen för den här stilen är <span className="font-medium text-card-foreground">{baseInoculationPct}%</span>{" "}
          vid {REFERENCE_LEVAIN_TEMP}°C och {REFERENCE_LEVAIN_TIME}h jäsning. Mängden skalas med Q10:
          dubbelt så lång tid ≈ halva mängden surdeg, +10°C ≈ 2,2x snabbare jäsning. Resultatet begränsas
          till {INOCULATION_MIN}–{INOCULATION_MAX}% mjölbaserat ({INOCULATION_MIN * 2}–{INOCULATION_MAX * 2}% surdeg).
          {leavenType === "hybrid" && " Hybridläge halverar surdegen eftersom jästen bär halva jobbet."}
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Just nu: {totalTime}h total tid vid {roomTemp}°C{coldShare}.
        </p>
      </div>

      <div>
        <h5 className="font-semibold text-card-foreground mb-3">Är surdegen mogen?</h5>
        <ul className="space-y-2">
          {checklist.map((item) => (
            <li key={item} className="flex gap-3 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground mt-3">
          Trög eller nymatad surdeg jäser långsammare än beräkningen antar – vänta hellre en timme extra.
        </p>
      </div>

      <div>
        <h5 className="font-semibold text-card-foreground mb-1">Känslighet: tid och temperatur</h5>
        <p className="text-sm text-muted-foreground mb-3">
          Surdeg i % av mjölet (färdig surdeg inom parentes). Din nuvarande inställning är markerad.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left font-medium text-muted-foreground py-2 pr-3">Tid</th>
                {TEMPS.map((t) => (
                  <th key={t} className="text-right font-medium text-muted-foreground py-2 px-3">
                    {t}°C
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIMES.map((time) => (
                <tr key={time} className="border-t border-border">
                  <td className="py-2 pr-3 font-medium text-card-foreground">{time}h</td>
                  {TEMPS.map((temp) => {
                    const pct = computeInoculationPct(
                      baseInoculationPct,
                      computeRoomEquivTime(time, 0),
                      temp,
                      leavenType === "commercial" ? "sourdough" : leavenType
                    );
                    const isCurrent =
                      Math.abs(time - totalTime) < 0.01 && Math.abs(temp - roomTemp) < 0.01;
                    return (
                      <td
                        key={temp}
                        className={`py-2 px-3 text-right tabular-nums ${
                          isCurrent
                            ? "bg-primary/10 font-semibold text-card-foreground rounded"
                            : "text-muted-foreground"
                        }`}
                      >
                        {pct}%
                        <span className="text-xs opacity-70"> ({Math.round(pct * 2 * 10) / 10}%)</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Värdena gäller jäsning i rumstemperatur hela tiden. Kyltid räknas om till rumsekvivalent tid
          (1h i kyl ≈ 0,3h i rumstemperatur) innan surdegsmängden bestäms.
        </p>
      </div>
    </Card>
  );
}
