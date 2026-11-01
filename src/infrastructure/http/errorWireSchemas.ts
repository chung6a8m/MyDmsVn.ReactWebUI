import { z } from "./cspZod";

export const errorEnvelopeSchema = z.object({ error: z.object({ code: z.string(), message: z.string(), details: z.array(z.object({ code: z.string(), message: z.string(), field: z.string().optional() }).strict()).optional(), correlationId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).optional() }).strict() }).strict();
