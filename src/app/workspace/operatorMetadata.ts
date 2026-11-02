const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const identifier = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
export function operatorMetadata(value: { operationId?: unknown; deploymentEpoch?: unknown; correlationId?: unknown; localDocumentId?: unknown; [key: string]: unknown }) {
  const safeUuid = (input: unknown) => typeof input === "string" && uuid.test(input) && input !== "00000000-0000-0000-0000-000000000000" ? input : undefined;
  const operationId = safeUuid(value.operationId), deploymentEpoch = safeUuid(value.deploymentEpoch), localDocumentId = safeUuid(value.localDocumentId);
  const correlationId = typeof value.correlationId === "string" && identifier.test(value.correlationId) ? value.correlationId : undefined;
  const summary = [operationId && `Mã thao tác: ${operationId}`, deploymentEpoch && `Cơ sở dữ liệu: ${deploymentEpoch}`,
    correlationId && `Mã tương quan: ${correlationId}`, localDocumentId && `Mã bản nháp: ${localDocumentId}`].filter(Boolean).join("\n");
  return { operationId, deploymentEpoch, correlationId, localDocumentId, summary };
}
