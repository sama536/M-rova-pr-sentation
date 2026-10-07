import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { PrefsProvider } from "./hooks/prefs";
import "./styles/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 20_000, refetchOnWindowFocus: false, retry: (count, err) => count < 1 && !(err as { status?: number }).status },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <PrefsProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </PrefsProvider>
    </QueryClientProvider>
  </StrictMode>,
);
