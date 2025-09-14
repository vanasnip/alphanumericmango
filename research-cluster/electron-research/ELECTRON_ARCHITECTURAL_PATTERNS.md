# Electron Architectural Patterns & Best Practices Guide

## Executive Summary

This comprehensive guide analyzes architectural patterns and best practices for Electron applications based on successful implementations like VS Code, Slack, Discord, and other enterprise-grade desktop applications. It provides concrete implementation strategies for building scalable, secure, and maintainable Electron applications.

## Table of Contents

1. [Core Architecture Patterns](#core-architecture-patterns)
2. [Design Patterns](#design-patterns)
3. [Security Patterns](#security-patterns)
4. [Scalability Patterns](#scalability-patterns)
5. [Code Organization](#code-organization)
6. [Implementation Examples](#implementation-examples)

---

## 1. Core Architecture Patterns

### 1.1 Multi-Process Architecture Design

**Pattern**: Chromium-Inherited Process Isolation
- **Main Process**: Single entry point with full Node.js API access
- **Renderer Process**: One per BrowserWindow, isolated web content rendering
- **Shared Process**: Common services across windows (VS Code pattern)
- **Extension Host Process**: Isolated extension execution environment

**Key Principles:**
```typescript
// Process Architecture Layout
Main Process (Node.js)
├── Window Management
├── Application Lifecycle
├── Native OS Integration
├── IPC Coordination
└── Child Process Management
    ├── Renderer Process 1 (Chromium + Context Isolation)
    ├── Renderer Process 2 (Chromium + Context Isolation)
    ├── Shared Process (Services)
    └── Extension Host Process (Plugins)
```

**Benefits:**
- Memory and resource isolation between processes
- Crash resilience (renderer crash doesn't kill main process)
- Security through process sandboxing
- Scalability through distributed processing

### 1.2 Main/Renderer Process Separation Strategies

**VS Code Pattern - Service Delegation:**
```typescript
// Main Process - Services Hub
export class MainProcessServicesHub {
  private fileService: IFileService;
  private terminalService: ITerminalService;
  private extensionService: IExtensionService;

  constructor() {
    this.initializeServices();
    this.setupIPCHandlers();
  }

  private setupIPCHandlers() {
    ipcMain.handle('file:read', (event, path) => 
      this.fileService.readFile(path));
    ipcMain.handle('terminal:create', (event, options) => 
      this.terminalService.createTerminal(options));
  }
}

// Renderer Process - UI Layer
export class RendererProcessUILayer {
  private ipcBridge: IElectronAPI;

  async readFile(path: string): Promise<string> {
    return this.ipcBridge.file.read(path);
  }

  async createTerminal(options: TerminalOptions): Promise<Terminal> {
    return this.ipcBridge.terminal.create(options);
  }
}
```

**Architectural Decision Points:**
1. **CPU-intensive operations** → Dedicated worker processes
2. **System resource access** → Main process services
3. **UI rendering and interactions** → Renderer processes
4. **Cross-window state** → Shared process pattern

### 1.3 Extension/Plugin Architectures

**Microkernel Pattern Implementation:**
```typescript
// Core System
export interface IExtensionHost {
  loadExtension(manifest: ExtensionManifest): Promise<void>;
  unloadExtension(id: string): Promise<void>;
  executeCommand(command: string, ...args: any[]): Promise<any>;
}

// Extension API Surface
export interface IExtensionAPI {
  registerCommand(command: string, handler: Function): void;
  contributeViewProvider(id: string, provider: ViewProvider): void;
  onDidChangeActiveEditor(listener: (editor: Editor) => void): void;
}

// Security Boundary
export class SandboxedExtensionHost implements IExtensionHost {
  private extensionProcess: ChildProcess;
  
  async loadExtension(manifest: ExtensionManifest): Promise<void> {
    // Load extension in isolated process
    const extensionCode = await this.loadExtensionCode(manifest);
    await this.extensionProcess.send({
      type: 'load-extension',
      code: extensionCode,
      permissions: manifest.permissions
    });
  }
}
```

### 1.4 Service-Oriented Architecture in Electron

**Service Layer Pattern:**
```typescript
// Service Interface
export interface IService {
  readonly id: string;
  initialize(): Promise<void>;
  dispose(): Promise<void>;
}

// Service Registry
export class ServiceRegistry {
  private services = new Map<string, IService>();
  
  register<T extends IService>(service: T): void {
    this.services.set(service.id, service);
  }
  
  get<T extends IService>(id: string): T {
    return this.services.get(id) as T;
  }
}

// Example Service Implementation
export class FileSystemService implements IService {
  readonly id = 'filesystem';
  
  async initialize(): Promise<void> {
    // Setup file watchers, permissions, etc.
  }
  
  async readFile(path: string): Promise<Buffer> {
    // Secure file reading with validation
    return fs.readFile(path);
  }
}
```

---

## 2. Design Patterns

### 2.1 Command/Query Separation in IPC

**CQRS Pattern for IPC:**
```typescript
// Command Pattern - State Changes
export interface ICommand {
  readonly type: string;
  execute(): Promise<void>;
}

// Query Pattern - Data Retrieval
export interface IQuery<TResult> {
  readonly type: string;
  execute(): Promise<TResult>;
}

// IPC Command Handler
export class IPCCommandBus {
  private handlers = new Map<string, ICommand>();
  
  constructor() {
    ipcMain.handle('command:execute', async (event, commandType, payload) => {
      const command = this.createCommand(commandType, payload);
      await command.execute();
    });
  }
  
  private createCommand(type: string, payload: any): ICommand {
    switch (type) {
      case 'file:save':
        return new SaveFileCommand(payload.path, payload.content);
      case 'window:close':
        return new CloseWindowCommand(payload.windowId);
      default:
        throw new Error(`Unknown command type: ${type}`);
    }
  }
}
```

### 2.2 Event-Driven Architecture

**Event Bus Pattern:**
```typescript
// Event System
export interface IEvent {
  readonly type: string;
  readonly timestamp: Date;
  readonly source: string;
}

export class EventBus {
  private listeners = new Map<string, Set<EventListener>>();
  
  subscribe<T extends IEvent>(
    eventType: string, 
    listener: (event: T) => void
  ): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    
    this.listeners.get(eventType)!.add(listener);
    
    // Return unsubscribe function
    return () => this.listeners.get(eventType)?.delete(listener);
  }
  
  publish<T extends IEvent>(event: T): void {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }
  }
}

// Cross-process event bridging
export class IPCEventBridge {
  constructor(private eventBus: EventBus) {
    this.setupIPCBridge();
  }
  
  private setupIPCBridge(): void {
    // Forward main process events to renderer
    this.eventBus.subscribe('*', (event) => {
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('event:received', event);
      });
    });
    
    // Handle renderer events
    ipcMain.on('event:publish', (event, electronEvent) => {
      this.eventBus.publish(electronEvent);
    });
  }
}
```

### 2.3 State Management Patterns

**Redux-Inspired State Management:**
```typescript
// State Management
export interface AppState {
  windows: WindowState[];
  settings: SettingsState;
  extensions: ExtensionState[];
}

export interface Action {
  type: string;
  payload?: any;
}

export class StateManager {
  private state: AppState;
  private reducers: Map<string, Reducer>;
  private subscribers: Set<StateListener> = new Set();
  
  dispatch(action: Action): void {
    const reducer = this.reducers.get(action.type);
    if (reducer) {
      const newState = reducer(this.state, action);
      this.updateState(newState);
    }
  }
  
  private updateState(newState: AppState): void {
    this.state = newState;
    this.notifySubscribers();
    
    // Sync state to renderer processes
    this.syncToRenderers();
  }
  
  private syncToRenderers(): void {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('state:updated', this.state);
    });
  }
}
```

### 2.4 Dependency Injection in Electron Context

**Service Locator Pattern:**
```typescript
// Dependency Injection Container
export class DIContainer {
  private services = new Map<string, any>();
  private factories = new Map<string, ServiceFactory>();
  
  register<T>(
    identifier: string, 
    factory: ServiceFactory<T>, 
    singleton: boolean = true
  ): void {
    this.factories.set(identifier, { factory, singleton });
  }
  
  resolve<T>(identifier: string): T {
    if (this.services.has(identifier)) {
      return this.services.get(identifier);
    }
    
    const serviceFactory = this.factories.get(identifier);
    if (!serviceFactory) {
      throw new Error(`Service not registered: ${identifier}`);
    }
    
    const instance = serviceFactory.factory(this);
    
    if (serviceFactory.singleton) {
      this.services.set(identifier, instance);
    }
    
    return instance;
  }
}

// Usage in Application Bootstrap
export class ApplicationBootstrap {
  private container = new DIContainer();
  
  configure(): void {
    // Register services
    this.container.register('fileService', () => new FileService());
    this.container.register('windowService', (container) => 
      new WindowService(container.resolve('fileService')));
  }
  
  start(): void {
    this.configure();
    const windowService = this.container.resolve<WindowService>('windowService');
    windowService.createMainWindow();
  }
}
```

---

## 3. Security Patterns

### 3.1 Context Isolation Implementation

**Secure Preload Script Pattern:**
```typescript
// preload.ts - Secure API Bridge
import { contextBridge, ipcRenderer } from 'electron';

// Define type-safe API surface
export interface ElectronAPI {
  file: {
    read(path: string): Promise<string>;
    write(path: string, content: string): Promise<void>;
  };
  window: {
    minimize(): void;
    maximize(): void;
    close(): void;
  };
  app: {
    getVersion(): Promise<string>;
    onUpdateAvailable(callback: () => void): void;
  };
}

// Expose limited, validated API
const electronAPI: ElectronAPI = {
  file: {
    read: (path: string) => ipcRenderer.invoke('file:read', path),
    write: (path: string, content: string) => 
      ipcRenderer.invoke('file:write', path, content)
  },
  
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close')
  },
  
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    onUpdateAvailable: (callback) => 
      ipcRenderer.on('app:update-available', callback)
  }
};

// Secure context bridge exposure
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Global type declaration
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

### 3.2 IPC Security Validation

**Secure IPC Handler Pattern:**
```typescript
// Secure IPC Handler with Validation
export class SecureIPCHandler {
  private allowedOrigins = new Set(['file://']);
  private rateLimiter = new Map<string, number>();
  
  constructor() {
    this.setupSecureHandlers();
  }
  
  private setupSecureHandlers(): void {
    ipcMain.handle('secure-operation', async (event, operation, ...args) => {
      // Validate sender
      if (!this.isValidSender(event.sender)) {
        throw new Error('Unauthorized sender');
      }
      
      // Rate limiting
      if (!this.checkRateLimit(event.sender.id)) {
        throw new Error('Rate limit exceeded');
      }
      
      // Input validation
      this.validateInput(operation, args);
      
      return this.executeSecureOperation(operation, args);
    });
  }
  
  private isValidSender(sender: Electron.WebContents): boolean {
    const url = sender.getURL();
    return this.allowedOrigins.has(new URL(url).protocol);
  }
  
  private checkRateLimit(senderId: number): boolean {
    const now = Date.now();
    const lastRequest = this.rateLimiter.get(senderId.toString()) || 0;
    
    if (now - lastRequest < 100) { // 100ms minimum between requests
      return false;
    }
    
    this.rateLimiter.set(senderId.toString(), now);
    return true;
  }
  
  private validateInput(operation: string, args: any[]): void {
    // Implement schema validation based on operation type
    switch (operation) {
      case 'file:read':
        this.validateFilePath(args[0]);
        break;
      case 'file:write':
        this.validateFilePath(args[0]);
        this.validateFileContent(args[1]);
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
}
```

### 3.3 Content Security Policy (CSP)

**Renderer Process Security Configuration:**
```typescript
// Secure BrowserWindow Configuration
export function createSecureWindow(): BrowserWindow {
  return new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,           // Disable Node.js in renderer
      contextIsolation: true,           // Enable context isolation
      enableRemoteModule: false,        // Disable remote module
      preload: path.join(__dirname, 'preload.js'),
      sandbox: true,                    // Enable sandbox mode
      webSecurity: true,                // Enable web security
      allowRunningInsecureContent: false,
      experimentalFeatures: false
    }
  });
}

// CSP Header Implementation
export class CSPManager {
  private static readonly CSP_HEADER = `
    default-src 'self';
    script-src 'self' 'unsafe-inline';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    font-src 'self';
    connect-src 'self';
    media-src 'self';
    object-src 'none';
    child-src 'none';
    worker-src 'none';
    frame-src 'none';
  `.replace(/\s+/g, ' ').trim();
  
  static applyCSP(window: BrowserWindow): void {
    window.webContents.session.webRequest.onHeadersReceived(
      (details, callback) => {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [this.CSP_HEADER]
          }
        });
      }
    );
  }
}
```

---

## 4. Scalability Patterns

### 4.1 Microkernel Pattern for Extensibility

**Extension System Architecture:**
```typescript
// Core Extension System
export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  activationEvents: string[];
  contributes: ExtensionContributions;
  main?: string;
}

export interface ExtensionContributions {
  commands?: CommandContribution[];
  menus?: MenuContribution[];
  views?: ViewContribution[];
  languages?: LanguageContribution[];
}

export class ExtensionManager {
  private loadedExtensions = new Map<string, LoadedExtension>();
  private contributionRegistry = new ContributionRegistry();
  
  async loadExtension(manifest: ExtensionManifest): Promise<void> {
    // Validate extension manifest
    this.validateManifest(manifest);
    
    // Create isolated execution context
    const extensionHost = new ExtensionHost(manifest.id);
    
    // Load extension code
    if (manifest.main) {
      const extensionModule = await extensionHost.loadModule(manifest.main);
      
      // Register contributions
      this.registerContributions(manifest.contributes);
      
      // Activate extension
      await extensionModule.activate(this.createExtensionContext(manifest.id));
    }
    
    this.loadedExtensions.set(manifest.id, {
      manifest,
      extensionHost,
      isActive: true
    });
  }
  
  private createExtensionContext(extensionId: string): ExtensionContext {
    return {
      subscriptions: new DisposableStore(),
      workspaceState: new WorkspaceState(extensionId),
      globalState: new GlobalState(extensionId),
      extensionPath: this.getExtensionPath(extensionId),
      
      // API surface
      commands: this.createCommandsAPI(extensionId),
      window: this.createWindowAPI(extensionId),
      workspace: this.createWorkspaceAPI(extensionId)
    };
  }
}
```

### 4.2 Feature Flag Architecture

**Feature Toggle System:**
```typescript
// Feature Flag System
export enum FeatureFlag {
  NEW_TERMINAL = 'new-terminal',
  ADVANCED_SEARCH = 'advanced-search',
  DARK_THEME_V2 = 'dark-theme-v2',
  EXPERIMENTAL_EDITOR = 'experimental-editor'
}

export class FeatureFlagService {
  private flags = new Map<FeatureFlag, boolean>();
  private userFlags = new Map<string, Map<FeatureFlag, boolean>>();
  
  constructor(private configService: ConfigService) {
    this.loadFeatureFlags();
  }
  
  isEnabled(flag: FeatureFlag, userId?: string): boolean {
    // Check user-specific override
    if (userId && this.userFlags.has(userId)) {
      const userFlags = this.userFlags.get(userId)!;
      if (userFlags.has(flag)) {
        return userFlags.get(flag)!;
      }
    }
    
    // Check global flag
    return this.flags.get(flag) ?? false;
  }
  
  setFlag(flag: FeatureFlag, enabled: boolean, userId?: string): void {
    if (userId) {
      if (!this.userFlags.has(userId)) {
        this.userFlags.set(userId, new Map());
      }
      this.userFlags.get(userId)!.set(flag, enabled);
    } else {
      this.flags.set(flag, enabled);
    }
    
    // Notify all windows of flag change
    this.notifyFlagChange(flag, enabled, userId);
  }
  
  private notifyFlagChange(
    flag: FeatureFlag, 
    enabled: boolean, 
    userId?: string
  ): void {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('feature-flag:changed', {
        flag,
        enabled,
        userId
      });
    });
  }
}

// Usage in Components
export class FeatureAwareComponent {
  constructor(private featureFlags: FeatureFlagService) {}
  
  render(): React.ReactElement {
    const useNewTerminal = this.featureFlags.isEnabled(
      FeatureFlag.NEW_TERMINAL, 
      this.getCurrentUserId()
    );
    
    return (
      <div>
        {useNewTerminal ? <NewTerminalComponent /> : <LegacyTerminalComponent />}
      </div>
    );
  }
}
```

### 4.3 Progressive Enhancement Strategies

**Adaptive Loading Pattern:**
```typescript
// Progressive Enhancement Manager
export class ProgressiveEnhancementManager {
  private capabilities = new Set<string>();
  private loadedFeatures = new Map<string, boolean>();
  
  constructor() {
    this.detectCapabilities();
  }
  
  private detectCapabilities(): void {
    // Detect system capabilities
    const systemInfo = process.getSystemVersion();
    const memoryUsage = process.getProcessMemoryInfo();
    
    // Add capabilities based on system
    if (memoryUsage.residentSet > 1024 * 1024 * 512) { // 512MB
      this.capabilities.add('high-memory');
    }
    
    if (process.platform === 'darwin') {
      this.capabilities.add('native-titlebar');
    }
    
    // Check GPU acceleration
    if (app.commandLine.hasSwitch('disable-gpu')) {
      this.capabilities.add('software-rendering');
    } else {
      this.capabilities.add('gpu-acceleration');
    }
  }
  
  async loadFeature(featureId: string): Promise<boolean> {
    if (this.loadedFeatures.has(featureId)) {
      return this.loadedFeatures.get(featureId)!;
    }
    
    try {
      const feature = await this.dynamicImportFeature(featureId);
      
      // Check if system supports this feature
      if (this.supportsFeature(feature.requirements)) {
        await feature.initialize();
        this.loadedFeatures.set(featureId, true);
        return true;
      } else {
        // Fall back to basic implementation
        await this.loadFallbackFeature(featureId);
        this.loadedFeatures.set(featureId, false);
        return false;
      }
    } catch (error) {
      console.error(`Failed to load feature ${featureId}:`, error);
      await this.loadFallbackFeature(featureId);
      this.loadedFeatures.set(featureId, false);
      return false;
    }
  }
  
  private supportsFeature(requirements: string[]): boolean {
    return requirements.every(req => this.capabilities.has(req));
  }
  
  private async dynamicImportFeature(featureId: string): Promise<Feature> {
    const featurePath = path.join(__dirname, 'features', `${featureId}.js`);
    return import(featurePath);
  }
}
```

---

## 5. Code Organization

### 5.1 Project Structure Best Practices

**Recommended Directory Structure:**
```
electron-app/
├── src/
│   ├── main/                    # Main Process Code
│   │   ├── index.ts            # Application Entry Point
│   │   ├── window-manager.ts    # Window Lifecycle Management
│   │   ├── services/           # Core Services
│   │   │   ├── file-service.ts
│   │   │   ├── settings-service.ts
│   │   │   └── extension-service.ts
│   │   ├── ipc/               # IPC Handlers
│   │   │   ├── file-handlers.ts
│   │   │   └── window-handlers.ts
│   │   └── security/          # Security Layer
│   │       ├── csp-manager.ts
│   │       └── permission-manager.ts
│   │
│   ├── renderer/               # Renderer Process Code
│   │   ├── index.html         # Main Window HTML
│   │   ├── main.tsx           # React Entry Point
│   │   ├── components/        # UI Components
│   │   ├── services/          # Renderer Services
│   │   ├── stores/           # State Management
│   │   └── types/            # Type Definitions
│   │
│   ├── preload/               # Preload Scripts
│   │   ├── main-preload.ts    # Main Window Preload
│   │   └── worker-preload.ts  # Worker Window Preload
│   │
│   ├── shared/                # Shared Code
│   │   ├── types/            # Common Type Definitions
│   │   ├── constants/        # Application Constants
│   │   ├── utils/           # Utility Functions
│   │   └── ipc/             # IPC Type Definitions
│   │
│   └── extensions/           # Extension System
│       ├── host/            # Extension Host
│       ├── api/            # Extension API
│       └── contrib/        # Core Contributions
│
├── resources/               # Static Resources
├── build/                  # Build Scripts
├── dist/                   # Compiled Output
├── tests/                  # Test Files
├── docs/                   # Documentation
└── scripts/               # Development Scripts
```

### 5.2 Shared Code Between Processes

**Shared Types and Utilities:**
```typescript
// src/shared/types/ipc-types.ts
export interface IPCRequest<T = any> {
  id: string;
  channel: string;
  payload: T;
  timestamp: number;
}

export interface IPCResponse<T = any> {
  id: string;
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

// src/shared/ipc/channels.ts
export const IPC_CHANNELS = {
  // File Operations
  FILE_READ: 'file:read',
  FILE_WRITE: 'file:write',
  FILE_DELETE: 'file:delete',
  
  // Window Management
  WINDOW_CREATE: 'window:create',
  WINDOW_CLOSE: 'window:close',
  WINDOW_MINIMIZE: 'window:minimize',
  
  // Application
  APP_GET_VERSION: 'app:get-version',
  APP_GET_PATH: 'app:get-path',
  APP_QUIT: 'app:quit'
} as const;

// src/shared/utils/validation.ts
export class ValidationUtils {
  static isValidFilePath(path: string): boolean {
    // Cross-platform file path validation
    return typeof path === 'string' && 
           path.length > 0 && 
           !path.includes('..') &&
           !/[<>:"|?*]/.test(path);
  }
  
  static sanitizeInput(input: string): string {
    return input.replace(/[<>:"|?*]/g, '').trim();
  }
}

// src/shared/constants/app-config.ts
export const APP_CONFIG = {
  WINDOW: {
    DEFAULT_WIDTH: 1200,
    DEFAULT_HEIGHT: 800,
    MIN_WIDTH: 800,
    MIN_HEIGHT: 600
  },
  
  IPC: {
    TIMEOUT: 5000,
    MAX_PAYLOAD_SIZE: 1024 * 1024 * 10 // 10MB
  },
  
  SECURITY: {
    MAX_REQUESTS_PER_SECOND: 100,
    ALLOWED_PROTOCOLS: ['file:', 'https:']
  }
} as const;
```

### 5.3 TypeScript Integration Patterns

**Type-Safe IPC Communication:**
```typescript
// src/shared/types/api-surface.ts
export interface ElectronAPI {
  // File operations
  fileService: {
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
    deleteFile(path: string): Promise<void>;
    watchFile(path: string, callback: (event: string) => void): () => void;
  };
  
  // Window management
  windowService: {
    minimize(): void;
    maximize(): void;
    close(): void;
    setTitle(title: string): void;
  };
  
  // Application info
  appService: {
    getVersion(): Promise<string>;
    getPath(name: string): Promise<string>;
    quit(): void;
  };
}

// Type-safe preload implementation
// src/preload/main-preload.ts
import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from '../shared/types/api-surface';

const electronAPI: ElectronAPI = {
  fileService: {
    readFile: (path: string) => ipcRenderer.invoke('file:read', path),
    writeFile: (path: string, content: string) => 
      ipcRenderer.invoke('file:write', path, content),
    deleteFile: (path: string) => ipcRenderer.invoke('file:delete', path),
    watchFile: (path: string, callback: (event: string) => void) => {
      const channel = `file:watch:${path}`;
      ipcRenderer.on(channel, (_, event) => callback(event));
      return () => ipcRenderer.removeAllListeners(channel);
    }
  },
  
  windowService: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    setTitle: (title: string) => ipcRenderer.send('window:set-title', title)
  },
  
  appService: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    getPath: (name: string) => ipcRenderer.invoke('app:get-path', name),
    quit: () => ipcRenderer.send('app:quit')
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Global type declaration
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

### 5.4 Build System Architecture

**Modern Build Configuration with electron-vite:**
```typescript
// electron.vite.config.ts
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: ['electron']
      }
    },
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@main': resolve('src/main')
      }
    }
  },
  
  preload: {
    build: {
      rollupOptions: {
        external: ['electron']
      }
    },
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  
  renderer: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@renderer': resolve('src/renderer')
      }
    },
    plugins: [react()]
  }
});

// package.json build scripts
{
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "package:win": "electron-builder --win",
    "package:mac": "electron-builder --mac",
    "package:linux": "electron-builder --linux",
    "test": "vitest",
    "test:e2e": "playwright test"
  }
}
```

---

## 6. Implementation Examples

### 6.1 Complete Application Architecture

**Main Process Bootstrap:**
```typescript
// src/main/index.ts
import { app, BrowserWindow } from 'electron';
import { ApplicationBootstrap } from './application-bootstrap';
import { SecurityManager } from './security/security-manager';
import { ServiceRegistry } from './services/service-registry';

class ElectronApplication {
  private bootstrap: ApplicationBootstrap;
  private securityManager: SecurityManager;
  
  constructor() {
    this.bootstrap = new ApplicationBootstrap();
    this.securityManager = new SecurityManager();
  }
  
  async initialize(): Promise<void> {
    // Configure security policies
    await this.securityManager.initialize();
    
    // Bootstrap application services
    await this.bootstrap.initialize();
    
    // Setup application event handlers
    this.setupAppEventHandlers();
  }
  
  private setupAppEventHandlers(): void {
    app.whenReady().then(() => {
      this.createMainWindow();
    });
    
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });
    
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createMainWindow();
      }
    });
  }
  
  private createMainWindow(): void {
    const windowService = this.bootstrap.serviceRegistry
      .get<WindowService>('windowService');
    windowService.createMainWindow();
  }
}

// Application entry point
const application = new ElectronApplication();
application.initialize().catch(console.error);
```

### 6.2 Service Registry Implementation

```typescript
// src/main/services/service-registry.ts
export class ServiceRegistry {
  private services = new Map<string, any>();
  private initializing = new Set<string>();
  
  async register<T>(
    identifier: string, 
    serviceClass: new (...args: any[]) => T,
    dependencies: string[] = []
  ): Promise<T> {
    if (this.services.has(identifier)) {
      return this.services.get(identifier);
    }
    
    if (this.initializing.has(identifier)) {
      throw new Error(`Circular dependency detected: ${identifier}`);
    }
    
    this.initializing.add(identifier);
    
    try {
      // Resolve dependencies
      const resolvedDependencies = await Promise.all(
        dependencies.map(dep => this.get(dep))
      );
      
      // Create service instance
      const service = new serviceClass(...resolvedDependencies);
      
      // Initialize if service supports it
      if ('initialize' in service && typeof service.initialize === 'function') {
        await service.initialize();
      }
      
      this.services.set(identifier, service);
      this.initializing.delete(identifier);
      
      return service;
    } catch (error) {
      this.initializing.delete(identifier);
      throw error;
    }
  }
  
  async get<T>(identifier: string): Promise<T> {
    if (this.services.has(identifier)) {
      return this.services.get(identifier);
    }
    
    throw new Error(`Service not found: ${identifier}`);
  }
}
```

### 6.3 Testing Strategies

**Unit Testing with Vitest:**
```typescript
// tests/unit/services/file-service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FileService } from '../../../src/main/services/file-service';

describe('FileService', () => {
  let fileService: FileService;
  
  beforeEach(() => {
    fileService = new FileService();
  });
  
  it('should read file content', async () => {
    // Mock fs operations
    const mockReadFile = vi.fn().mockResolvedValue('file content');
    vi.mock('fs/promises', () => ({
      readFile: mockReadFile
    }));
    
    const content = await fileService.readFile('/test/file.txt');
    
    expect(content).toBe('file content');
    expect(mockReadFile).toHaveBeenCalledWith('/test/file.txt', 'utf8');
  });
  
  it('should validate file paths', () => {
    expect(() => fileService.readFile('../../../etc/passwd'))
      .toThrow('Invalid file path');
    
    expect(() => fileService.readFile('valid/path.txt'))
      .not.toThrow();
  });
});
```

**E2E Testing with Playwright:**
```typescript
// tests/e2e/app.spec.ts
import { test, expect } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';

test.describe('Electron App E2E', () => {
  let electronApp: ElectronApplication;
  let page: Page;
  
  test.beforeAll(async () => {
    electronApp = await electron.launch({
      args: ['dist/main/index.js']
    });
    page = await electronApp.firstWindow();
  });
  
  test.afterAll(async () => {
    await electronApp.close();
  });
  
  test('should load main window', async () => {
    const title = await page.title();
    expect(title).toBe('My Electron App');
  });
  
  test('should handle file operations', async () => {
    // Test file read functionality
    await page.click('[data-testid="open-file-btn"]');
    await page.waitForSelector('[data-testid="file-content"]');
    
    const content = await page.textContent('[data-testid="file-content"]');
    expect(content).toBeTruthy();
  });
});
```

### 6.4 CI/CD Pipeline Configuration

**GitHub Actions Workflow:**
```yaml
# .github/workflows/build-and-test.yml
name: Build and Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node-version: [18, 20]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Run unit tests
      run: npm run test:unit
    
    - name: Run E2E tests
      run: npm run test:e2e
      if: matrix.os == 'ubuntu-latest'
    
    - name: Build application
      run: npm run build
    
    - name: Package application
      run: npm run package
      if: matrix.node-version == 20
  
  release:
    needs: test
    runs-on: ${{ matrix.os }}
    if: github.ref == 'refs/heads/main'
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: 20
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build and package
      run: npm run dist
      env:
        GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Conclusion

This comprehensive guide provides battle-tested architectural patterns and implementation strategies for building robust Electron applications. The patterns outlined here are based on successful implementations like VS Code, and provide a solid foundation for creating scalable, secure, and maintainable desktop applications.

Key takeaways:
- **Security First**: Always implement context isolation and validate IPC communications
- **Process Separation**: Leverage Electron's multi-process architecture for better performance and stability
- **Modular Design**: Use microkernel patterns for extensibility and maintainability
- **Type Safety**: Implement comprehensive TypeScript types across process boundaries
- **Testing Strategy**: Include both unit and E2E testing in your development workflow

These patterns will help you build Electron applications that can scale from simple desktop tools to complex enterprise-grade applications.