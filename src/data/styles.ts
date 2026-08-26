export interface FlourBlend {
  name: string;
  percentage: number;
  protein_pct?: number;
  ash_pct?: number;
}

export interface BreadStyle {
  id: string;
  name: string;
  description: string;
  category: 'pizza' | 'bread' | 'enriched' | 'preferment';
  region: string;
  defaultParams: {
    hydration_pct: number;
    salt_pct: number;
    sugar_pct: number;
    oil_pct: number;
    preferment?: {
      type: 'poolish' | 'biga' | 'levain' | 'none';
      flour_pct: number;
      hydration_pct: number;
    };
  };
  fermentation: {
    bulk_ratio: number;
    proof_ratio: number;
    base_yeast_fresh_pct: number;
    base_inoculation_pct?: number;
  };
  characteristics: string[];
  flourBlend?: FlourBlend[];
}

export const BREAD_STYLES: BreadStyle[] = [
  // PIZZA STYLES
  {
    id: 'neapolitan',
    name: 'Traditionell Napolitansk Pizza',
    description: 'Traditionell napolitansk pizza enligt originalrecept',
    category: 'pizza',
    region: 'Napoli, Italien',
    defaultParams: {
      hydration_pct: 66,
      salt_pct: 2.8,
      sugar_pct: 0,
      oil_pct: 0,
    },
    fermentation: {
      bulk_ratio: 0.80,  // 12-14h bulk, 3h proof
      proof_ratio: 0.20,
      base_yeast_fresh_pct: 0.025,  // 0.25g per 1000g mjöl
      base_inoculation_pct: 18,
    },
    characteristics: ['265g bollar', 'Lång bulkjäsning 12-14h', '21°C jäsning', 'Vikning 3 gånger'],
    flourBlend: [
      { name: 'Caputo Pizzeria', percentage: 50, protein_pct: 12.5 },
      { name: 'Vigevano Oro di Macina', percentage: 50, protein_pct: 13.0 }
    ]
  },
  {
    id: 'ny_style',
    name: 'New York Style Pizza',
    description: 'Tunn men seg amerikansk pizza',
    category: 'pizza',
    region: 'New York, USA',
    defaultParams: {
      hydration_pct: 62,
      salt_pct: 2.2,
      sugar_pct: 1.5,
      oil_pct: 2,
    },
    fermentation: {
      bulk_ratio: 0.30,
      proof_ratio: 0.70,
      base_yeast_fresh_pct: 0.20,
      base_inoculation_pct: 20,
    },
    characteristics: ['Seg konsistens', 'Kan vikas', 'Hemugn 250°C', 'Mozzarella']
  },
  {
    id: 'detroit',
    name: 'Detroit Style Pizza',
    description: 'Tjock, luftig siciliansk stil',
    category: 'pizza',
    region: 'Detroit, USA',
    defaultParams: {
      hydration_pct: 72,
      salt_pct: 2.5,
      sugar_pct: 2,
      oil_pct: 4,
    },
    fermentation: {
      bulk_ratio: 0.35,
      proof_ratio: 0.65,
      base_yeast_fresh_pct: 0.25,
    },
    characteristics: ['Fyrkantig form', 'Knapriga kanter', 'Ost till kanterna', 'Sås på toppen']
  },
  {
    id: 'roman',
    name: 'Roman Pizza (Al Taglio)',
    description: 'Ultratunn romersk pizza',
    category: 'pizza',
    region: 'Rom, Italien',
    defaultParams: {
      hydration_pct: 68,
      salt_pct: 2.5,
      sugar_pct: 0,
      oil_pct: 3,
    },
    fermentation: {
      bulk_ratio: 0.40,
      proof_ratio: 0.60,
      base_yeast_fresh_pct: 0.08,
    },
    characteristics: ['Ultratunn', 'Knaprig', 'Rektangulär', 'Lång jäsning']
  },
  {
    id: 'chicago_deep',
    name: 'Chicago Deep Dish',
    description: 'Djup amerikansk pizza med tjock botten',
    category: 'pizza',
    region: 'Chicago, USA',
    defaultParams: {
      hydration_pct: 58,
      salt_pct: 2.0,
      sugar_pct: 1,
      oil_pct: 8,
    },
    fermentation: {
      bulk_ratio: 0.50,
      proof_ratio: 0.50,
      base_yeast_fresh_pct: 0.30,
    },
    characteristics: ['Djup form', 'Smörbotten', 'Ost på botten', 'Mycket pålägg']
  },

  // BREAD STYLES
  {
    id: 'country_sourdough',
    name: 'Country Sourdough',
    description: 'Klassiskt lantbröd med surdeg',
    category: 'bread',
    region: 'Frankrike',
    defaultParams: {
      hydration_pct: 75,
      salt_pct: 2.0,
      sugar_pct: 0,
      oil_pct: 0,
    },
    fermentation: {
      bulk_ratio: 0.65,
      proof_ratio: 0.35,
      base_yeast_fresh_pct: 0,
      base_inoculation_pct: 20,
    },
    characteristics: ['Surdegsjäst', 'Öppen krumb', 'Syrlig smak', 'Tjock skorpa']
  },
  {
    id: 'baguette',
    name: 'Baguette Traditionnelle',
    description: 'Klassisk fransk baguette med poolish',
    category: 'bread',
    region: 'Frankrike',
    defaultParams: {
      hydration_pct: 68,
      salt_pct: 2.0,
      sugar_pct: 0,
      oil_pct: 0,
      preferment: {
        type: 'poolish',
        flour_pct: 40,
        hydration_pct: 100,
      },
    },
    fermentation: {
      bulk_ratio: 0.60,
      proof_ratio: 0.40,
      base_yeast_fresh_pct: 0.10,
    },
    characteristics: ['Poolish förjäsning', 'Knaprig skorpa', 'Öppen krumb', 'Traditionell']
  },
  {
    id: 'ciabatta',
    name: 'Ciabatta',
    description: 'Italienskt bröd med hög hydrering',
    category: 'bread',
    region: 'Italien',
    defaultParams: {
      hydration_pct: 80,
      salt_pct: 2.2,
      sugar_pct: 0,
      oil_pct: 1,
      preferment: {
        type: 'biga',
        flour_pct: 50,
        hydration_pct: 45,
      },
    },
    fermentation: {
      bulk_ratio: 0.70,
      proof_ratio: 0.30,
      base_yeast_fresh_pct: 0.08,
    },
    characteristics: ['Biga förjäsning', 'Mycket luftig', 'Oregelbundna hål', 'Mjuk skorpa']
  },
  {
    id: 'focaccia',
    name: 'Focaccia Genovese',
    description: 'Italiensk platt olivoljebröd',
    category: 'bread',
    region: 'Genua, Italien',
    defaultParams: {
      hydration_pct: 70,
      salt_pct: 2.5,
      sugar_pct: 0,
      oil_pct: 8,
    },
    fermentation: {
      bulk_ratio: 0.40,
      proof_ratio: 0.60,
      base_yeast_fresh_pct: 0.15,
    },
    characteristics: ['Olivolja', 'Platt form', 'Mjuk konsistens', 'Toppings']
  },
  {
    id: 'pain_de_mie',
    name: 'Pain de Mie',
    description: 'Franskt formbröd (sandwich bread)',
    category: 'bread',
    region: 'Frankrike',
    defaultParams: {
      hydration_pct: 65,
      salt_pct: 1.8,
      sugar_pct: 3,
      oil_pct: 4,
    },
    fermentation: {
      bulk_ratio: 0.45,
      proof_ratio: 0.55,
      base_yeast_fresh_pct: 0.25,
    },
    characteristics: ['Mjuk skorpa', 'Fin krumb', 'Kvadratisk form', 'Sandwich']
  },

  // PREFERMENT BREADS
  {
    id: 'poolish_bread',
    name: 'Poolish Country Bread',
    description: 'Rustikt bröd med poolish förjäsning',
    category: 'preferment',
    region: 'Frankrike',
    defaultParams: {
      hydration_pct: 72,
      salt_pct: 2.0,
      sugar_pct: 0,
      oil_pct: 0,
      preferment: {
        type: 'poolish',
        flour_pct: 50,
        hydration_pct: 100,
      },
    },
    fermentation: {
      bulk_ratio: 0.60,
      proof_ratio: 0.40,
      base_yeast_fresh_pct: 0.08,
    },
    characteristics: ['Poolish 12-16h', 'Komplex smak', 'Öppen krumb', 'Knaprig skorpa'],
    flourBlend: [
      { name: 'Bröd­mjöl', percentage: 80, protein_pct: 12.5 },
      { name: 'Fullkornsvete', percentage: 20, protein_pct: 14.0 }
    ]
  },
  {
    id: 'biga_pane',
    name: 'Pane Pugliese (Biga)',
    description: 'Italienskt bröd med biga förjäsning',
    category: 'preferment',
    region: 'Apulien, Italien',
    defaultParams: {
      hydration_pct: 70,
      salt_pct: 2.2,
      sugar_pct: 0,
      oil_pct: 0,
      preferment: {
        type: 'biga',
        flour_pct: 60,
        hydration_pct: 45,
      },
    },
    fermentation: {
      bulk_ratio: 0.65,
      proof_ratio: 0.35,
      base_yeast_fresh_pct: 0.06,
    },
    characteristics: ['Biga 12-24h', 'Nötaktig smak', 'Fin krumb', 'Hållbart'],
    flourBlend: [
      { name: 'Tipo 0', percentage: 70, protein_pct: 11.5 },
      { name: 'Tipo 1', percentage: 30, protein_pct: 12.0 }
    ]
  },
  {
    id: 'pizza_poolish',
    name: 'Neapolitan Poolish Pizza',
    description: 'Napolitansk pizza med poolish enligt traditionellt recept',
    category: 'pizza',
    region: 'Napoli, Italien',
    defaultParams: {
      hydration_pct: 60,  // 300g vatten / 500g mjöl
      salt_pct: 2.4,      // 12g salt / 500g mjöl
      sugar_pct: 0.6,     // 3g honung / 500g mjöl
      oil_pct: 0,
      preferment: {
        type: 'poolish',
        flour_pct: 35,    // 175g / 500g total mjöl
        hydration_pct: 100, // 175g vatten i poolish
      },
    },
    fermentation: {
      bulk_ratio: 0.15,   // 2h rumstemperatur efter blandning
      proof_ratio: 0.85,  // 18-24h kall + 2h uppvärmning
      base_yeast_fresh_pct: 0.3,  // Motsvarar 1g IDY i poolish
    },
    characteristics: ['270g bollar', 'Poolish 18-24h kall', '2h uppvärmning', 'Leopard spotting'],
    flourBlend: [
      { name: 'Tipo 00', percentage: 100, protein_pct: 12.5 }
    ]
  },
  {
    id: 'pizza_biga',
    name: 'Pizza Napoletana (100% Biga)',
    description: 'Napolitansk pizza med 100% biga',
    category: 'pizza', 
    region: 'Napoli, Italien',
    defaultParams: {
      hydration_pct: 70,  // 450-500ml + 200-250ml = 650-750ml / 1000g
      salt_pct: 2.8,      // 28g / 1000g mjöl
      sugar_pct: 1.0,     // 10g malt / 1000g mjöl
      oil_pct: 0,
      preferment: {
        type: 'biga',
        flour_pct: 100,   // 100% biga - inget extra mjöl
        hydration_pct: 47, // 450-500ml / 1000g mjöl i bigan
      },
    },
    fermentation: {
      bulk_ratio: 0.20,   // 30min vila efter knådning
      proof_ratio: 0.80,  // 18h biga + 3h bollning
      base_yeast_fresh_pct: 0.25, // 2-3g / 1000g mjöl
    },
    characteristics: ['260-280g bollar', '100% biga', '18h kallförjäsning', 'W300+ mjöl krävs'],
    flourBlend: [
      { name: 'Molino Pizzuti Costa d\'Amalfi', percentage: 60, protein_pct: 13.0 },
      { name: 'Vigevano Tramonti Oro', percentage: 40, protein_pct: 14.0 }
    ]
  },
  {
    id: 'sicilian_pizza',
    name: 'Sicilian Pizza',
    description: 'Tjock siciliansk pizza (Sfincione)',
    category: 'pizza',
    region: 'Sicilien, Italien',
    defaultParams: {
      hydration_pct: 68,
      salt_pct: 2.8,
      sugar_pct: 1,
      oil_pct: 6,
    },
    fermentation: {
      bulk_ratio: 0.40,
      proof_ratio: 0.60,
      base_yeast_fresh_pct: 0.15,
      base_inoculation_pct: 22,
    },
    characteristics: ['Tjock botten', 'Olivolja', 'Löktoppning', 'Breadcrumbs'],
    flourBlend: [
      { name: 'Tipo 00', percentage: 60, protein_pct: 11.0 },
      { name: 'Semolina', percentage: 40, protein_pct: 13.5 }
    ]
  },

  // ENRICHED BREADS
  {
    id: 'milkbread',
    name: 'Milkbread (Hokkaido)',
    description: 'Japanskt mjölkbröd - magiskt mjukt och luftigt',
    category: 'enriched',
    region: 'Japan/Sverige',
    defaultParams: {
      hydration_pct: 64, // 345g vatten / 540g mjöl
      salt_pct: 1.1,     // 1 tsk salt ≈ 6g / 540g mjöl
      sugar_pct: 6.5,    // 35g strösocker / 540g mjöl
      oil_pct: 5.6,      // 30g smör / 540g mjöl
    },
    fermentation: {
      bulk_ratio: 0.60,
      proof_ratio: 0.40,
      base_yeast_fresh_pct: 2.8, // 15g jäst / 540g mjöl
    },
    characteristics: ['Torrmjölkspulver 4.6%', 'Extremt mjuk', 'Lång hållbarhet', 'Tangzhong-metod'],
    flourBlend: [
      { name: 'Ölandsvetemjöl (eller bröd­mjöl)', percentage: 100, protein_pct: 11.5 }
    ]
  },
  {
    id: 'pain_de_mie_traditional',
    name: 'Pain de Mie (Traditionell)',
    description: 'Klassiskt franskt formbröd enligt originalrecept',
    category: 'enriched',
    region: 'Frankrike',
    defaultParams: {
      hydration_pct: 69, // (250g vatten + 250g mjölk) / 720g mjöl
      salt_pct: 2.1,     // 15g salt / 720g mjöl
      sugar_pct: 2.6,    // 19g honung / 720g mjöl
      oil_pct: 14,       // 100g smör / 720g mjöl
    },
    fermentation: {
      bulk_ratio: 0.40,
      proof_ratio: 0.60,
      base_yeast_fresh_pct: 2.0, // 6g torrjäst motsvarar ~15g färsk
    },
    characteristics: ['Mjölk + vatten', 'Honung istället för socker', 'Mycket smör', 'Kvadratisk form'],
    flourBlend: [
      { name: 'Vetemjöl', percentage: 100, protein_pct: 11.5 }
    ]
  },
  {
    id: 'sourdough_form_bread',
    name: 'Surdeg Formbröd',
    description: 'Svenskt surdegsbröd för form - Martin Johanssons recept',
    category: 'bread',
    region: 'Sverige',
    defaultParams: {
      hydration_pct: 62.5, // 250g vatten / 400g mjöl
      salt_pct: 2.4,       // Uppskattad 1½ tsk ≈ 9.6g / 400g
      sugar_pct: 0,
      oil_pct: 0,
    },
    fermentation: {
      bulk_ratio: 0.70,
      proof_ratio: 0.30,
      base_yeast_fresh_pct: 0,
      base_inoculation_pct: 50, // 200g surdeg / 400g mjöl
    },
    characteristics: ['50% surdegsinokulation', 'Vikning i bunke', 'Avlång limpa', '3-4h jäsning'],
    flourBlend: [
      { name: 'Vetemjöl Special', percentage: 100, protein_pct: 12.0 }
    ]
  },
  {
    id: 'sourdough_tortillas',
    name: 'Surdeg Tortillas',
    description: 'Mexikanska tortillas med svensk surdeg',
    category: 'bread',
    region: 'Mexico/Sverige',
    defaultParams: {
      hydration_pct: 57, // (150ml surdeg/2 + 250ml vatten) / 420g mjöl
      salt_pct: 2.3,     // 1½ tsk ≈ 9.6g / 420g mjöl
      sugar_pct: 0,
      oil_pct: 24,       // 100g smält smör / 420g mjöl
    },
    fermentation: {
      bulk_ratio: 0.20,
      proof_ratio: 0.80,
      base_yeast_fresh_pct: 0,
      base_inoculation_pct: 18, // 150ml surdeg ≈ 75g / 420g mjöl
    },
    characteristics: ['MMS-metoden', 'Hett vatten', 'Smält smör', '12 stora eller 24 små'],
    flourBlend: [
      { name: 'Vetemjöl', percentage: 100, protein_pct: 11.0 }
    ]
  },
  {
    id: 'brioche',
    name: 'Brioche',
    description: 'Rikt franskt smörbröd',
    category: 'enriched',
    region: 'Frankrike',
    defaultParams: {
      hydration_pct: 58,
      salt_pct: 1.8,
      sugar_pct: 12,
      oil_pct: 40, // Smör
    },
    fermentation: {
      bulk_ratio: 0.50,
      proof_ratio: 0.50,
      base_yeast_fresh_pct: 1.2,
    },
    characteristics: ['Mycket smör', 'Söt', 'Mjuk konsistens', 'Äggrik']
  },
  {
    id: 'challah',
    name: 'Challah',
    description: 'Judiskt flätat äggbröd',
    category: 'enriched',
    region: 'Östeuropa',
    defaultParams: {
      hydration_pct: 55,
      salt_pct: 1.5,
      sugar_pct: 8,
      oil_pct: 8,
    },
    fermentation: {
      bulk_ratio: 0.45,
      proof_ratio: 0.55,
      base_yeast_fresh_pct: 0.8,
    },
    characteristics: ['Äggrik', 'Flätat', 'Söt', 'Glansig yta']
  },
  {
    id: 'pita',
    name: 'Pita Bread',
    description: 'Mellanöstern fickbröd',
    category: 'bread',
    region: 'Mellanöstern',
    defaultParams: {
      hydration_pct: 62,
      salt_pct: 2.0,
      sugar_pct: 1,
      oil_pct: 2,
    },
    fermentation: {
      bulk_ratio: 0.50,
      proof_ratio: 0.50,
      base_yeast_fresh_pct: 0.5,
    },
    characteristics: ['Platt', 'Ficka', 'Snabb bakning', 'Mjuk']
  },
  {
    id: 'sourdough_rye',
    name: 'Swedish Rye Sourdough',
    description: 'Svenskt rågsurdegsbröd',
    category: 'bread',       
    region: 'Sverige',
    defaultParams: {
      hydration_pct: 72,
      salt_pct: 2.2,
      sugar_pct: 0,
      oil_pct: 0,
    },
    fermentation: {
      bulk_ratio: 0.70,
      proof_ratio: 0.30,
      base_yeast_fresh_pct: 0,
      base_inoculation_pct: 25,
    },
    characteristics: ['Rågsurdeg', 'Mörk färg', 'Tät krumb', 'Syrlig'],
    flourBlend: [
      { name: 'Rågmjöl', percentage: 30, protein_pct: 8.0 },
      { name: 'Vetemjöl', percentage: 70, protein_pct: 11.5 }
    ]
  },
  {
    id: 'multigrain_sourdough',
    name: 'Multigrain Sourdough',
    description: 'Flerkornsbröd med surdeg',
    category: 'bread',
    region: 'Norden',
    defaultParams: {
      hydration_pct: 78,
      salt_pct: 2.0,
      sugar_pct: 0,
      oil_pct: 2,
    },
    fermentation: {
      bulk_ratio: 0.65,
      proof_ratio: 0.35,
      base_yeast_fresh_pct: 0,
      base_inoculation_pct: 22,
    },
    characteristics: ['Flera kornsorter', 'Nötaktig', 'Hög fiber', 'Mättande'],
    flourBlend: [
      { name: 'Bröd­mjöl', percentage: 50, protein_pct: 12.5 },
      { name: 'Råg­mjöl', percentage: 20, protein_pct: 8.0 },
      { name: 'Speltvete', percentage: 30, protein_pct: 14.0 }
    ]
  }
];

export const getStyleById = (id: string): BreadStyle | undefined => {
  return BREAD_STYLES.find(style => style.id === id);
};

export const getStylesByCategory = (category: string): BreadStyle[] => {
  return BREAD_STYLES.filter(style => style.category === category);
};

export const getFlourBlendText = (flourBlend?: FlourBlend[]): string => {
  if (!flourBlend || flourBlend.length === 0) return 'Vetemjöl';
  return flourBlend.map(flour => `${flour.percentage}% ${flour.name}`).join(' + ');
};