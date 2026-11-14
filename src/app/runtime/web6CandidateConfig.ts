import type { AuthSession } from "../../infrastructure/http/authSession";
import { createProductionRuntime } from "./createProductionRuntime";

const candidateIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export type Web6CandidateConfig = { enabled: false } | { enabled: true; candidateId: string };

export function readWeb6CandidateConfig(value: string | undefined): Web6CandidateConfig {
  return value && candidateIdPattern.test(value)
    ? { enabled: true, candidateId: value }
    : { enabled: false };
}

export function createConfiguredProductionRuntime(auth: AuthSession) {
  const config = readWeb6CandidateConfig(import.meta.env.VITE_MYDMSVN_WEB6_CANDIDATE_ID);
  return config.enabled
    ? createProductionRuntime(auth, { manualResend: { enabled: true, candidateId: config.candidateId } })
    : createProductionRuntime(auth);
}
