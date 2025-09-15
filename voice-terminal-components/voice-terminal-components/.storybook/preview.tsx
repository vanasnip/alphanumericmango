import type { Preview } from '@storybook/react';
import React from 'react';
import '../src/styles/globals.css';

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'paper-light',
      values: [
        {
          name: 'paper-light',
          value: '#EFF2F9',
        },
        {
          name: 'paper-dark',
          value: '#1A1B1E',
        },
      ],
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme || 'light';
      return (
        <div data-theme={`paper-${theme}`} style={{ padding: '2rem' }}>
          <Story />
        </div>
      );
    },
  ],
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Global theme for components',
      defaultValue: 'light',
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'light', title: 'Light (Paper)' },
          { value: 'dark', title: 'Dark (Midnight Paper)' },
        ],
        showName: true,
      },
    },
  },
};

export default preview;