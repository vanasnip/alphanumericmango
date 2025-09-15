/**
 * Mock data for theme testing scenarios
 */

// Mock component showcase page content
export const mockComponentShowcase = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Component Showcase</title>
    <style>
        /* CSS variables will be injected by theme system */
        :root {
            --theme-primary: #3B82F6;
            --theme-secondary: #8B5CF6;
            --theme-success: #10B981;
            --theme-warning: #F59E0B;
            --theme-error: #EF4444;
            --theme-background: #1F2937;
            --theme-surface: #374151;
            --theme-text: #F9FAFB;
            --theme-font-family: system-ui;
            --theme-font-size: 16px;
            --theme-spacing-unit: 0.25rem;
        }
        
        body {
            background-color: var(--theme-background);
            color: var(--theme-text);
            font-family: var(--theme-font-family);
            font-size: var(--theme-font-size);
            margin: 0;
            padding: 2rem;
        }
        
        .btn {
            padding: 0.5rem 1rem;
            border: 1px solid;
            border-radius: 0.375rem;
            cursor: pointer;
            margin: 0.5rem;
            font-size: inherit;
        }
        
        .btn-primary {
            background-color: var(--theme-primary);
            border-color: var(--theme-primary);
            color: white;
        }
        
        .btn-secondary {
            background-color: var(--theme-secondary);
            border-color: var(--theme-secondary);
            color: white;
        }
        
        .btn-success {
            background-color: var(--theme-success);
            border-color: var(--theme-success);
            color: white;
        }
        
        .btn-warning {
            background-color: var(--theme-warning);
            border-color: var(--theme-warning);
            color: white;
        }
        
        .btn-error {
            background-color: var(--theme-error);
            border-color: var(--theme-error);
            color: white;
        }
        
        .form-control {
            padding: 0.5rem;
            border: 1px solid var(--theme-surface);
            border-radius: 0.375rem;
            background-color: var(--theme-surface);
            color: var(--theme-text);
            margin: 0.5rem;
        }
        
        .form-control:focus {
            outline: 2px solid var(--theme-primary);
            outline-offset: 2px;
        }
        
        .card {
            background-color: var(--theme-surface);
            border-radius: 0.5rem;
            padding: 1rem;
            margin: 1rem;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .navbar {
            background-color: var(--theme-surface);
            padding: 1rem;
            margin-bottom: 2rem;
            border-bottom: 1px solid var(--theme-primary);
        }
        
        .sidebar {
            background-color: var(--theme-surface);
            width: 200px;
            height: 300px;
            padding: 1rem;
            border-radius: 0.5rem;
        }
        
        .alert {
            padding: 1rem;
            border-radius: 0.375rem;
            margin: 0.5rem;
        }
        
        .alert-success {
            background-color: var(--theme-success);
            color: white;
        }
        
        .alert-warning {
            background-color: var(--theme-warning);
            color: white;
        }
        
        .alert-error {
            background-color: var(--theme-error);
            color: white;
        }
        
        .badge {
            display: inline-block;
            padding: 0.25rem 0.5rem;
            border-radius: 0.25rem;
            font-size: 0.875rem;
            background-color: var(--theme-primary);
            color: white;
        }
        
        .progress {
            width: 100%;
            height: 1rem;
            background-color: var(--theme-surface);
            border-radius: 0.5rem;
            overflow: hidden;
        }
        
        .progress-bar {
            height: 100%;
            background-color: var(--theme-primary);
            width: 60%;
        }
        
        .spinner {
            width: 2rem;
            height: 2rem;
            border: 2px solid var(--theme-surface);
            border-top: 2px solid var(--theme-primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .terminal {
            background-color: var(--terminal-background, #000000);
            color: var(--terminal-color, #00FF00);
            font-family: var(--terminal-fontFamily, 'Courier New, monospace');
            padding: 1rem;
            border-radius: 0.5rem;
            min-height: 200px;
        }
        
        .voice-indicator {
            width: 3rem;
            height: 3rem;
            border-radius: 50%;
            background-color: var(--voiceIndicator-activeColor, var(--theme-success));
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
        }
        
        .voice-indicator.active {
            animation: var(--voiceIndicator-pulseAnimation, pulse 2s ease-in-out infinite);
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
    </style>
</head>
<body>
    <div data-testid="components-loaded" style="display: none;">Components Loaded</div>
    
    <nav class="navbar" data-testid="navbar">
        <h1>Component Showcase</h1>
    </nav>
    
    <div style="display: flex; gap: 2rem;">
        <aside class="sidebar" data-testid="sidebar">
            <h3>Navigation</h3>
            <ul>
                <li><a href="#" data-testid="nav-item-active">Active Item</a></li>
                <li><a href="#">Regular Item</a></li>
            </ul>
        </aside>
        
        <main style="flex: 1;">
            <section>
                <h2>Buttons</h2>
                <button class="btn btn-primary" data-testid="button-primary">Primary</button>
                <button class="btn btn-secondary" data-testid="button-secondary">Secondary</button>
                <button class="btn btn-success" data-testid="button-success">Success</button>
                <button class="btn btn-warning" data-testid="button-warning">Warning</button>
                <button class="btn btn-error" data-testid="button-error">Error</button>
                <button class="btn btn-primary" data-testid="theme-test-button">Test Button</button>
            </section>
            
            <section>
                <h2>Form Controls</h2>
                <input type="text" class="form-control" placeholder="Text input" data-testid="input-text">
                <input type="password" class="form-control" placeholder="Password" data-testid="input-password">
                <textarea class="form-control" placeholder="Textarea" data-testid="textarea"></textarea>
                <select class="form-control" data-testid="select">
                    <option>Option 1</option>
                    <option>Option 2</option>
                </select>
                <input type="text" class="form-control" data-testid="theme-test-input" placeholder="Test Input">
                
                <div style="margin: 1rem 0;">
                    <label>
                        <input type="checkbox" data-testid="checkbox"> Checkbox
                    </label>
                </div>
                
                <div style="margin: 1rem 0;">
                    <label>
                        <input type="radio" name="test" data-testid="radio"> Radio
                    </label>
                </div>
                
                <div style="margin: 1rem 0;">
                    <label>
                        <input type="checkbox" role="switch" data-testid="toggle"> Toggle
                    </label>
                </div>
            </section>
            
            <section>
                <h2>Feedback Components</h2>
                <button onclick="showToast('success')" data-testid="show-toast-success">Show Success Toast</button>
                <button onclick="showToast('error')" data-testid="show-toast-error">Show Error Toast</button>
                <button onclick="showModal()" data-testid="show-modal">Show Modal</button>
                
                <div class="alert alert-success" data-testid="alert">
                    This is an alert message
                </div>
            </section>
            
            <section>
                <h2>Data Display</h2>
                <div class="card" data-testid="card">
                    <h3>Card Title</h3>
                    <p>Card content goes here.</p>
                </div>
                
                <span class="badge" data-testid="badge">Badge</span>
                <span class="badge" data-testid="badge-primary">Primary Badge</span>
                
                <table data-testid="table" style="width: 100%; margin: 1rem 0; border-collapse: collapse;">
                    <thead>
                        <tr style="background-color: var(--theme-surface);">
                            <th style="padding: 0.5rem; border: 1px solid var(--theme-primary);">Column 1</th>
                            <th style="padding: 0.5rem; border: 1px solid var(--theme-primary);">Column 2</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="padding: 0.5rem; border: 1px solid var(--theme-surface);">Data 1</td>
                            <td style="padding: 0.5rem; border: 1px solid var(--theme-surface);">Data 2</td>
                        </tr>
                    </tbody>
                </table>
                
                <ul data-testid="list">
                    <li>List item 1</li>
                    <li>List item 2</li>
                    <li>List item 3</li>
                </ul>
            </section>
            
            <section>
                <h2>Indicators</h2>
                <div class="progress" data-testid="progress">
                    <div class="progress-bar"></div>
                </div>
                
                <div class="spinner" data-testid="spinner"></div>
                
                <div style="width: 3rem; height: 3rem; border-radius: 50%; background-color: var(--theme-primary); margin: 1rem 0;" data-testid="avatar"></div>
                
                <div data-testid="rating">
                    ★★★★☆
                </div>
            </section>
            
            <section>
                <h2>Specialized Components</h2>
                <div class="terminal" data-testid="terminal" data-component="terminal">
                    <div>$ welcome to voice terminal</div>
                    <div>$ type your commands here</div>
                    <div class="terminal-cursor">_</div>
                </div>
                
                <div class="voice-indicator active" data-testid="voice-indicator" data-component="voiceIndicator">
                    🎤
                </div>
            </section>
        </main>
    </div>
    
    <!-- Toast container -->
    <div id="toast-container" style="position: fixed; top: 1rem; right: 1rem; z-index: 1000;"></div>
    
    <!-- Modal -->
    <div id="modal-backdrop" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000;">
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--theme-surface); padding: 2rem; border-radius: 0.5rem;" data-testid="modal">
            <h3>Modal Title</h3>
            <p>Modal content goes here.</p>
            <button onclick="hideModal()">Close</button>
        </div>
    </div>
    
    <script>
        // Mock theme store for testing
        window.__themeStore = {
            setTheme: function(theme) {
                // Apply theme to CSS variables
                const root = document.documentElement;
                if (theme.theme?.global?.colors) {
                    Object.entries(theme.theme.global.colors).forEach(([key, value]) => {
                        root.style.setProperty('--theme-' + key, value);
                    });
                }
                
                // Dispatch theme change event
                document.dispatchEvent(new CustomEvent('theme-changed', { detail: theme }));
            },
            
            setPreset: function(preset) {
                const presets = {
                    default: {
                        theme: {
                            global: {
                                colors: {
                                    primary: '#3B82F6',
                                    secondary: '#8B5CF6',
                                    background: '#1F2937',
                                    surface: '#374151',
                                    text: '#F9FAFB'
                                }
                            }
                        }
                    },
                    ocean: {
                        theme: {
                            global: {
                                colors: {
                                    primary: '#0EA5E9',
                                    secondary: '#06B6D4',
                                    background: '#0F172A',
                                    surface: '#1E293B',
                                    text: '#F1F5F9'
                                }
                            }
                        }
                    },
                    forest: {
                        theme: {
                            global: {
                                colors: {
                                    primary: '#16A34A',
                                    secondary: '#059669',
                                    background: '#14532D',
                                    surface: '#166534',
                                    text: '#F0FDF4'
                                }
                            }
                        }
                    }
                };
                
                if (presets[preset]) {
                    this.setTheme(presets[preset]);
                }
            },
            
            getTheme: function() {
                return {
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
                            }
                        },
                        components: {
                            terminal: {
                                inherit: false,
                                background: '#000000',
                                color: '#00FF00'
                            },
                            voiceIndicator: {
                                inherit: true,
                                overrides: {
                                    activeColor: '#10B981'
                                }
                            }
                        }
                    }
                };
            }
        };
        
        // Toast functionality
        function showToast(type) {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = 'alert alert-' + type;
            toast.setAttribute('data-testid', 'toast-' + type);
            toast.textContent = type.charAt(0).toUpperCase() + type.slice(1) + ' message';
            toast.style.marginBottom = '0.5rem';
            
            container.appendChild(toast);
            
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 3000);
        }
        
        // Modal functionality
        function showModal() {
            document.getElementById('modal-backdrop').style.display = 'block';
        }
        
        function hideModal() {
            document.getElementById('modal-backdrop').style.display = 'none';
        }
        
        // Mark components as loaded
        setTimeout(() => {
            document.querySelector('[data-testid="components-loaded"]').style.display = 'block';
        }, 100);
    </script>
</body>
</html>
`;

// Mock theme file contents for file system testing
export const mockThemeFiles = {
	'default-theme.json': JSON.stringify({
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
					fontSize: {
						base: '16px',
						scale: 1.25
					}
				},
				spacing: {
					unit: '0.25rem',
					scale: [1, 2, 3, 4, 6, 8, 12, 16, 24, 32]
				},
				borders: {
					radius: {
						none: '0',
						sm: '0.125rem',
						md: '0.375rem',
						lg: '0.5rem',
						full: '9999px'
					},
					width: '1px',
					style: 'solid'
				}
			},
			components: {
				terminal: {
					inherit: false,
					background: '#000000',
					fontFamily: 'JetBrains Mono, monospace',
					fontSize: '14px'
				}
			}
		}
	}, null, 2),

	'corrupted-theme.json': '{"theme":{"mode":"dark","preset":"default","global":{"colors":{"primary":"#3B82F6"',

	'invalid-theme.json': JSON.stringify({
		theme: {
			mode: 'invalid-mode',
			preset: 'nonexistent',
			global: {
				colors: {
					primary: 'not-a-color',
					background: null
				}
			}
		}
	}, null, 2),

	'empty-theme.json': '{}',

	'large-theme.json': JSON.stringify({
		theme: {
			mode: 'dark',
			preset: 'custom',
			global: {
				colors: Object.fromEntries(
					Array.from({ length: 1000 }, (_, i) => [`color${i}`, `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`])
				),
				typography: {
					fontFamily: 'system-ui',
					fontSize: {
						base: '16px',
						scale: 1.25
					}
				},
				spacing: {
					unit: '0.25rem',
					scale: Array.from({ length: 100 }, (_, i) => i + 1)
				},
				borders: {
					radius: {
						none: '0',
						sm: '0.125rem',
						md: '0.375rem',
						lg: '0.5rem',
						full: '9999px'
					},
					width: '1px',
					style: 'solid'
				}
			},
			components: Object.fromEntries(
				Array.from({ length: 100 }, (_, i) => [`component${i}`, {
					inherit: i % 2 === 0,
					overrides: {
						color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`
					}
				}])
			)
		}
	}, null, 2)
};

// Performance test configurations
export const performanceTestConfigs = {
	rapid_switching: {
		themes: ['default', 'ocean', 'forest'],
		iterations: 100,
		delay: 10
	},
	
	stress_test: {
		themes: ['default', 'ocean', 'forest', 'custom'],
		iterations: 1000,
		delay: 1
	},
	
	memory_test: {
		themes: ['default', 'ocean'],
		iterations: 500,
		delay: 5,
		measureMemory: true
	}
};

// Accessibility test scenarios
export const accessibilityTestScenarios = {
	contrast_validation: [
		{ background: '#000000', text: '#FFFFFF', expected: 21 },
		{ background: '#FFFFFF', text: '#000000', expected: 21 },
		{ background: '#3B82F6', text: '#FFFFFF', expected: 4.5 },
		{ background: '#555555', text: '#FFFFFF', expected: 3.1 },
		{ background: '#888888', text: '#000000', expected: 2.8 }
	],
	
	keyboard_navigation: [
		'button',
		'input[type="text"]',
		'input[type="password"]',
		'textarea',
		'select',
		'a[href]',
		'[tabindex="0"]'
	],
	
	screen_reader_content: [
		{ selector: 'button', requiredAttributes: ['aria-label', 'aria-describedby'] },
		{ selector: 'input', requiredAttributes: ['aria-label', 'aria-describedby'] },
		{ selector: '[role="button"]', requiredAttributes: ['aria-label'] }
	]
};

// Browser compatibility test matrix
export const browserCompatibilityMatrix = {
	features: [
		{
			name: 'CSS Custom Properties',
			test: () => CSS.supports('color', 'var(--test)')
		},
		{
			name: 'CSS Grid',
			test: () => CSS.supports('display', 'grid')
		},
		{
			name: 'CSS Flexbox',
			test: () => CSS.supports('display', 'flex')
		},
		{
			name: 'localStorage',
			test: () => typeof Storage !== 'undefined'
		},
		{
			name: 'Performance API',
			test: () => 'performance' in window
		}
	],
	
	fallbacks: {
		'CSS Custom Properties': {
			primary: '#3B82F6',
			secondary: '#8B5CF6',
			background: '#1F2937',
			text: '#F9FAFB'
		}
	}
};