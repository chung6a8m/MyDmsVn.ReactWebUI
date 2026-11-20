import type { ValidationIssue } from "../../ports/portContracts";

export type DocumentModule = "sales" | "goods-receipt";

// Encode separators as well as punctuation; composite IDs cannot collide if a
// session ID, field name or clientLineId contains a dash, colon or percent.
function part(value: string) {
  return encodeURIComponent(value).replace(/[-_.!~*'()]/g, (character) =>
    "%" + character.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0"));
}

export function documentFieldId(module: DocumentModule, sessionId: string, field: string) {
  return ["doc-field", module, part(sessionId), part(field)].join("-");
}

export function validationIssueId(module: DocumentModule, sessionId: string, issue: ValidationIssue, index: number) {
  return ["doc-issue", module, part(sessionId), part(issue.field), part(issue.clientLineId ?? ""), part(issue.code), String(index)].join("-");
}

export function fieldIssueMessages(issues: readonly ValidationIssue[] | undefined, field: string): string[] {
  return issues?.filter(issue => issue.field === field).map(issue => issue.message) ?? [];
}
