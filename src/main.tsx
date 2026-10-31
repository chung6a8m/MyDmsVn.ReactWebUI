import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { RouterProvider } from "@tanstack/react-router";
import { Providers } from "./app/providers";
import { router } from "./app/router";
import "./index.css";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);
