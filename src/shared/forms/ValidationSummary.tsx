import type { ValidationIssue } from "../../ports/portContracts";
import { validationIssueId, type DocumentModule } from "./fieldIdentity";

export function ValidationSummary({
  module, sessionId, issues, label, onSelect,
}: {
  module: DocumentModule;
  sessionId: string;
  issues: readonly ValidationIssue[];
  label: string;
  onSelect?: (issue: ValidationIssue) => void;
}) {
  if (!issues.length) return null;
  return (
    <section aria-label={label} className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm" tabIndex={-1}>
      <p className="mb-1 font-medium">Cần kiểm tra {issues.length} lỗi trong chứng từ:</p>
      <ul aria-label={label} className="list-disc space-y-1 pl-5">
        {issues.map((issue, index) => (
          <li key={validationIssueId(module, sessionId, issue, index)}
            id={validationIssueId(module, sessionId, issue, index)}
            data-line-id={issue.clientLineId}>
            {onSelect && issue.field ? (
              <button type="button" className="cursor-pointer text-left underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
                onClick={() => onSelect(issue)}>{issue.message}</button>
            ) : issue.message}
          </li>
        ))}
      </ul>
    </section>
  );
}
