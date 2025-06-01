/**
 * Material Properties Database for Enhanced Switch Comparison
 *
 * This file contains comprehensive material characteristics that drive
 * context injection for rich, enthusiast-oriented switch comparisons.
 *
 * Based on community knowledge and mechanical keyboard research for
 * sound profiles, feel characteristics, and typing implications.
 */

export interface MaterialSoundProfile {
  descriptors: string[];
  frequency: 'low' | 'medium' | 'high';
  resonance: 'dampened' | 'neutral' | 'resonant';
  volume: 'quiet' | 'moderate' | 'loud';
}

export interface MaterialFeelProfile {
  descriptors: string[];
  texture: 'smooth' | 'textured' | 'scratchy';
  firmness: 'soft' | 'medium' | 'firm';
  characteristics: string[];
}

export interface HousingMaterial {
  name: string;
  sound: MaterialSoundProfile;
  feel: MaterialFeelProfile;
  commonUse: string;
  enthusiastTerms: string[];
}

export interface StemMaterial {
  name: string;
  sound: MaterialSoundProfile;
  feel: MaterialFeelProfile;
  durability: 'low' | 'medium' | 'high';
  lubrication: 'requires-lube' | 'self-lubricating' | 'factory-lubed';
  enthusiastTerms: string[];
}

export interface SpringWeightCategory {
  range: string;
  actuationRange: [number, number];
  sound: MaterialSoundProfile;
  feel: MaterialFeelProfile;
  useCases: string[];
  fatigueLevel: 'low' | 'medium' | 'high';
  typingSpeed: 'very-fast' | 'fast' | 'moderate' | 'deliberate';
  enthusiastTerms: string[];
}

export interface CharacteristicDefinition {
  primaryName: string;
  synonyms: string[];
  variations: string[];
  commonTypos: string[];
  databaseMappingStrategy:
    | 'type_based'
    | 'material_based'
    | 'force_based'
    | 'name_based'
    | 'hybrid';
  databaseConditions: {
    typeConditions?: string[];
    materialConditions?: {
      housing?: string[];
      stem?: string[];
    };
    forceConditions?: {
      operator: '>' | '<' | 'BETWEEN';
      values: number[];
    };
    nameConditions?: string[];
    hybridLogic?: string;
  };
  description: string;
  materialScience: string[];
  soundProfile: string[];
  feelProfile: string[];
}

export const HOUSING_MATERIALS: Record<string, HousingMaterial> = {
  nylon: {
    name: 'Nylon',
    sound: {
      descriptors: ['deeper', 'fuller', 'muted', 'warm', 'rounded'],
      frequency: 'low',
      resonance: 'dampened',
      volume: 'moderate'
    },
    feel: {
      descriptors: ['firm', 'stable', 'solid'],
      texture: 'textured',
      firmness: 'firm',
      characteristics: ['dampens vibrations', 'absorbs sound', 'stable base']
    },
    commonUse: 'Traditional Cherry MX switches, budget-friendly options',
    enthusiastTerms: ['thocky', 'muted', 'warm thock', 'deep sound signature']
  },

  polycarbonate: {
    name: 'Polycarbonate (PC)',
    sound: {
      descriptors: ['sharper', 'crisper', 'brighter', 'clear', 'defined'],
      frequency: 'high',
      resonance: 'resonant',
      volume: 'moderate'
    },
    feel: {
      descriptors: ['responsive', 'crisp', 'defined'],
      texture: 'smooth',
      firmness: 'medium',
      characteristics: ['allows RGB shine-through', 'resonant housing', 'clear sound transmission']
    },
    commonUse: 'RGB keyboards, premium linear switches, modern enthusiast switches',
    enthusiastTerms: ['clacky', 'crisp', 'bright', 'poppy', 'clean sound signature']
  },

  pom: {
    name: 'POM (Polyoxymethylene)',
    sound: {
      descriptors: ['quiet', 'muted', 'controlled', 'refined'],
      frequency: 'low',
      resonance: 'dampened',
      volume: 'quiet'
    },
    feel: {
      descriptors: ['smooth', 'consistent', 'refined'],
      texture: 'smooth',
      firmness: 'medium',
      characteristics: ['self-lubricating properties', 'consistent feel', 'premium material']
    },
    commonUse: 'High-end switches, enthusiast linears, premium builds',
    enthusiastTerms: ['creamy', 'smooth', 'buttery', 'refined thock', 'whisper quiet']
  },

  pa12: {
    name: 'PA12 (Nylon 12)',
    sound: {
      descriptors: ['balanced', 'controlled', 'refined', 'warm'],
      frequency: 'medium',
      resonance: 'neutral',
      volume: 'moderate'
    },
    feel: {
      descriptors: ['balanced', 'smooth', 'consistent'],
      texture: 'smooth',
      firmness: 'medium',
      characteristics: [
        'improved nylon variant',
        'better dimensional stability',
        'consistent properties'
      ]
    },
    commonUse: 'Modern enthusiast switches, HMX switches, premium housings',
    enthusiastTerms: ['balanced', 'refined', 'smooth thock', 'premium feel']
  },

  ink_blend: {
    name: 'INK Blend (Gateron)',
    sound: {
      descriptors: ['unique', 'pointed', 'distinctive', 'sharp'],
      frequency: 'high',
      resonance: 'resonant',
      volume: 'moderate'
    },
    feel: {
      descriptors: ['distinctive', 'firm', 'unique'],
      texture: 'smooth',
      firmness: 'firm',
      characteristics: ['proprietary blend', 'distinctive sound signature', 'Gateron exclusive']
    },
    commonUse: 'Gateron INK series switches',
    enthusiastTerms: ['clacky', 'unique', 'INK sound', 'distinctive ping']
  }
};

export const STEM_MATERIALS: Record<string, StemMaterial> = {
  pom: {
    name: 'POM',
    sound: {
      descriptors: ['quiet', 'consistent', 'stable', 'clean'],
      frequency: 'medium',
      resonance: 'neutral',
      volume: 'quiet'
    },
    feel: {
      descriptors: ['smooth', 'consistent', 'reliable'],
      texture: 'smooth',
      firmness: 'medium',
      characteristics: [
        'low coefficient of friction',
        'self-lubricating',
        'durable',
        'minimal stem wobble'
      ]
    },
    durability: 'high',
    lubrication: 'self-lubricating',
    enthusiastTerms: ['buttery smooth', 'consistent', 'reliable', 'no-scratch']
  },

  pok: {
    name: 'POK (Polyketone)',
    sound: {
      descriptors: ['refined', 'premium', 'controlled', 'sophisticated'],
      frequency: 'medium',
      resonance: 'neutral',
      volume: 'quiet'
    },
    feel: {
      descriptors: ['ultra-smooth', 'premium', 'refined', 'exceptional'],
      texture: 'smooth',
      firmness: 'medium',
      characteristics: [
        'enhanced smoothness over POM',
        'premium material',
        'superior wear resistance',
        'minimal friction'
      ]
    },
    durability: 'high',
    lubrication: 'self-lubricating',
    enthusiastTerms: ['creamy', 'ultra-smooth', 'premium feel', 'silk-like', 'effortless']
  },

  uhmwpe: {
    name: 'UHMWPE (Ultra-High Molecular Weight Polyethylene)',
    sound: {
      descriptors: ['ultra-smooth', 'refined', 'whisper-quiet', 'controlled'],
      frequency: 'low',
      resonance: 'dampened',
      volume: 'quiet'
    },
    feel: {
      descriptors: ['ultra-smooth', 'exceptional', 'frictionless', 'premium'],
      texture: 'smooth',
      firmness: 'medium',
      characteristics: [
        'lowest friction coefficient',
        'enhanced acoustics',
        'premium material',
        'exceptional smoothness'
      ]
    },
    durability: 'high',
    lubrication: 'self-lubricating',
    enthusiastTerms: [
      'silk-smooth',
      'frictionless',
      'premium',
      'whisper-smooth',
      'effortless glide'
    ]
  },

  nylon: {
    name: 'Nylon',
    sound: {
      descriptors: ['traditional', 'stable', 'consistent'],
      frequency: 'medium',
      resonance: 'neutral',
      volume: 'moderate'
    },
    feel: {
      descriptors: ['traditional', 'reliable', 'standard'],
      texture: 'textured',
      firmness: 'medium',
      characteristics: [
        'traditional material',
        'reliable performance',
        'may require lubrication',
        'standard feel'
      ]
    },
    durability: 'medium',
    lubrication: 'requires-lube',
    enthusiastTerms: ['traditional', 'reliable', 'classic feel', 'old-school']
  }
};

export const SPRING_WEIGHTS: Record<string, SpringWeightCategory> = {
  ultraLight: {
    range: 'Ultra Light (30-39g)',
    actuationRange: [30, 39],
    sound: {
      descriptors: ['quick', 'snappy', 'responsive', 'light'],
      frequency: 'high',
      resonance: 'resonant',
      volume: 'moderate'
    },
    feel: {
      descriptors: ['feather-light', 'effortless', 'hair-trigger', 'sensitive'],
      texture: 'smooth',
      firmness: 'soft',
      characteristics: [
        'minimal finger pressure',
        'high sensitivity',
        'quick return',
        'prone to accidental presses'
      ]
    },
    useCases: ['competitive gaming', 'speed typing', 'users with RSI', 'light touch preference'],
    fatigueLevel: 'low',
    typingSpeed: 'very-fast',
    enthusiastTerms: ['feather touch', 'hair trigger', 'lightning fast', 'whisper light']
  },

  light: {
    range: 'Light (40-49g)',
    actuationRange: [40, 49],
    sound: {
      descriptors: ['responsive', 'quick', 'snappy', 'agile'],
      frequency: 'medium',
      resonance: 'neutral',
      volume: 'moderate'
    },
    feel: {
      descriptors: ['light', 'responsive', 'agile', 'comfortable'],
      texture: 'smooth',
      firmness: 'soft',
      characteristics: [
        'easy actuation',
        'quick response',
        'comfortable for long sessions',
        'slight accidental press risk'
      ]
    },
    useCases: ['gaming', 'programming', 'extended typing', 'fast typists'],
    fatigueLevel: 'low',
    typingSpeed: 'fast',
    enthusiastTerms: ['nimble', 'responsive', 'comfortable', 'effortless']
  },

  medium: {
    range: 'Medium (50-59g)',
    actuationRange: [50, 59],
    sound: {
      descriptors: ['balanced', 'controlled', 'measured', 'reliable'],
      frequency: 'medium',
      resonance: 'neutral',
      volume: 'moderate'
    },
    feel: {
      descriptors: ['balanced', 'controlled', 'reliable', 'versatile'],
      texture: 'smooth',
      firmness: 'medium',
      characteristics: [
        'balanced actuation force',
        'good for mixed use',
        'reduced accidental presses',
        'versatile weight'
      ]
    },
    useCases: [
      'mixed gaming and typing',
      'office work',
      'general use',
      'first mechanical keyboard'
    ],
    fatigueLevel: 'medium',
    typingSpeed: 'moderate',
    enthusiastTerms: ['balanced', 'all-rounder', 'reliable', 'versatile']
  },

  mediumHeavy: {
    range: 'Medium Heavy (60-69g)',
    actuationRange: [60, 69],
    sound: {
      descriptors: ['substantial', 'controlled', 'deliberate', 'firm'],
      frequency: 'medium',
      resonance: 'neutral',
      volume: 'moderate'
    },
    feel: {
      descriptors: ['substantial', 'deliberate', 'confident', 'controlled'],
      texture: 'smooth',
      firmness: 'firm',
      characteristics: ['deliberate actuation', 'reduced typos', 'confident feel', 'good feedback']
    },
    useCases: ['typing focus', 'writing', 'accuracy-critical work', 'deliberate typists'],
    fatigueLevel: 'medium',
    typingSpeed: 'moderate',
    enthusiastTerms: ['deliberate', 'confident', 'substantial', 'purposeful']
  },

  heavy: {
    range: 'Heavy (70-84g)',
    actuationRange: [70, 84],
    sound: {
      descriptors: ['authoritative', 'solid', 'weighty', 'substantial'],
      frequency: 'low',
      resonance: 'dampened',
      volume: 'moderate'
    },
    feel: {
      descriptors: ['heavy', 'authoritative', 'solid', 'deliberate'],
      texture: 'smooth',
      firmness: 'firm',
      characteristics: [
        'requires deliberate pressure',
        'eliminates accidental presses',
        'strong feedback',
        'typing precision'
      ]
    },
    useCases: ['heavy typists', 'precision work', 'reduced fatigue preference', 'strong fingers'],
    fatigueLevel: 'high',
    typingSpeed: 'deliberate',
    enthusiastTerms: ['authoritative', 'solid', 'weighty', 'no-nonsense']
  },

  extraHeavy: {
    range: 'Extra Heavy (85g+)',
    actuationRange: [85, 120],
    sound: {
      descriptors: ['massive', 'tank-like', 'commanding', 'forceful'],
      frequency: 'low',
      resonance: 'dampened',
      volume: 'loud'
    },
    feel: {
      descriptors: ['massive', 'commanding', 'forceful', 'unyielding'],
      texture: 'smooth',
      firmness: 'firm',
      characteristics: [
        'requires significant force',
        'ultimate precision',
        'eliminates all accidents',
        'strong finger requirement'
      ]
    },
    useCases: [
      'specialized applications',
      'enthusiast preference',
      'ultimate precision',
      'specific user preference'
    ],
    fatigueLevel: 'high',
    typingSpeed: 'deliberate',
    enthusiastTerms: ['tank-like', 'commanding', 'beast mode', 'iron fingers']
  }
};

export const SWITCH_CHARACTERISTICS: Record<string, CharacteristicDefinition> = {
  smooth: {
    primaryName: 'smooth',
    synonyms: ['linear', 'buttery', 'silky', 'fluid', 'flowing', 'seamless'],
    variations: ['smoothness', 'smooth feel', 'smooth action', 'smooth linear'],
    commonTypos: ['smoth', 'smoooth', 'smouth', 'smoof'],
    databaseMappingStrategy: 'hybrid',
    databaseConditions: {
      typeConditions: ['linear'],
      materialConditions: {
        stem: ['pom', 'pok', 'uhmwpe'],
        housing: ['pom']
      },
      nameConditions: ['oil', 'smooth', 'cream', 'silk', 'butter']
    },
    description: 'Switches with minimal friction and consistent travel throughout the keystroke',
    materialScience: [
      'POM stems for self-lubrication',
      'Factory lubrication',
      'Precision molding',
      'Low friction materials'
    ],
    soundProfile: ['muted', 'consistent', 'soft impact'],
    feelProfile: ['effortless', 'consistent', 'no scratch', 'uniform resistance']
  },

  creamy: {
    primaryName: 'creamy',
    synonyms: ['buttery', 'smooth', 'luxurious', 'rich', 'velvety'],
    variations: ['cream', 'creamy feel', 'creamy smooth', 'butter-like'],
    commonTypos: ['creemy', 'cremy', 'craemy', 'creami'],
    databaseMappingStrategy: 'material_based',
    databaseConditions: {
      materialConditions: {
        stem: ['pom', 'pok'],
        housing: ['pom']
      },
      typeConditions: ['linear'],
      forceConditions: {
        operator: 'BETWEEN',
        values: [45, 60]
      },
      nameConditions: ['cream', 'oil', 'butter']
    },
    description: 'Ultra-smooth switches with a luxurious, effortless feel',
    materialScience: [
      'POM-on-POM contact surfaces',
      'Factory lubrication',
      'Precision tolerances',
      'Self-lubricating materials'
    ],
    soundProfile: ['soft', 'muted', 'refined', 'whisper-quiet'],
    feelProfile: ['effortless', 'luxurious', 'flowing', 'no resistance']
  },

  clicky: {
    primaryName: 'clicky',
    synonyms: ['clicking', 'audible', 'loud', 'tactile-audible'],
    variations: ['click', 'clicky feel', 'audible click', 'clicking sound'],
    commonTypos: ['clickey', 'clicky', 'clikey', 'clickly'],
    databaseMappingStrategy: 'type_based',
    databaseConditions: {
      typeConditions: ['clicky'],
      nameConditions: ['blue', 'green', 'click', 'loud']
    },
    description: 'Switches with both tactile bump and audible click sound',
    materialScience: [
      'Click jacket mechanism',
      'Metal contact points',
      'Spring-loaded click bar',
      'Resonant housing materials'
    ],
    soundProfile: ['sharp', 'loud', 'distinctive', 'crisp'],
    feelProfile: ['tactile bump', 'distinct feedback', 'audible confirmation']
  },

  tactile: {
    primaryName: 'tactile',
    synonyms: ['bumpy', 'feedback', 'responsive', 'non-linear'],
    variations: ['tactile bump', 'tactile feel', 'tactile feedback', 'bump'],
    commonTypos: ['tactyle', 'tactil', 'tactiele', 'tactle'],
    databaseMappingStrategy: 'type_based',
    databaseConditions: {
      typeConditions: ['tactile'],
      nameConditions: ['brown', 'clear', 'bump', 'tactile']
    },
    description: 'Switches with a noticeable bump during actuation for tactile feedback',
    materialScience: [
      'Leaf spring design',
      'Tactile bump geometry',
      'Spring curve engineering',
      'Contact point design'
    ],
    soundProfile: ['moderate', 'controlled', 'feedback sound'],
    feelProfile: ['distinct bump', 'tactile feedback', 'confirmation feel']
  },

  silent: {
    primaryName: 'silent',
    synonyms: ['quiet', 'dampened', 'muted', 'silenced'],
    variations: ['silent operation', 'quiet typing', 'dampened sound', 'silenced switches'],
    commonTypos: ['slient', 'silet', 'silant', 'queit'],
    databaseMappingStrategy: 'name_based',
    databaseConditions: {
      nameConditions: ['silent', 'quiet', 'dampened'],
      typeConditions: ['silent', 'quiet']
    },
    description: 'Switches designed with dampening mechanisms for quiet operation',
    materialScience: [
      'Rubber dampeners',
      'Sound absorption materials',
      'Cushioned bottom-out',
      'Dampened return'
    ],
    soundProfile: ['whisper quiet', 'muted', 'dampened', 'office-friendly'],
    feelProfile: ['cushioned', 'soft landing', 'dampened return']
  },

  thocky: {
    primaryName: 'thocky',
    synonyms: ['deep', 'full', 'rich', 'resonant', 'bassy'],
    variations: ['thock', 'thocky sound', 'deep sound', 'full sound'],
    commonTypos: ['thockey', 'thoky', 'thocki', 'thoccy'],
    databaseMappingStrategy: 'material_based',
    databaseConditions: {
      materialConditions: {
        housing: ['nylon', 'pom']
      },
      forceConditions: {
        operator: '>',
        values: [55]
      }
    },
    description: 'Switches with deep, full, satisfying sound profile',
    materialScience: [
      'Nylon housing for sound dampening',
      'POM materials',
      'Heavy springs',
      'Sound chamber design'
    ],
    soundProfile: ['deep', 'full', 'rich', 'satisfying'],
    feelProfile: ['substantial', 'solid', 'satisfying']
  },

  crisp: {
    primaryName: 'crisp',
    synonyms: ['clacky', 'sharp', 'bright', 'clear', 'defined'],
    variations: ['crisp sound', 'clacky feel', 'sharp sound', 'bright sound'],
    commonTypos: ['crysp', 'crispy', 'crips', 'claky'],
    databaseMappingStrategy: 'material_based',
    databaseConditions: {
      materialConditions: {
        housing: ['pc', 'polycarbonate']
      },
      typeConditions: ['clicky', 'linear']
    },
    description: 'Switches with bright, sharp, well-defined sound',
    materialScience: [
      'Polycarbonate housing',
      'Hard materials',
      'Resonant design',
      'Clear sound transmission'
    ],
    soundProfile: ['bright', 'sharp', 'clear', 'defined'],
    feelProfile: ['responsive', 'defined', 'precise']
  },

  heavy: {
    primaryName: 'heavy',
    synonyms: ['stiff', 'firm', 'strong', 'resistant', 'weighted'],
    variations: ['heavy spring', 'heavy weight', 'high force', 'stiff actuation'],
    commonTypos: ['hevy', 'haevy', 'heavey', 'heafy'],
    databaseMappingStrategy: 'force_based',
    databaseConditions: {
      forceConditions: {
        operator: '>',
        values: [60]
      }
    },
    description: 'Switches requiring higher actuation force for deliberate typing',
    materialScience: ['Heavy springs', 'High spring tension', 'Deliberate actuation design'],
    soundProfile: ['authoritative', 'solid', 'substantial'],
    feelProfile: ['deliberate', 'firm', 'resistant', 'controlled']
  },

  light: {
    primaryName: 'light',
    synonyms: ['soft', 'easy', 'gentle', 'responsive', 'quick'],
    variations: ['light touch', 'light actuation', 'low force', 'easy press'],
    commonTypos: ['lite', 'ligt', 'ligth', 'lihgt'],
    databaseMappingStrategy: 'force_based',
    databaseConditions: {
      forceConditions: {
        operator: '<',
        values: [50]
      }
    },
    description: 'Switches with low actuation force for quick, effortless typing',
    materialScience: ['Light springs', 'Low spring tension', 'Quick actuation design'],
    soundProfile: ['quick', 'responsive', 'light'],
    feelProfile: ['effortless', 'quick', 'sensitive', 'responsive']
  }
};

export const USE_CASE_PREFERENCES = {
  gaming: {
    preferredSpringWeights: ['ultraLight', 'light'],
    preferredSounds: ['responsive', 'quick', 'snappy'],
    keyFactors: ['actuation speed', 'consistency', 'fatigue resistance']
  },
  typing: {
    preferredSpringWeights: ['medium', 'mediumHeavy'],
    preferredSounds: ['satisfying', 'controlled', 'pleasant'],
    keyFactors: ['typing rhythm', 'finger comfort', 'sound profile']
  },
  office: {
    preferredSpringWeights: ['light', 'medium'],
    preferredSounds: ['quiet', 'muted', 'professional'],
    keyFactors: ['noise level', 'professionalism', 'comfort']
  },
  programming: {
    preferredSpringWeights: ['light', 'medium', 'mediumHeavy'],
    preferredSounds: ['satisfying', 'consistent', 'comfortable'],
    keyFactors: ['extended use comfort', 'precision', 'tactile feedback']
  }
} as const;

export const MATERIAL_TERMS = {
  polycarbonate: {
    primary: 'polycarbonate',
    aliases: ['pc', 'poly', 'polycarb'],
    variations: ['polycarbonate housing', 'pc housing', 'clear housing'],
    commonTypos: ['polycarbonite', 'polycarbon', 'polycarbonyte', 'polcarb', 'polycarbinate']
  },
  nylon: {
    primary: 'nylon',
    aliases: ['pa', 'pa66', 'polyamide'],
    variations: ['nylon housing', 'nylon material', 'pa housing'],
    commonTypos: ['nylon', 'nylong', 'nylone', 'nilon', 'nyloon']
  },
  pom: {
    primary: 'POM',
    aliases: ['polyoxymethylene', 'delrin', 'acetal'],
    variations: ['pom housing', 'pom material', 'delrin housing'],
    commonTypos: ['pom', 'pom', 'polyoxymethelene', 'polyoxymethilene', 'delerin']
  },
  pa12: {
    primary: 'PA12',
    aliases: ['nylon 12', 'pa-12', 'polyamide 12'],
    variations: ['pa12 housing', 'nylon 12 housing', 'pa-12 material'],
    commonTypos: ['pa12', 'pa-12', 'nylon12', 'nylone 12']
  },
  uhmwpe: {
    primary: 'UHMWPE',
    aliases: ['ultra-high molecular weight polyethylene', 'uhmw', 'ultra high molecular weight pe'],
    variations: ['uhmwpe stem', 'uhmw pe', 'ultra high molecular weight polyethylene'],
    commonTypos: ['uhmwpe', 'uhmw-pe', 'umhwpe', 'uhmwp']
  },
  pok: {
    primary: 'POK',
    aliases: ['polyketone', 'poly ketone'],
    variations: ['pok stem', 'polyketone stem', 'pok material'],
    commonTypos: ['pok', 'polyketone', 'polykeeton', 'polketone']
  },
  ink: {
    primary: 'INK',
    aliases: ['ink blend', 'gateron ink', 'ink material'],
    variations: ['ink housing', 'ink blend housing', 'gateron ink material'],
    commonTypos: ['ink', 'inck', 'inc']
  },
  abs: {
    primary: 'ABS',
    aliases: ['acrylonitrile butadiene styrene', 'abs plastic'],
    variations: ['abs housing', 'abs material', 'abs plastic'],
    commonTypos: ['abs', 'abz', 'acrylonitrile butadine styrene']
  },
  aluminum: {
    primary: 'aluminum',
    aliases: ['aluminium', 'al', 'alu'],
    variations: ['aluminum housing', 'aluminum top', 'alu housing'],
    commonTypos: ['aluminium', 'aluminim', 'aluminun', 'alluminum']
  },
  brass: {
    primary: 'brass',
    aliases: ['brass alloy', 'bronze'],
    variations: ['brass weight', 'brass top', 'brass housing'],
    commonTypos: ['bras', 'brss', 'brash']
  },
  steel: {
    primary: 'steel',
    aliases: ['stainless steel', 'ss'],
    variations: ['steel weight', 'steel top', 'stainless steel'],
    commonTypos: ['steal', 'stell', 'stainles steel']
  },
  copper: {
    primary: 'copper',
    aliases: ['cu', 'copper alloy'],
    variations: ['copper weight', 'copper top', 'copper housing'],
    commonTypos: ['coper', 'coppe', 'cupper']
  }
};

export const CHARACTERISTIC_UNDERSTANDING_PROMPT = `
You are an expert at understanding mechanical keyboard switch characteristics. 
Your job is to analyze user queries and map them to standardized characteristic terms.

Available characteristics and their definitions:
${Object.entries(SWITCH_CHARACTERISTICS)
  .map(
    ([key, def]) =>
      `- ${def.primaryName}: ${def.description}
    Synonyms: ${def.synonyms.join(', ')}
    Common variations: ${def.variations.join(', ')}`
  )
  .join('\n')}

When given a user query, return a JSON object with:
{
  "characteristics": ["characteristic1", "characteristic2"],
  "confidence": 0.8,
  "interpretations": {
    "characteristic1": "explanation of why this maps to this characteristic",
    "characteristic2": "explanation"
  }
}

Handle typos, variations, and synonyms. If unsure, include multiple possibilities with explanations.
`;

/**
 * Get characteristic database conditions for a given characteristic key
 */
export function getCharacteristicDatabaseConditions(
  characteristicKey: string
): CharacteristicDefinition['databaseConditions'] | null {
  const characteristic = SWITCH_CHARACTERISTICS[characteristicKey];
  return characteristic ? characteristic.databaseConditions : null;
}

/**
 * Get all possible terms for a characteristic (primary name, synonyms, variations, typos)
 */
export function getAllCharacteristicTerms(characteristicKey: string): string[] {
  const characteristic = SWITCH_CHARACTERISTICS[characteristicKey];
  if (!characteristic) return [];

  return [
    characteristic.primaryName,
    ...characteristic.synonyms,
    ...characteristic.variations,
    ...characteristic.commonTypos
  ];
}

/**
 * Get all material terms (primary + aliases + variations + typos) for a given material
 */
export function getAllMaterialTerms(materialKey: string): string[] {
  const material = MATERIAL_TERMS[materialKey as keyof typeof MATERIAL_TERMS];
  if (!material) return [];

  return [material.primary, ...material.aliases, ...material.variations, ...material.commonTypos];
}

/**
 * Get all known material terms across all materials
 */
export function getAllKnownMaterialTerms(): string[] {
  const allTerms: string[] = [];

  for (const materialKey of Object.keys(MATERIAL_TERMS)) {
    allTerms.push(...getAllMaterialTerms(materialKey));
  }

  return [...new Set(allTerms)];
}

/**
 * Normalize a material term to its primary form
 */
export function normalizeMaterialTerm(term: string): string | null {
  const lowerTerm = term.toLowerCase().trim();

  for (const [materialKey, material] of Object.entries(MATERIAL_TERMS)) {
    const allTerms = [
      material.primary.toLowerCase(),
      ...material.aliases.map((a) => a.toLowerCase()),
      ...material.variations.map((v) => v.toLowerCase()),
      ...material.commonTypos.map((t) => t.toLowerCase())
    ];

    if (allTerms.includes(lowerTerm)) {
      return material.primary;
    }
  }

  return null;
}
