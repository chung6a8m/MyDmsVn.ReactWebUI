import type {
  PortContext,
  PostAcknowledgement,
  ReadResult,
  SalesDocument,
  SalesListQuery,
  SalesPage,
  SalesSaveSnapshot,
  ServerId,
  VersionToken,
  WriteResult,
} from "../features/sales/contracts";

export interface SalesPort {
  list(
    query: SalesListQuery,
    context: PortContext,
  ): Promise<ReadResult<SalesPage>>;
  get(
    saleId: ServerId,
    context: PortContext,
  ): Promise<ReadResult<SalesDocument>>;
  save(
    snapshot: SalesSaveSnapshot,
    context: PortContext,
  ): Promise<WriteResult<SalesDocument>>;
  post(
    input: { saleId: ServerId; expectedVersion: VersionToken },
    context: PortContext,
  ): Promise<WriteResult<PostAcknowledgement>>;
}
