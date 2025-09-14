import React from 'react';
import { Mic, MicOff } from 'lucide-react';

interface VoiceIndicatorProps {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  onToggle: () => void;
}

const VoiceIndicator: React.FC<VoiceIndicatorProps> = ({ 
  isListening, 
  transcript, 
  interimTranscript,
  onToggle 
}) => {
  return (
    <div className="terminal-window">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggle}
            className={`p-3 rounded-lg transition-all ${
              isListening 
                ? 'bg-terminal-blue text-white animate-pulse-glow' 
                : 'bg-terminal-border hover:bg-terminal-blue hover:text-white'
            }`}
          >
            {isListening ? <Mic size={24} /> : <MicOff size={24} />}
          </button>
          
          <div className="flex items-center gap-2">
            {isListening && (
              <>
                <div className="voice-indicator listening"></div>
                <span className="text-terminal-blue font-medium">Listening...</span>
              </>
            )}
            {!isListening && (
              <span className="text-gray-500">Press spacebar or click mic to start</span>
            )}
          </div>
        </div>

        <div className="text-sm text-gray-500">
          Say "Hey Terminal" to activate
        </div>
      </div>

      {(transcript || interimTranscript) && (
        <div className="mt-4 p-3 bg-terminal-bg rounded-lg">
          <div className="text-xs text-gray-500 mb-1">Transcript:</div>
          <div className="font-mono">
            {transcript && (
              <span className="text-terminal-text">{transcript}</span>
            )}
            {interimTranscript && (
              <span className="text-gray-500 italic"> {interimTranscript}</span>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-terminal-green' : 'bg-gray-600'}`}></div>
          <span className="text-xs text-gray-500">Status</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-terminal-blue"></div>
          <span className="text-xs text-gray-500">Ready</span>
        </div>
      </div>
    </div>
  );
};

export default VoiceIndicator;