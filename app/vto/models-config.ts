type ModelPaths = {
  glb: string;
  usdz: string;
};

type ModelsMap = {
  [key: string]: ModelPaths;
};

export const MODELS_CONFIG = {
  earrings: {
    default: {
      glb: '/models/usdz/ring.glb',
      usdz: '/models/usdz/Ring.usdz',
    },
  },
  necklace: {
    'black-panther': {
      glb: '/models/necklace/black-panther.glb',
      usdz: '/models/usdz/Ring.usdz',
    },
    'native-american': {
      glb: '/models/necklace/native-american.glb',
      usdz: '/models/usdz/Ring.usdz',
    },
  },
  rings: {
    default: {
      glb: '/models/usdz/ring.glb',
      usdz: '/models/usdz/Ring.usdz',
    },
  },
  watch: {
    default: {
      glb: '/models/watch/default.glb',
      usdz: '/models/usdz/Ring.usdz',
    },
  },
} as const satisfies Record<string, ModelsMap>;

export type Category = keyof typeof MODELS_CONFIG;
export type ModelName<T extends Category> = keyof typeof MODELS_CONFIG[T];

export function getModelPath(category: Category, modelName?: string): string | null {
  const categoryModels = MODELS_CONFIG[category] as ModelsMap;
  if (!categoryModels) return null;

  if (!modelName) {
    const defaultModel = categoryModels['default'] || Object.values(categoryModels)[0];
    return defaultModel?.glb || null;
  }

  const model = categoryModels[modelName];
  return model?.glb || null;
}

export function getARModelPaths(category: Category, modelName?: string): ModelPaths | null {
  const categoryModels = MODELS_CONFIG[category] as ModelsMap;
  if (!categoryModels) return null;

  if (!modelName) {
    const defaultModel = categoryModels['default'] || Object.values(categoryModels)[0];
    return defaultModel ? { glb: defaultModel.glb, usdz: defaultModel.usdz } : null;
  }

  const model = categoryModels[modelName];
  return model ? { glb: model.glb, usdz: model.usdz } : null;
}

export function getAvailableModels(category: Category): string[] {
  const categoryModels = MODELS_CONFIG[category];
  return categoryModels ? Object.keys(categoryModels) : [];
}
