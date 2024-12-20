import { createSignal, createEffect } from 'solid-js';

interface ErrorState {
  message: string;
  code?: string;
  details?: unknown;
  timestamp: number;
}

export function useErrorHandler() {
  const [error, setError] = createSignal<ErrorState | null>(null);
  const [hasError, setHasError] = createSignal(false);

  createEffect(() => {
    if (error()) {
      setHasError(true);
      // You could add error reporting service integration here
      console.error('Error occurred:', error());
    } else {
      setHasError(false);
    }
  });

  const handleError = (e: unknown) => {
    const errorState: ErrorState = {
      message: 'An unexpected error occurred',
      timestamp: Date.now()
    };

    if (e instanceof Error) {
      errorState.message = e.message;
      errorState.details = e.stack;
    } else if (typeof e === 'string') {
      errorState.message = e;
    } else {
      errorState.details = e;
    }

    setError(errorState);
  };

  const clearError = () => {
    setError(null);
  };

  const withErrorHandling = <T extends (...args: any[]) => any>(
    fn: T
  ): ((...args: Parameters<T>) => Promise<ReturnType<T>>) => {
    return async (...args: Parameters<T>) => {
      try {
        return await fn(...args);
      } catch (e) {
        handleError(e);
        throw e;
      }
    };
  };

  return {
    error,
    hasError,
    handleError,
    clearError,
    withErrorHandling
  };
} 