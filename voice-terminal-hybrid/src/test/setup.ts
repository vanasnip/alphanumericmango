import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
	value: {
		getItem: vi.fn(),
		setItem: vi.fn(),
		removeItem: vi.fn(),
		clear: vi.fn(),
	},
	writable: true,
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: vi.fn().mockImplementation(query => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(), // deprecated
		removeListener: vi.fn(), // deprecated
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
});

// Mock CSS custom properties
Object.defineProperty(document.documentElement.style, 'setProperty', {
	value: vi.fn(),
	writable: true,
});

Object.defineProperty(document.documentElement.style, 'getPropertyValue', {
	value: vi.fn().mockReturnValue(''),
	writable: true,
});

// Mock file system APIs for theme file operations
Object.defineProperty(window, 'File', {
	value: class MockFile {
		constructor(public name: string, public content: string) {}
	},
	writable: true,
});

Object.defineProperty(window, 'FileReader', {
	value: class MockFileReader {
		readAsText = vi.fn();
		result = '';
		onload = vi.fn();
		onerror = vi.fn();
	},
	writable: true,
});

// Mock performance API for theme switch timing
Object.defineProperty(window, 'performance', {
	value: {
		now: vi.fn().mockReturnValue(Date.now()),
		mark: vi.fn(),
		measure: vi.fn(),
		getEntriesByName: vi.fn().mockReturnValue([]),
		clearMarks: vi.fn(),
		clearMeasures: vi.fn(),
	},
	writable: true,
});

// Silence console warnings during tests unless explicitly testing them
const originalWarn = console.warn;
const originalError = console.error;

beforeEach(() => {
	console.warn = vi.fn();
	console.error = vi.fn();
});

afterEach(() => {
	console.warn = originalWarn;
	console.error = originalError;
	vi.clearAllMocks();
});