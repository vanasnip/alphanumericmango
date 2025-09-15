import type { AppTheme } from '../../src/lib/stores/themeStore';

// Valid theme configurations for testing
export const validThemes: Record<string, AppTheme> = {
	minimal: {
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
					fontFamily: 'system-ui',
					fontSize: {
						base: '16px',
						scale: 1.25
					}
				},
				spacing: {
					unit: '0.25rem',
					scale: [1]
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
			components: {}
		}
	},

	complete: {
		theme: {
			mode: 'light',
			preset: 'ocean',
			global: {
				colors: {
					primary: '#0EA5E9',
					secondary: '#06B6D4',
					success: '#10B981',
					warning: '#F59E0B',
					error: '#EF4444',
					background: '#FFFFFF',
					surface: '#F8FAFC',
					text: '#0F172A'
				},
				typography: {
					fontFamily: 'Inter, system-ui, sans-serif',
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
					background: '#0F172A',
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
				},
				navbar: {
					inherit: true,
					overrides: {
						backgroundColor: '#F8FAFC',
						borderColor: '#E2E8F0'
					}
				}
			}
		}
	},

	highContrast: {
		theme: {
			mode: 'dark',
			preset: 'custom',
			global: {
				colors: {
					primary: '#FFFFFF',
					secondary: '#FFFF00',
					success: '#00FF00',
					warning: '#FFAA00',
					error: '#FF0000',
					background: '#000000',
					surface: '#333333',
					text: '#FFFFFF'
				},
				typography: {
					fontFamily: 'Arial, sans-serif',
					fontSize: {
						base: '18px',
						scale: 1.5
					}
				},
				spacing: {
					unit: '0.5rem',
					scale: [1, 2, 3, 4, 6, 8]
				},
				borders: {
					radius: {
						none: '0',
						sm: '0.25rem',
						md: '0.5rem',
						lg: '1rem',
						full: '9999px'
					},
					width: '2px',
					style: 'solid'
				}
			},
			components: {
				terminal: {
					inherit: false,
					background: '#000000',
					color: '#FFFFFF',
					fontFamily: 'Courier New, monospace',
					fontSize: '16px',
					lineHeight: 1.6
				}
			}
		}
	},

	customBranding: {
		theme: {
			mode: 'light',
			preset: 'custom',
			global: {
				colors: {
					primary: '#6B46C1',
					secondary: '#EC4899',
					success: '#059669',
					warning: '#D97706',
					error: '#DC2626',
					background: '#FAFAF9',
					surface: '#FFFFFF',
					text: '#1C1917'
				},
				typography: {
					fontFamily: 'Poppins, sans-serif',
					fontSize: {
						base: '15px',
						scale: 1.2
					}
				},
				spacing: {
					unit: '0.2rem',
					scale: [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20]
				},
				borders: {
					radius: {
						none: '0',
						sm: '0.2rem',
						md: '0.5rem',
						lg: '0.8rem',
						full: '50rem'
					},
					width: '1.5px',
					style: 'solid'
				}
			},
			components: {
				terminal: {
					inherit: false,
					background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
					color: '#FFFFFF',
					fontFamily: 'Fira Code, monospace',
					fontSize: '13px',
					borderRadius: '0.5rem',
					padding: '1.5rem'
				},
				voiceIndicator: {
					inherit: false,
					backgroundColor: '#6B46C1',
					color: '#FFFFFF',
					borderRadius: '50%',
					animation: 'pulse 1.5s infinite'
				}
			}
		}
	}
};

// Edge case themes for stress testing
export const edgeCaseThemes = {
	extremeValues: {
		theme: {
			mode: 'dark',
			preset: 'custom',
			global: {
				colors: {
					primary: '#000001',
					secondary: '#FFFFFE',
					success: '#10B981',
					warning: '#F59E0B',
					error: '#EF4444',
					background: '#000000',
					surface: '#000002',
					text: '#FFFFFF'
				},
				typography: {
					fontFamily: 'system-ui',
					fontSize: {
						base: '1px',
						scale: 10
					}
				},
				spacing: {
					unit: '0.001rem',
					scale: [0, 1000, 2000, 5000]
				},
				borders: {
					radius: {
						none: '0',
						sm: '0.001rem',
						md: '100rem',
						lg: '1000rem',
						full: '99999px'
					},
					width: '0.1px',
					style: 'solid'
				}
			},
			components: {}
		}
	},

	maximalSpacing: {
		theme: {
			mode: 'dark',
			preset: 'custom',
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
					fontFamily: 'system-ui',
					fontSize: {
						base: '16px',
						scale: 1.25
					}
				},
				spacing: {
					unit: '0.25rem',
					scale: Array.from({ length: 50 }, (_, i) => i + 1)
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
			components: {}
		}
	},

	deeplyNested: {
		theme: {
			mode: 'dark',
			preset: 'custom',
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
					fontFamily: 'system-ui',
					fontSize: {
						base: '16px',
						scale: 1.25
					}
				},
				spacing: {
					unit: '0.25rem',
					scale: [1, 2, 3, 4]
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
				// Create deeply nested component structure
				level1: {
					inherit: true,
					level2: {
						inherit: true,
						level3: {
							inherit: true,
							level4: {
								inherit: true,
								level5: {
									inherit: true,
									overrides: {
										deepProperty: 'value'
									}
								}
							}
						}
					}
				}
			}
		}
	}
};

// Invalid theme configurations for error testing
export const invalidThemes = {
	missingRequired: {
		theme: {
			mode: 'dark'
			// Missing preset, global
		}
	},

	invalidColors: {
		theme: {
			mode: 'dark',
			preset: 'default',
			global: {
				colors: {
					primary: 'not-a-color',
					secondary: '#GGGGGG',
					success: '#10B981',
					warning: '#F59E0B',
					error: '#EF4444',
					background: null,
					surface: '#374151',
					text: 123
				},
				typography: {
					fontFamily: 'system-ui',
					fontSize: {
						base: '16px',
						scale: 1.25
					}
				},
				spacing: {
					unit: '0.25rem',
					scale: [1]
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
			components: {}
		}
	},

	invalidMode: {
		theme: {
			mode: 'invalid-mode',
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
					fontFamily: 'system-ui',
					fontSize: {
						base: '16px',
						scale: 1.25
					}
				},
				spacing: {
					unit: '0.25rem',
					scale: [1]
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
			components: {}
		}
	},

	invalidTypography: {
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
					fontFamily: null,
					fontSize: {
						base: 'invalid-size',
						scale: 'not-a-number'
					}
				},
				spacing: {
					unit: '0.25rem',
					scale: [1]
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
			components: {}
		}
	},

	malformedJSON: '{"theme":{"mode":"dark","preset":"default","global":{"colors":{"primary":"#3B82F6"'
};

// Performance test data sets
export const performanceTestData = {
	small: {
		colorCount: 10,
		componentCount: 5,
		spacingCount: 5
	},
	medium: {
		colorCount: 100,
		componentCount: 25,
		spacingCount: 15
	},
	large: {
		colorCount: 1000,
		componentCount: 100,
		spacingCount: 50
	},
	extreme: {
		colorCount: 5000,
		componentCount: 500,
		spacingCount: 100
	}
};

// Generate large theme configurations for performance testing
export function generateLargeTheme(size: keyof typeof performanceTestData): any {
	const { colorCount, componentCount, spacingCount } = performanceTestData[size];
	
	const colors: Record<string, string> = {
		primary: '#3B82F6',
		secondary: '#8B5CF6',
		success: '#10B981',
		warning: '#F59E0B',
		error: '#EF4444',
		background: '#1F2937',
		surface: '#374151',
		text: '#F9FAFB'
	};

	// Generate additional colors
	for (let i = 0; i < colorCount; i++) {
		colors[`color${i}`] = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
	}

	const components: Record<string, any> = {};
	
	// Generate components
	for (let i = 0; i < componentCount; i++) {
		components[`component${i}`] = {
			inherit: i % 2 === 0,
			overrides: {
				color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
				backgroundColor: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`
			}
		};
	}

	return {
		theme: {
			mode: 'dark',
			preset: 'custom',
			global: {
				colors,
				typography: {
					fontFamily: 'system-ui',
					fontSize: {
						base: '16px',
						scale: 1.25
					}
				},
				spacing: {
					unit: '0.25rem',
					scale: Array.from({ length: spacingCount }, (_, i) => i + 1)
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
			components
		}
	};
}

// Accessibility test configurations
export const accessibilityTestThemes = {
	lowContrast: {
		theme: {
			mode: 'dark',
			preset: 'custom',
			global: {
				colors: {
					primary: '#555555',
					secondary: '#666666',
					success: '#777777',
					warning: '#888888',
					error: '#999999',
					background: '#444444',
					surface: '#555555',
					text: '#666666' // Poor contrast
				},
				typography: {
					fontFamily: 'system-ui',
					fontSize: {
						base: '16px',
						scale: 1.25
					}
				},
				spacing: {
					unit: '0.25rem',
					scale: [1, 2, 3, 4]
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
			components: {}
		}
	},

	highContrast: {
		theme: {
			mode: 'dark',
			preset: 'custom',
			global: {
				colors: {
					primary: '#FFFFFF',
					secondary: '#FFFF00',
					success: '#00FF00',
					warning: '#FFAA00',
					error: '#FF0000',
					background: '#000000',
					surface: '#111111',
					text: '#FFFFFF' // Excellent contrast
				},
				typography: {
					fontFamily: 'system-ui',
					fontSize: {
						base: '18px',
						scale: 1.4
					}
				},
				spacing: {
					unit: '0.5rem',
					scale: [1, 2, 3, 4, 6, 8]
				},
				borders: {
					radius: {
						none: '0',
						sm: '0.25rem',
						md: '0.5rem',
						lg: '1rem',
						full: '9999px'
					},
					width: '2px',
					style: 'solid'
				}
			},
			components: {}
		}
	}
};

// Cross-browser compatibility test configurations
export const browserCompatibilityThemes = {
	modernFeatures: {
		theme: {
			mode: 'dark',
			preset: 'custom',
			global: {
				colors: {
					primary: 'oklch(0.7 0.15 200)',
					secondary: 'color-mix(in srgb, blue 50%, red)',
					success: '#10B981',
					warning: '#F59E0B',
					error: '#EF4444',
					background: '#1F2937',
					surface: '#374151',
					text: '#F9FAFB'
				},
				typography: {
					fontFamily: 'system-ui',
					fontSize: {
						base: '16px',
						scale: 1.25
					}
				},
				spacing: {
					unit: '1dvh',
					scale: [1, 2, 3, 4]
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
			components: {}
		}
	},

	legacySafe: {
		theme: {
			mode: 'dark',
			preset: 'custom',
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
					fontFamily: 'Arial, sans-serif',
					fontSize: {
						base: '16px',
						scale: 1.25
					}
				},
				spacing: {
					unit: '4px',
					scale: [1, 2, 3, 4]
				},
				borders: {
					radius: {
						none: '0px',
						sm: '2px',
						md: '6px',
						lg: '8px',
						full: '50px'
					},
					width: '1px',
					style: 'solid'
				}
			},
			components: {}
		}
	}
};