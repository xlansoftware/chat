import { createOpenAI } from "@ai-sdk/openai";
import { extractReasoningMiddleware, LanguageModel, wrapLanguageModel } from "ai";
import { loadModelConfig } from "./model-store";
import { logger } from './logger';

// Cache for initialized models to avoid recreating them
const modelByName = new Map<string, LanguageModel>();

/**
 * Wraps a language model with reasoning extraction middleware
 * @param model - The base language model to enhance
 * @returns Enhanced model with reasoning capabilities
 */
const enhancedModel = (model: LanguageModel): LanguageModel => {
  return wrapLanguageModel({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: model as any,
    middleware: extractReasoningMiddleware({ tagName: 'think' }),
  });
};

/**
 * Creates and returns the default fallback model
 * @returns Default language model instance
 */
const createDefaultModel = (): LanguageModel => {
  const config = {
    baseURL: 'http://host.docker.internal:1234/v1',
    apiKey: 'whatever',
    modelName: 'auto'
  };

  try {
    const model = enhancedModel(
      createOpenAI({
        baseURL: config.baseURL,
        apiKey: config.apiKey
      }).chat(config.modelName)
    );

    return model;
  } catch (error) {
    logger.error('Failed to create default model', { error });
    throw new Error(`Failed to initialize default model: ${error}`);
  }
};

// Initialize default model
const defaultModel = createDefaultModel();

/**
 * Creates a language model from configuration
 * @param config - Model configuration object
 * @param name - Model name for logging
 * @returns Configured language model instance
 */
const createModelFromConfig = (config: { url: string; "api-key": string; "model-name": string }, name: string): LanguageModel => {
  logger.info('Creating model from config', {
    name,
    url: config.url,
    modelName: config["model-name"],
    hasApiKey: !!config["api-key"]
  });

  try {
    const model = enhancedModel(
      createOpenAI({
        baseURL: config.url,
        apiKey: config["api-key"],
      }).chat(config["model-name"])
    );

    logger.info('Model created successfully', { name });
    return model;
  } catch (error) {
    logger.error('Failed to create model from config', {
      name,
      url: config.url,
      error: error instanceof Error ? error.message : String(error)
    });
    throw new Error(`Failed to create model "${name}": ${error}`);
  }
};

/**
 * Retrieves a language model by name, creating it if necessary
 * Falls back to default model if name is not provided or not found
 * 
 * @param name - Optional model name to retrieve
 * @returns Promise resolving to the requested or default language model
 * 
 * @example
 * const model = await getModel('gpt-4');
 * const defaultModel = await getModel();
 */
export const getModel = async (name?: string | undefined): Promise<LanguageModel> => {
  logger.info('Getting model', { name: name || 'default' });

  // Return default model if no name specified
  if (!name) {
    logger.debug('No model name provided, using default model');
    return defaultModel;
  }

  // Return cached model if available
  if (modelByName.has(name)) {
    logger.debug('Returning cached model', { name });
    return modelByName.get(name)!;
  }

  logger.info('Model not in cache, loading from config', { name });

  try {
    // Load all model configurations
    const modelConfigs = await loadModelConfig();
    logger.debug('Model configurations loaded', {
      count: modelConfigs.length,
      availableModels: modelConfigs.map(c => c.name)
    });

    // Find the requested model configuration
    const config = modelConfigs.find((c) => c.name === name);

    if (!config) {
      logger.warn('Model configuration not found, falling back to default', {
        requestedName: name,
        availableModels: modelConfigs.map(c => c.name)
      });
      return defaultModel;
    }

    logger.info('Model configuration found', {
      name,
      url: config.url,
      modelName: config["model-name"]
    });

    // Create and cache the model
    const result = createModelFromConfig(config, name);
    modelByName.set(name, result);

    logger.info('Model cached for future use', { name, cacheSize: modelByName.size });

    return result;

  } catch (error) {
    logger.error('Error loading model, falling back to default', {
      name,
      error: error instanceof Error ? error.message : String(error)
    });
    return defaultModel;
  }
};

/**
 * Clears the model cache
 * Useful for forcing reload of model configurations
 */
export const clearModelCache = (): void => {
  const previousSize = modelByName.size;
  modelByName.clear();
  logger.info('Model cache cleared', { previousSize });
};

/**
 * Gets the list of currently cached model names
 * @returns Array of cached model names
 */
export const getCachedModelNames = (): string[] => {
  const names = Array.from(modelByName.keys());
  logger.debug('Getting cached model names', { count: names.length, names });
  return names;
};

/**
 * Preloads a model into the cache
 * @param name - Model name to preload
 * @returns Promise resolving to the preloaded model
 */
export const preloadModel = async (name: string): Promise<LanguageModel> => {
  logger.info('Preloading model', { name });
  return getModel(name);
};

/**
 * Load a local model to use for summary and titles
 * @returns Promise resolving to the a model
 */
export const getModelForSummary = async (preferred?: string): Promise<LanguageModel | null> => {
  const modelConfigs = await loadModelConfig();

  const preferredModel = modelConfigs.find((m) => m.name === preferred)
  if (preferredModel && preferredModel["is-local"]) {
    return await getModel(preferred);
  }

  const localModel = modelConfigs.find((m) => m["is-local"]);
  if (!localModel) return null;
  return await getModel(localModel.name);
}