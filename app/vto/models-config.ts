export const MODELS_CONFIG = {
  earrings: {
    default: '/models/earrings/default.glb',
  },
  necklace: {
    'black-panther': '/models/necklace/black-panther.glb',
    'native-american': '/models/necklace/native-american.glb',
  },
  rings: {
    default: '/models/rings/default.glb',
  },
  watch: {
    default: '/models/watch/default.glb',
  },
} as const;

export type Category = keyof typeof MODELS_CONFIG;
export type ModelName<T extends Category> = keyof typeof MODELS_CONFIG[T];

export function getModelPath(category: Category, modelName?: string): string | null {
  const categoryModels = MODELS_CONFIG[category];
  if (!categoryModels) return null;

  // If no model specified, use 'default' if available, otherwise first model
  if (!modelName) {
    return categoryModels['default' as keyof typeof categoryModels]
      || Object.values(categoryModels)[0] as string;
  }

  // Validate model name
  const modelPath = categoryModels[modelName as keyof typeof categoryModels];
  return modelPath ? String(modelPath) : null;
}

export function getAvailableModels(category: Category): string[] {
  const categoryModels = MODELS_CONFIG[category];
  return categoryModels ? Object.keys(categoryModels) : [];
}
