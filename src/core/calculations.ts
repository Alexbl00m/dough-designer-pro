import { BreadStyle } from '@/data/styles';

export interface CalculationInputs {
  style: BreadStyle;
  ballWeight: number;
  ballCount: number;
  totalTime: number;
  roomTemp: number;
  coldTemp?: number;
  coldHours?: number;
  leavenType: 'commercial' | 'sourdough' | 'hybrid';
  yeastForm: 'fresh' | 'active_dry' | 'instant';
  mixing: 'hand' | 'spiral' | 'planetary' | 'dlx';
  desiredDoughTemp: number;
  /** Optional user overrides of the style defaults (baker's %) */
  hydration?: number;
  salt?: number;
  sugar?: number;
  oil?: number;
}

export interface Ingredient {
  name: string;
  grams: number;
  percentage: number;
  type: 'flour' | 'water' | 'salt' | 'yeast' | 'starter' | 'oil' | 'sugar' | 'preferment';
}

export interface CalculationResults {
  ingredients: Ingredient[];
  waterTemp: number;
  bulkTime: number;
  proofTime: number;
  totalFlour: number;
  yeastPercentage: number;
  timeline: TimelineStep[];
  notes: string[];
  /** Effective parameters actually used for the calculation */
  params: {
    hydration: number;
    salt: number;
    sugar: number;
    oil: number;
    roomEquivTime: number;
    coldHours: number;
    totalTime: number;
    totalDoughWeight: number;
    inoculationPct: number;
    baseInoculationPct: number;
    leavenType: 'commercial' | 'sourdough' | 'hybrid';
    roomTemp: number;
  };
}

export interface TimelineStep {
  time: string;
  action: string;
  description: string;
  temperature?: number;
}

// Yeast conversion factors
const YEAST_CONVERSIONS = {
  fresh_to_ady: 0.4,
  fresh_to_idy: 0.33,
  ady_to_idy: 0.82
};

// Q10 temperature correction
function getTemperatureFactor(temp: number, refTemp: number = 23, q10: number = 2.2): number {
  return Math.pow(q10, (temp - refTemp) / 10);
}

/** The base inoculation assumes ~6h room-equivalent bulk at 23°C. */
export const REFERENCE_LEVAIN_TIME = 6;
export const REFERENCE_LEVAIN_TEMP = 23;
/** Practical limits bakers actually use: 3–25% flour (= 6–50% starter at 100% hydration) */
export const INOCULATION_MIN = 3;
export const INOCULATION_MAX = 25;

/** Room-equivalent fermentation hours, accounting for time spent at 4°C. */
export function computeRoomEquivTime(totalTime: number, coldHours: number = 0): number {
  const coldRetardFactor = 0.3; // Cold slows fermentation by ~70%
  const effectiveColdHours = Math.min(Math.max(coldHours, 0), totalTime);
  return Math.max(0.5, (totalTime - effectiveColdHours) + effectiveColdHours * coldRetardFactor);
}

/** Starter (levain) inoculation as % of total flour, scaled by time and temperature. */
export function computeInoculationPct(
  baseInoculation: number,
  roomEquivTime: number,
  roomTemp: number,
  leavenType: 'commercial' | 'sourdough' | 'hybrid' = 'sourdough'
): number {
  if (leavenType === 'commercial') return 0;
  const tempFactor = getTemperatureFactor(roomTemp);
  const scaled = baseInoculation * (REFERENCE_LEVAIN_TIME / roomEquivTime) / tempFactor;
  let pct = Math.min(Math.max(scaled, INOCULATION_MIN), INOCULATION_MAX);
  if (leavenType === 'hybrid') pct *= 0.5;
  return Math.round(pct * 10) / 10;
}

// Baker's percentage calculations
export function calculateRecipe(inputs: CalculationInputs): CalculationResults {
  const { style, ballWeight, ballCount, totalTime, roomTemp, leavenType, yeastForm, mixing, desiredDoughTemp, coldTemp = 4, coldHours = 0 } = inputs;

  // Effective parameters: user overrides win over style defaults
  const hydrationPct = inputs.hydration ?? style.defaultParams.hydration_pct;
  const saltPct = inputs.salt ?? style.defaultParams.salt_pct;
  const sugarPct = inputs.sugar ?? style.defaultParams.sugar_pct;
  const oilPct = inputs.oil ?? style.defaultParams.oil_pct;

  // Calculate total dough weight and flour weight
  const totalDoughWeight = Math.max(0, ballWeight * ballCount);
  // Extra dry ingredients that add weight but are not part of the flour base
  const extrasPct = style.id === 'milkbread' ? 4.6 : 0;
  const totalPercentage = 100 + hydrationPct + saltPct + sugarPct + oilPct + extrasPct;
  const totalFlour = totalDoughWeight / (totalPercentage / 100);

  // Room equivalent time calculation (cold hours can never exceed total time)
  const effectiveColdHours = Math.min(Math.max(coldHours, 0), totalTime);
  const roomEquivTime = computeRoomEquivTime(totalTime, effectiveColdHours);

  // Calculate yeast percentage
  let yeastPercentage = 0;
  if (leavenType === 'commercial' || leavenType === 'hybrid') {
    // Styles that are sourdough-only have no base yeast: fall back to a sane default
    const baseFreshYeast = style.fermentation.base_yeast_fresh_pct || 0.3;
    const tempFactor = getTemperatureFactor(roomTemp);
    const timeFactor = 24 / roomEquivTime; // Base calculation for 24h
    
    // Style corrections (clamped so extreme inputs can never produce absurd/negative yeast)
    const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
    const saltCorrection = clamp(1 + 0.05 * (saltPct - 2.0), 0.8, 1.4);
    const sugarCorrection = clamp(1 + 0.02 * sugarPct, 0.8, 1.5);
    const hydrationCorrection = clamp(1 - 0.005 * (hydrationPct - 62), 0.7, 1.3);
    
    let freshYeastPct = baseFreshYeast * timeFactor / tempFactor * saltCorrection * sugarCorrection * hydrationCorrection;
    // In hybrid mode the sourdough carries part of the load
    if (leavenType === 'hybrid') freshYeastPct *= 0.5;
    
    // Convert to desired yeast form
    if (yeastForm === 'active_dry') {
      yeastPercentage = freshYeastPct * YEAST_CONVERSIONS.fresh_to_ady;
    } else if (yeastForm === 'instant') {
      yeastPercentage = freshYeastPct * YEAST_CONVERSIONS.fresh_to_idy;
    } else {
      yeastPercentage = freshYeastPct;
    }
  }

  // Sourdough inoculation actually used
  const usesStarter = leavenType === 'sourdough' || leavenType === 'hybrid';
  const baseInoculation = style.fermentation.base_inoculation_pct ?? 20;
  const inoculationPct = usesStarter
    ? computeInoculationPct(baseInoculation, roomEquivTime, roomTemp, leavenType)
    : 0;

  // Build ingredients list
  const ingredients: Ingredient[] = [];
  
  // Add flour(s) - either blend or single
  if (style.flourBlend && style.flourBlend.length > 0) {
    style.flourBlend.forEach(flour => {
      ingredients.push({
        name: flour.name,
        grams: Math.round(totalFlour * (flour.percentage / 100) * 10) / 10,
        percentage: flour.percentage,
        type: 'flour'
      });
    });
  } else {
    ingredients.push({
      name: 'Mjöl (Tipo 00/Vetemjöl)',
      grams: Math.round(totalFlour * 10) / 10,
      percentage: 100,
      type: 'flour'
    });
  }
  
  // Add water
  ingredients.push({
    name: 'Vatten',
    grams: Math.round(totalFlour * (hydrationPct / 100) * 10) / 10,
    percentage: hydrationPct,
    type: 'water'
  });
  
  // Add salt
  ingredients.push({
    name: 'Salt',
    grams: Math.round(totalFlour * (saltPct / 100) * 10) / 10,
    percentage: saltPct,
    type: 'salt'
  });

  // Add yeast if commercial
  if (yeastPercentage > 0) {
    const yeastNames = {
      fresh: 'Färsk jäst',
      active_dry: 'Torrjäst (aktiv)',
      instant: 'Torrjäst (instant)'
    };
    
    ingredients.push({
      name: yeastNames[yeastForm],
      grams: Math.round(totalFlour * (yeastPercentage / 100) * 100) / 100,
      percentage: Math.round(yeastPercentage * 100) / 100,
      type: 'yeast'
    });
  }

  // Add sourdough starter if needed
  if (usesStarter && inoculationPct > 0) {
    const starterFlour = totalFlour * (inoculationPct / 100);
    const starterWater = starterFlour;
    const totalStarter = starterFlour + starterWater;
    
    ingredients.push({
      name: 'Surdeg (100% hydrering)',
      grams: Math.round(totalStarter * 10) / 10,
      percentage: Math.round(inoculationPct * 2 * 10) / 10, // flour + water
      type: 'starter'
    });
    
    // Adjust flour and water for single flour or first flour in blend
    const firstFlourIndex = ingredients.findIndex(ing => ing.type === 'flour');
    const waterIndex = ingredients.findIndex(ing => ing.type === 'water');
    
    if (firstFlourIndex !== -1) {
      ingredients[firstFlourIndex].grams = Math.round(Math.max(0, ingredients[firstFlourIndex].grams - starterFlour) * 10) / 10;
      ingredients[firstFlourIndex].name += ' (utöver surdegen)';
    }
    if (waterIndex !== -1) {
      ingredients[waterIndex].grams = Math.round(Math.max(0, ingredients[waterIndex].grams - starterWater) * 10) / 10;
      ingredients[waterIndex].name += ' (utöver surdegen)';
    }
  }

  // Add sugar if needed
  if (sugarPct > 0) {
    const sugarName = style.id === 'pain_de_mie_traditional' ? 'Honung' :
                     style.id === 'milkbread' ? 'Strösocker' : 'Socker';
    ingredients.push({
      name: sugarName,
      grams: Math.round(totalFlour * (sugarPct / 100) * 10) / 10,
      percentage: sugarPct,
      type: 'sugar'
    });
  }

  // Add special ingredients for specific recipes
  if (style.id === 'milkbread') {
    // Add milk powder (4.6% of flour weight)
    ingredients.push({
      name: 'Torrmjölkspulver',
      grams: Math.round(totalFlour * 0.046 * 10) / 10,
      percentage: 4.6,
      type: 'flour' // Treat as flour for calculation purposes
    });
  }

  if (style.id === 'pain_de_mie_traditional') {
    // Replace some water with milk (50/50 split)
    const waterIndex = ingredients.findIndex(ing => ing.type === 'water');
    if (waterIndex !== -1) {
      const totalLiquid = ingredients[waterIndex].grams;
      const waterAmount = totalLiquid / 2;
      const milkAmount = totalLiquid / 2;
      
      ingredients[waterIndex].grams = Math.round(waterAmount * 10) / 10;
      ingredients[waterIndex].name = 'Fingervarmt vatten';
      ingredients[waterIndex].percentage = Math.round((waterAmount / totalFlour) * 1000) / 10;
      
      ingredients.push({
        name: 'Standardmjölk',
        grams: Math.round(milkAmount * 10) / 10,
        percentage: Math.round((milkAmount / totalFlour) * 1000) / 10,
        type: 'water'
      });
    }
  }

  if (style.id === 'sourdough_tortillas') {
    // Replace some water with hot water
    const waterIndex = ingredients.findIndex(ing => ing.type === 'water');
    if (waterIndex !== -1) {
      ingredients[waterIndex].name = 'Hett vatten';
    }
  }

  // Add oil if needed
  if (oilPct > 0) {
    const oilName = style.id === 'brioche' ? 'Smör' : 
                   style.id === 'focaccia' ? 'Olivolja' :
                   style.id === 'milkbread' ? 'Smör' :
                   style.id === 'pain_de_mie_traditional' ? 'Smör' :
                   style.id === 'sourdough_tortillas' ? 'Smält smör' : 'Olja';
    ingredients.push({
      name: oilName,
      grams: Math.round(totalFlour * (oilPct / 100) * 10) / 10,
      percentage: oilPct,
      type: 'oil'
    });
  }

  // Calculate water temperature (DDT)
  const frictionFactors = { hand: 2, spiral: 8, planetary: 6, dlx: 4 };
  const frictionFactor = frictionFactors[mixing];
  const flourTemp = roomTemp; // Flour equilibrates to the room it is stored in
  const rawWaterTemp = desiredDoughTemp * 3 - flourTemp - roomTemp - frictionFactor;
  const waterTemp = Math.min(Math.max(rawWaterTemp, 1), 55);

  // Calculate bulk and proof times from the real clock time, normalised so the
  // ratios always sum to 1 (some styles' ratios did not).
  const ratioSum = style.fermentation.bulk_ratio + style.fermentation.proof_ratio || 1;
  const bulkTime = totalTime * (style.fermentation.bulk_ratio / ratioSum);
  const proofTime = totalTime * (style.fermentation.proof_ratio / ratioSum);

  // Make displayed baker's percentages consistent with the grams actually listed.
  // (Previously flour showed 100% and water the target hydration even after the
  // starter's flour/water had been subtracted from them.)
  ingredients.forEach(ing => {
    const pct = totalFlour > 0 ? (ing.grams / totalFlour) * 100 : 0;
    ing.percentage = ing.type === 'yeast'
      ? Math.round(pct * 1000) / 1000
      : Math.round(pct * 10) / 10;
  });

  // Generate timeline
  const timeline = generateTimeline(bulkTime, proofTime, mixing, style);

  // Generate notes
  const notes = generateNotes(inputs, yeastPercentage, waterTemp, {
    hydrationPct,
    oilPct,
    rawWaterTemp,
    coldHours: effectiveColdHours,
  });

  if (usesStarter && inoculationPct > 0) {
    notes.push(
      `ℹ️ Procenten visar varje ingrediens andel av det totala mjölet (${Math.round(totalFlour)}g), där surdegens mjöl (${Math.round(totalFlour * (inoculationPct / 100))}g) och vatten redan är avräknade från mjöl- och vattenposten. Total hydrering blir ${hydrationPct}%.`
    );
    notes.push(
      `🫙 Surdegsratio: ${inoculationPct}% av mjölvikten kommer från surdegen, dvs ${Math.round(inoculationPct * 2 * 10) / 10}% färdig surdeg (100% hydrering) på mjölet. Basen är ${baseInoculation}% vid 23°C och ~6h jäsning – mängden skalas ned vid längre tid eller varmare rum och begränsas till 3–25%.`
    );
    notes.push(
      '🫙 Använd mogen surdeg: mata 1:5:5 och använd den på toppen (ca 4–6h vid 23°C). Trög eller nymatad surdeg = längre jäsning än beräknat.'
    );
  }

  return {
    ingredients,
    waterTemp: Math.round(waterTemp * 10) / 10,
    bulkTime: Math.round(bulkTime * 10) / 10,
    proofTime: Math.round(proofTime * 10) / 10,
    totalFlour: Math.round(totalFlour),
    yeastPercentage: Math.round(yeastPercentage * 1000) / 1000,
    timeline,
    notes,
    params: {
      hydration: hydrationPct,
      salt: saltPct,
      sugar: sugarPct,
      oil: oilPct,
      roomEquivTime: Math.round(roomEquivTime * 10) / 10,
      coldHours: effectiveColdHours,
      totalTime,
      totalDoughWeight,
      inoculationPct,
      baseInoculationPct: baseInoculation,
      leavenType,
      roomTemp,
    }
  };
}

function generateTimeline(bulkTime: number, proofTime: number, mixing: string, style: BreadStyle): TimelineStep[] {
  const timeline: TimelineStep[] = [];
  
  // Style-specific timelines
  switch (style.id) {
    case 'neapolitan':
      return generateNeapolitanTimeline(bulkTime, proofTime);
    case 'pizza_poolish':
      return generatePoolishTimeline(bulkTime, proofTime);
    case 'pizza_biga':
      return generateBigaTimeline(bulkTime, proofTime);
    case 'milkbread':
      return generateMilkbreadTimeline(bulkTime, proofTime);
    case 'pain_de_mie_traditional':
      return generatePainDeMieTimeline(bulkTime, proofTime);
    case 'sourdough_form_bread':
      return generateSourdoughFormTimeline(bulkTime, proofTime);
    case 'sourdough_tortillas':
      return generateTortillaTimeline(bulkTime, proofTime);
    case 'country_sourdough':
      return generateCountrySourdoughTimeline(bulkTime, proofTime);
    case 'baguette':
      return generateBaguetteTimeline(bulkTime, proofTime);
    default:
      return generateGenericTimeline(bulkTime, proofTime, mixing, style);
  }
}

function generateNeapolitanTimeline(bulkTime: number, proofTime: number): TimelineStep[] {
  return [
    {
      time: '00:00',
      action: 'Blanda vatten, salt och jäst',
      description: '15°C vatten, 28-30g salt, 0.25g färsk jäst - rör tills upplöst'
    },
    {
      time: '00:05',
      action: 'Tillsätt mjöl',
      description: 'Häll i 1000g mjöl (Caputo Pizzeria + Vigevano), blanda snabbt för hand'
    },
    {
      time: '00:30',
      action: 'Första vikningen',
      description: 'Vik degen 4-5 gånger tills spänd och slät, vila 15 min'
    },
    {
      time: '00:45',
      action: 'Andra vikningen',
      description: 'Upprepa vikning, vila 15 min'
    },
    {
      time: '01:00',
      action: 'Tredje vikningen',
      description: 'Sista vikning, ta ut 80g för jäsningskontroll'
    },
    {
      time: formatTime(bulkTime),
      action: 'Dela och bolla',
      description: 'Dela till 265g bollar, bolla med spänning'
    },
    {
      time: formatTime(bulkTime + proofTime),
      action: 'Klart för utbakning',
      description: 'Kontrollera jäsning (25-29 på regnmätare), kavla försiktigt'
    }
  ];
}

function generatePoolishTimeline(bulkTime: number, proofTime: number): TimelineStep[] {
  return [
    {
      time: 'DAG 1 - 00:00',
      action: 'Gör poolish',
      description: '175g mjöl + 175g ljummet vatten + 3g honung + 1g torrjäst'
    },
    {
      time: 'DAG 1 - 02:00',
      action: 'Poolish i kyl',
      description: 'Poolish till kylskåp i 18-24h'
    },
    {
      time: 'DAG 2 - 00:00',
      action: 'Poolish till rumstemperatur',
      description: 'Ta ut poolish 1h före användning'
    },
    {
      time: 'DAG 2 - 01:00',
      action: 'Blanda slutdeg',
      description: 'Poolish + 125g vatten + 325g mjöl + 12g salt, knåda 5-8 min'
    },
    {
      time: `DAG 2 - ${formatTime(1 + bulkTime)}`,
      action: 'Dela och bolla',
      description: 'Dela till 270g bollar, vila 20 min'
    },
    {
      time: `DAG 2 - ${formatTime(1 + bulkTime + proofTime)}`,
      action: 'Klart för utbakning',
      description: 'Degen ska vara luftig och lätt att sträcka'
    }
  ];
}

function generateBigaTimeline(bulkTime: number, proofTime: number): TimelineStep[] {
  return [
    {
      time: 'DAG 1 - 00:00',
      action: 'Gör biga',
      description: '1000g mjöl + 450-500ml vatten + 2-3g jäst, blanda till jämn deg'
    },
    {
      time: 'DAG 1 - 18:00',
      action: 'Biga färdig',
      description: 'Biga klar efter 18h vid 16°C, ska lukta tydligt'
    },
    {
      time: 'DAG 2 - 00:00',
      action: 'Knåda slutdeg',
      description: 'Biga + 200-250ml isvatten + 28g salt + 10g malt'
    },
    {
      time: 'DAG 2 - 00:30',
      action: 'Windowpane-test',
      description: 'Degen ska klara windowpane-test och kännas tuggumiaktig'
    },
    {
      time: `DAG 2 - ${formatTime(0.5 + bulkTime)}`,
      action: 'Dela och bolla',
      description: 'Dela till 260-280g bollar för 36cm pizzor'
    },
    {
      time: `DAG 2 - ${formatTime(0.5 + bulkTime + proofTime)}`,
      action: 'Klart för utbakning',
      description: 'Degbollar redo efter 3h vid rumstemperatur'
    }
  ];
}

function generateMilkbreadTimeline(bulkTime: number, proofTime: number): TimelineStep[] {
  return [
    {
      time: '00:00',
      action: 'Gör tangzhong',
      description: 'Koka 30g mjöl + 150ml mjölk/vatten till tjock konsistens, kyl'
    },
    {
      time: '00:30',
      action: 'Blanda deg',
      description: 'Mjöl, socker, salt, torrjäst, tangzhong, mjölk - knåda 8 min'
    },
    {
      time: '00:38',
      action: 'Tillsätt smör',
      description: 'Rumstempererat smör portionsvis, knåda till slätt'
    },
    {
      time: formatTime(bulkTime),
      action: 'Forma bröd',
      description: 'Dela degen, forma och lägg i smörd form'
    },
    {
      time: formatTime(bulkTime + proofTime),
      action: 'Pensla och grädda',
      description: 'Pensla med mjölk, grädda 180°C i 30-35 min'
    }
  ];
}

function generatePainDeMieTimeline(bulkTime: number, proofTime: number): TimelineStep[] {
  return [
    {
      time: '00:00',
      action: 'Lös jäst i mjölk',
      description: 'Blanda jäst i fingervarmt mjölk/vatten (50/50)'
    },
    {
      time: '00:05',
      action: 'Tillsätt mjöl och honung',
      description: 'Blanda mjöl, honung och jästblandning'
    },
    {
      time: '00:15',
      action: 'Knåda med smör',
      description: 'Knåda 10-15 min till slät deg med smör'
    },
    {
      time: formatTime(bulkTime),
      action: 'Forma och lägg i form',
      description: 'Forma till limpa, lägg i smörd form med lock'
    },
    {
      time: formatTime(bulkTime + proofTime),
      action: 'Grädda',
      description: 'Grädda 220°C till dubbel storlek, sänk till 190°C'
    }
  ];
}

function generateSourdoughFormTimeline(bulkTime: number, proofTime: number): TimelineStep[] {
  return [
    {
      time: '00:00',
      action: 'Autolys',
      description: 'Blanda mjöl och vatten, vila 30 min'
    },
    {
      time: '00:30',
      action: 'Tillsätt surdeg och salt',
      description: 'Arbeta in aktiv surdeg och salt försiktigt'
    },
    {
      time: '01:00',
      action: 'Första vikningen',
      description: 'Vikning i bunke, vila 30 min'
    },
    {
      time: '01:30',
      action: 'Andra vikningen',
      description: 'Upprepa vikning, vila 30 min'
    },
    {
      time: '02:00',
      action: 'Tredje vikningen',
      description: 'Sista vikning i bunke'
    },
    {
      time: formatTime(bulkTime),
      action: 'Forma till limpa',
      description: 'Forma till avlång limpa, lägg i korg'
    },
    {
      time: formatTime(bulkTime + proofTime),
      action: 'Grädda',
      description: 'Grädda med ånga 230°C i 20 min, sedan 200°C'
    }
  ];
}

function generateTortillaTimeline(bulkTime: number, proofTime: number): TimelineStep[] {
  return [
    {
      time: '00:00',
      action: 'MMS-metod: Het vätska',
      description: 'Blanda hett vatten (80°C) med smält smör'
    },
    {
      time: '00:05',
      action: 'Tillsätt mjöl och surdeg',
      description: 'Blanda mjöl, surdeg och het vätskeblandning'
    },
    {
      time: '00:15',
      action: 'Knåda till slät deg',
      description: 'Knåda till mjuk, elastisk deg'
    },
    {
      time: formatTime(bulkTime),
      action: 'Dela och vila',
      description: 'Dela till 8 bitar, forma bollar, vila under handduk'
    },
    {
      time: formatTime(bulkTime + proofTime),
      action: 'Kavla och stek',
      description: 'Kavla tunna, stek i torr panna 20-30 sek per sida'
    }
  ];
}

function generateCountrySourdoughTimeline(bulkTime: number, proofTime: number): TimelineStep[] {
  return [
    {
      time: '00:00',
      action: 'Autolys',
      description: 'Blanda mjöl och vatten, vila 30-60 min'
    },
    {
      time: '01:00',
      action: 'Tillsätt surdeg och salt',
      description: 'Arbeta in aktiv surdeg och salt'
    },
    {
      time: '01:30',
      action: 'Första set vikningar',
      description: 'Stretch & fold var 30:e minut, 4 set totalt'
    },
    {
      time: formatTime(bulkTime),
      action: 'Förbollning',
      description: 'Forma till boll, vila 20-30 min'
    },
    {
      time: formatTime(bulkTime + 0.5),
      action: 'Slutformning',
      description: 'Forma till limpa, lägg i banneton'
    },
    {
      time: formatTime(bulkTime + proofTime),
      action: 'Grädda',
      description: 'Grädda med ånga 250°C i 20 min, sedan 230°C'
    }
  ];
}

function generateBaguetteTimeline(bulkTime: number, proofTime: number): TimelineStep[] {
  return [
    {
      time: '00:00',
      action: 'Blanda grunddeg',
      description: 'Mjöl, vatten, salt, jäst - blanda till jämn deg'
    },
    {
      time: '00:45',
      action: 'Första vikningen',
      description: 'Bokvikning i bunke, vila 45 min'
    },
    {
      time: '01:30',
      action: 'Andra vikningen',
      description: 'Upprepa vikning, vila 45 min'
    },
    {
      time: formatTime(bulkTime),
      action: 'Förforma',
      description: 'Dela degen, förforma till korta stockar'
    },
    {
      time: formatTime(bulkTime + 0.5),
      action: 'Slutforma baguetter',
      description: 'Forma till långa baguetter, lägg i dukkorg'
    },
    {
      time: formatTime(bulkTime + proofTime),
      action: 'Skär och grädda',
      description: 'Gör snitt, grädda med ånga 240°C'
    }
  ];
}

function generateGenericTimeline(bulkTime: number, proofTime: number, mixing: string, style: BreadStyle): TimelineStep[] {
  const timeline: TimelineStep[] = [];
  
  timeline.push({
    time: '00:00',
    action: 'Blanda ingredienser',
    description: `Blanda mjöl, vatten (${mixing === 'hand' ? 'för hand' : 'med maskin'})`
  });

  if (style.defaultParams.hydration_pct > 65 && style.defaultParams.sugar_pct < 5) {
    timeline.push({
      time: '00:30',
      action: 'Autolys',
      description: 'Vila degen 30 min för glutenutveckling'
    });
  }

  timeline.push({
    time: style.defaultParams.hydration_pct > 65 ? '01:00' : '00:30',
    action: 'Tillsätt salt och jäst',
    description: 'Arbeta in salt och jäst, börja bulkjäsning'
  });

  if (mixing === 'hand' && style.defaultParams.hydration_pct > 65) {
    timeline.push({
      time: '01:30',
      action: 'Första vikningen',
      description: 'Coil fold eller stretch & fold'
    });
    
    timeline.push({
      time: '02:15',
      action: 'Andra vikningen',
      description: 'Coil fold eller stretch & fold'
    });
  }

  timeline.push({
    time: formatTime(bulkTime),
    action: style.category === 'pizza' ? 'Dela och bolla' : 'Forma',
    description: style.category === 'pizza' ? 'Dela degen och forma bollar' : 'Forma bröd och lägg i korg/form'
  });

  timeline.push({
    time: formatTime(bulkTime + proofTime),
    action: 'Klar att grädda',
    description: style.category === 'pizza' ? 'Kavla ut och toppa pizza' : 'Baka brödet'
  });

  return timeline;
}

function formatTime(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours % 1) * 60);
  return h.toString().padStart(2, '0') + ':' + m.toString().padStart(2, '0');
}

function generateNotes(
  inputs: CalculationInputs,
  yeastPct: number,
  waterTemp: number,
  eff: { hydrationPct: number; oilPct: number; rawWaterTemp: number; coldHours: number }
): string[] {
  const notes: string[] = [];
  
  if (eff.rawWaterTemp !== waterTemp) {
    notes.push(`⚠️ Beräknad vattentemperatur (${eff.rawWaterTemp.toFixed(1)}°C) ligger utanför praktiskt intervall och har justerats till ${waterTemp.toFixed(1)}°C.`);
  }

  if ((inputs.coldHours ?? 0) > inputs.totalTime) {
    notes.push(`⚠️ Kyltiden var längre än den totala tiden och har begränsats till ${eff.coldHours}h.`);
  }

  if (waterTemp < 5) {
    notes.push('⚠️ Vattentemperaturen är mycket låg. Överväg kortare jäsningstid eller högre rumstemperatur.');
  } else if (waterTemp > 50) {
    notes.push('⚠️ Vattentemperaturen är hög. Kontrollera att jästen inte dödas (max 50°C för färsk jäst).');
  }
  
  if (eff.hydrationPct > 75) {
    notes.push('💡 Hög hydrering: Använd våta händer vid vikning och var försiktig vid formning.');
  }
  
  if (inputs.leavenType !== 'sourdough' && yeastPct > 0 && yeastPct < 0.02) {
    notes.push('⚠️ Mycket lite jäst beräknat. Kontrollera jäsningstid och temperatur.');
  }
  
  if (eff.oilPct > 10) {
    notes.push('💡 Fet deg: Tillsätt fett efter glutenutveckling för bästa resultat.');
  }

  // Style-specific notes
  switch (inputs.style.id) {
    case 'neapolitan':
      notes.push('🍕 Traditionell napolitansk: Vikning 3x med 15min vila. Bulkjäsning 12-14h vid 21°C.');
      notes.push('🍕 Gräddas vid 900°C i 60-90 sekunder. Hemugn: 250°C med bakstål, 8-12 min.');
      break;
    case 'ny_style':
      notes.push('🍕 Gräddas vid 250°C i 12-15 minuter. Använd bakstål för bästa resultat.');
      break;
    case 'pizza_poolish':
      notes.push('🍕 Poolish dag 1: Blanda och jäs 2h rumstemperatur, sedan 18-24h i kyl.');
      notes.push('🍕 Dag 2: Knåda slutdeg, 2h rumstemperatur före utbakning. Mål: leopard spotting.');
      break;
    case 'pizza_biga':
      notes.push('🍕 Biga dag 1: Torr biga 18h vid 16°C. Kräver W300+ mjöl för styrka.');
      notes.push('🍕 Dag 2: Knåda med isvatten + malt. Windowpane-test måste klara. 3h bollning.');
      break;
    case 'country_sourdough':
      notes.push('🍞 Gräddas med ånga första 20 min, sedan utan lock. 230°C → 200°C.');
      break;
    case 'baguette':
      notes.push('🥖 Gör snitt precis före gräddning. Ånga första 15 min.');
      break;
    case 'milkbread':  
      notes.push('🍞 Tangzhong-metod: Koka 30g mjöl + 150ml mjölk/vatten till tjock konsistens.');
      notes.push('🍞 Tillsätt 25g torrmjölkspulver för extra mjukhet. Pensla med mjölk.');
      break;
    case 'pain_de_mie_traditional':
      notes.push('🍞 Blanda jäst i fingervarmt vatten. Knåda 10-15 min till slät deg.');
      notes.push('🍞 Baka i lock till dubbel storlek vid 220°C, sänk till 190°C.');
      break;
    case 'sourdough_form_bread':
      notes.push('🍞 Vikning i bunke flera gånger. 30 min vila mellan vikningar.');
      notes.push('🍞 Forma till avlång limpa. 3-4h jäsning vid rumstemperatur.');
      break;
    case 'sourdough_tortillas':
      notes.push('🌮 MMS-metoden: Hett vatten + smält smör = mjuka tortillas.');
      notes.push('🌮 Stek i torr panna 20-30 sek per sida tills de bubblar.');
      break;
  }
  
  return notes;
}