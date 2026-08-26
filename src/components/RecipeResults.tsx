import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Clock, Thermometer, Scale, Timer, AlertCircle, Lightbulb } from "lucide-react";
import { CalculationResults } from "@/core/calculations";
import { SourdoughPanel } from "@/components/SourdoughPanel";

interface RecipeResultsProps extends CalculationResults {
  styleName: string;
}

export function RecipeResults({ 
  ingredients, 
  waterTemp, 
  bulkTime, 
  proofTime, 
  totalFlour,
  yeastPercentage,
  timeline,
  notes,
  params,
  styleName
}: RecipeResultsProps) {
  const totalWeight = ingredients.reduce((sum, ingredient) => sum + ingredient.grams, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6 bg-gradient-to-r from-primary/5 to-primary-glow/5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-semibold text-card-foreground">{styleName}</h3>
          <Badge variant="secondary" className="text-sm">
            Total: {totalWeight.toFixed(0)}g
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Recept genererat med Q10-modellering och stilspecifika korrigeringar
        </p>
      </Card>

      {/* Ingredients */}
      <Card className="p-6">
        <h4 className="text-lg font-semibold text-card-foreground mb-4">Ingredienser</h4>
        <div className="space-y-3">
          {ingredients.map((ingredient, index) => (
            <div key={index} className="flex justify-between items-center py-2 border-b border-border last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  ingredient.type === 'flour' ? 'bg-amber-400' :
                  ingredient.type === 'water' ? 'bg-blue-400' :
                  ingredient.type === 'salt' ? 'bg-gray-400' :
                  ingredient.type === 'yeast' ? 'bg-yellow-400' :
                  ingredient.type === 'starter' ? 'bg-amber-700' :
                  ingredient.type === 'sugar' ? 'bg-pink-300' :
                  ingredient.type === 'oil' ? 'bg-lime-500' :
                  'bg-green-400'
                }`} />
                <span className="font-medium text-card-foreground">{ingredient.name}</span>
              </div>
              <div className="text-right">
                <span className="font-semibold text-lg">
                  {ingredient.grams < 10 ? ingredient.grams.toFixed(2) : Math.round(ingredient.grams)}g
                </span>
                <Badge variant="outline" className="ml-2 text-xs">
                  {ingredient.percentage.toFixed(1)}%
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Process Info */}
      <Card className="p-6">
        <h4 className="text-lg font-semibold text-card-foreground mb-4">Process</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <Thermometer className="h-8 w-8 text-primary" />
            </div>
            <div className="text-sm text-muted-foreground">Vattentemp</div>
            <div className="font-semibold text-lg">{waterTemp.toFixed(1)}°C</div>
          </div>
          
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <Clock className="h-8 w-8 text-primary" />
            </div>
            <div className="text-sm text-muted-foreground">Bulkjäsning</div>
            <div className="font-semibold text-lg">{bulkTime.toFixed(1)}h</div>
          </div>
          
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <Timer className="h-8 w-8 text-primary" />
            </div>
            <div className="text-sm text-muted-foreground">Slutjäsning</div>
            <div className="font-semibold text-lg">{proofTime.toFixed(1)}h</div>
          </div>
          
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <Scale className="h-8 w-8 text-primary" />
            </div>
            <div className="text-sm text-muted-foreground">Total mjöl</div>
            <div className="font-semibold text-lg">{totalFlour.toFixed(0)}g</div>
          </div>
        </div>
      </Card>

      {/* Sourdough ratio, maturity checklist and sensitivity */}
      <SourdoughPanel params={params} totalFlour={totalFlour} />

      {/* Timeline */}
      <Card className="p-6">
        <h4 className="text-lg font-semibold text-card-foreground mb-4">Tidslinje</h4>
        <div className="space-y-3">
          {timeline.map((step, index) => (
            <div key={index} className="flex gap-4">
              <div className="flex-shrink-0 w-16 text-sm font-mono text-primary font-semibold">
                {step.time}
              </div>
              <div className="flex-1">
                <div className="font-medium text-card-foreground">{step.action}</div>
                <div className="text-sm text-muted-foreground">{step.description}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Notes & Tips */}
      {notes.length > 0 && (
        <Card className="p-6">
          <h4 className="text-lg font-semibold text-card-foreground mb-4 flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Tips & Varningar
          </h4>
          <div className="space-y-2">
            {notes.map((note, index) => (
              <div key={index} className="flex gap-3 text-sm">
                <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{note}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Export */}
      <div className="flex gap-3">
        <Button className="flex-1" size="lg">
          📱 Exportera till Telefon
        </Button>
        <Button variant="outline" size="lg">
          🖨️ Skriv ut
        </Button>
      </div>
    </div>
  );
}