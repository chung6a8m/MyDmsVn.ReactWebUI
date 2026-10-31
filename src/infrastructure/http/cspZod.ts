import { z } from "zod";

// Configure before constructing schemas: even Zod's caught eval capability
// probe violates the production script-src policy. Use its supported runtime parser.
z.config({ jitless: true });
export { z };
