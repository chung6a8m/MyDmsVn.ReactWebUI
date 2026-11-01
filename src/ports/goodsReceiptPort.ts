import type { GoodsReceiptDocument, GoodsReceiptListQuery, GoodsReceiptPage, GoodsReceiptPostAcknowledgement, GoodsReceiptSaveSnapshot } from "../features/goodsReceipt/contracts";
import type { PortContext, ReadResult, WriteResult } from "./portContracts";
export interface GoodsReceiptPort {
  list(query: GoodsReceiptListQuery, context: PortContext): Promise<ReadResult<GoodsReceiptPage>>;
  get(receiptId: string, context: PortContext): Promise<ReadResult<GoodsReceiptDocument>>;
  save(snapshot: GoodsReceiptSaveSnapshot, context: PortContext): Promise<WriteResult<GoodsReceiptDocument>>;
  post(input: { receiptId: string; expectedVersion: string }, context: PortContext): Promise<WriteResult<GoodsReceiptPostAcknowledgement>>;
}
