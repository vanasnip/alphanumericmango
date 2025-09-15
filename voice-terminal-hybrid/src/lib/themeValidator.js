/**
 * Theme validation system with JSON Schema and error reporting
 */

// Theme validation schema
const THEME_SCHEMA = {
  type: 'object',
  required: ['mode', 'preset', 'global', 'components'],
  properties: {
    mode: {
      type: 'string',
      enum: ['light', 'dark', 'auto']
    },
    preset: {
      type: 'string',
      enum: ['default', 'ocean', 'forest', 'custom']
    },
    global: {
      type: 'object',
      required: ['colors', 'typography', 'spacing', 'borders'],
      properties: {
        colors: {
          type: 'object',
          required: ['primary', 'secondary', 'success', 'warning', 'error', 'background', 'surface', 'text'],
          properties: {
            primary: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
            secondary: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
            success: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
            warning: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
            error: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
            background: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
            surface: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
            text: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' }
          },
          additionalProperties: { type: 'string' }
        },
        typography: {
          type: 'object',
          required: ['fontFamily', 'fontSize'],
          properties: {
            fontFamily: { type: 'string', minLength: 1 },
            fontSize: {
              type: 'object',
              required: ['base', 'scale'],
              properties: {
                base: { type: 'string', pattern: '^[0-9]+px$' },
                scale: { type: 'number', minimum: 1.0, maximum: 2.0 }
              }
            }
          }
        },
        spacing: {
          type: 'object',
          required: ['unit', 'scale'],
          properties: {
            unit: { type: 'string', pattern: '^[0-9.]+rem$' },
            scale: {
              type: 'array',
              items: { type: 'number', minimum: 0 },
              minItems: 1
            }
          }
        },
        borders: {
          type: 'object',
          required: ['radius', 'width', 'style'],
          properties: {
            radius: {
              type: 'object',
              properties: {
                none: { type: 'string' },
                sm: { type: 'string' },
                md: { type: 'string' },
                lg: { type: 'string' },
                full: { type: 'string' }
              }
            },
            width: { type: 'string' },
            style: { type: 'string', enum: ['solid', 'dashed', 'dotted', 'none'] }
          }
        }
      }
    },
    components: {
      type: 'object',
      patternProperties: {
        '^[a-zA-Z][a-zA-Z0-9]*$': {
          type: 'object',
          properties: {
            inherit: { type: 'boolean' },
            overrides: { type: 'object' }
          },
          additionalProperties: true
        }
      }
    }
  }
};

/**
 * Validation error class
 */
export class ThemeValidationError extends Error {
  constructor(message, path = '', value = null) {
    super(message);
    this.name = 'ThemeValidationError';
    this.path = path;
    this.value = value;
  }
}

/**
 * Simple JSON Schema validator
 * @param {any} data - Data to validate
 * @param {object} schema - JSON Schema object
 * @param {string} path - Current path in the data (for error reporting)
 * @returns {array} Array of validation errors
 */
function validateSchema(data, schema, path = '') {
  const errors = [];
  
  // Type validation
  if (schema.type) {
    const dataType = Array.isArray(data) ? 'array' : typeof data;
    if (dataType !== schema.type) {
      errors.push(new ThemeValidationError(
        `Expected ${schema.type} but got ${dataType}`,
        path,
        data
      ));
      return errors; // Early return for type mismatch
    }
  }
  
  // Enum validation
  if (schema.enum && !schema.enum.includes(data)) {
    errors.push(new ThemeValidationError(
      `Value must be one of: ${schema.enum.join(', ')}`,
      path,
      data
    ));
  }
  
  // Pattern validation for strings
  if (schema.pattern && typeof data === 'string') {
    const regex = new RegExp(schema.pattern);
    if (!regex.test(data)) {
      errors.push(new ThemeValidationError(
        `Value does not match pattern: ${schema.pattern}`,
        path,
        data
      ));
    }
  }
  
  // Number validation
  if (typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push(new ThemeValidationError(
        `Value must be >= ${schema.minimum}`,
        path,
        data
      ));
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push(new ThemeValidationError(
        `Value must be <= ${schema.maximum}`,
        path,
        data
      ));
    }
  }
  
  // String validation
  if (typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push(new ThemeValidationError(
        `String must be at least ${schema.minLength} characters`,
        path,
        data
      ));
    }
    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      errors.push(new ThemeValidationError(
        `String must be at most ${schema.maxLength} characters`,
        path,
        data
      ));
    }
  }
  
  // Array validation
  if (Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      errors.push(new ThemeValidationError(
        `Array must have at least ${schema.minItems} items`,
        path,
        data
      ));
    }
    if (schema.maxItems !== undefined && data.length > schema.maxItems) {
      errors.push(new ThemeValidationError(
        `Array must have at most ${schema.maxItems} items`,
        path,
        data
      ));
    }
    
    // Validate array items
    if (schema.items) {
      data.forEach((item, index) => {
        errors.push(...validateSchema(item, schema.items, `${path}[${index}]`));
      });
    }
  }
  
  // Object validation
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    // Required properties
    if (schema.required) {
      schema.required.forEach(prop => {
        if (!(prop in data)) {
          errors.push(new ThemeValidationError(
            `Required property '${prop}' is missing`,
            path,
            data
          ));
        }
      });
    }
    
    // Properties validation
    if (schema.properties) {
      Object.keys(schema.properties).forEach(prop => {
        if (prop in data) {
          errors.push(...validateSchema(
            data[prop],
            schema.properties[prop],
            path ? `${path}.${prop}` : prop
          ));
        }
      });
    }
    
    // Pattern properties validation
    if (schema.patternProperties) {
      Object.keys(data).forEach(prop => {
        Object.keys(schema.patternProperties).forEach(pattern => {
          const regex = new RegExp(pattern);
          if (regex.test(prop)) {
            errors.push(...validateSchema(
              data[prop],
              schema.patternProperties[pattern],
              path ? `${path}.${prop}` : prop
            ));
          }
        });
      });
    }
  }
  
  return errors;
}

/**
 * Validate theme configuration
 * @param {object} theme - Theme configuration to validate
 * @returns {object} Validation result with isValid flag and errors array
 */
export function validateTheme(theme) {
  const errors = validateSchema(theme, THEME_SCHEMA);
  
  return {
    isValid: errors.length === 0,
    errors: errors,
    errorCount: errors.length
  };
}

/**
 * Validate partial theme (for incremental updates)
 * @param {object} partialTheme - Partial theme configuration
 * @param {object} baseTheme - Base theme to merge with
 * @returns {object} Validation result
 */
export function validatePartialTheme(partialTheme, baseTheme) {
  // Merge partial theme with base theme
  const mergedTheme = mergeDeep(baseTheme, partialTheme);
  return validateTheme(mergedTheme);
}

/**
 * Deep merge two objects
 * @param {object} target - Target object
 * @param {object} source - Source object
 * @returns {object} Merged object
 */
function mergeDeep(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = mergeDeep(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

/**
 * Validate color value
 * @param {string} color - Color value to validate
 * @returns {boolean} Whether the color is valid
 */
export function validateColor(color) {
  if (typeof color !== 'string') return false;
  
  // Hex color validation
  const hexPattern = /^#[0-9A-Fa-f]{6}$/;
  if (hexPattern.test(color)) return true;
  
  // RGB/RGBA validation
  const rgbPattern = /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[0-9.]+\s*)?\)$/;
  if (rgbPattern.test(color)) return true;
  
  // HSL/HSLA validation
  const hslPattern = /^hsla?\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*(?:,\s*[0-9.]+\s*)?\)$/;
  if (hslPattern.test(color)) return true;
  
  // CSS named colors (basic set)
  const namedColors = [
    'transparent', 'currentColor', 'inherit', 'initial', 'unset',
    'black', 'white', 'red', 'green', 'blue', 'yellow', 'cyan', 'magenta'
  ];
  if (namedColors.includes(color.toLowerCase())) return true;
  
  return false;
}

/**
 * Validate CSS length value
 * @param {string} value - CSS length value
 * @returns {boolean} Whether the value is valid
 */
export function validateCSSLength(value) {
  if (typeof value !== 'string') return false;
  
  const lengthPattern = /^-?[0-9]*\.?[0-9]+(px|em|rem|vh|vw|%|pt|pc|in|cm|mm|ex|ch|vmin|vmax)$/;
  return lengthPattern.test(value) || value === '0';
}

/**
 * Format validation errors for display
 * @param {array} errors - Array of validation errors
 * @returns {string} Formatted error message
 */
export function formatValidationErrors(errors) {
  if (errors.length === 0) return '';
  
  return errors.map(error => `${error.path}: ${error.message}`).join('\n');
}

/**
 * Get validation summary
 * @param {object} validationResult - Result from validateTheme
 * @returns {string} Human-readable summary
 */
export function getValidationSummary(validationResult) {
  if (validationResult.isValid) {
    return 'Theme configuration is valid';
  }
  
  const errorsByType = {};
  validationResult.errors.forEach(error => {
    const type = error.message.split(' ')[0];
    errorsByType[type] = (errorsByType[type] || 0) + 1;
  });
  
  const summary = Object.entries(errorsByType)
    .map(([type, count]) => `${count} ${type.toLowerCase()} error${count > 1 ? 's' : ''}`)
    .join(', ');
  
  return `Found ${validationResult.errorCount} validation error${validationResult.errorCount > 1 ? 's' : ''}: ${summary}`;
}