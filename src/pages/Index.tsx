import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StyleSelector } from "@/components/StyleSelector";
import { CalculatorInputs } from "@/components/CalculatorInputs";
import { RecipeResults } from "@/components/RecipeResults";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Calculator, ChefHat, Clock } from "lucide-react";
import heroBakery from "@/assets/hero-bakery.jpg";
import { getStyleById } from "@/data/styles";
import { calculateRecipe, CalculationInputs } from "@/core/calculations";

const Index = () => {
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);
  const [currentSection, setCurrentSection] = useState<'styles' | 'calculator' | 'results'>('styles');
  const [values, setValues] = useState({
    hydration: 67,
    salt: 2.6,
    totalTime: 24,
    roomTemp: 23,
    ballWeight: 265,
    ballCount: 8,
    leavenType: 'commercial',
    yeastForm: 'instant',
    mixing: 'hand',
    desiredDoughTemp: 24,
    coldHours: 0
  });

  const handleValueChange = (key: string, value: number | string) => {
    setValues(prev => {
      const next = { ...prev, [key]: value } as typeof prev;
      // Cold time can never exceed the total fermentation time
      if (next.coldHours > next.totalTime) next.coldHours = next.totalTime;
      return next;
    });
  };

  const selectedStyleData = selectedStyle ? getStyleById(selectedStyle) : null;

  // Update values when style changes to match defaults
  const handleStyleSelect = (styleId: string) => {
    setSelectedStyle(styleId);
    setCurrentSection('calculator');
    const style = getStyleById(styleId);
    if (style) {
      setValues(prev => ({
        ...prev,
        hydration: style.defaultParams.hydration_pct,
        salt: style.defaultParams.salt_pct,
        leavenType: style.fermentation.base_inoculation_pct ? 'sourdough' : 'commercial',
        totalTime: style.category === 'bread' ? 6 : 24 // Shorter default for bread
      }));
    }
  };

  const handleSectionChange = (section: 'styles' | 'calculator' | 'results') => {
    setCurrentSection(section);
  };

  const results = selectedStyleData ? calculateRecipe({
    style: selectedStyleData,
    ballWeight: values.ballWeight,
    ballCount: values.ballCount,
    totalTime: values.totalTime,
    roomTemp: values.roomTemp,
    coldTemp: 4,
    coldHours: values.coldHours,
    hydration: values.hydration,
    salt: values.salt,
    leavenType: values.leavenType as any,
    yeastForm: values.yeastForm as any,
    mixing: values.mixing as any,
    desiredDoughTemp: values.desiredDoughTemp
  } as CalculationInputs) : null;

  if (showCalculator) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar 
            selectedStyle={selectedStyle}
            onSectionChange={handleSectionChange}
            currentSection={currentSection}
          />
          
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <SidebarTrigger />
                  <ChefHat className="h-6 w-6 text-primary" />
                  <h1 className="text-xl font-semibold text-foreground">Baker's Calculator</h1>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => setShowCalculator(false)}
                  size="sm"
                >
                  Back to Home
                </Button>
              </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-6 overflow-auto">
              {currentSection === 'styles' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-2xl font-semibold text-foreground mb-2">Choose Your Style</h2>
                    <p className="text-muted-foreground">Select a bread or pizza style to get started with optimized parameters.</p>
                  </div>
                  <StyleSelector 
                    selectedStyle={selectedStyle} 
                    onStyleSelect={handleStyleSelect} 
                  />
                </div>
              )}

              {currentSection === 'calculator' && selectedStyle && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-2xl font-semibold text-foreground mb-2">Adjust Parameters</h2>
                    <p className="text-muted-foreground">Fine-tune the recipe parameters for {selectedStyleData?.name}.</p>
                  </div>
                  <CalculatorInputs 
                    values={values} 
                    onValueChange={handleValueChange}
                    selectedStyle={selectedStyleData}
                  />
                  {selectedStyleData && (
                    <div className="mt-6">
                      <Button 
                        onClick={() => setCurrentSection('results')}
                        className="w-full"
                        size="lg"
                      >
                        Visa Recept
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {currentSection === 'results' && selectedStyle && results && selectedStyleData && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-2xl font-semibold text-foreground mb-2">Recipe Results</h2>
                    <p className="text-muted-foreground">Your calculated recipe for {selectedStyleData.name}.</p>
                  </div>
                  <RecipeResults 
                    {...results} 
                    styleName={selectedStyleData.name}
                  />
                </div>
              )}
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroBakery})` }}
        >
          <div className="absolute inset-0 bg-black/40" />
        </div>
        
        <div className="relative z-10 text-center text-white max-w-4xl mx-auto px-4">
          <div className="mb-6">
            <ChefHat className="h-16 w-16 mx-auto mb-4 text-primary-glow" />
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Baker's
            <span className="bg-gradient-to-r from-primary-glow to-primary bg-clip-text text-transparent"> Calculator</span>
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-white/90 leading-relaxed">
            The world's most advanced dough calculator.<br/>
            Perfect fermentation timing for every style.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              variant="hero" 
              size="xl"
              onClick={() => setShowCalculator(true)}
              className="shadow-2xl"
            >
              <Calculator className="h-5 w-5" />
              Start Calculating
            </Button>
            <Button 
              variant="outline" 
              size="xl"
              className="bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              <Clock className="h-5 w-5" />
              View Features
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Precision Meets Artistry
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Advanced fermentation science meets intuitive design. 
              From Neapolitan pizza to country sourdough.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center group">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                <Calculator className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Auto-Calculate Yeast</h3>
              <p className="text-muted-foreground">Q10 temperature modeling with style-specific corrections for perfect fermentation timing.</p>
            </div>
            
            <div className="text-center group">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                <Clock className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Smart Timing</h3>
              <p className="text-muted-foreground">Bulk and proof time optimization based on temperature, hydration, and mixing method.</p>
            </div>
            
            <div className="text-center group">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                <ChefHat className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">All Styles</h3>
              <p className="text-muted-foreground">Pizza, sourdough, baguettes, ciabatta - with poolish, biga, and levain support.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;