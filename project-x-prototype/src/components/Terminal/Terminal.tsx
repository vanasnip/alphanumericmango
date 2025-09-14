import React, { useEffect, useRef } from 'react';
import { OutputLine } from '../../types/index';

interface TerminalProps {
  lines: OutputLine[];
  currentDirectory: string;
  isExecuting: boolean;
}

const Terminal: React.FC<TerminalProps> = ({ lines, currentDirectory, isExecuting }) => {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new lines are added
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  const getLineColor = (type: OutputLine['type']) => {
    switch (type) {
      case 'command':
        return 'text-terminal-blue';
      case 'error':
        return 'text-terminal-red';
      case 'success':
        return 'text-terminal-green';
      default:
        return 'text-terminal-text';
    }
  };

  return (
    <div className="terminal-window">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-terminal-border">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="text-sm text-gray-500 ml-2">Terminal</span>
        </div>
        <div className="text-sm text-gray-500">
          {currentDirectory}
        </div>
      </div>
      
      <div 
        ref={terminalRef}
        className="h-96 overflow-y-auto font-mono text-sm"
      >
        {lines.map((line) => (
          <div 
            key={line.id} 
            className={`${getLineColor(line.type)} leading-relaxed`}
          >
            {line.text || '\u00A0'}
          </div>
        ))}
        
        {isExecuting && (
          <div className="text-terminal-text animate-pulse">
            <span className="inline-block">▊</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Terminal;