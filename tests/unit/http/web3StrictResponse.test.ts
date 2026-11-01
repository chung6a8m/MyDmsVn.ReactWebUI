import { expect, it } from "vitest";
import { readData } from "../../../src/infrastructure/http/authApi";

it.each([
  '{"data":{},"data":{}}',
  '{"data":{"x":1,"\\u0078":2}}',
  '{"data":{},"extra":true}',
  '{"data":{"name":"\\ud800"}}',
  '{"data":{"id":1e0}}',
])("WEB3 strict responses reject malformed/duplicate envelope: %s", async source => {
  await expect(readData(new Response(source), true)).rejects.toThrow();
});
it("WEB3 strict responses reject invalid UTF8", async () => {
  const bytes = new Uint8Array([123,34,100,97,116,97,34,58,34,192,175,34,125]);
  await expect(readData(new Response(bytes), true)).rejects.toThrow();
});
it("Sales retains its existing response parsing", async () => {
  await expect(readData(new Response('{"data":1,"data":2}'))).resolves.toBe(2);
});
