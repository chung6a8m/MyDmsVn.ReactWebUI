import { expect, it } from "vitest";
import type { GoodsReceiptSaveSnapshot } from "../../src/features/goodsReceipt/contracts";
import type { SalesSaveSnapshot } from "../../src/features/sales/contracts";
import type { WriteResult } from "../../src/ports/portContracts";
import { createAuthSession } from "../../src/infrastructure/http/authSession";
import { createHttpTransport } from "../../src/infrastructure/http/httpTransport";
import { createSalesHttpPort } from "../../src/infrastructure/http/salesHttpPort";
import { createGoodsReceiptHttpPort } from "../../src/infrastructure/http/goodsReceiptHttpPort";
import { type Web4CommittedResult } from "../../src/infrastructure/http/operationStatusPort";
import { createOperationResolutionPort } from "../../src/infrastructure/http/operationResolutionPort";
import { mapSavedDetail } from "../../src/infrastructure/http/salesWireMapper";
import { mapSavedGoodsReceiptDetail } from "../../src/infrastructure/http/goodsReceiptWireMapper";
import { scaledDecimal } from "../../src/infrastructure/http/web3WireSchemas";
import {
  freezeWeb4Operation, receiptPostOperationRequest, receiptSaveOperationRequest, salesPostOperationRequest, salesSaveOperationRequest,
  type FrozenWeb4Operation, type Web4WireIntent,
} from "../../src/infrastructure/http/web4OperationCodec";
import { connectTestServer } from "./testServerFetch";

// One Vitest case inside one backend-owned .NET/SQL wrapper. This proves actual
// frontend port interoperability, not browser storage, IIS/TLS or user confirmation.
it("resolves six original results and six durable negative decisions through actual exact13 without Read", async () => {
  const bridge = await connectTestServer("web5");
  const controller = new AbortController();
  try {
    const memory = new Map<string, string>();
    const auth = createAuthSession({
      fetch: bridge.fetch,
      storage: { getItem: key => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, value); }, removeItem: key => { memory.delete(key); } },
      lock: async work => work(), notify: () => {},
    });
    await auth.login(bridge.bootstrap.actor.username, bridge.bootstrap.actor.password);
    expect(await auth.loadFeatureCapabilities("goods-receipt")).toBe(true);
    const authenticated = auth.getSnapshot();
    expect(authenticated.status).toBe("authenticated");
    expect(authenticated.actorKey).toBe(String(bridge.bootstrap.actor.userId));
    expect(authenticated.features.sales).toEqual({ read: false, write: true, post: true });
    expect(authenticated.features["goods-receipt"]).toEqual({ read: false, write: true, post: true });
    const deploymentEpoch = authenticated.deploymentEpoch;
    if (!deploymentEpoch) throw new Error("Authoritative operation context did not supply an epoch.");
    const context = { deploymentEpoch, actorKey: authenticated.actorKey, actorGeneration: authenticated.actorGeneration, signal: controller.signal };
    const transport = createHttpTransport(auth, bridge.fetch);
    const operations = createOperationResolutionPort(transport, auth);
    const frozen: FrozenWeb4Operation[] = [];
    const freeze = async (request: Web4WireIntent) => {
      const operation = await freezeWeb4Operation(request, { deploymentEpoch, actorKey: context.actorKey, operationId: crypto.randomUUID() });
      frozen.push(operation);
      return operation;
    };
    async function recover<T>(operation: FrozenWeb4Operation, send: () => Promise<WriteResult<T>>, map: (result: Web4CommittedResult) => T, restart = false): Promise<T> {
      bridge.suppressFirstAcknowledgement(operation.operationId);
      expect(await send(), operation.request.operationKind).toEqual({ kind: "outcome-unknown" });
      expect(bridge.mutationDispatches.get(operation.operationId), "No automatic resend after acknowledgement loss").toBe(1);
      if (restart) await bridge.restart();
      const status = await operations.read(operation, context);
      if (status.kind !== "committed") throw new Error(`${operation.request.operationKind} did not return its original committed result.`);
      expect(status.operationKind).toBe(operation.request.operationKind);
      expect(status.value).toEqual(bridge.originalMutationData(operation.operationId));
      const recovered = map(status);
      expect(bridge.mutationDispatches.get(operation.operationId), "Status reads cannot dispatch another mutation").toBe(1);
      return recovered;
    }
    const catalog = bridge.bootstrap.catalog;
    const receiptCreate: GoodsReceiptSaveSnapshot = {
      receiptId: null, expectedVersion: null, receiptDate: "2024-02-29", warehouseId: String(catalog.warehouseId), employeeId: String(catalog.employeeId), note: "Nhập kho",
      lines: [{ clientLineId: "receipt-initial", receiptLineId: null, productId: String(catalog.productId), quantity: "10.0000", unitCost: "12.0000" }],
    };
    const receiptCreateOperation = await freeze(receiptSaveOperationRequest(receiptCreate));
    expect(receiptCreateOperation.request.requestTargetId).toBeNull();
    const receiptCreatePort = createGoodsReceiptHttpPort(transport, auth, { operation: receiptCreateOperation });
    const createdReceipt = await recover(receiptCreateOperation, () => receiptCreatePort.save(receiptCreate, context), result => {
      if (result.operationKind !== "Receipt.Create") throw new Error("Unexpected Receipt Create result kind.");
      return mapSavedGoodsReceiptDetail(result.value, receiptCreate);
    }, true);
    expect(createdReceipt.saved.lines.map(line => line.clientLineId)).toEqual(["receipt-initial"]);

    const receiptUpdate: GoodsReceiptSaveSnapshot = {
      ...createdReceipt.saved, note: "Nhập kho đã sửa", lines: [
        { clientLineId: "receipt-other", receiptLineId: null, productId: String(catalog.otherProductId), quantity: "4.0000", unitCost: "2.5000" },
        { clientLineId: "receipt-product", receiptLineId: createdReceipt.saved.lines[0].receiptLineId, productId: String(catalog.productId), quantity: "20.0000", unitCost: "15.0000" },
      ],
    };
    const receiptUpdateOperation = await freeze(receiptSaveOperationRequest(receiptUpdate));
    const receiptUpdatePort = createGoodsReceiptHttpPort(transport, auth, { operation: receiptUpdateOperation });
    const updatedReceipt = await recover(receiptUpdateOperation, () => receiptUpdatePort.save(receiptUpdate, context), result => {
      if (result.operationKind !== "Receipt.Update") throw new Error("Unexpected Receipt Update result kind.");
      return mapSavedGoodsReceiptDetail(result.value, receiptUpdate);
    });
    expect(updatedReceipt.version).not.toBe(createdReceipt.version);
    expect(updatedReceipt.lines.map(line => line.productId)).toEqual([String(catalog.otherProductId), String(catalog.productId)]);
    expect(updatedReceipt.lines.every(line => line.receiptLineId !== createdReceipt.lines[0].receiptLineId)).toBe(true);
    const receiptPostInput = { receiptId: updatedReceipt.receiptId, expectedVersion: updatedReceipt.version };
    const receiptPostOperation = await freeze(receiptPostOperationRequest(receiptPostInput));
    const receiptPostPort = createGoodsReceiptHttpPort(transport, auth, { operation: receiptPostOperation });
    const postedReceipt = await recover(receiptPostOperation, () => receiptPostPort.post(receiptPostInput, context), result => {
      if (result.operationKind !== "Receipt.Post") throw new Error("Unexpected Receipt Post result kind.");
      return result.value;
    });
    expect(postedReceipt.status).toBe("Posted");
    expect(Object.hasOwn(postedReceipt, "version")).toBe(false);
    expect(await receiptPostPort.get(postedReceipt.receiptId, context)).toMatchObject({ kind: "failed", error: { kind: "forbidden" } });

    const salesCreate: SalesSaveSnapshot = {
      saleId: null, expectedVersion: null, saleDate: "2024-02-29", customerId: String(catalog.customerId), warehouseId: String(catalog.warehouseId), employeeId: String(catalog.employeeId), note: "Bán hàng — hàng tặng",
      lines: [
        { clientLineId: "sale-paid", saleLineId: null, productId: String(catalog.productId), qty: "3.0000", unitPrice: "25.0000", isGift: false },
        { clientLineId: "sale-gift", saleLineId: null, productId: String(catalog.productId), qty: "2.0000", unitPrice: "25.0000", isGift: true },
        { clientLineId: "sale-zero", saleLineId: null, productId: String(catalog.productId), qty: "1.0000", unitPrice: "0.0000", isGift: false },
      ],
    };
    const salesCreateOperation = await freeze(salesSaveOperationRequest(salesCreate));
    expect(salesCreateOperation.request.requestTargetId).toBeNull();
    const salesCreatePort = createSalesHttpPort(transport, auth, { operation: salesCreateOperation });
    const createdSale = await recover(salesCreateOperation, () => salesCreatePort.save(salesCreate, context), result => {
      if (result.operationKind !== "Sales.Create") throw new Error("Unexpected Sales Create result kind.");
      return mapSavedDetail(result.value, salesCreate);
    });
    expect(createdSale.saved.lines.map(line => line.clientLineId)).toEqual(["sale-paid", "sale-gift", "sale-zero"]);
    const salesUpdate: SalesSaveSnapshot = { ...createdSale.saved, lines: [
      ...createdSale.saved.lines,
      { clientLineId: "sale-other", saleLineId: null, productId: String(catalog.otherProductId), qty: "1.0000", unitPrice: "10.0000", isGift: false },
    ] };
    const salesUpdateOperation = await freeze(salesSaveOperationRequest(salesUpdate));
    const salesUpdatePort = createSalesHttpPort(transport, auth, { operation: salesUpdateOperation });
    const updatedSale = await recover(salesUpdateOperation, () => salesUpdatePort.save(salesUpdate, context), result => {
      if (result.operationKind !== "Sales.Update") throw new Error("Unexpected Sales Update result kind.");
      return mapSavedDetail(result.value, salesUpdate);
    });
    expect(updatedSale.version).not.toBe(createdSale.version);
    expect(updatedSale.lines.slice(0, 3).map(line => line.saleLineId)).toEqual(createdSale.lines.map(line => line.saleLineId));
    expect(new Set(updatedSale.lines.map(line => line.saleLineId)).size).toBe(4);
    expect(scaledDecimal(updatedSale.totalAmount, 4)).toBe(850_000n);
    const salesPostInput = { saleId: updatedSale.saleId, expectedVersion: updatedSale.version };
    const salesPostOperation = await freeze(salesPostOperationRequest(salesPostInput));
    const salesPostPort = createSalesHttpPort(transport, auth, { operation: salesPostOperation });
    const postedSale = await recover(salesPostOperation, () => salesPostPort.post(salesPostInput, context), result => {
      if (result.operationKind !== "Sales.Post") throw new Error("Unexpected Sales Post result kind.");
      return result.value;
    });
    expect(postedSale.status).toBe("Posted");
    expect(postedSale.version).not.toBe(updatedSale.version);
    expect(await salesPostPort.get(postedSale.saleId, context)).toMatchObject({ kind: "failed", error: { kind: "forbidden" } });

    expect(frozen).toHaveLength(6);
    expect(bridge.mutationDispatches.size).toBe(6);
    expect([...bridge.mutationDispatches.values()]).toEqual([1, 1, 1, 1, 1, 1]);
    expect(bridge.statusRequests).toEqual(frozen.map(operation => ({ operationId: operation.operationId, fingerprint: operation.requestFingerprint, epoch: deploymentEpoch })));

    const negativeCases = [
      { original: receiptCreateOperation, send: (operation: FrozenWeb4Operation) => createGoodsReceiptHttpPort(transport, auth, { operation }).save(receiptCreate, context) },
      { original: receiptUpdateOperation, send: (operation: FrozenWeb4Operation) => createGoodsReceiptHttpPort(transport, auth, { operation }).save(receiptUpdate, context) },
      { original: receiptPostOperation, send: (operation: FrozenWeb4Operation) => createGoodsReceiptHttpPort(transport, auth, { operation }).post(receiptPostInput, context) },
      { original: salesCreateOperation, send: (operation: FrozenWeb4Operation) => createSalesHttpPort(transport, auth, { operation }).save(salesCreate, context) },
      { original: salesUpdateOperation, send: (operation: FrozenWeb4Operation) => createSalesHttpPort(transport, auth, { operation }).save(salesUpdate, context) },
      { original: salesPostOperation, send: (operation: FrozenWeb4Operation) => createSalesHttpPort(transport, auth, { operation }).post(salesPostInput, context) },
    ];
    for (const entry of negativeCases) {
      const operation = await freezeWeb4Operation(entry.original.request, { deploymentEpoch, actorKey: context.actorKey, operationId: crypto.randomUUID() });
      // Only the owned private backend test fixture has operator authority. It
      // commits and independently checks SQL before the production v2 port reads.
      await bridge.resolve(operation);
      const negative = await operations.read(operation, context);
      expect(negative.kind, operation.request.operationKind).toBe("not-executed");
      expect(bridge.mutationDispatches.has(operation.operationId)).toBe(false);
      // A deliberate late first arrival tests the server fence. This test action
      // does not enable a browser resend or infer rollback from the HTTP error.
      expect(await entry.send(operation)).toEqual({ kind: "outcome-unknown" });
      expect(bridge.mutationDispatches.get(operation.operationId)).toBe(1);
      expect(await operations.read(operation, context)).toEqual(negative);
    }
    expect(bridge.mutationDispatches.size).toBe(12);
    expect([...bridge.mutationDispatches.values()].every(count => count === 1)).toBe(true);
    expect(bridge.statusRequests).toHaveLength(18);
    await bridge.complete();
  } finally { controller.abort(); bridge.close(); }
});
