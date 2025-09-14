<script lang="ts">
	export let number: number;
	export let type: 'project' | 'menu' | 'message' | 'command' = 'menu';
	export let isActive = false;
	export let isHovered = false;
	export let voiceCommand = '';
	export let size: 'small' | 'medium' | 'large' = 'medium';

	// Color schemes for different element types
	const colorSchemes = {
		project: {
			bg: '#2563eb', // Blue
			text: '#ffffff',
			border: '#1d4ed8',
			activeBg: '#1d4ed8',
			hoverBg: '#3b82f6'
		},
		menu: {
			bg: '#059669', // Green (matches terminal theme)
			text: '#ffffff', 
			border: '#047857',
			activeBg: '#047857',
			hoverBg: '#10b981'
		},
		message: {
			bg: '#7c3aed', // Purple
			text: '#ffffff',
			border: '#6d28d9',
			activeBg: '#6d28d9',
			hoverBg: '#8b5cf6'
		},
		command: {
			bg: '#dc2626', // Red
			text: '#ffffff',
			border: '#b91c1c',
			activeBg: '#b91c1c',
			hoverBg: '#ef4444'
		}
	};

	// Size configurations
	const sizeConfigs = {
		small: {
			width: '20px',
			height: '20px',
			fontSize: '0.7rem',
			borderWidth: '1px'
		},
		medium: {
			width: '24px',
			height: '24px',
			fontSize: '0.8rem',
			borderWidth: '2px'
		},
		large: {
			width: '32px',
			height: '32px',
			fontSize: '1rem',
			borderWidth: '2px'
		}
	};

	$: scheme = colorSchemes[type];
	$: sizeConfig = sizeConfigs[size];
	$: displayNumber = number > 99 ? '99+' : number.toString();
</script>

<div
	class="voice-number-badge {type}"
	class:active={isActive}
	class:hovered={isHovered}
	style="
		--bg-color: {scheme.bg};
		--text-color: {scheme.text};
		--border-color: {scheme.border};
		--active-bg: {scheme.activeBg};
		--hover-bg: {scheme.hoverBg};
		--width: {sizeConfig.width};
		--height: {sizeConfig.height};
		--font-size: {sizeConfig.fontSize};
		--border-width: {sizeConfig.borderWidth};
	"
	title="Voice Command: {voiceCommand}"
>
	<span class="number">{displayNumber}</span>
	{#if isHovered && voiceCommand}
		<div class="voice-tooltip">
			<div class="tooltip-content">
				Say: <strong>"{voiceCommand}"</strong>
			</div>
		</div>
	{/if}
</div>

<style>
	.voice-number-badge {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--width);
		height: var(--height);
		background-color: var(--bg-color);
		color: var(--text-color);
		border: var(--border-width) solid var(--border-color);
		border-radius: 50%;
		font-weight: bold;
		font-size: var(--font-size);
		line-height: 1;
		user-select: none;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow: 
			0 2px 4px rgba(0, 0, 0, 0.3),
			0 0 0 0 rgba(var(--bg-color), 0.4);
		z-index: 10;
	}

	.voice-number-badge:hover,
	.voice-number-badge.hovered {
		background-color: var(--hover-bg);
		box-shadow: 
			0 4px 8px rgba(0, 0, 0, 0.4),
			0 0 0 3px rgba(var(--bg-color), 0.3);
		transform: scale(1.1);
	}

	.voice-number-badge.active {
		background-color: var(--active-bg);
		box-shadow: 
			0 6px 12px rgba(0, 0, 0, 0.5),
			0 0 0 4px rgba(var(--bg-color), 0.5);
		transform: scale(1.15);
	}

	.number {
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
	}

	/* Voice tooltip */
	.voice-tooltip {
		position: absolute;
		bottom: calc(100% + 8px);
		left: 50%;
		transform: translateX(-50%);
		z-index: 1000;
		pointer-events: none;
		animation: fadeInUp 0.2s ease-out;
	}

	.tooltip-content {
		background: rgba(0, 0, 0, 0.9);
		color: #00ff00;
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
		font-size: 0.75rem;
		white-space: nowrap;
		border: 1px solid #00ff00;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
	}

	.tooltip-content::after {
		content: '';
		position: absolute;
		top: 100%;
		left: 50%;
		transform: translateX(-50%);
		border: 4px solid transparent;
		border-top-color: #00ff00;
	}

	/* Type-specific styling adjustments */
	.voice-number-badge.project {
		border-radius: 6px; /* Square-ish for project tabs */
	}

	.voice-number-badge.message {
		opacity: 0.85;
	}

	.voice-number-badge.message.active {
		opacity: 1;
	}

	/* Accessibility enhancements */
	@media (prefers-reduced-motion: reduce) {
		.voice-number-badge {
			transition: none;
		}
		
		.voice-number-badge:hover,
		.voice-number-badge.hovered {
			transform: none;
		}
		
		.voice-number-badge.active {
			transform: none;
		}
	}

	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.voice-number-badge {
			border-width: 3px;
			box-shadow: none;
		}
	}

	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}
</style>