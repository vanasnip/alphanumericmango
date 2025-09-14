import React from 'react';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { ParsedCommand } from '../../types/index';

interface CommandPreviewProps {
  command: ParsedCommand | null;
  onExecute: () => void;
  onCancel: () => void;
}

const CommandPreview: React.FC<CommandPreviewProps> = ({ command, onExecute, onCancel }) => {
  if (!command) return null;

  const getRiskColor = (risk: ParsedCommand['risk']) => {
    switch (risk) {
      case 'dangerous':
        return 'border-terminal-red bg-red-900/20';
      case 'moderate':
        return 'border-terminal-yellow bg-yellow-900/20';
      default:
        return 'border-terminal-green bg-green-900/20';
    }
  };

  const getRiskIcon = (risk: ParsedCommand['risk']) => {
    switch (risk) {
      case 'dangerous':
        return <XCircle className="text-terminal-red" size={20} />;
      case 'moderate':
        return <AlertCircle className="text-terminal-yellow" size={20} />;
      default:
        return <CheckCircle className="text-terminal-green" size={20} />;
    }
  };

  return (
    <div className={`terminal-window border-2 ${getRiskColor(command.risk)}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {getRiskIcon(command.risk)}
          <span className="font-medium">Command Preview</span>
        </div>
        <div className="text-sm text-gray-500">
          Confidence: {Math.round(command.confidence * 100)}%
        </div>
      </div>

      <div className="mb-4">
        <div className="text-xs text-gray-500 mb-1">You said:</div>
        <div className="text-sm italic text-gray-400">"{command.raw}"</div>
      </div>

      <div className="mb-4">
        <div className="text-xs text-gray-500 mb-1">Will execute:</div>
        <div className="font-mono text-terminal-blue bg-terminal-bg p-2 rounded">
          $ {command.command}
        </div>
      </div>

      {command.risk === 'dangerous' && (
        <div className="mb-4 p-2 bg-red-900/30 rounded text-terminal-red text-sm">
          ⚠️ This command may have destructive effects. Please confirm carefully.
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onExecute}
          className="flex-1 bg-terminal-blue hover:bg-blue-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
        >
          Say "Execute" or Click to Run
        </button>
        <button
          onClick={onCancel}
          className="flex-1 bg-terminal-border hover:bg-terminal-red text-white py-2 px-4 rounded-lg font-medium transition-colors"
        >
          Cancel
        </button>
      </div>

      <div className="mt-3 text-xs text-gray-500 text-center">
        Safety gate active - command requires confirmation
      </div>
    </div>
  );
};

export default CommandPreview;