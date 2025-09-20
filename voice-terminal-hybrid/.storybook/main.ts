import type { StorybookConfig } from '@storybook/sveltekit';
import { join, dirname } from 'path';

function getAbsolutePath(value: string): any {
  return dirname(require.resolve(join(value, 'package.json')));
}

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx|svelte)'],
  addons: [
    getAbsolutePath('@storybook/addon-essentials'),
    getAbsolutePath('@storybook/addon-controls'),
    getAbsolutePath('@storybook/addon-docs'),
    getAbsolutePath('@storybook/addon-viewport'),
    getAbsolutePath('@storybook/addon-backgrounds'),
    getAbsolutePath('@storybook/addon-actions'),
    getAbsolutePath('@storybook/addon-a11y'),
    getAbsolutePath('@storybook/addon-svelte-csf')
  ],
  framework: {
    name: getAbsolutePath('@storybook/sveltekit'),
    options: {}
  },
  core: {
    builder: getAbsolutePath('@storybook/builder-vite')
  },
  features: {
    storyStoreV7: true
  },
  typescript: {
    check: false,
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop) => (prop.parent ? !/node_modules/.test(prop.parent.fileName) : true),
    },
  },
  viteFinal: async (config, { configType }) => {
    // Ensure proper handling of Svelte files
    config.plugins = config.plugins || [];
    
    // Handle CSS custom properties and theme variables
    config.css = {
      ...config.css,
      preprocessorOptions: {
        ...config.css?.preprocessorOptions,
        css: {
          ...config.css?.preprocessorOptions?.css,
          charset: false
        }
      }
    };

    // Resolve Svelte and SvelteKit paths
    config.resolve = {
      ...config.resolve,
      alias: {
        ...config.resolve?.alias,
        '$lib': join(process.cwd(), 'src/lib'),
        '$app/environment': join(process.cwd(), '.storybook/mocks.js'),
        '$app/stores': join(process.cwd(), '.storybook/mocks.js'),
        '$app/navigation': join(process.cwd(), '.storybook/mocks.js')
      }
    };

    // Optimize dependencies for better performance
    config.optimizeDeps = {
      ...config.optimizeDeps,
      include: [
        ...(config.optimizeDeps?.include || []),
        'flowbite-svelte'
      ]
    };

    // Handle environment variables for Storybook
    config.define = {
      ...config.define,
      global: 'globalThis'
    };

    return config;
  }
};

export default config;