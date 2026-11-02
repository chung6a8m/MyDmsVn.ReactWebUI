import { z } from "./cspZod";

// WEB4 B01 corpus 1c603c6; B04 OperationsController context route. A database
// epoch is opaque server authority, never a JWT sid or locally generated value.
export const deploymentEpochSchema = z.string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  .refine(value => value !== "00000000-0000-0000-0000-000000000000");
const operationsContextSchema = z.object({
  deploymentEpoch: deploymentEpochSchema,
  actorUserId: z.number().int().positive().max(2147483647),
  contractVersion: z.literal("web4-v1"),
}).strict();

export function parseOperationsContext(data: unknown, authoritativeUserId: number) {
  const context = operationsContextSchema.parse(data);
  if (context.actorUserId !== authoritativeUserId) throw Error("Operations context actor mismatch");
  return context;
}
