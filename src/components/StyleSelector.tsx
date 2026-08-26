import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BREAD_STYLES, getStylesByCategory, getFlourBlendText } from "@/data/styles";

interface StyleSelectorProps {
  selectedStyle: string | null;
  onStyleSelect: (styleId: string) => void;
}

export function StyleSelector({ selectedStyle, onStyleSelect }: StyleSelectorProps) {
  const pizzaStyles = getStylesByCategory('pizza');
  const breadStyles = getStylesByCategory('bread');
  const prefermentStyles = getStylesByCategory('preferment');
  const enrichedStyles = getStylesByCategory('enriched');

  const renderStyleCard = (style: any) => (
    <Card
      key={style.id}
      className={`p-6 cursor-pointer transition-all duration-300 hover:shadow-lg ${
        selectedStyle === style.id
          ? 'ring-2 ring-primary bg-primary/5'
          : 'hover:shadow-md'
      }`}
      onClick={() => onStyleSelect(style.id)}
    >
      <div className="space-y-3">
        <div className="flex justify-between items-start">
          <h4 className="font-semibold text-card-foreground">{style.name}</h4>
          <Badge variant="outline" className="text-xs">
            {style.region}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{style.description}</p>
        {style.flourBlend && (
          <div className="text-xs text-primary/80 font-medium mb-2">
            Mjölblandning: {getFlourBlendText(style.flourBlend)}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="text-xs">
            {style.defaultParams.hydration_pct}% hydrering
          </Badge>
          <Badge variant="outline" className="text-xs">
            {style.defaultParams.salt_pct}% salt
          </Badge>
          {style.defaultParams.preferment && (
            <Badge variant="outline" className="text-xs">
              {style.defaultParams.preferment.type}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {style.characteristics.slice(0, 3).map((char: string, index: number) => (
            <span key={index} className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              {char}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
          🍕 Pizza Stilar
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pizzaStyles.map(renderStyleCard)}
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
          🍞 Bröd Stilar
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {breadStyles.map(renderStyleCard)}
        </div>
      </div>

      {prefermentStyles.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            🌾 Förjäsning (Poolish/Biga)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {prefermentStyles.map(renderStyleCard)}
          </div>
        </div>
      )}

      {enrichedStyles.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            🧈 Rika Degar
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {enrichedStyles.map(renderStyleCard)}
          </div>
        </div>
      )}
    </div>
  );
}