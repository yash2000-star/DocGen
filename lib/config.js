const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const DEFAULT_CONFIG_PATH = path.join(PROJECT_ROOT, 'docs.json');

/**
 * Loads and validates a docs.json configuration file.
 * 
 * @param {string} [configPath] - Optional path to a specific docs.json file.
 *   If omitted, loads the root template at /docs.json.
 *   Example: loadConfig('./dist/yash2000-star/secrets-app/docs.json')
 * 
 * @returns {object} The parsed and validated configuration object.
 * @throws {Error} If the file is missing, unparseable, or missing required fields.
 */
function loadConfig(configPath) {
  const resolvedPath = configPath 
    ? path.resolve(configPath) 
    : DEFAULT_CONFIG_PATH;

  // --- 1. Check file exists ---
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `[Config Loader] docs.json not found at: ${resolvedPath}\n` +
      `  → If this is a new project, create one by copying the template:\n` +
      `    cp ${DEFAULT_CONFIG_PATH} ${resolvedPath}\n` +
      `  → Or run the build pipeline to auto-generate one.`
    );
  }

  // --- 2. Parse the JSON ---
  let config;
  try {
    const raw = fs.readFileSync(resolvedPath, 'utf8');
    config = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `[Config Loader] Failed to parse docs.json at: ${resolvedPath}\n` +
      `  → Error: ${err.message}\n` +
      `  → Make sure the file contains valid JSON.`
    );
  }

  // --- 3. Validate required fields ---
  const errors = [];

  if (!config.name && config.name !== '') {
    // name can be empty string (template default), but the key must exist
    if (!('name' in config)) {
      errors.push('Missing required field: "name"');
    }
  }

  if (!config.colors || !config.colors.primary) {
    errors.push('Missing required field: "colors.primary"');
  }

  if (!('navigation' in config)) {
    errors.push('Missing required field: "navigation" (can be an empty array [])');
  }

  if (errors.length > 0) {
    throw new Error(
      `[Config Loader] Invalid docs.json at: ${resolvedPath}\n` +
      errors.map(e => `  ✗ ${e}`).join('\n') + '\n' +
      `  → See the template at ${DEFAULT_CONFIG_PATH} for the full schema.`
    );
  }

  return config;
}

module.exports = { loadConfig };
