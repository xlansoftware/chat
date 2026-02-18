import YAML from 'yaml';

import { ensureFolderExists, File, rootConfigPath } from "./store-tools";
import path from 'node:path';
import { ModelConfig } from '@/types/model-config';
import { logger } from './logger';

// Example content for /data-store/models.yaml
const exampleConfig = `# Model Configuration
# Define your AI models here
#
# models:
#   - name: default
#     url: http://host.docker.internal:1234/v1
#     api-key: 'none'
#     model-name: auto
#     is-local: true
#   - name: gpt-4
#     url: https://api.openai.com/v1
#     api-key: $OPENAI_API_KEY
#     model-name: gpt-4
`;

const defaultModelConfig: ModelConfig = {
  name: 'default',
  url: 'http://host.docker.internal:1234/v1',
  "api-key": 'none',
  "model-name": 'auto',
  "is-local": true,
};

/**
 * Reads an API key, resolving environment variables if needed
 * @param apiKey - The API key or environment variable reference (e.g., "$OPENAI_API_KEY")
 * @returns The resolved API key value
 */
const readApiKey = (apiKey: string | undefined): string => {
  if (!apiKey) {
    logger.debug('API key not provided');
    return "";
  }

  const trimmedKey = apiKey.trim();

  if (trimmedKey.startsWith("$")) {
    const envKey = trimmedKey.substring(1);
    const result = process.env[envKey];

    if (!result) {
      logger.error(`Missing environment variable`, { envKey });
      throw new Error(`Environment variable ${envKey} is not defined`);
    }

    logger.debug(`Resolved API key from environment variable`, { envKey });
    return result;
  }

  logger.debug(`Using literal API key`);
  return apiKey;
};

/**
 * Validates a model configuration object
 * @param mc - Partial model configuration to validate
 * @param index - Index of the model in the array (for logging)
 * @returns Valid ModelConfig or null if invalid
 */
const validateAndParseModel = (mc: Partial<ModelConfig>, index: number): ModelConfig | null => {
  logger.debug(`Parsing model entry`, { index, name: mc.name || mc['model-name'] });

  if (!mc.url || typeof mc.url !== 'string' || !mc.url.trim()) {
    logger.warn(`Model skipped: missing or invalid url`, { index, mc });
    return null;
  }

  try {
    const apiKeyResolved = readApiKey(mc['api-key']);

    const resolved: ModelConfig = {
      name: mc.name || mc['model-name'] || mc.url,
      "model-name": mc['model-name'] || mc.name || "auto",
      "api-key": apiKeyResolved,
      "is-local": mc['is-local'],
      url: mc.url.trim()
    };

    logger.debug(`Model loaded`, { name: resolved.name, url: resolved.url });
    return resolved;

  } catch (e) {
    logger.warn(`Model skipped`, { index, name: mc.name || mc['model-name'] || mc.url });
    return null;
  }
};

/**
 * Loads model configurations from YAML file
 * @param configFileName - Optional path to config file (defaults to models.yaml in rootStorePath)
 * @returns Array of valid model configurations
 */
export async function loadModelConfig(
  configFileName?: string
): Promise<readonly ModelConfig[]> {

  configFileName = configFileName || path.join(rootConfigPath, "models.yaml");
  logger.info(`Loading model config`, { path: configFileName });

  // Ensure the directory exists
  await ensureFolderExists(path.dirname(configFileName));

  // Create template if file doesn't exist
  if (!(await File.exists(configFileName))) {
    logger.warn(`models.yaml not found, creating template`, { path: configFileName });
    await File.writeAllText(configFileName, exampleConfig);
    logger.debug(`Template models.yaml created, using default model`);
    return [defaultModelConfig];
  }

  try {
    const content = await File.readAllText(configFileName);

    if (!content.trim()) {
      logger.warn('Configuration file is empty, using default model');
      return [defaultModelConfig];
    }

    logger.debug(`models.yaml content loaded`);

    const config = YAML.parse(content);

    // Validate config structure
    if (!config || typeof config !== 'object') {
      throw new Error('Invalid config format: expected object');
    }

    if (!Array.isArray(config.models)) {
      logger.warn('Invalid config format: "models" array is missing, using default model');
      return [defaultModelConfig];
    }

    if (config.models.length === 0) {
      logger.warn('No models defined in config, using default model');
      return [defaultModelConfig];
    }

    logger.debug(`Models found in config`, { count: config.models.length });

    // Parse and validate each model
    const result: ModelConfig[] = config.models
      .map(validateAndParseModel)
      .filter((model: unknown): model is ModelConfig => model !== null);

    if (result.length > 0) {
      logger.info(`Model configuration loaded successfully`, {
        count: result.length,
        models: result.map(m => m.name),
      });
      return result;
    }

    logger.warn(`No valid models found after parsing, falling back to default`);

  } catch (error) {
    logger.error(`Failed to load model config`, {
      path: configFileName,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  logger.debug(`Using default model config`);
  return [defaultModelConfig];
}