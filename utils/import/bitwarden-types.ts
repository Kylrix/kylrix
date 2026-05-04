export interface BitwardenExport {
  encrypted: boolean;
  folders: BitwardenFolder[];
  items: BitwardenItem[];
}

export interface BitwardenFolder {
  id: string;
  name: string;
}

export interface BitwardenItem {
  collectionIds: null;
  creationDate: string;
  deletedDate: null;
  favorite: boolean;
  fields: BitwardenCustomField[] | null;
  folderId: string | null;
  id: string;
  login: BitwardenLogin | null;
  name: string;
  notes: string | null;
  organizationId: null;
  passwordHistory: null;
  reprompt: number;
  revisionDate: string;
  type: number;
}

export interface BitwardenLogin {
  password: string | null;
  totp: string | null;
  uris: BitwardenUri[] | null;
  username: string | null;
}

export interface BitwardenUri {
  match: null;
  uri: string;
}

export interface BitwardenCustomField {
  linkedId: null;
  name: string;
  type: number;
  value: string;
}

export const BITWARDEN_ITEM_TYPES = {
  LOGIN: 1,
  SECURE_NOTE: 2,
  CARD: 3,
  IDENTITY: 4,
} as const;

export const BITWARDEN_FIELD_TYPES = {
  TEXT: 0,
  HIDDEN: 1,
  BOOLEAN: 2,
  LINKED: 3,
} as const;
