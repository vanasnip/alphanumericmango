<script lang="ts">
	import { onMount } from 'svelte';
	import { voiceNavigation } from '../voiceNavigation.js';
	import VoiceNumberBadge from './VoiceNumberBadge.svelte';

	let demoItems = [
		{ id: 'item1', label: 'First Demo Item', type: 'menu' as const },
		{ id: 'item2', label: 'Second Demo Item', type: 'command' as const },
		{ id: 'item3', label: 'Third Demo Item', type: 'menu' as const },
		{ id: 'item4', label: 'Fourth Demo Item', type: 'command' as const },
		{ id: 'item5', label: 'Fifth Demo Item', type: 'menu' as const },
	];

	let selectedItem: string | null = null;
	let lastCommand = '';
	let hoveredItem: number | null = null;

	onMount(() => {
		// Register demo items with voice navigation
		demoItems.forEach((item, index) => {
			const number = 20 + index + 1; // Start demo numbers at 21
			voiceNavigation.registerItem(
				item.id,
				item.type,
				[`demo ${number}`, item.label.toLowerCase()],
				() => {
					selectedItem = item.id;
					lastCommand = `Executed: ${item.label}`;
					setTimeout(() => {
						selectedItem = null;
					}, 1000);
				}
			);
		});
	});

	const scalabilityItems = Array.from({ length: 25 }, (_, i) => ({
		id: `scale-${i + 1}`,
		number: 50 + i,
		label: `Scalability Item ${i + 1}`
	}));

	function demonstrateScalability(item: any) {
		lastCommand = `Clicked scalability item ${item.number - 49}`;
	}
</script>

<div class="voice-demo">
	<div class="demo-header">
		<h2>🎤 Voice Navigation Demo</h2>
		<p>This showcases the numbered voice navigation system with various UI patterns.</p>
	</div>

	<!-- Basic Demo Items -->
	<div class="demo-section">
		<h3>📋 Basic Numbered Navigation</h3>
		<p>Say the number or name of any item below:</p>
		<div class="demo-items">
			{#each demoItems as item, index (item.id)}
				{@const number = 21 + index}
				<div 
					class="demo-item"
					class:selected={selectedItem === item.id}
					on:click={() => {
						selectedItem = item.id;
						lastCommand = `Clicked: ${item.label}`;
					}}
					on:mouseenter={() => hoveredItem = number}
					on:mouseleave={() => hoveredItem = null}
				>
					<VoiceNumberBadge 
						{number}
						type={item.type}
						voiceCommand="Demo {number}"
						isActive={selectedItem === item.id}
						isHovered={hoveredItem === number}
					/>
					<span class="item-label">{item.label}</span>
					<span class="voice-commands">
						"21" • "Demo 21" • "{item.label.toLowerCase()}"
					</span>
				</div>
			{/each}
		</div>
		{#if lastCommand}
			<div class="last-command">
				✅ {lastCommand}
			</div>
		{/if}
	</div>

	<!-- Message Sequence Demo -->
	<div class="demo-section">
		<h3>💬 Chat Message Numbering</h3>
		<p>Messages use alternating odd/even numbering (User: odd, Assistant: even):</p>
		<div class="message-demo">
			{#each Array.from({ length: 6 }, (_, i) => ({ id: i + 1, role: i % 2 === 0 ? 'user' : 'assistant', content: `Message ${i + 1} content` })) as msg}
				{@const number = msg.id % 2 === 1 ? msg.id : msg.id + 6}
				<div class="demo-message {msg.role}">
					<VoiceNumberBadge 
						{number}
						type="message"
						voiceCommand="Message {number}"
						size="small"
					/>
					<div class="message-role">
						{msg.role === 'user' ? '👤' : '🤖'} {msg.role}
					</div>
					<div class="message-text">
						{msg.content}
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Scalability Demo -->
	<div class="demo-section">
		<h3>📊 Scalability (10+ Items)</h3>
		<p>Numbers scale to 99+, with efficient voice commands:</p>
		<div class="scalability-grid">
			{#each scalabilityItems.slice(0, 12) as item}
				<button
					class="scale-item"
					on:click={() => demonstrateScalability(item)}
				>
					<VoiceNumberBadge 
						number={item.number}
						type="menu"
						voiceCommand="{item.number}"
						size="small"
					/>
					<span>Item {item.number - 49}</span>
				</button>
			{/each}
			<div class="more-items">
				<VoiceNumberBadge 
					number={99}
					type="menu"
					voiceCommand="99+"
					size="small"
				/>
				<span>+13 more items...</span>
			</div>
		</div>
	</div>

	<!-- Voice Command Patterns -->
	<div class="demo-section">
		<h3>🗣️ Voice Command Patterns</h3>
		<div class="command-patterns">
			<div class="pattern-group">
				<h4>Direct Number Commands</h4>
				<ul>
					<li><code>"1"</code> → First item</li>
					<li><code>"25"</code> → 25th item</li>
					<li><code>"99"</code> → 99th item</li>
				</ul>
			</div>
			<div class="pattern-group">
				<h4>Contextual Commands</h4>
				<ul>
					<li><code>"Project 2"</code> → Second project tab</li>
					<li><code>"Message 7"</code> → 7th message</li>
					<li><code>"Menu 3"</code> → Third menu item</li>
					<li><code>"Command 5"</code> → Fifth command</li>
				</ul>
			</div>
			<div class="pattern-group">
				<h4>Natural Language</h4>
				<ul>
					<li><code>"Select 3"</code> → Third item</li>
					<li><code>"Go to 8"</code> → Eighth item</li>
					<li><code>"Click 12"</code> → Twelfth item</li>
					<li><code>"Show message 4"</code> → Fourth message</li>
				</ul>
			</div>
		</div>
	</div>

	<!-- Accessibility Features -->
	<div class="demo-section">
		<h3>♿ Accessibility Features</h3>
		<div class="accessibility-demo">
			<div class="feature-item">
				<VoiceNumberBadge 
					number={1}
					type="menu"
					voiceCommand="High contrast"
					size="large"
				/>
				<div>
					<strong>High Contrast Support</strong>
					<p>Numbers maintain visibility in high contrast mode</p>
				</div>
			</div>
			<div class="feature-item">
				<VoiceNumberBadge 
					number={2}
					type="command"
					voiceCommand="Reduced motion"
					size="large"
				/>
				<div>
					<strong>Reduced Motion</strong>
					<p>Animations respect prefers-reduced-motion</p>
				</div>
			</div>
			<div class="feature-item">
				<VoiceNumberBadge 
					number={3}
					type="message"
					voiceCommand="Screen reader"
					size="large"
				/>
				<div>
					<strong>Screen Reader Friendly</strong>
					<p>Tooltips and ARIA labels for accessibility</p>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.voice-demo {
		padding: 2rem;
		max-width: 1200px;
		margin: 0 auto;
		color: #00ff00;
		background: #0a0a0a;
		font-family: 'Monaco', 'Menlo', monospace;
	}

	.demo-header {
		text-align: center;
		margin-bottom: 3rem;
	}

	.demo-header h2 {
		font-size: 2rem;
		margin-bottom: 1rem;
		text-shadow: 0 0 10px #00ff00;
	}

	.demo-section {
		margin-bottom: 3rem;
		padding: 2rem;
		background: #1a1a1a;
		border-radius: 8px;
		border: 1px solid #333;
	}

	.demo-section h3 {
		font-size: 1.4rem;
		margin-bottom: 1rem;
		color: #00ff00;
		text-shadow: 0 0 5px #00ff00;
	}

	.demo-section p {
		margin-bottom: 1.5rem;
		color: #ccc;
		line-height: 1.5;
	}

	/* Basic Demo Items */
	.demo-items {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.demo-item {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		background: #0a0a0a;
		border: 1px solid #333;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.demo-item:hover {
		border-color: #00ff00;
		background: #1a2a1a;
	}

	.demo-item.selected {
		border-color: #00ff00;
		background: #1a3a1a;
		box-shadow: 0 0 10px rgba(0, 255, 0, 0.3);
	}

	.item-label {
		font-weight: bold;
		flex: 1;
	}

	.voice-commands {
		font-size: 0.8rem;
		color: #666;
		font-family: monospace;
	}

	.last-command {
		padding: 0.75rem;
		background: #1a3a1a;
		border: 1px solid #00ff00;
		border-radius: 4px;
		color: #00ff00;
		font-weight: bold;
	}

	/* Message Demo */
	.message-demo {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.demo-message {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		border-radius: 6px;
	}

	.demo-message.user {
		background: #1a2a1a;
		margin-left: 2rem;
	}

	.demo-message.assistant {
		background: #1a1a2a;
		margin-right: 2rem;
	}

	.message-role {
		font-size: 0.9rem;
		font-weight: bold;
		min-width: 100px;
	}

	.message-text {
		flex: 1;
	}

	/* Scalability Grid */
	.scalability-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.scale-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem;
		background: #0a0a0a;
		border: 1px solid #333;
		border-radius: 4px;
		color: #00ff00;
		cursor: pointer;
		transition: all 0.2s;
		font-family: inherit;
	}

	.scale-item:hover {
		border-color: #00ff00;
		background: #1a2a1a;
	}

	.more-items {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem;
		background: #2a2a1a;
		border: 1px dashed #666;
		border-radius: 4px;
		color: #666;
		font-style: italic;
	}

	/* Command Patterns */
	.command-patterns {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 2rem;
	}

	.pattern-group h4 {
		margin-bottom: 0.75rem;
		color: #00ff00;
		font-size: 1.1rem;
	}

	.pattern-group ul {
		list-style: none;
		padding: 0;
	}

	.pattern-group li {
		margin-bottom: 0.5rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.pattern-group code {
		background: #2a2a2a;
		padding: 0.25rem 0.5rem;
		border-radius: 3px;
		color: #00ff00;
		font-weight: bold;
		min-width: 120px;
		font-family: monospace;
	}

	/* Accessibility Demo */
	.accessibility-demo {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.feature-item {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		padding: 1.5rem;
		background: #0a0a0a;
		border: 1px solid #333;
		border-radius: 6px;
	}

	.feature-item strong {
		display: block;
		margin-bottom: 0.5rem;
		color: #00ff00;
	}

	.feature-item p {
		margin: 0;
		color: #ccc;
		line-height: 1.4;
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		.voice-demo {
			padding: 1rem;
		}
		
		.demo-section {
			padding: 1rem;
		}
		
		.scalability-grid {
			grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		}
		
		.command-patterns {
			grid-template-columns: 1fr;
		}
		
		.feature-item {
			flex-direction: column;
			align-items: flex-start;
			text-align: left;
		}
	}
</style>