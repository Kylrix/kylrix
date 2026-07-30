import { encodeEnvelope } from "./codec";
import {
  TMP_PROTOCOL_VERSION,
  type NostrEventEnvelope,
  type PayloadKind,
  type TendonEnvelope} from "./types";

function nonce(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export function buildEnvelope(payload: TendonEnvelope["payload"], capabilityToken = ""): TendonEnvelope {
  return {
    protocol_version: TMP_PROTOCOL_VERSION,
    dispatch_timestamp_utc: Date.now(),
    capability_token: capabilityToken,
    cryptographic_nonce: nonce(),
    payload};
}

function payloadToKind(payloadKind: PayloadKind): number {
  if (payloadKind === "unicast_mail") {
    return 1059;
  }
  if (payloadKind === "multicast_chat") {
    return 42;
  }
  return 30000;
}

export function wrapForNostr(envelope: TendonEnvelope, tags: string[][]): NostrEventEnvelope {
  return {
    kind: payloadToKind(envelope.payload.kind),
    content_base64: encodeEnvelope(envelope),
    tags,
    created_at_unix: Math.floor(envelope.dispatch_timestamp_utc / 1000)};
}
