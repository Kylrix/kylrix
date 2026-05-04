import { createContext, useContext, useState, useCallback, useEffect } from 'react';

interface SourceContextType {
  source: string | null;
  setSource: (source: string | null) => void;
  redirectUri: string | null;
  setRedirectUri: (redirectUri: string | null) => void;
  getBackUrl: () => string | null;
}

const SourceContext = createContext<SourceContextType | undefined>(undefined);

export function SourceProvider({ children }: { children: React.ReactNode }) {
  const [source, setSource] = useState<string | null>(null);
  const [redirectUri, setRedirectUri] = useState<string | null>(null);
  const [_isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedSource = localStorage.getItem('id_redirect_source');
      const storedRedirectUri = localStorage.getItem('id_redirect_uri');
      if (storedSource) {
        setSource(storedSource);
      }
      if (storedRedirectUri) {
        setRedirectUri(storedRedirectUri);
      }
      setIsInitialized(true);
    }
  }, []);

  const handleSetSource = useCallback((newSource: string | null) => {
    setSource(newSource);
    if (newSource) {
      localStorage.setItem('id_redirect_source', newSource);
    } else {
      localStorage.removeItem('id_redirect_source');
    }
  }, []);

  const handleSetRedirectUri = useCallback((newRedirectUri: string | null) => {
    setRedirectUri(newRedirectUri);
    if (newRedirectUri) {
      localStorage.setItem('id_redirect_uri', newRedirectUri);
    } else {
      localStorage.removeItem('id_redirect_uri');
    }
  }, []);

  const getBackUrl = useCallback(() => {
    if (source === 'kylrixnote' || source === 'note') {
      if (!redirectUri) {
        return null;
      }

      const handoffUrl = new URL('/handoff', window.location.origin);
      handoffUrl.searchParams.set('source', source);
      handoffUrl.searchParams.set('redirect_uri', redirectUri);
      return handoffUrl.toString();
    }

    if (!source) {
      return null;
    }

    if (!source.startsWith('http://') && !source.startsWith('https://')) {
      return `https://${source}`;
    }

    return source;
  }, [redirectUri, source]);

  return (
    <SourceContext.Provider
      value={{
        source,
        setSource: handleSetSource,
        redirectUri,
        setRedirectUri: handleSetRedirectUri,
        getBackUrl,
      }}
    >
      {children}
    </SourceContext.Provider>
  );
}

export function useSource() {
  const context = useContext(SourceContext);
  if (!context) {
    throw new Error('useSource must be used within SourceProvider');
  }
  return context;
}
