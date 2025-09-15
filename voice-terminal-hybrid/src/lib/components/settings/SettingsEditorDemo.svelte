<script>
  import SettingsEditor from './SettingsEditor.svelte';
  
  // Mock data for demo
  const mockPresets = [
    {
      id: 'default',
      name: 'Default',
      theme: {
        mode: 'dark',
        preset: 'default',
        global: {
          colors: {
            primary: '#3B82F6',
            secondary: '#8B5CF6',
            success: '#10B981',
            warning: '#F59E0B',
            error: '#EF4444',
            background: '#1F2937',
            surface: '#374151',
            text: '#F9FAFB'
          },
          typography: {
            fontFamily: 'Inter, system-ui',
            fontSize: { base: '16px', scale: 1.25 }
          },
          spacing: { unit: '0.25rem', scale: [1, 2, 3, 4, 6, 8, 12, 16, 24, 32] },
          borders: {
            radius: { none: '0', sm: '0.125rem', md: '0.375rem', lg: '0.5rem', full: '9999px' },
            width: '1px',
            style: 'solid'
          }
        },
        components: {
          terminal: {
            inherit: false,
            background: '#000000',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '14px',
            lineHeight: 1.5,
            padding: '1rem'
          },
          voiceIndicator: {
            inherit: true,
            overrides: {
              activeColor: '#10B981',
              pulseAnimation: '2s ease-in-out infinite'
            }
          }
        }
      }
    },
    {
      id: 'ocean',
      name: 'Ocean',
      theme: {
        mode: 'dark',
        preset: 'ocean',
        global: {
          colors: {
            primary: '#0EA5E9',
            secondary: '#06B6D4',
            success: '#10B981',
            warning: '#F59E0B',
            error: '#EF4444',
            background: '#0F172A',
            surface: '#1E293B',
            text: '#F1F5F9'
          }
        }
      }
    },
    {
      id: 'forest',
      name: 'Forest',
      theme: {
        mode: 'dark',
        preset: 'forest',
        global: {
          colors: {
            primary: '#22C55E',
            secondary: '#84CC16',
            success: '#10B981',
            warning: '#F59E0B',
            error: '#EF4444',
            background: '#0F1419',
            surface: '#1C2128',
            text: '#F0F6FC'
          }
        }
      }
    },
    {
      id: 'sunset',
      name: 'Sunset',
      theme: {
        mode: 'dark',
        preset: 'sunset',
        global: {
          colors: {
            primary: '#F59E0B',
            secondary: '#EF4444',
            success: '#10B981',
            warning: '#F59E0B',
            error: '#EF4444',
            background: '#1C1917',
            surface: '#292524',
            text: '#FAFAF9'
          }
        }
      }
    }
  ];

  let currentTheme = mockPresets[0].theme;
</script>

<div class="demo-container">
  <h1 class="demo-title">Theme Settings Editor - Demo</h1>
  <p class="demo-description">
    This demo showcases the complete Theme Settings Editor UI built with Flowbite-Svelte.
    Try different presets, edit the JSON, and see live preview updates.
  </p>
  
  <div class="editor-container">
    <SettingsEditor
      theme={currentTheme}
      presets={mockPresets}
      readonly={false}
    />
  </div>
</div>

<style>
  .demo-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background-color: var(--theme-background, #1F2937);
    color: var(--theme-text, #F9FAFB);
    font-family: 'Inter, system-ui';
  }

  .demo-title {
    font-size: 2rem;
    font-weight: 700;
    margin: 1rem;
    text-align: center;
    color: var(--theme-primary, #3B82F6);
  }

  .demo-description {
    margin: 0 1rem 1rem;
    text-align: center;
    color: color-mix(in srgb, var(--theme-text, #F9FAFB) 80%, transparent);
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
  }

  .editor-container {
    flex: 1;
    margin: 0 1rem 1rem;
    border-radius: 0.5rem;
    overflow: hidden;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .demo-title {
      font-size: 1.5rem;
      margin: 0.5rem;
    }
    
    .demo-description {
      margin: 0 0.5rem 0.5rem;
      font-size: 0.875rem;
    }
    
    .editor-container {
      margin: 0 0.5rem 0.5rem;
    }
  }
</style>