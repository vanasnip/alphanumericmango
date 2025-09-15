// Main export file for Voice Terminal Components

// Theme
export * from './theme/tokens';

// Phase 1 Components (Complete)
export { Paper } from './components/Paper';
export type { PaperProps } from './components/Paper/Paper';

export { Typography } from './components/Typography';
export type { 
  TypographyVariant,
  FontWeight,
  FontFamily,
  TextColor
} from './components/Typography';

export { Button } from './components/Button';
export type { ButtonProps } from './components/Button/Button';

// Phase 2 Components (Complete)
export { MessageBubble } from './components/MessageBubble';
export type { MessageBubbleProps } from './components/MessageBubble/MessageBubble';

export { HexagonGrid, Hexagon } from './components/HexagonGrid';
export type { HexagonGridProps, HexagonProps } from './components/HexagonGrid/HexagonGrid';

export { TabBar, Tab } from './components/TabBar';
export type { TabBarProps, TabProps } from './components/TabBar/TabBar';
// export { TextField } from './components/TextField';
// export { ProjectCard } from './components/ProjectCard';

// Types
export type { Theme } from './types/theme';