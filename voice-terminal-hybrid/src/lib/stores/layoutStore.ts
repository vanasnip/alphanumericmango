import { writable } from 'svelte/store';

export type LayoutMode = 'vertical' | 'horizontal';
export type PanelPosition = 'left' | 'right' | 'top' | 'bottom';

interface LayoutConfig {
	mode: LayoutMode;
	conversationPosition: PanelPosition;
	splitRatio: number; // 0.3 to 0.7 for flexible sizing
}

// Create a persistent store using localStorage
function createLayoutStore() {
	// Load from localStorage or use defaults
	const stored = typeof window !== 'undefined' 
		? localStorage.getItem('terminalLayout')
		: null;
	
	const initial: LayoutConfig = stored 
		? JSON.parse(stored)
		: {
			mode: 'vertical',
			conversationPosition: 'right',
			splitRatio: 0.4 // 40% for conversation, 60% for terminal
		};

	const { subscribe, set, update } = writable<LayoutConfig>(initial);

	return {
		subscribe,
		update,
		setMode: (mode: LayoutMode) => {
			update(config => {
				const newConfig = { ...config, mode };
				// Adjust position based on mode
				if (mode === 'vertical') {
					newConfig.conversationPosition = config.conversationPosition === 'top' || config.conversationPosition === 'bottom' 
						? 'right' 
						: config.conversationPosition;
				} else {
					newConfig.conversationPosition = config.conversationPosition === 'left' || config.conversationPosition === 'right'
						? 'bottom'
						: config.conversationPosition;
				}
				if (typeof window !== 'undefined') {
					localStorage.setItem('terminalLayout', JSON.stringify(newConfig));
				}
				return newConfig;
			});
		},
		swapPanels: () => {
			update(config => {
				const newConfig = { ...config };
				if (config.mode === 'vertical') {
					newConfig.conversationPosition = config.conversationPosition === 'left' ? 'right' : 'left';
				} else {
					newConfig.conversationPosition = config.conversationPosition === 'top' ? 'bottom' : 'top';
				}
				if (typeof window !== 'undefined') {
					localStorage.setItem('terminalLayout', JSON.stringify(newConfig));
				}
				return newConfig;
			});
		},
		setSplitRatio: (ratio: number) => {
			update(config => {
				const newConfig = { 
					...config, 
					splitRatio: Math.max(0.3, Math.min(0.7, ratio)) 
				};
				if (typeof window !== 'undefined') {
					localStorage.setItem('terminalLayout', JSON.stringify(newConfig));
				}
				return newConfig;
			});
		},
		reset: () => {
			const defaultConfig: LayoutConfig = {
				mode: 'vertical',
				conversationPosition: 'right',
				splitRatio: 0.4
			};
			set(defaultConfig);
			if (typeof window !== 'undefined') {
				localStorage.setItem('terminalLayout', JSON.stringify(defaultConfig));
			}
		}
	};
}

export const layoutStore = createLayoutStore();