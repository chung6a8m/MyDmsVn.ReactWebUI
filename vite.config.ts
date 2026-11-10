import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

const candidateIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export default defineConfig(({ command, mode }) => {
  const candidateId = loadEnv(mode, process.cwd(), "VITE_").VITE_MYDMSVN_WEB6_CANDIDATE_ID;
  if (command === "build" && candidateId && !candidateIdPattern.test(candidateId)) {
    throw new Error("VITE_MYDMSVN_WEB6_CANDIDATE_ID must be a canonical WEB6 candidate ID");
  }
  return {
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
    }, {
      name: "web6-candidate-build-marker",
      apply: "build",
      configResolved({ env }) {
        if ((env.VITE_MYDMSVN_WEB6_CANDIDATE_ID || null) !== (candidateId || null)) {
          throw new Error("VITE_MYDMSVN_WEB6_CANDIDATE_ID differs from the resolved Vite build value");
        }
      },
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "web6-candidate-build.json",
          source: JSON.stringify({ version: 1, candidateId: candidateId || null }),
        });
      },
    }],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  };
});
