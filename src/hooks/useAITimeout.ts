import { useContext } from 'react';
import { AITimeoutContext } from '../context/AITimeoutContext';

export function useAITimeout() {
  const context = useContext(AITimeoutContext);
  if (!context) {
    throw new Error('useAITimeout must be used within AITimeoutProvider');
  }
  return context;
}
