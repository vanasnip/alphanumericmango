module.exports = {
	version: 2,
	discovery: {
		allowedHostnames: ['localhost'],
		networkIdleTimeout: 750,
		disable: false
	},
	snapshot: {
		widths: [320, 768, 1024, 1440],
		minHeight: 568,
		percyCSS: `
			/* Hide dynamic elements that could cause flaky tests */
			[data-testid="timestamp"],
			[data-testid="voice-level-indicator"] {
				visibility: hidden !important;
			}
			
			/* Ensure animations are paused for consistent screenshots */
			*, *::before, *::after {
				animation-duration: 0s !important;
				animation-delay: 0s !important;
				transition-duration: 0s !important;
				transition-delay: 0s !important;
			}
			
			/* Disable cursor blink */
			.terminal-cursor {
				animation: none !important;
			}
		`
	},
	defer: {
		// Wait for theme application
		'theme-application': 200,
		// Wait for component rendering
		'component-render': 100
	}
};