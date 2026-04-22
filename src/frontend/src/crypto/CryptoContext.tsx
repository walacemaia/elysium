/**
 * CryptoContext — provides a session-scoped TransportSecretKey to the entire app.
 *
 * The transport key is generated once on mount and reused for all vetKey operations
 * during the session. It is never persisted to storage.
 */

import type { TransportSecretKey } from "@dfinity/vetkeys";
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { clearVetKeyCache, generateTransportKey } from "./vetkeys";

interface CryptoContextValue {
  transportKey: TransportSecretKey | null;
}

const CryptoContext = createContext<CryptoContextValue>({ transportKey: null });

/**
 * Wraps the app to provide a stable TransportSecretKey for the session.
 * Clears the vetKey cache when the key is regenerated.
 */
export function CryptoProvider({ children }: { children: ReactNode }) {
  const [transportKey, setTransportKey] = useState<TransportSecretKey | null>(
    null,
  );

  useEffect(() => {
    clearVetKeyCache();
    const key = generateTransportKey();
    setTransportKey(key);
  }, []);

  return (
    <CryptoContext.Provider value={{ transportKey }}>
      {children}
    </CryptoContext.Provider>
  );
}

/**
 * Returns the session TransportSecretKey.
 * Will be null briefly on initial mount before the key is generated.
 */
export function useCrypto(): CryptoContextValue {
  return useContext(CryptoContext);
}
