import { useEffect, useRef, useState, useCallback } from 'react';
import { VoiceState, ParsedCommand } from '../types';
import { commandMappings } from '../data/mockResponses';

// Extend Window interface for webkit speech recognition
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export const useVoiceRecognition = () => {
  const [voiceState, setVoiceState] = useState<VoiceState>({
    isListening: false,
    transcript: '',
    interimTranscript: '',
    confidence: 0,
    noiseLevel: 0,
  });

  const recognitionRef = useRef<any>(null);

  const parseCommand = useCallback((transcript: string): ParsedCommand | null => {
    const lowercased = transcript.toLowerCase().trim();
    
    // Check for exact or close matches in command mappings
    for (const [phrase, command] of Object.entries(commandMappings)) {
      if (lowercased.includes(phrase)) {
        // Determine risk level based on command
        let risk: ParsedCommand['risk'] = 'safe';
        if (command.includes('rm') || command.includes('delete') || command.includes('drop')) {
          risk = 'dangerous';
        } else if (command.includes('push') || command.includes('deploy') || command.includes('install')) {
          risk = 'moderate';
        }

        return {
          raw: transcript,
          command,
          confidence: 0.85 + Math.random() * 0.1, // Simulate 85-95% confidence
          risk,
        };
      }
    }

    // If no exact match, try to interpret the command
    if (lowercased.includes('test')) {
      return {
        raw: transcript,
        command: 'npm test',
        confidence: 0.75,
        risk: 'safe',
      };
    }

    return null;
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      
      if (!SpeechRecognition) {
        console.error('Speech recognition not supported');
        alert('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
        return;
      }

      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        setVoiceState(prev => ({
          ...prev,
          transcript: finalTranscript || prev.transcript,
          interimTranscript,
          confidence: event.results[0]?.[0]?.confidence || 0,
        }));
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'no-speech') {
          // Restart recognition if no speech detected
          setTimeout(() => {
            if (recognitionRef.current && voiceState.isListening) {
              recognitionRef.current.start();
            }
          }, 1000);
        }
      };

      recognitionRef.current.onend = () => {
        setVoiceState(prev => ({ ...prev, isListening: false }));
      };
    }

    recognitionRef.current.start();
    setVoiceState(prev => ({ ...prev, isListening: true }));
  }, [voiceState.isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setVoiceState(prev => ({ ...prev, isListening: false }));
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (voiceState.isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [voiceState.isListening, startListening, stopListening]);

  const clearTranscript = useCallback(() => {
    setVoiceState(prev => ({
      ...prev,
      transcript: '',
      interimTranscript: '',
    }));
  }, []);

  // Keyboard shortcut (spacebar)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        toggleListening();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [toggleListening]);

  return {
    ...voiceState,
    startListening,
    stopListening,
    toggleListening,
    clearTranscript,
    parseCommand,
  };
};