// The HTTPS host supplies a fresh nonce in each HTML response. Dev/preview have
// no CSP nonce. Both grids and Dockview use the same document-owned value.
export function getStyleNonce(targetDocument: Document = document): string | undefined {
  return targetDocument.querySelector<HTMLMetaElement>('meta[name="mydmsvn-style-nonce"]')?.content || undefined;
}
