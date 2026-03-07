import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import ChoiceModal from '../components/ChoiceModal';
import { Clock } from 'lucide-react';

interface TimeoutChoice {
  type: 'keep-waiting' | 'skip-ai' | 'abort';
}

interface AITimeoutContextType {
  showTimeoutModal: (action: string) => Promise<TimeoutChoice>;
}

const AITimeoutContext = createContext<AITimeoutContextType | null>(null);

export function useAITimeout() {
  const context = useContext(AITimeoutContext);
  if (!context) {
    throw new Error('useAITimeout must be used within AITimeoutProvider');
  }
  return context;
}

interface AITimeoutProviderProps {
  children: ReactNode;
}

export function AITimeoutProvider({ children }: AITimeoutProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState('');

  useEffect(() => {
    const handleTimeout = (event: Event) => {
      const customEvent = event as CustomEvent<{ action: string }>;
      setCurrentAction(customEvent.detail.action);
      setIsOpen(true);
    };

    window.addEventListener('nc-ai-timeout', handleTimeout);

    return () => {
      window.removeEventListener('nc-ai-timeout', handleTimeout);
    };
  }, []);

  const showTimeoutModal = useCallback((action: string): Promise<TimeoutChoice> => {
    return new Promise<TimeoutChoice>((resolve) => {
      setCurrentAction(action);
      setIsOpen(true);
      const handler = (event: Event) => {
        const customEvent = event as CustomEvent<{ action: string; choice: TimeoutChoice['type'] }>;
        if (customEvent.detail.action === action) {
          resolve({ type: customEvent.detail.choice });
          window.removeEventListener('nc-timeout-choice', handler);
        }
      };
      window.addEventListener('nc-timeout-choice', handler);
    });
  }, []);

  const handleChoice = useCallback((type: TimeoutChoice['type']) => {
    // Dispatch the choice event
    window.dispatchEvent(new CustomEvent('nc-timeout-choice', {
      detail: { action: currentAction, choice: type }
    }));
    setIsOpen(false);
  }, [currentAction]);

  const handleClose = useCallback(() => {
    // Clicking outside or cancel = abort
    handleChoice('abort');
  }, [handleChoice]);

  return (
    <AITimeoutContext.Provider value={{ showTimeoutModal }}>
      {children}
      <ChoiceModal
        isOpen={isOpen}
        onClose={handleClose}
        title="AI Generation Taking Too Long"
        message={
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <Clock className="text-amber-500 mt-0.5 flex-shrink-0" size={20} />
              <div>
                <p className="text-slate-300">
                  The AI operation <span className="font-semibold text-white">{currentAction}</span> is taking longer than expected (over 30 seconds).
                </p>
                <p className="text-slate-400 text-xs mt-2">
                  This might indicate the model is processing a complex request or experiencing delays.
                </p>
              </div>
            </div>
          </div>
        }
        choices={[
          {
            label: 'Keep Waiting (30s more)',
            onClick: () => handleChoice('keep-waiting'),
            variant: 'primary',
          },
          {
            label: 'Generate Without AI',
            onClick: () => handleChoice('skip-ai'),
            variant: 'secondary',
          },
          {
            label: 'Abort Generation',
            onClick: () => handleChoice('abort'),
            variant: 'danger',
          },
        ]}
      />
    </AITimeoutContext.Provider>
  );
}
