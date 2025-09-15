/**
 * CSS Variable Generator for theme system
 * Converts JSON theme configuration to CSS custom properties
 */

/**
 * Convert a value to a CSS-compatible string
 * @param {any} value - The value to convert
 * @returns {string} CSS-compatible value
 */
function formatCSSValue(value) {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Convert an object to CSS custom properties with prefix
 * @param {object} obj - Object to convert
 * @param {string} prefix - CSS variable prefix
 * @returns {string} CSS custom properties
 */
function objectToCSSVariables(obj, prefix = '--theme') {
  const variables = [];
  
  function traverse(current, path) {
    for (const [key, value] of Object.entries(current)) {
      const variableName = `${prefix}-${path}${key}`.replace(/([A-Z])/g, '-$1').toLowerCase();
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursively handle nested objects
        traverse(value, `${path}${key}-`);
      } else {
        // Create CSS variable
        variables.push(`  ${variableName}: ${formatCSSValue(value)};`);
      }
    }
  }
  
  traverse(obj, '');
  return variables.join('\n');
}

/**
 * Generate global CSS variables from theme
 * @param {object} theme - Theme configuration object
 * @returns {string} CSS rules for global variables
 */
export function generateGlobalVariables(theme) {
  const globalVars = objectToCSSVariables(theme.global, '--theme');
  const modeVar = `  --theme-mode: ${theme.mode};`;
  const presetVar = `  --theme-preset: ${theme.preset};`;
  
  return `:root {\n${modeVar}\n${presetVar}\n${globalVars}\n}`;
}

/**
 * Generate component-specific CSS variables
 * @param {object} components - Components configuration object
 * @returns {string} CSS rules for component variables
 */
export function generateComponentVariables(components) {
  const rules = [];
  
  for (const [componentName, config] of Object.entries(components)) {
    if (config.inherit) {
      // For inherited components, only generate override variables
      if (config.overrides) {
        const overrideVars = objectToCSSVariables(config.overrides, `--${componentName}`);
        rules.push(`.${componentName} {\n${overrideVars}\n}`);
      }
    } else {
      // For non-inherited components, generate all variables
      const componentVars = objectToCSSVariables(config, `--${componentName}`);
      rules.push(`.${componentName} {\n${componentVars}\n}`);
    }
  }
  
  return rules.join('\n\n');
}

/**
 * Generate complete CSS from theme configuration
 * @param {object} theme - Complete theme configuration
 * @returns {string} Complete CSS with all variables
 */
export function generateThemeCSS(theme) {
  const globalCSS = generateGlobalVariables(theme);
  const componentCSS = generateComponentVariables(theme.components);
  
  return `${globalCSS}\n\n${componentCSS}`;
}

/**
 * Apply CSS variables to the document
 * @param {string} css - CSS string to apply
 * @param {string} id - ID for the style element (default: 'theme-variables')
 */
export function applyCSSVariables(css, id = 'theme-variables') {
  if (typeof document === 'undefined') return;
  
  // Remove existing style element
  const existing = document.getElementById(id);
  if (existing) {
    existing.remove();
  }
  
  // Create new style element
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  
  // Insert into document head
  document.head.appendChild(style);
}

/**
 * Generate Flowbite-compatible CSS variables
 * @param {object} theme - Theme configuration
 * @returns {string} Flowbite-compatible CSS
 */
export function generateFlowbiteVariables(theme) {
  const colors = theme.global.colors;
  const typography = theme.global.typography;
  const spacing = theme.global.spacing;
  const borders = theme.global.borders;
  
  // Map theme colors to Flowbite color scheme
  const flowbiteColors = `
  :root {
    /* Flowbite Primary Colors */
    --primary-50: color-mix(in srgb, ${colors.primary} 10%, white);
    --primary-100: color-mix(in srgb, ${colors.primary} 20%, white);
    --primary-200: color-mix(in srgb, ${colors.primary} 30%, white);
    --primary-300: color-mix(in srgb, ${colors.primary} 40%, white);
    --primary-400: color-mix(in srgb, ${colors.primary} 60%, white);
    --primary-500: ${colors.primary};
    --primary-600: color-mix(in srgb, ${colors.primary} 80%, black);
    --primary-700: color-mix(in srgb, ${colors.primary} 70%, black);
    --primary-800: color-mix(in srgb, ${colors.primary} 60%, black);
    --primary-900: color-mix(in srgb, ${colors.primary} 50%, black);
    
    /* Flowbite Secondary Colors */
    --secondary-50: color-mix(in srgb, ${colors.secondary} 10%, white);
    --secondary-100: color-mix(in srgb, ${colors.secondary} 20%, white);
    --secondary-200: color-mix(in srgb, ${colors.secondary} 30%, white);
    --secondary-300: color-mix(in srgb, ${colors.secondary} 40%, white);
    --secondary-400: color-mix(in srgb, ${colors.secondary} 60%, white);
    --secondary-500: ${colors.secondary};
    --secondary-600: color-mix(in srgb, ${colors.secondary} 80%, black);
    --secondary-700: color-mix(in srgb, ${colors.secondary} 70%, black);
    --secondary-800: color-mix(in srgb, ${colors.secondary} 60%, black);
    --secondary-900: color-mix(in srgb, ${colors.secondary} 50%, black);
    
    /* Status Colors */
    --green-500: ${colors.success};
    --yellow-500: ${colors.warning};
    --red-500: ${colors.error};
    
    /* Gray Scale */
    --gray-50: color-mix(in srgb, ${colors.text} 5%, ${colors.background});
    --gray-100: color-mix(in srgb, ${colors.text} 10%, ${colors.background});
    --gray-200: color-mix(in srgb, ${colors.text} 20%, ${colors.background});
    --gray-300: color-mix(in srgb, ${colors.text} 30%, ${colors.background});
    --gray-400: color-mix(in srgb, ${colors.text} 40%, ${colors.background});
    --gray-500: color-mix(in srgb, ${colors.text} 50%, ${colors.background});
    --gray-600: color-mix(in srgb, ${colors.text} 60%, ${colors.background});
    --gray-700: color-mix(in srgb, ${colors.text} 70%, ${colors.background});
    --gray-800: color-mix(in srgb, ${colors.text} 80%, ${colors.background});
    --gray-900: ${colors.text};
    
    /* Typography */
    --font-family-sans: ${typography.fontFamily};
    --text-base: ${typography.fontSize.base};
    
    /* Spacing */
    --spacing-px: 1px;
    --spacing-0: 0;
    --spacing-1: calc(${spacing.unit} * ${spacing.scale[0]});
    --spacing-2: calc(${spacing.unit} * ${spacing.scale[1]});
    --spacing-3: calc(${spacing.unit} * ${spacing.scale[2]});
    --spacing-4: calc(${spacing.unit} * ${spacing.scale[3]});
    --spacing-6: calc(${spacing.unit} * ${spacing.scale[4]});
    --spacing-8: calc(${spacing.unit} * ${spacing.scale[5]});
    --spacing-12: calc(${spacing.unit} * ${spacing.scale[6]});
    --spacing-16: calc(${spacing.unit} * ${spacing.scale[7]});
    --spacing-24: calc(${spacing.unit} * ${spacing.scale[8]});
    --spacing-32: calc(${spacing.unit} * ${spacing.scale[9]});
    
    /* Border Radius */
    --rounded-none: ${borders.radius.none};
    --rounded-sm: ${borders.radius.sm};
    --rounded: ${borders.radius.md};
    --rounded-lg: ${borders.radius.lg};
    --rounded-full: ${borders.radius.full};
  }`;
  
  return flowbiteColors;
}

/**
 * Create theme CSS update function for stores
 * @param {object} theme - Theme configuration
 */
export function updateThemeCSS(theme) {
  // Generate and apply main theme variables
  const themeCSS = generateThemeCSS(theme);
  applyCSSVariables(themeCSS, 'theme-variables');
  
  // Generate and apply Flowbite-compatible variables
  const flowbiteCSS = generateFlowbiteVariables(theme);
  applyCSSVariables(flowbiteCSS, 'flowbite-variables');
  
  // Update document class for theme mode
  if (typeof document !== 'undefined') {
    document.documentElement.className = document.documentElement.className
      .replace(/theme-\w+/g, '')
      .trim();
    document.documentElement.classList.add(`theme-${theme.mode}`);
  }
}

/**
 * Get current CSS variable value
 * @param {string} variableName - CSS variable name (with or without --)
 * @returns {string} Current value of the CSS variable
 */
export function getCSSVariable(variableName) {
  if (typeof document === 'undefined') return '';
  
  const name = variableName.startsWith('--') ? variableName : `--${variableName}`;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Set CSS variable value
 * @param {string} variableName - CSS variable name (with or without --)
 * @param {string} value - Value to set
 */
export function setCSSVariable(variableName, value) {
  if (typeof document === 'undefined') return;
  
  const name = variableName.startsWith('--') ? variableName : `--${variableName}`;
  document.documentElement.style.setProperty(name, value);
}