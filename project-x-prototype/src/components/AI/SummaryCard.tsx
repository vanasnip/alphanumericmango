import React from 'react';
import { Bot, AlertTriangle, CheckCircle } from 'lucide-react';
import { AIResponse } from '../../types/index.js';

interface SummaryCardProps {
  response: AIResponse | null;
  isLoading: boolean;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ response, isLoading }) => {
  if (!response && !isLoading) return null;

  return (
    <div className="terminal-window">
      <div className="flex items-center gap-2 mb-3">
        <Bot className="text-terminal-blue" size={20} />
        <span className="font-medium">AI Summary</span>
        {isLoading && (
          <span className="text-xs text-gray-500 ml-auto animate-pulse">
            Analyzing output...
          </span>
        )}
      </div>

      {isLoading && !response && (
        <div className="space-y-2">
          <div className="h-4 bg-terminal-border rounded animate-pulse"></div>
          <div className="h-4 bg-terminal-border rounded animate-pulse w-3/4"></div>
        </div>
      )}

      {response && (
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            {response.hasErrors ? (
              <AlertTriangle className="text-terminal-red mt-0.5" size={16} />
            ) : (
              <CheckCircle className="text-terminal-green mt-0.5" size={16} />
            )}
            <p className="text-sm leading-relaxed">{response.summary}</p>
          </div>

          {response.suggestions && response.suggestions.length > 0 && (
            <div className="mt-3 pt-3 border-t border-terminal-border">
              <div className="text-xs text-gray-500 mb-2">Suggestions:</div>
              <ul className="space-y-1">
                {response.suggestions.map((suggestion, index) => (
                  <li key={index} className="text-sm text-terminal-blue">
                    • {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <button className="hover:text-terminal-blue transition-colors">
              🔊 Play Audio
            </button>
            <button className="hover:text-terminal-blue transition-colors">
              📋 Copy Summary
            </button>
            <button className="hover:text-terminal-blue transition-colors">
              💬 Ask Follow-up
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SummaryCard;