import type { GoodsReceiptPort } from "../../ports/goodsReceiptPort";
import type { AuthSession } from "./authSession";
import { ProtocolError } from "./authApi";
import { readBoundary, type HttpTransport } from "./readBoundary";
import { writeBoundary } from "./writeBoundary";
import { receiptDetailSchema, receiptListQuerySchema, receiptPageSchema, receiptPostAcknowledgementSchema, receiptPostInputSchema, receiptUpdateSchema } from "./goodsReceiptWireSchemas";
import { mapGoodsReceiptDetail, mapGoodsReceiptPage, mapGoodsReceiptSaveInput, mapGoodsReceiptWriteIssues, mapSavedGoodsReceiptDetail } from "./goodsReceiptWireMapper";
import { serializeWeb3Query, web3ErrorEnvelopeSchema, web3LongId } from "./web3WireSchemas";
import { frozenWriteRequest, type FrozenWriteOptions } from "./frozenWriteRequest";
import { receiptSaveOperationRequest, receiptPostOperationRequest } from "./web4OperationCodec";

export function createGoodsReceiptHttpPort(transport: HttpTransport, auth: AuthSession, options: FrozenWriteOptions = {}): GoodsReceiptPort {
  return {
    list: (query, context) => readBoundary(auth, context, async () => {
      const parameters = serializeWeb3Query(receiptListQuerySchema, query);
      return mapGoodsReceiptPage(receiptPageSchema.parse(await transport.request(`/api/v1/goods-receipts?${parameters}`, { signal: context.signal, strictResponse: true })));
    }, web3ErrorEnvelopeSchema),
    get: (receiptId, context) => readBoundary(auth, context, async () => {
      const id = web3LongId.parse(receiptId);
      const detail = receiptDetailSchema.parse(await transport.request(`/api/v1/goods-receipts/${id}`, { signal: context.signal, strictResponse: true }));
      if (detail.receiptId !== id) throw new ProtocolError();
      return mapGoodsReceiptDetail(detail);
    }, web3ErrorEnvelopeSchema),
    async save(input, context) {
      // Capture order and local identities synchronously, before auth.access or
      // any transport await. Caller edits cannot change payload or field mapping.
      const snapshot = structuredClone(input);
      const result = await writeBoundary(auth, context, async dispatched => {
        if (options.operation) {
          const outcome = await frozenWriteRequest(transport, auth, context, options.operation, receiptSaveOperationRequest(snapshot), dispatched, options.onCommitted, options.onRejected);
          if (outcome.operationKind !== "Receipt.Create" && outcome.operationKind !== "Receipt.Update") throw new ProtocolError();
          return mapSavedGoodsReceiptDetail(outcome.value, snapshot);
        }
        const body = mapGoodsReceiptSaveInput(snapshot);
        const id = snapshot.receiptId === null ? null : web3LongId.parse(snapshot.receiptId);
        const payload = id === null ? body : receiptUpdateSchema.parse({ ...body, expectedVersion: snapshot.expectedVersion });
        const path = id === null ? "/api/v1/goods-receipts" : `/api/v1/goods-receipts/${id}/draft`;
        const data = await transport.request(path, { method: id === null ? "POST" : "PUT", body: JSON.stringify(payload), signal: context.signal, strictResponse: true }, dispatched);
        return mapSavedGoodsReceiptDetail(receiptDetailSchema.parse(data), snapshot);
      }, web3ErrorEnvelopeSchema);
      return result.kind === "failed" ? { ...result, error: mapGoodsReceiptWriteIssues(result.error, snapshot) } : result;
    },
    post: (input, context) => writeBoundary(auth, context, async dispatched => {
      if (options.operation) {
        const outcome = await frozenWriteRequest(transport, auth, context, options.operation, receiptPostOperationRequest(input), dispatched, options.onCommitted, options.onRejected);
        if (outcome.operationKind !== "Receipt.Post") throw new ProtocolError();
        return outcome.value;
      }
      const receiptId = web3LongId.parse(input.receiptId);
      const body = receiptPostInputSchema.parse({ expectedVersion: input.expectedVersion });
      const data = await transport.request(`/api/v1/goods-receipts/${receiptId}/post`, { method: "POST", body: JSON.stringify(body), signal: context.signal, strictResponse: true }, dispatched);
      const acknowledgement = receiptPostAcknowledgementSchema.parse(data);
      if (acknowledgement.receiptId !== receiptId) throw new ProtocolError();
      return acknowledgement;
    }, web3ErrorEnvelopeSchema),
  };
}
