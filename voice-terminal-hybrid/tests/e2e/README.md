# E2E Theme Testing Suite

This comprehensive E2E test suite covers all aspects of the voice-terminal-hybrid theming system, including theme editing, voice control integration, component theming, error handling, performance, and cross-browser compatibility.

## Test Structure

### 📁 Test Files

- **`theme-editing.spec.ts`** - Theme editing workflow tests
- **`voice-theme.spec.ts`** - Voice control integration tests  
- **`component-theming.spec.ts`** - Component theme application tests
- **`error-recovery.spec.ts`** - Error handling and recovery tests
- **`performance.spec.ts`** - Performance and memory tests
- **`cross-browser.spec.ts`** - Cross-browser compatibility tests

### 🛠️ Helper Utilities

- **`test-helpers.ts`** - Core theme testing utilities
- **`voice-helpers.ts`** - Voice simulation and automation
- **`json-editing-helpers.ts`** - JSON editor automation
- **`page-objects.ts`** - Page Object Model patterns
- **`e2e-test-setup.ts`** - Test setup and fixtures

## Running Tests

### All E2E Tests
```bash
npm run test:e2e
```

### Specific Test Categories
```bash
# Theme editing tests
npm run test:e2e -- --grep "@e2e.*theme-editing"

# Voice control tests  
npm run test:e2e -- --grep "@voice"

# Component theming tests
npm run test:e2e -- --grep "@components"

# Performance tests
npm run test:e2e -- --grep "@performance"

# Cross-browser tests
npm run test:e2e -- --grep "@cross-browser"

# Error handling tests
npm run test:e2e -- --grep "@error-handling"
```

### Browser-Specific Tests
```bash
# Chrome only
npm run test:e2e -- --project=chromium

# Firefox only  
npm run test:e2e -- --project=firefox

# Safari only
npm run test:e2e -- --project=webkit

# Mobile browsers
npm run test:e2e -- --project="Mobile Chrome"
```

### UI Mode (Interactive)
```bash
npm run test:e2e:ui
```

## Test Features

### 🎨 Theme Editing Workflow

Tests cover:
- JSON editor functionality and validation
- Live preview updates
- Save/load persistence
- Undo/redo operations
- Large theme file handling
- Keyboard shortcuts
- Error recovery

**Example Test:**
```typescript
test('should modify JSON values and see live preview', async ({ page }) => {
  const helpers = new ThemeTestHelpers(page);
  const settingsPage = new ThemeSettingsPage(page);
  
  await settingsPage.open();
  await settingsPage.editJSONTheme({
    theme: {
      global: {
        colors: { primary: '#FF6B6B' }
      }
    }
  });
  
  const preview = await settingsPage.getPreviewThemeVariables();
  expect(preview['--theme-primary']).toBe('#FF6B6B');
});
```

### 🎤 Voice Control Integration

Tests cover:
- Voice command recognition
- Theme switching via voice
- Voice feedback and announcements
- Error handling for speech recognition
- Accessibility support
- Continuous voice sessions

**Example Test:**
```typescript
test('should change theme via voice command', async ({ page }) => {
  const voicePage = new VoiceControlPage(page);
  
  await voicePage.initializeVoiceMocks();
  await voicePage.startVoiceRecognition();
  await voicePage.sendVoiceCommand('change theme to ocean');
  
  const theme = await page.evaluate(() => 
    window.__themeStore.getTheme().theme.preset
  );
  expect(theme).toBe('ocean');
});
```

### 🧩 Component Theme Application

Tests cover:
- Flowbite component theming
- CSS variable application
- Component inheritance behavior
- Responsive theming
- Animation and transition validation
- Dark/light mode variants

**Example Test:**
```typescript
test('should apply theme to Button components', async ({ page }) => {
  const previewPage = new ThemePreviewPage(page);
  
  await previewPage.applyTheme({
    theme: {
      global: { colors: { primary: '#FF6B6B' } }
    }
  });
  
  const buttonStyles = await previewPage.testButtonThemes();
  expect(buttonStyles.primary.backgroundColor).toContain('255, 107, 107');
});
```

### 🚨 Error Handling & Recovery

Tests cover:
- Invalid JSON recovery
- Missing settings.json handling
- Network failure simulation
- Theme validation errors
- Corrupted data recovery
- Development mode error details

**Example Test:**
```typescript
test('should recover from invalid JSON', async ({ page }) => {
  const jsonHelpers = new JSONEditingHelpers(page);
  
  await jsonHelpers.setJSONContent('{ invalid json }');
  
  const validation = await jsonHelpers.validateJSONContent();
  expect(validation.valid).toBe(false);
  expect(validation.errors.length).toBeGreaterThan(0);
});
```

### ⚡ Performance Testing

Tests cover:
- Theme switch timing (target: <100ms)
- Memory usage monitoring
- Large theme file handling
- Rapid switching stress tests
- CSS variable update optimization
- Rendering performance

**Example Test:**
```typescript
test('should switch themes within performance target', async ({ page }) => {
  const performancePage = new PerformancePage(page);
  
  const results = await performancePage.measureThemeSwitchPerformance(10);
  expect(results.average).toBeLessThan(100); // 100ms target
  expect(results.max).toBeLessThan(200);
});
```

### 🌐 Cross-Browser Compatibility

Tests cover:
- Chrome/Chromium rendering
- Firefox CSS compatibility
- Safari/WebKit modern features
- Edge consistency
- Mobile browser support
- Font rendering differences
- CSS Grid/Flexbox support

**Example Test:**
```typescript
test('Chrome: should render theme correctly', async ({ page }) => {
  const helpers = new ThemeTestHelpers(page);
  
  await helpers.applyTheme(testTheme);
  
  const cssVarsSupported = await page.evaluate(() => 
    CSS.supports('color', 'var(--test-var)')
  );
  expect(cssVarsSupported).toBe(true);
});
```

## Custom Assertions

The test suite includes custom assertions for theme-specific testing:

```typescript
import { themeExpect } from '../fixtures/e2e-test-setup';

// Performance assertions
await themeExpect.toHaveAcceptablePerformance(page, 100);

// Error checking
await themeExpect.toHaveNoConsoleErrors(page);

// CSS variable validation
await themeExpect.toHaveValidThemeVariables(page);

// Accessibility compliance
await themeExpect.toMeetAccessibilityStandards(page, 4.5);

// Responsive design
await themeExpect.toBeResponsive(page, viewports);
```

## Page Object Model

The test suite uses Page Object Model for maintainable test code:

```typescript
const pageFactory = new PageFactory(page);

// Theme settings page
const settings = pageFactory.themeSettings();
await settings.open();
await settings.applyPreset('ocean');
await settings.saveTheme();

// Voice control page
const voice = pageFactory.voiceControl();
await voice.startVoiceRecognition();
await voice.sendVoiceCommand('change theme to dark');

// Theme preview page
const preview = pageFactory.themePreview();
const buttonStyles = await preview.testButtonThemes();
const responsive = await preview.testResponsiveTheme(viewports);
```

## Test Data & Fixtures

Pre-built test data for common scenarios:

```typescript
import { themeTestData } from '../fixtures/e2e-test-setup';

// Test themes
const themes = themeTestData.getTestThemes();
await helpers.applyTheme(themes.minimal);
await helpers.applyTheme(themes.highContrast);

// Voice commands
const commands = themeTestData.getVoiceCommands();
await voice.sendVoiceSequence(commands.themeChanges);

// Performance scenarios
const scenarios = themeTestData.getPerformanceScenarios();
await helpers.rapidThemeSwitching(
  scenarios.rapidSwitching.themes,
  scenarios.rapidSwitching.iterations
);
```

## Debugging & Troubleshooting

### Debug Mode
Run tests with debug output:
```bash
npm run test:e2e -- --debug
```

### Screenshots on Failure
Automatic screenshots are captured on test failures in `test-results/`

### Trace Viewer
View detailed execution traces:
```bash
npm run test:e2e -- --trace on
```

### Console Logs
Tests capture and validate console errors:
```typescript
const debugInfo = await testUtils.captureDebugInfo(page);
console.log('Test state:', debugInfo);
```

### Performance Monitoring
Built-in performance metrics collection:
```typescript
const metrics = await page.evaluate(() => 
  window.__testData.performanceMetrics
);
```

## Contributing

When adding new tests:

1. **Use Page Objects** for UI interactions
2. **Include Performance Tests** for new features
3. **Add Cross-Browser Tests** for compatibility
4. **Write Custom Assertions** for domain-specific validations
5. **Document Test Scenarios** in comments
6. **Use Meaningful Test Names** that describe behavior

### Test Naming Convention
```typescript
test.describe('Feature Name @category', () => {
  test('should do specific behavior under specific conditions', async ({ page }) => {
    // Test implementation
  });
});
```

### Test Categories
- `@e2e` - End-to-end tests
- `@voice` - Voice control tests
- `@components` - Component theming tests
- `@performance` - Performance tests
- `@cross-browser` - Browser compatibility tests
- `@error-handling` - Error recovery tests
- `@accessibility` - Accessibility tests

## CI/CD Integration

Tests are configured for continuous integration:

- **Parallel Execution** across multiple browsers
- **Visual Regression** testing with Percy
- **Performance Benchmarking** with thresholds
- **Accessibility Auditing** with axe-core
- **Coverage Reports** for test completeness

## Best Practices

1. **Wait for Theme Application** - Always wait for theme changes to complete
2. **Use Realistic Data** - Test with actual theme configurations
3. **Test Error Conditions** - Include negative test cases
4. **Monitor Performance** - Validate timing and memory usage
5. **Verify Accessibility** - Check contrast ratios and keyboard navigation
6. **Cross-Browser Testing** - Ensure compatibility across browsers
7. **Clean Up** - Reset state between tests

This comprehensive test suite ensures the voice-terminal-hybrid theming system works reliably across all scenarios, browsers, and user interactions.