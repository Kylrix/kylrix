export const TMP_PROTOCOL_VERSION = 3;

export type PayloadKind = "unicast_mail" | "multicast_chat" | "system_directive";

type AttachmentMetadata = {
  content_address_hash: string;
  storage_size_bytes: number;
  file_mime_type: string;
  distributed_url_hint: string;
  file_decryption_key: string;
};

type UnicastMail = {
  message_id: string;
  thread_id: string;
  subject: string;
  body_plaintext: string;
  cc_recipients_npub: string[];
  attachments: AttachmentMetadata[];
};

type MulticastChat = {
  group_id: string;
  group_epoch: number;
  client_message_id: string;
  body_content: string;
  interactive_mentions: string[];
};

enum CommandType {
  UNKNOWN = 0,
  KEY_ROTATION_NOTICE = 1,
  CAPABILITY_REVOCATION = 2,
  GROUP_MEMBERSHIP_SYNC = 3,
  EPOCH_COMMIT = 4}

type SystemDirective = {
  command: CommandType;
  payload_bytes: string;
};

export type TendonEnvelope = {
  protocol_version: number;
  dispatch_timestamp_utc: number;
  capability_token: string;
  cryptographic_nonce: string;
  payload:
    | { kind: "unicast_mail"; value: UnicastMail }
    | { kind: "multicast_chat"; value: MulticastChat }
    | { kind: "system_directive"; value: SystemDirective };
};

export type NostrEventEnvelope = {
  kind: number;
  content_base64: string;
  tags: string[][];
  created_at_unix: number;
};
