import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: "exclude-lab-from-production",
    apply: "build",
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== "chunk") continue;
        const forbidden = Object.keys(output.modules).filter((id) =>
          /\/src\/(lab|infrastructure\/fake)\//.test(id.replaceAll("\\", "/")),
        );
        if (forbidden.length) this.error(`Production contains Lab/fake modules: ${forbidden.join(", ")}`);
      }
    },
  }],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
