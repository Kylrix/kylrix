"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode17 = __toESM(require("vscode"), 1);

// src/views/status.ts
var vscode = __toESM(require("vscode"), 1);

// ../cli/src/config.ts
var fs = __toESM(require("fs"), 1);
var path = __toESM(require("path"), 1);
var os = __toESM(require("os"), 1);
var DEFAULT_API_URL = "https://www.kylrix.space";
var DEFAULT_OFFLINE_ACCOUNT = "default";
var CONFIG_DIR = path.join(os.homedir(), ".kylrix");
var CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
function normalizeBaseUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return DEFAULT_API_URL;
  let url = rawUrl.trim();
  if (!url) return DEFAULT_API_URL;
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  url = url.replace(/\/+$/, "");
  url = url.replace(/\/api\/v1$/, "").replace(/\/api$/, "");
  return url;
}
function getBaseUriPartitionKey(rawUrl) {
  const normalized = normalizeBaseUrl(rawUrl);
  if (normalized === DEFAULT_API_URL || normalized === "https://kylrix.space") {
    return "default";
  }
  try {
    const u = new URL(normalized);
    const portPart = u.port ? `_${u.port}` : "";
    const safeHost = `${u.protocol.replace(":", "")}_${u.hostname}${portPart}`;
    return safeHost.replace(/[^a-zA-Z0-9_-]/g, "_");
  } catch {
    return normalized.replace(/[^a-zA-Z0-9_-]/g, "_");
  }
}
function getAccountSlug(userId) {
  if (!userId || typeof userId !== "string") {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed?.defaultSyncSource) return String(parsed.defaultSyncSource).replace(/[^a-zA-Z0-9_-]/g, "_");
      }
    } catch {
    }
    return DEFAULT_OFFLINE_ACCOUNT;
  }
  return userId.replace(/[^a-zA-Z0-9_-]/g, "_");
}
function getSiloDir(baseUrl, userId) {
  const partition = getBaseUriPartitionKey(baseUrl);
  const accountSlug = getAccountSlug(userId);
  const dir = path.join(CONFIG_DIR, "silos", partition, accountSlug);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}
function getSiloDbPath(baseUrl, userId) {
  const dir = getSiloDir(baseUrl, userId);
  const siloDb = path.join(dir, "local.db");
  const legacyDb = path.join(CONFIG_DIR, "local.db");
  const partitionKey = getBaseUriPartitionKey(baseUrl);
  if (!fs.existsSync(siloDb) && fs.existsSync(legacyDb) && partitionKey === "default") {
    try {
      fs.copyFileSync(legacyDb, siloDb);
    } catch {
    }
  }
  const anonDb = path.join(CONFIG_DIR, "silos", partitionKey, "anonymous", "local.db");
  if (!fs.existsSync(siloDb) && fs.existsSync(anonDb) && getAccountSlug(userId) === DEFAULT_OFFLINE_ACCOUNT) {
    try {
      fs.copyFileSync(anonDb, siloDb);
    } catch {
    }
  }
  return siloDb;
}
function getSiloFallbackPath(baseUrl, userId) {
  const dir = getSiloDir(baseUrl, userId);
  const siloJson = path.join(dir, "local-store.json");
  const legacyJson = path.join(CONFIG_DIR, "local-store.json");
  const partitionKey = getBaseUriPartitionKey(baseUrl);
  if (!fs.existsSync(siloJson) && fs.existsSync(legacyJson) && partitionKey === "default") {
    try {
      fs.copyFileSync(legacyJson, siloJson);
    } catch {
    }
  }
  const anonJson = path.join(CONFIG_DIR, "silos", partitionKey, "anonymous", "local-store.json");
  if (!fs.existsSync(siloJson) && fs.existsSync(anonJson) && getAccountSlug(userId) === DEFAULT_OFFLINE_ACCOUNT) {
    try {
      fs.copyFileSync(anonJson, siloJson);
    } catch {
    }
  }
  return siloJson;
}
function createEmptyConfig() {
  const defaultServer = DEFAULT_API_URL;
  return {
    currentServer: defaultServer,
    servers: {
      [defaultServer]: {
        baseUrl: defaultServer,
        partitionKey: "default",
        accounts: {}
      }
    },
    apiUrl: defaultServer
  };
}
function syncLegacyFields(config, activeServerUrl, account) {
  config.apiUrl = activeServerUrl;
  config.token = account?.token;
  config.userId = account?.userId;
  config.email = account?.email;
  config.workspaceId = account?.workspaceId;
  config.tier = account?.tier;
}
function migrateConfigIfNeeded(parsed) {
  if (parsed && typeof parsed === "object" && parsed.servers && typeof parsed.servers === "object") {
    return parsed;
  }
  const legacyUrl = normalizeBaseUrl(parsed?.apiUrl || DEFAULT_API_URL);
  const partitionKey = getBaseUriPartitionKey(legacyUrl);
  const config = createEmptyConfig();
  config.currentServer = legacyUrl;
  const legacyUserId = parsed?.userId;
  config.servers[legacyUrl] = {
    baseUrl: legacyUrl,
    partitionKey,
    activeAccountId: legacyUserId,
    accounts: {}
  };
  if (legacyUserId || parsed?.token) {
    const accId = legacyUserId || "legacy_user";
    config.servers[legacyUrl].activeAccountId = accId;
    config.servers[legacyUrl].accounts[accId] = {
      userId: accId,
      email: parsed?.email,
      token: parsed?.token,
      workspaceId: parsed?.workspaceId,
      tier: parsed?.tier,
      lastUsedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  syncLegacyFields(config, legacyUrl, legacyUserId ? config.servers[legacyUrl].accounts[legacyUserId] : void 0);
  return config;
}
function loadConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return createEmptyConfig();
    }
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return migrateConfigIfNeeded(parsed);
  } catch {
    return createEmptyConfig();
  }
}
function saveMasterConfig(config) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { encoding: "utf-8", mode: 384 });
  } catch (err) {
    throw new Error(`Failed to save config to ${CONFIG_FILE}: ${err.message}`);
  }
}
function saveConfig(updates, targetServerUrl) {
  const config = loadConfig();
  const rawUrl = updates.apiUrl || targetServerUrl || config.currentServer || DEFAULT_API_URL;
  const normUrl = normalizeBaseUrl(rawUrl);
  const partitionKey = getBaseUriPartitionKey(normUrl);
  if (!config.servers[normUrl]) {
    config.servers[normUrl] = {
      baseUrl: normUrl,
      partitionKey,
      accounts: {}
    };
  }
  const server = config.servers[normUrl];
  let accId = updates.userId || server.activeAccountId;
  if (!accId) {
    accId = updates.email ? updates.email.replace(/[^a-zA-Z0-9_-]/g, "_") : "anonymous";
  }
  const existingAcc = server.accounts[accId] || { userId: accId };
  const hasWorkspaceUpdate = "workspaceId" in updates;
  const updatedAcc = {
    ...existingAcc,
    userId: updates.userId || existingAcc.userId || accId,
    email: updates.email !== void 0 ? updates.email : existingAcc.email,
    token: updates.token !== void 0 ? updates.token : existingAcc.token,
    workspaceId: hasWorkspaceUpdate ? updates.workspaceId || void 0 : existingAcc.workspaceId,
    tier: updates.tier !== void 0 ? updates.tier : existingAcc.tier,
    lastUsedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  server.accounts[updatedAcc.userId] = updatedAcc;
  server.activeAccountId = updatedAcc.userId;
  config.currentServer = normUrl;
  syncLegacyFields(config, normUrl, updatedAcc);
  if (hasWorkspaceUpdate && !updates.workspaceId) {
    config.workspaceId = void 0;
    if (server.accounts[updatedAcc.userId]) {
      delete server.accounts[updatedAcc.userId].workspaceId;
    }
  }
  saveMasterConfig(config);
  return config;
}
function switchAccount(idOrEmail, serverUrl) {
  const config = loadConfig();
  const normUrl = normalizeBaseUrl(serverUrl || config.currentServer);
  const server = config.servers[normUrl];
  if (!server) {
    throw new Error(`Server ${normUrl} is not registered in configuration.`);
  }
  const query = idOrEmail.trim().toLowerCase();
  const accounts = Object.values(server.accounts);
  const matched = accounts.find(
    (a) => a.userId.toLowerCase() === query || a.email && a.email.toLowerCase() === query
  );
  if (!matched) {
    const list = accounts.map((a) => a.email || a.userId).join(", ");
    throw new Error(`No account found matching "${idOrEmail}" on server ${normUrl}. Available: ${list || "none"}`);
  }
  server.activeAccountId = matched.userId;
  matched.lastUsedAt = (/* @__PURE__ */ new Date()).toISOString();
  config.currentServer = normUrl;
  syncLegacyFields(config, normUrl, matched);
  saveMasterConfig(config);
  return matched;
}
function listAccounts(serverUrl) {
  const config = loadConfig();
  const normUrl = normalizeBaseUrl(serverUrl || config.currentServer);
  const server = config.servers[normUrl];
  if (!server) {
    return {
      serverUrl: normUrl,
      partitionKey: getBaseUriPartitionKey(normUrl),
      activeAccountId: void 0,
      accounts: []
    };
  }
  return {
    serverUrl: normUrl,
    partitionKey: server.partitionKey,
    activeAccountId: server.activeAccountId,
    accounts: Object.values(server.accounts)
  };
}
function switchServer(serverUrl) {
  const config = loadConfig();
  const normUrl = normalizeBaseUrl(serverUrl);
  if (!config.servers[normUrl]) {
    config.servers[normUrl] = {
      baseUrl: normUrl,
      partitionKey: getBaseUriPartitionKey(normUrl),
      accounts: {}
    };
  }
  config.currentServer = normUrl;
  const server = config.servers[normUrl];
  const activeAcc = server.activeAccountId ? server.accounts[server.activeAccountId] : void 0;
  syncLegacyFields(config, normUrl, activeAcc);
  saveMasterConfig(config);
  return server;
}
function listServers() {
  const config = loadConfig();
  const entries = Object.values(config.servers);
  if (entries.length === 0) {
    return [
      {
        baseUrl: DEFAULT_API_URL,
        partitionKey: "default",
        isCurrent: true,
        accountCount: 0
      }
    ];
  }
  return entries.map((s) => ({
    baseUrl: s.baseUrl,
    partitionKey: s.partitionKey,
    isCurrent: s.baseUrl === config.currentServer,
    activeAccount: s.activeAccountId ? s.accounts[s.activeAccountId]?.email || s.activeAccountId : void 0,
    accountCount: Object.keys(s.accounts).length
  }));
}
function resolveEnvironment(cliOptions = {}) {
  const config = loadConfig();
  const rawUrl = cliOptions.url || process.env.KYLRIX_API_URL || config.currentServer || DEFAULT_API_URL;
  const apiUrl = normalizeBaseUrl(rawUrl);
  const partitionKey = getBaseUriPartitionKey(apiUrl);
  const server = config.servers[apiUrl];
  const account = server?.activeAccountId ? server.accounts[server.activeAccountId] : void 0;
  let token = cliOptions.token || process.env.KYLRIX_API_KEY || process.env.KYLRIX_PAT || process.env.KYLRIX_TOKEN || account?.token || config.token;
  if (!token && config.servers) {
    for (const s of Object.values(config.servers)) {
      if (s.activeAccountId && s.accounts[s.activeAccountId]?.token) {
        token = s.accounts[s.activeAccountId].token;
        break;
      }
      for (const acc of Object.values(s.accounts || {})) {
        if (acc.token) {
          token = acc.token;
          break;
        }
      }
      if (token) break;
    }
  }
  if (!token) {
    try {
      const userKeyPath = path.join(CONFIG_DIR, "credentials", "user.key");
      if (fs.existsSync(userKeyPath)) {
        const val = fs.readFileSync(userKeyPath, "utf-8").trim();
        if (val) token = val;
      }
    } catch {
    }
  }
  if (!token) {
    try {
      const patKeyPath = path.join(CONFIG_DIR, "credentials", "pat.key");
      if (fs.existsSync(patKeyPath)) {
        const val = fs.readFileSync(patKeyPath, "utf-8").trim();
        if (val) token = val;
      }
    } catch {
    }
  }
  if (!token) {
    try {
      const wsKeyPath = path.join(CONFIG_DIR, "credentials", "workspace.key");
      if (fs.existsSync(wsKeyPath)) {
        const val = fs.readFileSync(wsKeyPath, "utf-8").trim();
        if (val) token = val;
      }
    } catch {
    }
  }
  if (!token) {
    try {
      const agentsDir = path.join(CONFIG_DIR, "agents");
      if (fs.existsSync(agentsDir)) {
        const files = fs.readdirSync(agentsDir);
        for (const f of files) {
          if (f.endsWith(".json")) {
            const raw = fs.readFileSync(path.join(agentsDir, f), "utf-8");
            const parsed = JSON.parse(raw);
            if (parsed?.agentToken) {
              token = parsed.agentToken;
              break;
            }
          }
        }
      }
    } catch {
    }
  }
  let workspaceId = cliOptions.workspace || process.env.KYLRIX_WORKSPACE_ID || process.env.KYLRIX_PROJECT_ID || account?.workspaceId || config.workspaceId;
  if (!workspaceId) {
    try {
      const agentsDir = path.join(CONFIG_DIR, "agents");
      if (fs.existsSync(agentsDir)) {
        const files = fs.readdirSync(agentsDir);
        for (const f of files) {
          if (f.endsWith(".json")) {
            const raw = fs.readFileSync(path.join(agentsDir, f), "utf-8");
            const parsed = JSON.parse(raw);
            if (parsed?.defaultWorkspaceId) {
              workspaceId = parsed.defaultWorkspaceId;
              break;
            }
          }
        }
      }
    } catch {
    }
  }
  const userId = account?.userId || config.userId;
  const email = account?.email || config.email;
  const tier = account?.tier || config.tier;
  const siloDir = getSiloDir(apiUrl, userId);
  const siloDbPath = getSiloDbPath(apiUrl, userId);
  const siloFallbackPath = getSiloFallbackPath(apiUrl, userId);
  return {
    apiUrl,
    token,
    workspaceId,
    userId,
    email,
    tier,
    serverBaseUrl: apiUrl,
    partitionKey,
    activeAccountId: account?.userId,
    siloDir,
    siloDbPath,
    siloFallbackPath
  };
}

// ../../sdk/pairing-client.ts
var PairingClient = class {
  endpoint;
  constructor(endpoint = "https://www.kylrix.space/api/v1") {
    this.endpoint = endpoint.replace(/\/+$/, "");
  }
  /**
   * Request a new pairing session (returns userCode, deviceCode, verificationUri).
   */
  async requestPairing(input) {
    const res = await fetch(`${this.endpoint}/pairing/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(input)
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok || !json?.data) {
      throw new Error(json?.error?.message || `Failed to initiate pairing: HTTP ${res.status}`);
    }
    return json.data;
  }
  /**
   * Poll for authorization approval until approved, denied, or timed out.
   */
  async pollExchange(deviceCode, opts) {
    const interval = (opts?.intervalSeconds ?? 5) * 1e3;
    const timeout = (opts?.timeoutSeconds ?? 900) * 1e3;
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      opts?.onPoll?.("polling");
      const res = await fetch(`${this.endpoint}/pairing/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ device_code: deviceCode })
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok && json?.data?.access_token) {
        return {
          token: json.data.access_token,
          userId: json.data.user_id,
          scopes: json.data.scopes || []
        };
      }
      if (res.status === 428 || json?.error?.code === "authorization_pending") {
        await new Promise((resolve) => setTimeout(resolve, interval));
        continue;
      }
      if (res.status === 429 || json?.error?.code === "slow_down" || json?.error === "edge_rate_limited" || json?.error === "rate_limit_exceeded") {
        const retryHeader = res.headers?.get?.("retry-after");
        const retrySec = Number(retryHeader || json?.retry_after || 5);
        const delay = Math.max(retrySec * 1e3, interval + 2e3);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      if (res.status >= 500 && res.status < 600) {
        await new Promise((resolve) => setTimeout(resolve, interval));
        continue;
      }
      throw new Error(json?.error?.message || `Pairing rejected or failed: HTTP ${res.status}`);
    }
    throw new Error("Pairing session timed out waiting for user approval.");
  }
};

// ../../sdk/api/client.ts
var KylrixApiError = class extends Error {
  constructor(message, status, code, data) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
    this.name = "KylrixApiError";
  }
  status;
  code;
  data;
};
function toListResult(raw) {
  const items = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : Array.isArray(raw?.data) ? raw.data : [];
  const result = [...items];
  result.items = items;
  result.count = items.length;
  return result;
}
var KylrixClient = class {
  baseUrl;
  token;
  customFetch;
  defaultHeaders;
  activeWorkspaceId;
  pairing;
  constructor(options = {}) {
    let base = options.baseUrl || process.env.KYLRIX_API_URL || "https://www.kylrix.space";
    base = base.replace(/\/+$/, "");
    if (!base.endsWith("/api/v1")) {
      base = `${base}/api/v1`;
    }
    this.baseUrl = base;
    this.token = options.token || process.env.KYLRIX_API_KEY || process.env.KYLRIX_PAT;
    this.customFetch = options.fetch || globalThis.fetch;
    this.defaultHeaders = options.headers || {};
    this.activeWorkspaceId = options.workspaceId || process.env.KYLRIX_WORKSPACE_ID;
    this.pairing = new PairingClient(this.baseUrl);
  }
  setToken(token) {
    this.token = token;
  }
  setBaseUrl(baseUrl) {
    let base = baseUrl.replace(/\/+$/, "");
    if (!base.endsWith("/api/v1")) {
      base = `${base}/api/v1`;
    }
    this.baseUrl = base;
    this.pairing = new PairingClient(this.baseUrl);
  }
  setWorkspaceId(workspaceId) {
    this.activeWorkspaceId = workspaceId;
  }
  getBaseUrl() {
    return this.baseUrl;
  }
  async request(method, path6, options = {}) {
    const cleanPath = path6.startsWith("/") ? path6 : `/${path6}`;
    const url = new URL(`${this.baseUrl}${cleanPath}`);
    if (options.query) {
      for (const [key, val] of Object.entries(options.query)) {
        if (val !== void 0 && val !== null) {
          url.searchParams.set(key, String(val));
        }
      }
    }
    const headers = {
      Accept: "application/json",
      ...this.defaultHeaders,
      ...options.headers
    };
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    let body = void 0;
    if (options.body !== void 0) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }
    const res = await this.customFetch(url.toString(), {
      method,
      headers,
      body
    });
    const isJson = res.headers.get("content-type")?.includes("application/json");
    const data = isJson ? await res.json().catch(() => null) : await res.text();
    if (!res.ok) {
      const errObj = typeof data === "object" && data !== null ? data : {};
      const errMsg = errObj?.error?.message || errObj?.error || errObj?.message || `Kylrix API error HTTP ${res.status}: ${res.statusText}`;
      const errCode = errObj?.error?.code || errObj?.code || (res.status === 401 ? "unauthorized" : "api_error");
      throw new KylrixApiError(errMsg, res.status, errCode, data);
    }
    if (data && typeof data === "object" && "ok" in data && "data" in data) {
      return data.data;
    }
    return data;
  }
  // ── 1. Authentication & Profile ──
  auth = {
    me: () => this.request("GET", "/me"),
    tokenInfo: () => this.request("GET", "/token"),
    scopes: () => this.request("GET", "/token/scopes"),
    updateScopes: (scopes, mode = "grant") => this.request("POST", "/token/scopes", { body: { scopes, mode } }),
    listPats: () => this.request("GET", "/pats"),
    createPat: (data) => this.request("POST", "/pats", { body: data }),
    revokePat: (patId) => this.request("DELETE", `/pats/${patId}`),
    signin: (credentials) => this.request("POST", "/auth/signin", { body: credentials }),
    signup: (data) => this.request("POST", "/auth/signup", { body: data }),
    status: () => this.request("GET", "/auth/status"),
    logout: () => this.request("DELETE", "/token")
  };
  // ── 2. Workspaces ──
  workspaces = {
    list: async (limit = 25) => {
      const raw = await this.request("GET", "/workspaces", { query: { limit } });
      return toListResult(raw);
    },
    get: (id) => this.request("GET", `/workspaces/${id}`),
    create: (data) => this.request("POST", "/workspaces", { body: data }),
    update: (id, data) => this.request("PATCH", `/workspaces/${id}`, { body: data }),
    delete: (id) => this.request("DELETE", `/workspaces/${id}`),
    listCollaborators: async (workspaceId) => {
      const raw = await this.request("GET", `/workspaces/${workspaceId}/collaborators`);
      return toListResult(raw);
    },
    addCollaborator: (workspaceId, data) => this.request("POST", `/workspaces/${workspaceId}/collaborators`, { body: data })
  };
  // ── 3. Ideas (aliased to notes) ──
  ideas = {
    list: async (opts = {}) => {
      const raw = await this.request("GET", "/notes", {
        query: {
          limit: opts.limit ?? 25,
          workspaceId: opts.workspaceId !== void 0 ? opts.workspaceId : this.activeWorkspaceId
        }
      });
      return toListResult(raw);
    },
    get: (id) => this.request("GET", `/notes/${id}`),
    create: (data) => this.request("POST", "/notes", {
      body: {
        ...data,
        workspaceId: data.workspaceId || this.activeWorkspaceId
      }
    }),
    update: (id, data) => this.request("PATCH", `/notes/${id}`, { body: data }),
    delete: (id) => this.request("DELETE", `/notes/${id}`),
    articles: async (opts = {}) => {
      const res = await this.ideas.list(opts);
      const articles = (res.items || []).filter((item) => item.category === "article");
      return toListResult(articles);
    }
  };
  notes = this.ideas;
  // ── 4. Goals ──
  goals = {
    list: async (opts = {}) => {
      const raw = await this.request("GET", "/goals", {
        query: {
          limit: opts.limit ?? 25,
          workspaceId: opts.workspaceId !== void 0 ? opts.workspaceId : this.activeWorkspaceId,
          status: opts.status || void 0
        }
      });
      return toListResult(raw);
    },
    get: (id) => this.request("GET", `/goals/${id}`),
    create: (data) => this.request("POST", "/goals", {
      body: {
        ...data,
        workspaceId: data.workspaceId || this.activeWorkspaceId
      }
    }),
    update: (id, data) => this.request("PATCH", `/goals/${id}`, { body: data }),
    delete: (id) => this.request("DELETE", `/goals/${id}`)
  };
  // ── 5. Events / Calendar ──
  events = {
    list: async (opts = {}) => {
      const raw = await this.request("GET", "/events", {
        query: {
          limit: opts.limit ?? 25,
          workspaceId: opts.workspaceId !== void 0 ? opts.workspaceId : this.activeWorkspaceId
        }
      });
      return toListResult(raw);
    },
    get: (id) => this.request("GET", `/events/${id}`),
    create: (data) => this.request("POST", "/events", {
      body: {
        ...data,
        workspaceId: data.workspaceId || this.activeWorkspaceId
      }
    }),
    update: (id, data) => this.request("PATCH", `/events/${id}`, { body: data }),
    delete: (id) => this.request("DELETE", `/events/${id}`)
  };
  // ── 6. Forms ──
  forms = {
    list: async (opts = {}) => {
      const raw = await this.request("GET", "/forms", {
        query: {
          limit: opts.limit ?? 25,
          workspaceId: opts.workspaceId !== void 0 ? opts.workspaceId : this.activeWorkspaceId
        }
      });
      return toListResult(raw);
    },
    get: (id) => this.request("GET", `/forms/${id}`),
    create: (data) => this.request("POST", "/forms", {
      body: {
        ...data,
        workspaceId: data.workspaceId || this.activeWorkspaceId
      }
    }),
    delete: (id) => this.request("DELETE", `/forms/${id}`)
  };
  // ── 7. Flows ──
  flows = {
    list: async (limit = 25) => {
      const raw = await this.request("GET", "/flows", { query: { limit } });
      return toListResult(raw);
    },
    get: (id) => this.request("GET", `/flows/${id}`),
    create: (data) => this.request("POST", "/flows", { body: data }),
    delete: (id) => this.request("DELETE", `/flows/${id}`)
  };
  // ── 8. Chats & Hangouts ──
  chats = {
    list: async (limit = 25) => {
      const raw = await this.request("GET", "/chats", { query: { limit } });
      return toListResult(raw);
    },
    get: (id) => this.request("GET", `/chats/${id}`),
    messages: async (conversationId, limit = 50) => {
      const raw = await this.request("GET", `/chats/${conversationId}/messages`, { query: { limit } });
      return toListResult(raw);
    },
    sendMessage: (data) => this.request("POST", "/chats", { body: data })
  };
  hangouts = this.chats;
  // ── 9. Threads ──
  threads = {
    list: async (opts = {}) => {
      const raw = await this.request("GET", "/threads", { query: opts });
      return toListResult(raw);
    },
    get: (id) => this.request("GET", `/threads/${id}`),
    messages: async (threadId, limit = 50) => {
      const raw = await this.request("GET", `/threads/${threadId}/messages`, { query: { limit } });
      return toListResult(raw);
    },
    sendMessage: (threadId, content) => this.request("POST", `/threads/${threadId}/messages`, { body: { content } })
  };
  // ── 10. Tags ──
  tags = {
    list: async () => {
      const raw = await this.request("GET", "/tags");
      return toListResult(raw);
    },
    create: (data) => this.request("POST", "/tags", { body: data }),
    delete: (id) => this.request("DELETE", `/tags/${id}`)
  };
  // ── 11. Trash ──
  trash = {
    list: async (limit = 25) => {
      const raw = await this.request("GET", "/trash", { query: { limit } });
      return toListResult(raw);
    },
    restore: (kind, id) => this.request("POST", "/trash/restore", { body: { kind, id } }),
    purge: (kind, id) => this.request("POST", "/trash/purge", { body: { kind, id } })
  };
  // ── 12. Vault & Secrets ──
  vault = {
    list: async (opts = {}) => {
      const raw = await this.request("GET", "/vault", {
        query: {
          limit: opts.limit ?? 50,
          workspaceId: opts.workspaceId || this.activeWorkspaceId
        },
        headers: opts.mek ? { "x-mek": opts.mek } : void 0
      });
      return toListResult(raw);
    },
    get: (id, opts = {}) => this.request("GET", `/vault/${id}`, {
      query: {
        format: opts.format,
        pure: opts.pure
      },
      headers: {
        ...opts.mek ? { "x-mek": opts.mek } : {},
        ...opts.masterPassword ? { "x-master-password": opts.masterPassword } : {},
        ...opts.shareKey ? { "x-share-key": opts.shareKey } : {}
      }
    }),
    create: (data, opts = {}) => this.request("POST", "/vault", {
      body: {
        ...data,
        workspaceId: data.workspaceId || opts.workspaceId || this.activeWorkspaceId
      },
      headers: opts.mek ? { "x-mek": opts.mek } : void 0
    }),
    update: (id, data, opts = {}) => this.request("PATCH", `/vault/${id}`, {
      body: data,
      headers: opts.mek ? { "x-mek": opts.mek } : void 0
    }),
    delete: (id) => this.request("DELETE", `/vault/${id}`),
    unlockUserMek: (masterPassword) => this.request("POST", "/vault/unlock", {
      body: { masterPassword }
    }),
    resolvePublic: (id, opts = {}) => this.request("GET", `/vault/public/${id}`, {
      query: {
        shareKey: opts.shareKey,
        format: opts.format,
        pure: opts.pure
      }
    })
  };
  // ── 13. TOTP 2FA Secrets ──
  totp = {
    list: async (opts = {}) => {
      const raw = await this.request("GET", "/totp", {
        query: {
          limit: opts.limit ?? 50,
          workspaceId: opts.workspaceId || this.activeWorkspaceId
        },
        headers: opts.mek ? { "x-mek": opts.mek } : void 0
      });
      return toListResult(raw);
    },
    get: (id, opts = {}) => this.request("GET", `/totp/${id}`, {
      headers: {
        ...opts.mek ? { "x-mek": opts.mek } : {},
        ...opts.masterPassword ? { "x-master-password": opts.masterPassword } : {}
      }
    }),
    create: (data, opts = {}) => this.request("POST", "/totp", {
      body: {
        ...data,
        workspaceId: data.workspaceId || opts.workspaceId || this.activeWorkspaceId
      },
      headers: opts.mek ? { "x-mek": opts.mek } : void 0
    }),
    update: (id, data, opts = {}) => this.request("PATCH", `/totp/${id}`, {
      body: data,
      headers: opts.mek ? { "x-mek": opts.mek } : void 0
    }),
    delete: (id) => this.request("DELETE", `/totp/${id}`)
  };
  // ── 14. Autonomous Agents & Sessions ──
  agents = {
    listSessions: async (opts = {}) => {
      const raw = await this.request("GET", "/agents/sessions", {
        query: {
          limit: opts.limit ?? 25,
          harness: opts.harness,
          workspaceId: opts.workspaceId || this.activeWorkspaceId
        }
      });
      return toListResult(raw);
    },
    getSession: (id) => this.request("GET", `/agents/sessions/${id}`),
    createHarnessSession: (data) => this.request("POST", "/agents/harness", {
      body: {
        ...data,
        workspaceId: data.workspaceId || this.activeWorkspaceId
      }
    }),
    appendHarnessMirror: (sessionId, data) => this.request("POST", `/agents/sessions/${sessionId}/mirror`, { body: data }),
    deleteSession: (id) => this.request("DELETE", `/agents/sessions/${id}`),
    createKey: (data) => this.request("POST", "/agents/keys", { body: data }),
    provision: (data) => this.request("POST", "/agents/provision", { body: data })
  };
  // ── 15. Billing & Subscription ──
  billing = {
    status: () => this.request("GET", "/billing/status"),
    checkout: (data) => this.request("POST", "/billing/checkout", { body: data }),
    coins: () => this.request("GET", "/billing/coins"),
    claimCoupon: (couponId) => this.request("POST", "/billing/coupon", { body: { couponId } })
  };
  // ── 16. Global Search ──
  search = {
    query: async (searchTerm, opts = {}) => {
      const q = searchTerm.toLowerCase().trim();
      const wsId = opts.workspaceId || this.activeWorkspaceId;
      const limit = opts.limit || 20;
      const [ideasRes, goalsRes, eventsRes, formsRes, flowsRes] = await Promise.allSettled([
        this.ideas.list({ workspaceId: wsId, limit }),
        this.goals.list({ workspaceId: wsId, limit }),
        this.events.list({ workspaceId: wsId, limit }),
        this.forms.list({ workspaceId: wsId, limit }),
        this.flows.list(limit)
      ]);
      const results = [];
      if (ideasRes.status === "fulfilled" && ideasRes.value?.items) {
        for (const i of ideasRes.value.items) {
          if (i.title?.toLowerCase().includes(q) || i.content?.toLowerCase().includes(q)) {
            results.push({ kind: "idea", id: i.id, title: i.title || "(Untitled Idea)", snippet: i.content?.substring(0, 100) });
          }
        }
      }
      if (goalsRes.status === "fulfilled" && goalsRes.value?.items) {
        for (const g of goalsRes.value.items) {
          if (g.title?.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q)) {
            results.push({ kind: "goal", id: g.id, title: g.title || "(Untitled Goal)", snippet: g.description?.substring(0, 100) });
          }
        }
      }
      if (eventsRes.status === "fulfilled" && eventsRes.value?.items) {
        for (const e of eventsRes.value.items) {
          if (e.title?.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q)) {
            results.push({ kind: "event", id: e.id, title: e.title, snippet: e.description?.substring(0, 100) });
          }
        }
      }
      if (formsRes.status === "fulfilled" && formsRes.value?.items) {
        for (const f of formsRes.value.items) {
          if (f.title?.toLowerCase().includes(q)) {
            results.push({ kind: "form", id: f.id, title: f.title || "(Untitled Form)" });
          }
        }
      }
      if (flowsRes.status === "fulfilled" && flowsRes.value?.items) {
        for (const fl of flowsRes.value.items) {
          if (fl.title?.toLowerCase().includes(q) || fl.description?.toLowerCase().includes(q)) {
            results.push({ kind: "flow", id: fl.id, title: fl.title || "(Untitled Flow)", snippet: fl.description?.substring(0, 100) });
          }
        }
      }
      return results;
    }
  };
  // ── 17. Model Context Protocol (MCP) Dispatch ──
  mcp = {
    callTool: (name, args = {}) => this.request("POST", "/mcp/messages", {
      body: {
        jsonrpc: "2.0",
        id: String(Date.now()),
        method: "tools/call",
        params: { name, arguments: args }
      }
    })
  };
};

// ../cli/src/client.ts
function hasAuth(cliOptions = {}) {
  const env3 = resolveEnvironment(cliOptions);
  return Boolean(env3.token);
}
function getClient(cliOptions = {}) {
  const env3 = resolveEnvironment(cliOptions);
  return new KylrixClient({
    baseUrl: env3.apiUrl,
    token: env3.token,
    workspaceId: env3.workspaceId
  });
}

// ../cli/src/local/store.ts
var fs3 = __toESM(require("fs"), 1);
var path3 = __toESM(require("path"), 1);

// ../cli/src/local/sqlite.ts
var fs2 = __toESM(require("fs"), 1);
var path2 = __toESM(require("path"), 1);
var import_node_module = require("module");
var import_meta = {};
function generateLocalId(_prefix) {
  const now = /* @__PURE__ */ new Date();
  const sec = Math.floor(now.getTime() / 1e3);
  const msec = now.getMilliseconds();
  const hexTimestamp = sec.toString(16) + msec.toString(16).padStart(5, "0");
  let randomPadding = "";
  for (let i = 0; i < 7; i++) {
    randomPadding += Math.floor(Math.random() * 16).toString(16);
  }
  return hexTimestamp + randomPadding;
}
var dbInstances = /* @__PURE__ */ new Map();
function getNativeSqlite() {
  try {
    const origEmit = process.emit;
    process.emit = function(name, data, ...args) {
      if (name === "warning" && (data?.name === "ExperimentalWarning" || String(data?.message || "").toLowerCase().includes("sqlite") || String(data || "").toLowerCase().includes("sqlite"))) {
        return false;
      }
      return origEmit.apply(process, [name, data, ...args]);
    };
    const origEmitWarning = process.emitWarning;
    if (typeof origEmitWarning === "function") {
      process.emitWarning = function(warning, ...args) {
        if (typeof warning === "string" && warning.toLowerCase().includes("sqlite") || typeof warning === "object" && (warning?.name === "ExperimentalWarning" || String(warning?.message || "").toLowerCase().includes("sqlite"))) {
          return;
        }
        return origEmitWarning.apply(process, [warning, ...args]);
      };
    }
    const require2 = (0, import_node_module.createRequire)(import_meta.url);
    const sqlite = require2("node:sqlite");
    return sqlite.DatabaseSync || sqlite.default?.DatabaseSync;
  } catch {
    return null;
  }
}
function getDatabase(targetDbPath, cliOptions) {
  const env3 = resolveEnvironment(cliOptions);
  const dbPath = targetDbPath || env3.siloDbPath;
  if (dbInstances.has(dbPath)) {
    return dbInstances.get(dbPath);
  }
  const dir = path2.dirname(dbPath);
  if (!fs2.existsSync(dir)) {
    fs2.mkdirSync(dir, { recursive: true });
  }
  const DatabaseSync = getNativeSqlite();
  if (DatabaseSync) {
    const db = new DatabaseSync(dbPath);
    initSqliteSchema(db);
    dbInstances.set(dbPath, db);
    return db;
  }
  return null;
}
function initSqliteSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ideas (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT,
      category TEXT DEFAULT 'general',
      tags TEXT,
      is_local INTEGER DEFAULT 1,
      sync_status TEXT DEFAULT 'unsynced',
      cloud_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      target_value REAL DEFAULT 100,
      current_value REAL DEFAULT 0,
      unit TEXT DEFAULT '%',
      status TEXT DEFAULT 'not_started',
      is_local INTEGER DEFAULT 1,
      sync_status TEXT DEFAULT 'unsynced',
      cloud_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vault (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT,
      password TEXT,
      url TEXT,
      notes TEXT,
      is_env INTEGER DEFAULT 0,
      custom_fields TEXT,
      item_type TEXT DEFAULT 'login',
      is_local INTEGER DEFAULT 1,
      sync_status TEXT DEFAULT 'unsynced',
      cloud_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS totp (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      secret TEXT NOT NULL,
      issuer TEXT,
      account TEXT,
      is_local INTEGER DEFAULT 1,
      sync_status TEXT DEFAULT 'unsynced',
      cloud_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      description TEXT,
      is_local INTEGER DEFAULT 1,
      sync_status TEXT DEFAULT 'unsynced',
      cloud_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS forms (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      schema TEXT,
      is_local INTEGER DEFAULT 1,
      sync_status TEXT DEFAULT 'unsynced',
      cloud_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS flows (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'draft',
      is_local INTEGER DEFAULT 1,
      sync_status TEXT DEFAULT 'unsynced',
      cloud_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6366F1',
      is_local INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS trash (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      deleted_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS external_contexts (
      id TEXT PRIMARY KEY,
      client TEXT NOT NULL,
      directory TEXT,
      workspace_id TEXT,
      title TEXT NOT NULL,
      summary TEXT,
      payload TEXT,
      status TEXT DEFAULT 'connected',
      is_local INTEGER DEFAULT 1,
      sync_status TEXT DEFAULT 'unsynced',
      cloud_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS connected_tools (
      id TEXT PRIMARY KEY,
      client TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      directory TEXT,
      workspace_id TEXT,
      connected_at TEXT NOT NULL,
      last_active_at TEXT NOT NULL,
      status TEXT DEFAULT 'connected',
      metadata TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_ideas_updated ON ideas(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
    CREATE INDEX IF NOT EXISTS idx_ext_ctx_client ON external_contexts(client);
    CREATE INDEX IF NOT EXISTS idx_ext_ctx_dir ON external_contexts(directory);
  `);
  try {
    db.exec("ALTER TABLE ideas ADD COLUMN sync_status TEXT DEFAULT 'unsynced'");
  } catch {
  }
  try {
    db.exec("ALTER TABLE ideas ADD COLUMN cloud_id TEXT");
  } catch {
  }
  try {
    db.exec("ALTER TABLE goals ADD COLUMN sync_status TEXT DEFAULT 'unsynced'");
  } catch {
  }
  try {
    db.exec("ALTER TABLE goals ADD COLUMN cloud_id TEXT");
  } catch {
  }
  try {
    db.exec("ALTER TABLE vault ADD COLUMN sync_status TEXT DEFAULT 'unsynced'");
  } catch {
  }
  try {
    db.exec("ALTER TABLE vault ADD COLUMN cloud_id TEXT");
  } catch {
  }
  try {
    db.exec("ALTER TABLE totp ADD COLUMN sync_status TEXT DEFAULT 'unsynced'");
  } catch {
  }
  try {
    db.exec("ALTER TABLE totp ADD COLUMN cloud_id TEXT");
  } catch {
  }
  try {
    db.exec("ALTER TABLE events ADD COLUMN sync_status TEXT DEFAULT 'unsynced'");
  } catch {
  }
  try {
    db.exec("ALTER TABLE events ADD COLUMN cloud_id TEXT");
  } catch {
  }
  try {
    db.exec("ALTER TABLE forms ADD COLUMN sync_status TEXT DEFAULT 'unsynced'");
  } catch {
  }
  try {
    db.exec("ALTER TABLE forms ADD COLUMN cloud_id TEXT");
  } catch {
  }
  try {
    db.exec("ALTER TABLE flows ADD COLUMN sync_status TEXT DEFAULT 'unsynced'");
  } catch {
  }
  try {
    db.exec("ALTER TABLE flows ADD COLUMN cloud_id TEXT");
  } catch {
  }
  try {
    db.exec("ALTER TABLE external_contexts ADD COLUMN sync_status TEXT DEFAULT 'unsynced'");
  } catch {
  }
  try {
    db.exec("ALTER TABLE external_contexts ADD COLUMN cloud_id TEXT");
  } catch {
  }
}

// ../cli/src/local/store.ts
function loadFallback() {
  try {
    const env3 = resolveEnvironment();
    const fallbackPath = env3.siloFallbackPath;
    if (!fs3.existsSync(fallbackPath)) {
      return { ideas: [], goals: [], events: [], forms: [], flows: [], vault: [], totp: [], tags: [], trash: [] };
    }
    return JSON.parse(fs3.readFileSync(fallbackPath, "utf-8"));
  } catch {
    return { ideas: [], goals: [], events: [], forms: [], flows: [], vault: [], totp: [], tags: [], trash: [] };
  }
}
function saveFallback(data) {
  try {
    const env3 = resolveEnvironment();
    const fallbackPath = env3.siloFallbackPath;
    const dir = path3.dirname(fallbackPath);
    if (!fs3.existsSync(dir)) {
      fs3.mkdirSync(dir, { recursive: true });
    }
    fs3.writeFileSync(fallbackPath, JSON.stringify(data, null, 2), { encoding: "utf-8", mode: 384 });
  } catch {
  }
}
var LocalStore = {
  // ── Ideas ──
  listIdeas(cliOptions) {
    const db = getDatabase(void 0, cliOptions);
    if (db) {
      const stmt = db.prepare("SELECT * FROM ideas ORDER BY updated_at DESC");
      const rows = stmt.all().map((r) => ({
        id: r.id,
        title: r.title,
        content: r.content,
        category: r.category,
        tags: r.tags ? JSON.parse(r.tags) : [],
        isLocal: Boolean(r.is_local),
        syncStatus: r.sync_status || (r.cloud_id ? "synced" : "unsynced"),
        cloudId: r.cloud_id || null,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
      return { items: rows, count: rows.length };
    }
    const store = loadFallback();
    return { items: store.ideas || [], count: store.ideas?.length || 0 };
  },
  getIdea(id, cliOptions) {
    const db = getDatabase(void 0, cliOptions);
    if (db) {
      const stmt = db.prepare("SELECT * FROM ideas WHERE id = ? OR cloud_id = ?");
      const r = stmt.get(id, id);
      if (!r) throw new Error(`Idea not found: ${id}`);
      return {
        id: r.id,
        title: r.title,
        content: r.content,
        category: r.category,
        tags: r.tags ? JSON.parse(r.tags) : [],
        isLocal: Boolean(r.is_local),
        syncStatus: r.sync_status || (r.cloud_id ? "synced" : "unsynced"),
        cloudId: r.cloud_id || null,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      };
    }
    const store = loadFallback();
    const item = store.ideas.find((i) => i.id === id || i.cloudId === id);
    if (!item) throw new Error(`Idea not found: ${id}`);
    return item;
  },
  createIdea(data, cliOptions) {
    const id = data.id || generateLocalId("idea");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const syncStatus = data.syncStatus || "unsynced";
    const cloudId = data.cloudId || null;
    const db = getDatabase(void 0, cliOptions);
    if (db) {
      const stmt = db.prepare(`
        INSERT INTO ideas (id, title, content, category, tags, is_local, sync_status, cloud_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      `);
      stmt.run(id, data.title, data.content || "", data.category || "general", JSON.stringify(data.tags || []), syncStatus, cloudId, now, now);
      return {
        id,
        title: data.title,
        content: data.content || "",
        category: data.category || "general",
        tags: data.tags || [],
        isLocal: true,
        syncStatus,
        cloudId,
        createdAt: now,
        updatedAt: now
      };
    }
    const store = loadFallback();
    const item = { id, title: data.title, content: data.content || "", category: data.category || "general", tags: data.tags || [], isLocal: true, syncStatus, cloudId, createdAt: now, updatedAt: now };
    store.ideas.unshift(item);
    saveFallback(store);
    return item;
  },
  upsertIdeaFromCloud(item, cliOptions) {
    const db = getDatabase(void 0, cliOptions);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const createdAt = item.createdAt || now;
    const updatedAt = item.updatedAt || now;
    const tagsJson = JSON.stringify(item.tags || []);
    if (db) {
      const existing = db.prepare("SELECT id FROM ideas WHERE id = ? OR cloud_id = ?").get(item.id, item.id);
      if (existing) {
        db.prepare(`
          UPDATE ideas SET title = ?, content = ?, category = ?, tags = ?, sync_status = 'synced', cloud_id = ?, updated_at = ?
          WHERE id = ?
        `).run(item.title, item.content || "", item.category || "general", tagsJson, item.id, updatedAt, existing.id);
        const { id: _unusedId, ...itemRest } = item;
        return { ...itemRest, id: existing.id, syncStatus: "synced", cloudId: item.id, isLocal: true };
      } else {
        db.prepare(`
          INSERT INTO ideas (id, title, content, category, tags, is_local, sync_status, cloud_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 1, 'synced', ?, ?, ?)
        `).run(item.id, item.title, item.content || "", item.category || "general", tagsJson, item.id, createdAt, updatedAt);
        return { ...item, syncStatus: "synced", cloudId: item.id, isLocal: true };
      }
    }
    const store = loadFallback();
    const idx = store.ideas.findIndex((i) => i.id === item.id || i.cloudId === item.id);
    const enriched = { ...item, syncStatus: "synced", cloudId: item.id, isLocal: true };
    if (idx !== -1) {
      store.ideas[idx] = { ...store.ideas[idx], ...enriched };
    } else {
      store.ideas.unshift(enriched);
    }
    saveFallback(store);
    return enriched;
  },
  markIdeaSynced(localId, cloudId) {
    const db = getDatabase();
    if (db) {
      db.prepare(`UPDATE ideas SET sync_status = 'synced', cloud_id = ? WHERE id = ?`).run(cloudId, localId);
    }
    const store = loadFallback();
    const item = store.ideas?.find((i) => i.id === localId);
    if (item) {
      item.syncStatus = "synced";
      item.cloudId = cloudId;
      saveFallback(store);
    }
  },
  updateIdea(id, updates) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const existing = this.getIdea(id);
    const updated = { ...existing, ...updates, updatedAt: now };
    const db = getDatabase();
    if (db) {
      const stmt = db.prepare(`
        UPDATE ideas SET title = ?, content = ?, category = ?, tags = ?, updated_at = ? WHERE id = ?
      `);
      stmt.run(updated.title, updated.content || "", updated.category || "general", JSON.stringify(updated.tags || []), now, id);
      return updated;
    }
    const store = loadFallback();
    const idx = store.ideas.findIndex((i) => i.id === id);
    if (idx !== -1) {
      store.ideas[idx] = updated;
      saveFallback(store);
    }
    return updated;
  },
  deleteIdea(id) {
    const db = getDatabase();
    if (db) {
      const existing = db.prepare("SELECT * FROM ideas WHERE id = ? OR cloud_id = ?").get(id, id);
      if (existing) {
        db.prepare("DELETE FROM ideas WHERE id = ?").run(existing.id);
        db.prepare("INSERT INTO trash (id, kind, title, deleted_at) VALUES (?, ?, ?, ?)").run(
          existing.id,
          "idea",
          existing.title,
          (/* @__PURE__ */ new Date()).toISOString()
        );
      }
      return { success: true };
    }
    const store = loadFallback();
    const idx = store.ideas.findIndex((i) => i.id === id || i.cloudId === id);
    if (idx !== -1) {
      const [deleted] = store.ideas.splice(idx, 1);
      store.trash.unshift({ id: deleted.id, kind: "idea", title: deleted.title, deletedAt: (/* @__PURE__ */ new Date()).toISOString() });
      saveFallback(store);
    }
    return { success: true };
  },
  // ── Goals ──
  listGoals(cliOptions) {
    const db = getDatabase(void 0, cliOptions);
    if (db) {
      const stmt = db.prepare("SELECT * FROM goals ORDER BY updated_at DESC");
      const rows = stmt.all().map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        targetValue: r.target_value,
        currentValue: r.current_value,
        unit: r.unit,
        status: r.status,
        isLocal: Boolean(r.is_local),
        syncStatus: r.sync_status || (r.cloud_id ? "synced" : "unsynced"),
        cloudId: r.cloud_id || null,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
      return { items: rows, count: rows.length };
    }
    const store = loadFallback();
    return { items: store.goals || [], count: store.goals?.length || 0 };
  },
  getGoal(id, cliOptions) {
    const db = getDatabase(void 0, cliOptions);
    if (db) {
      const r = db.prepare("SELECT * FROM goals WHERE id = ? OR cloud_id = ?").get(id, id);
      if (!r) throw new Error(`Goal not found: ${id}`);
      return {
        id: r.id,
        title: r.title,
        description: r.description,
        targetValue: r.target_value,
        currentValue: r.current_value,
        unit: r.unit,
        status: r.status,
        isLocal: Boolean(r.is_local),
        syncStatus: r.sync_status || (r.cloud_id ? "synced" : "unsynced"),
        cloudId: r.cloud_id || null,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      };
    }
    const store = loadFallback();
    const item = store.goals.find((g) => g.id === id || g.cloudId === id);
    if (!item) throw new Error(`Goal not found: ${id}`);
    return item;
  },
  createGoal(data, cliOptions) {
    const id = data.id || generateLocalId("goal");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const syncStatus = data.syncStatus || "unsynced";
    const cloudId = data.cloudId || null;
    const db = getDatabase(void 0, cliOptions);
    if (db) {
      const stmt = db.prepare(`
        INSERT INTO goals (id, title, description, target_value, current_value, unit, status, is_local, sync_status, cloud_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      `);
      stmt.run(
        id,
        data.title,
        data.description || "",
        data.targetValue ?? 100,
        data.currentValue ?? 0,
        data.unit || "%",
        data.status || "not_started",
        syncStatus,
        cloudId,
        now,
        now
      );
      return {
        id,
        title: data.title,
        description: data.description || "",
        targetValue: data.targetValue ?? 100,
        currentValue: data.currentValue ?? 0,
        unit: data.unit || "%",
        status: data.status || "not_started",
        isLocal: true,
        syncStatus,
        cloudId,
        createdAt: now,
        updatedAt: now
      };
    }
    const store = loadFallback();
    const item = { id, title: data.title, description: data.description || "", targetValue: data.targetValue ?? 100, currentValue: data.currentValue ?? 0, unit: data.unit || "%", status: data.status || "not_started", isLocal: true, syncStatus, cloudId, createdAt: now, updatedAt: now };
    store.goals.unshift(item);
    saveFallback(store);
    return item;
  },
  upsertGoalFromCloud(item, cliOptions) {
    const db = getDatabase(void 0, cliOptions);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const createdAt = item.createdAt || now;
    const updatedAt = item.updatedAt || now;
    if (db) {
      const existing = db.prepare("SELECT id FROM goals WHERE id = ? OR cloud_id = ?").get(item.id, item.id);
      if (existing) {
        db.prepare(`
          UPDATE goals SET title = ?, description = ?, target_value = ?, current_value = ?, unit = ?, status = ?, sync_status = 'synced', cloud_id = ?, updated_at = ?
          WHERE id = ?
        `).run(
          item.title,
          item.description || "",
          item.targetValue ?? 100,
          item.currentValue ?? 0,
          item.unit || "%",
          item.status || "not_started",
          item.id,
          updatedAt,
          existing.id
        );
        return { id: existing.id, ...item, syncStatus: "synced", cloudId: item.id, isLocal: true };
      } else {
        db.prepare(`
          INSERT INTO goals (id, title, description, target_value, current_value, unit, status, is_local, sync_status, cloud_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'synced', ?, ?, ?)
        `).run(
          item.id,
          item.title,
          item.description || "",
          item.targetValue ?? 100,
          item.currentValue ?? 0,
          item.unit || "%",
          item.status || "not_started",
          item.id,
          createdAt,
          updatedAt
        );
        return { id: item.id, ...item, syncStatus: "synced", cloudId: item.id, isLocal: true };
      }
    }
    const store = loadFallback();
    const idx = store.goals.findIndex((g) => g.id === item.id || g.cloudId === item.id);
    const enriched = { ...item, syncStatus: "synced", cloudId: item.id, isLocal: true };
    if (idx !== -1) {
      store.goals[idx] = { ...store.goals[idx], ...enriched };
    } else {
      store.goals.unshift(enriched);
    }
    saveFallback(store);
    return enriched;
  },
  markGoalSynced(localId, cloudId) {
    const db = getDatabase();
    if (db) {
      db.prepare(`UPDATE goals SET sync_status = 'synced', cloud_id = ? WHERE id = ?`).run(cloudId, localId);
    }
    const store = loadFallback();
    const item = store.goals?.find((g) => g.id === localId);
    if (item) {
      item.syncStatus = "synced";
      item.cloudId = cloudId;
      saveFallback(store);
    }
  },
  updateGoal(id, updates) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const existing = this.getGoal(id);
    const updated = { ...existing, ...updates, updatedAt: now };
    const db = getDatabase();
    if (db) {
      db.prepare(`
        UPDATE goals SET title = ?, description = ?, target_value = ?, current_value = ?, unit = ?, status = ?, updated_at = ?
        WHERE id = ?
      `).run(
        updated.title,
        updated.description || "",
        updated.targetValue ?? 100,
        updated.currentValue ?? 0,
        updated.unit || "%",
        updated.status || "not_started",
        now,
        id
      );
      return updated;
    }
    const store = loadFallback();
    const idx = store.goals.findIndex((g) => g.id === id);
    if (idx !== -1) {
      store.goals[idx] = updated;
      saveFallback(store);
    }
    return updated;
  },
  deleteGoal(id) {
    const db = getDatabase();
    if (db) {
      const existing = db.prepare("SELECT * FROM goals WHERE id = ? OR cloud_id = ?").get(id, id);
      if (existing) {
        db.prepare("DELETE FROM goals WHERE id = ?").run(existing.id);
        db.prepare("INSERT INTO trash (id, kind, title, deleted_at) VALUES (?, ?, ?, ?)").run(
          existing.id,
          "goal",
          existing.title,
          (/* @__PURE__ */ new Date()).toISOString()
        );
      }
      return { success: true };
    }
    const store = loadFallback();
    const idx = store.goals.findIndex((g) => g.id === id || g.cloudId === id);
    if (idx !== -1) {
      const [deleted] = store.goals.splice(idx, 1);
      store.trash.unshift({ id: deleted.id, kind: "goal", title: deleted.title, deletedAt: (/* @__PURE__ */ new Date()).toISOString() });
      saveFallback(store);
    }
    return { success: true };
  },
  // ── Vault ──
  listVault() {
    const db = getDatabase();
    if (db) {
      return db.prepare("SELECT * FROM vault ORDER BY updated_at DESC").all().map((r) => ({
        id: r.id,
        name: r.name,
        username: r.username,
        password: r.password,
        url: r.url,
        notes: r.notes,
        isEnv: Boolean(r.is_env),
        customFields: r.custom_fields ? r.custom_fields.startsWith("{") || r.custom_fields.startsWith("[") ? JSON.parse(r.custom_fields) : r.custom_fields : void 0,
        itemType: r.item_type,
        isLocal: Boolean(r.is_local),
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
    }
    return loadFallback().vault || [];
  },
  getVault(id) {
    const db = getDatabase();
    if (db) {
      const r = db.prepare("SELECT * FROM vault WHERE id = ?").get(id);
      if (!r) throw new Error(`Secret not found: ${id}`);
      return {
        id: r.id,
        name: r.name,
        username: r.username,
        password: r.password,
        url: r.url,
        notes: r.notes,
        isEnv: Boolean(r.is_env),
        customFields: r.custom_fields ? r.custom_fields.startsWith("{") || r.custom_fields.startsWith("[") ? JSON.parse(r.custom_fields) : r.custom_fields : void 0,
        itemType: r.item_type,
        isLocal: Boolean(r.is_local),
        createdAt: r.created_at,
        updatedAt: r.updated_at
      };
    }
    const item = (loadFallback().vault || []).find((v) => v.id === id);
    if (!item) throw new Error(`Secret not found: ${id}`);
    return item;
  },
  createVault(data) {
    const id = generateLocalId("sec");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const customFieldsStr = typeof data.customFields === "object" ? JSON.stringify(data.customFields) : data.customFields || "";
    const db = getDatabase();
    if (db) {
      db.prepare(`
        INSERT INTO vault (id, name, username, password, url, notes, is_env, custom_fields, item_type, is_local, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        id,
        data.name,
        data.username || "",
        data.password || "",
        data.url || "",
        data.notes || "",
        data.isEnv ? 1 : 0,
        customFieldsStr,
        data.itemType || (data.isEnv ? "env" : "login"),
        now,
        now
      );
      return { id, ...data, isLocal: true, createdAt: now, updatedAt: now };
    }
    const store = loadFallback();
    const item = { id, ...data, isLocal: true, createdAt: now, updatedAt: now };
    store.vault.unshift(item);
    saveFallback(store);
    return item;
  },
  deleteVault(id) {
    const db = getDatabase();
    if (db) {
      const existing = db.prepare("SELECT * FROM vault WHERE id = ?").get(id);
      if (existing) {
        db.prepare("DELETE FROM vault WHERE id = ?").run(id);
        db.prepare("INSERT INTO trash (id, kind, title, deleted_at) VALUES (?, ?, ?, ?)").run(
          existing.id,
          "vault",
          existing.name,
          (/* @__PURE__ */ new Date()).toISOString()
        );
      }
      return { success: true };
    }
    const store = loadFallback();
    const idx = store.vault.findIndex((v) => v.id === id);
    if (idx !== -1) {
      const [deleted] = store.vault.splice(idx, 1);
      store.trash.unshift({ id: deleted.id, kind: "vault", title: deleted.name, deletedAt: (/* @__PURE__ */ new Date()).toISOString() });
      saveFallback(store);
    }
    return { success: true };
  },
  // ── TOTP ──
  listTotp() {
    const db = getDatabase();
    if (db) {
      return db.prepare("SELECT * FROM totp ORDER BY created_at DESC").all().map((r) => ({
        id: r.id,
        name: r.name,
        secret: r.secret,
        issuer: r.issuer,
        account: r.account,
        isLocal: Boolean(r.is_local),
        createdAt: r.created_at
      }));
    }
    return loadFallback().totp || [];
  },
  getTotp(id) {
    const db = getDatabase();
    if (db) {
      const r = db.prepare("SELECT * FROM totp WHERE id = ?").get(id);
      if (!r) throw new Error(`TOTP entry not found: ${id}`);
      return {
        id: r.id,
        name: r.name,
        secret: r.secret,
        issuer: r.issuer,
        account: r.account,
        isLocal: Boolean(r.is_local),
        createdAt: r.created_at
      };
    }
    const item = (loadFallback().totp || []).find((t) => t.id === id);
    if (!item) throw new Error(`TOTP entry not found: ${id}`);
    return item;
  },
  createTotp(data) {
    const id = generateLocalId("totp");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const db = getDatabase();
    if (db) {
      db.prepare(`
        INSERT INTO totp (id, name, secret, issuer, account, is_local, created_at)
        VALUES (?, ?, ?, ?, ?, 1, ?)
      `).run(id, data.name, data.secret, data.issuer || "", data.account || "", now);
      return { id, ...data, isLocal: true, createdAt: now };
    }
    const store = loadFallback();
    const item = { id, ...data, isLocal: true, createdAt: now };
    store.totp.unshift(item);
    saveFallback(store);
    return item;
  },
  deleteTotp(id) {
    const db = getDatabase();
    if (db) {
      db.prepare("DELETE FROM totp WHERE id = ?").run(id);
      return { success: true };
    }
    const store = loadFallback();
    const idx = store.totp.findIndex((t) => t.id === id);
    if (idx !== -1) {
      store.totp.splice(idx, 1);
      saveFallback(store);
    }
    return { success: true };
  },
  // ── Events ──
  listEvents() {
    const db = getDatabase();
    if (db) {
      const rows = db.prepare("SELECT * FROM events ORDER BY start_time ASC").all().map((r) => ({
        id: r.id,
        title: r.title,
        startTime: r.start_time,
        endTime: r.end_time,
        description: r.description,
        isLocal: Boolean(r.is_local),
        syncStatus: r.sync_status || (r.cloud_id ? "synced" : "unsynced"),
        cloudId: r.cloud_id || null,
        createdAt: r.created_at
      }));
      return { items: rows, count: rows.length };
    }
    const store = loadFallback();
    return { items: store.events || [], count: store.events?.length || 0 };
  },
  getEvent(id) {
    const db = getDatabase();
    if (db) {
      const stmt = db.prepare("SELECT * FROM events WHERE id = ? OR cloud_id = ?");
      const r = stmt.get(id, id);
      if (!r) throw new Error(`Event not found: ${id}`);
      return {
        id: r.id,
        title: r.title,
        startTime: r.start_time,
        endTime: r.end_time,
        description: r.description,
        isLocal: Boolean(r.is_local),
        syncStatus: r.sync_status || (r.cloud_id ? "synced" : "unsynced"),
        cloudId: r.cloud_id || null,
        createdAt: r.created_at
      };
    }
    const store = loadFallback();
    const item = (store.events || []).find((e) => e.id === id || e.cloudId === id);
    if (!item) throw new Error(`Event not found: ${id}`);
    return item;
  },
  createEvent(data) {
    const id = data.id || generateLocalId("evt");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const syncStatus = data.syncStatus || "unsynced";
    const cloudId = data.cloudId || null;
    const db = getDatabase();
    if (db) {
      db.prepare(`
        INSERT INTO events (id, title, start_time, end_time, description, is_local, sync_status, cloud_id, created_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
      `).run(id, data.title, data.startTime, data.endTime, data.description || "", syncStatus, cloudId, now);
      return { id, ...data, isLocal: true, syncStatus, cloudId, createdAt: now };
    }
    const store = loadFallback();
    const item = { id, ...data, isLocal: true, syncStatus, cloudId, createdAt: now };
    store.events.unshift(item);
    saveFallback(store);
    return item;
  },
  upsertEventFromCloud(item) {
    const db = getDatabase();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const createdAt = item.createdAt || now;
    if (db) {
      const existing = db.prepare("SELECT id FROM events WHERE id = ? OR cloud_id = ?").get(item.id, item.id);
      if (existing) {
        db.prepare(`
          UPDATE events SET title = ?, start_time = ?, end_time = ?, description = ?, sync_status = 'synced', cloud_id = ?
          WHERE id = ?
        `).run(item.title, item.startTime || "", item.endTime || "", item.description || "", item.id, existing.id);
        return { id: existing.id, ...item, syncStatus: "synced", cloudId: item.id, isLocal: true };
      } else {
        db.prepare(`
          INSERT INTO events (id, title, start_time, end_time, description, is_local, sync_status, cloud_id, created_at)
          VALUES (?, ?, ?, ?, ?, 1, 'synced', ?, ?)
        `).run(item.id, item.title, item.startTime || "", item.endTime || "", item.description || "", item.id, createdAt);
        return { id: item.id, ...item, syncStatus: "synced", cloudId: item.id, isLocal: true };
      }
    }
    const store = loadFallback();
    const idx = (store.events || []).findIndex((e) => e.id === item.id || e.cloudId === item.id);
    const enriched = { ...item, syncStatus: "synced", cloudId: item.id, isLocal: true };
    if (idx !== -1) {
      store.events[idx] = { ...store.events[idx], ...enriched };
    } else {
      (store.events = store.events || []).unshift(enriched);
    }
    saveFallback(store);
    return enriched;
  },
  markEventSynced(localId, cloudId) {
    const db = getDatabase();
    if (db) {
      db.prepare(`UPDATE events SET sync_status = 'synced', cloud_id = ? WHERE id = ?`).run(cloudId, localId);
    }
    const store = loadFallback();
    const item = (store.events || []).find((e) => e.id === localId);
    if (item) {
      item.syncStatus = "synced";
      item.cloudId = cloudId;
      saveFallback(store);
    }
  },
  deleteEvent(id) {
    const db = getDatabase();
    if (db) {
      db.prepare("DELETE FROM events WHERE id = ? OR cloud_id = ?").run(id, id);
      return { success: true };
    }
    const store = loadFallback();
    const idx = store.events.findIndex((e) => e.id === id || e.cloudId === id);
    if (idx !== -1) {
      store.events.splice(idx, 1);
      saveFallback(store);
    }
    return { success: true };
  },
  // ── Forms ──
  listForms() {
    const db = getDatabase();
    if (db) {
      const rows = db.prepare("SELECT * FROM forms ORDER BY created_at DESC").all().map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        schema: r.schema ? JSON.parse(r.schema) : [],
        isLocal: Boolean(r.is_local),
        syncStatus: r.sync_status || (r.cloud_id ? "synced" : "unsynced"),
        cloudId: r.cloud_id || null,
        createdAt: r.created_at
      }));
      return { items: rows, count: rows.length };
    }
    const store = loadFallback();
    return { items: store.forms || [], count: store.forms?.length || 0 };
  },
  getForm(id) {
    const db = getDatabase();
    if (db) {
      const r = db.prepare("SELECT * FROM forms WHERE id = ? OR cloud_id = ?").get(id, id);
      if (!r) throw new Error(`Form not found: ${id}`);
      return {
        id: r.id,
        title: r.title,
        description: r.description,
        schema: r.schema ? JSON.parse(r.schema) : [],
        isLocal: Boolean(r.is_local),
        syncStatus: r.sync_status || (r.cloud_id ? "synced" : "unsynced"),
        cloudId: r.cloud_id || null,
        createdAt: r.created_at
      };
    }
    const item = (loadFallback().forms || []).find((f) => f.id === id || f.cloudId === id);
    if (!item) throw new Error(`Form not found: ${id}`);
    return item;
  },
  createForm(data) {
    const id = data.id || generateLocalId("form");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const syncStatus = data.syncStatus || "unsynced";
    const cloudId = data.cloudId || null;
    const db = getDatabase();
    if (db) {
      db.prepare(`
        INSERT INTO forms (id, title, description, schema, is_local, sync_status, cloud_id, created_at)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?)
      `).run(id, data.title, data.description || "", JSON.stringify(data.schema || []), syncStatus, cloudId, now);
      return { id, ...data, isLocal: true, syncStatus, cloudId, createdAt: now };
    }
    const store = loadFallback();
    const item = { id, ...data, isLocal: true, syncStatus, cloudId, createdAt: now };
    store.forms.unshift(item);
    saveFallback(store);
    return item;
  },
  upsertFormFromCloud(item) {
    const db = getDatabase();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const createdAt = item.createdAt || now;
    const schemaJson = JSON.stringify(item.schema || []);
    if (db) {
      const existing = db.prepare("SELECT id FROM forms WHERE id = ? OR cloud_id = ?").get(item.id, item.id);
      if (existing) {
        db.prepare(`
          UPDATE forms SET title = ?, description = ?, schema = ?, sync_status = 'synced', cloud_id = ?
          WHERE id = ?
        `).run(item.title, item.description || "", schemaJson, item.id, existing.id);
        return { id: existing.id, ...item, syncStatus: "synced", cloudId: item.id, isLocal: true };
      } else {
        db.prepare(`
          INSERT INTO forms (id, title, description, schema, is_local, sync_status, cloud_id, created_at)
          VALUES (?, ?, ?, ?, 1, 'synced', ?, ?)
        `).run(item.id, item.title, item.description || "", schemaJson, item.id, createdAt);
        return { id: item.id, ...item, syncStatus: "synced", cloudId: item.id, isLocal: true };
      }
    }
    const store = loadFallback();
    const idx = (store.forms || []).findIndex((f) => f.id === item.id || f.cloudId === item.id);
    const enriched = { ...item, syncStatus: "synced", cloudId: item.id, isLocal: true };
    if (idx !== -1) {
      store.forms[idx] = { ...store.forms[idx], ...enriched };
    } else {
      (store.forms = store.forms || []).unshift(enriched);
    }
    saveFallback(store);
    return enriched;
  },
  markFormSynced(localId, cloudId) {
    const db = getDatabase();
    if (db) {
      db.prepare(`UPDATE forms SET sync_status = 'synced', cloud_id = ? WHERE id = ?`).run(cloudId, localId);
    }
    const store = loadFallback();
    const item = (store.forms || []).find((f) => f.id === localId);
    if (item) {
      item.syncStatus = "synced";
      item.cloudId = cloudId;
      saveFallback(store);
    }
  },
  deleteForm(id) {
    const db = getDatabase();
    if (db) {
      db.prepare("DELETE FROM forms WHERE id = ? OR cloud_id = ?").run(id, id);
      return { success: true };
    }
    const store = loadFallback();
    const idx = store.forms.findIndex((f) => f.id === id || f.cloudId === id);
    if (idx !== -1) {
      store.forms.splice(idx, 1);
      saveFallback(store);
    }
    return { success: true };
  },
  // ── Flows ──
  listFlows() {
    const db = getDatabase();
    if (db) {
      const rows = db.prepare("SELECT * FROM flows ORDER BY created_at DESC").all().map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        status: r.status,
        isLocal: Boolean(r.is_local),
        syncStatus: r.sync_status || (r.cloud_id ? "synced" : "unsynced"),
        cloudId: r.cloud_id || null,
        createdAt: r.created_at
      }));
      return { items: rows, count: rows.length };
    }
    const store = loadFallback();
    return { items: store.flows || [], count: store.flows?.length || 0 };
  },
  getFlow(id) {
    const db = getDatabase();
    if (db) {
      const r = db.prepare("SELECT * FROM flows WHERE id = ? OR cloud_id = ?").get(id, id);
      if (!r) throw new Error(`Flow not found: ${id}`);
      return {
        id: r.id,
        title: r.title,
        description: r.description,
        status: r.status,
        isLocal: Boolean(r.is_local),
        syncStatus: r.sync_status || (r.cloud_id ? "synced" : "unsynced"),
        cloudId: r.cloud_id || null,
        createdAt: r.created_at
      };
    }
    const item = (loadFallback().flows || []).find((f) => f.id === id || f.cloudId === id);
    if (!item) throw new Error(`Flow not found: ${id}`);
    return item;
  },
  createFlow(data) {
    const id = data.id || generateLocalId("flow");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const syncStatus = data.syncStatus || "unsynced";
    const cloudId = data.cloudId || null;
    const db = getDatabase();
    if (db) {
      db.prepare(`
        INSERT INTO flows (id, title, description, status, is_local, sync_status, cloud_id, created_at)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?)
      `).run(id, data.title, data.description || "", data.status || "draft", syncStatus, cloudId, now);
      return { id, ...data, isLocal: true, syncStatus, cloudId, createdAt: now };
    }
    const store = loadFallback();
    const item = { id, ...data, isLocal: true, syncStatus, cloudId, createdAt: now };
    store.flows.unshift(item);
    saveFallback(store);
    return item;
  },
  upsertFlowFromCloud(item) {
    const db = getDatabase();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const createdAt = item.createdAt || now;
    if (db) {
      const existing = db.prepare("SELECT id FROM flows WHERE id = ? OR cloud_id = ?").get(item.id, item.id);
      if (existing) {
        db.prepare(`
          UPDATE flows SET title = ?, description = ?, status = ?, sync_status = 'synced', cloud_id = ?
          WHERE id = ?
        `).run(item.title, item.description || "", item.status || "draft", item.id, existing.id);
        return { id: existing.id, ...item, syncStatus: "synced", cloudId: item.id, isLocal: true };
      } else {
        db.prepare(`
          INSERT INTO flows (id, title, description, status, is_local, sync_status, cloud_id, created_at)
          VALUES (?, ?, ?, ?, 1, 'synced', ?, ?)
        `).run(item.id, item.title, item.description || "", item.status || "draft", item.id, createdAt);
        return { id: item.id, ...item, syncStatus: "synced", cloudId: item.id, isLocal: true };
      }
    }
    const store = loadFallback();
    const idx = (store.flows || []).findIndex((f) => f.id === item.id || f.cloudId === item.id);
    const enriched = { ...item, syncStatus: "synced", cloudId: item.id, isLocal: true };
    if (idx !== -1) {
      store.flows[idx] = { ...store.flows[idx], ...enriched };
    } else {
      (store.flows = store.flows || []).unshift(enriched);
    }
    saveFallback(store);
    return enriched;
  },
  markFlowSynced(localId, cloudId) {
    const db = getDatabase();
    if (db) {
      db.prepare(`UPDATE flows SET sync_status = 'synced', cloud_id = ? WHERE id = ?`).run(cloudId, localId);
    }
    const store = loadFallback();
    const item = (store.flows || []).find((fl) => fl.id === localId);
    if (item) {
      item.syncStatus = "synced";
      item.cloudId = cloudId;
      saveFallback(store);
    }
  },
  deleteFlow(id) {
    const db = getDatabase();
    if (db) {
      db.prepare("DELETE FROM flows WHERE id = ? OR cloud_id = ?").run(id, id);
      return { success: true };
    }
    const store = loadFallback();
    const idx = store.flows.findIndex((f) => f.id === id || f.cloudId === id);
    if (idx !== -1) {
      store.flows.splice(idx, 1);
      saveFallback(store);
    }
    return { success: true };
  },
  // ── Tags ──
  listTags() {
    const db = getDatabase();
    if (db) {
      const rows = db.prepare("SELECT * FROM tags").all().map((r) => ({
        id: r.id,
        name: r.name,
        color: r.color,
        isLocal: Boolean(r.is_local)
      }));
      return { items: rows, count: rows.length };
    }
    const store = loadFallback();
    return { items: store.tags || [], count: store.tags?.length || 0 };
  },
  createTag(data) {
    const id = generateLocalId("tag");
    const db = getDatabase();
    if (db) {
      db.prepare(`
        INSERT INTO tags (id, name, color, is_local)
        VALUES (?, ?, ?, 1)
      `).run(id, data.name, data.color || "#6366F1");
      return { id, ...data, isLocal: true };
    }
    const store = loadFallback();
    const item = { id, ...data, isLocal: true };
    store.tags.unshift(item);
    saveFallback(store);
    return item;
  },
  deleteTag(id) {
    const db = getDatabase();
    if (db) {
      db.prepare("DELETE FROM tags WHERE id = ?").run(id);
      return { success: true };
    }
    const store = loadFallback();
    const idx = store.tags.findIndex((t) => t.id === id);
    if (idx !== -1) {
      store.tags.splice(idx, 1);
      saveFallback(store);
    }
    return { success: true };
  },
  // ── Trash ──
  listTrash() {
    const db = getDatabase();
    if (db) {
      const rows = db.prepare("SELECT * FROM trash ORDER BY deleted_at DESC").all().map((r) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        deletedAt: r.deleted_at
      }));
      return { items: rows, count: rows.length };
    }
    const store = loadFallback();
    return { items: store.trash || [], count: store.trash?.length || 0 };
  },
  restoreTrash(kind, id) {
    const db = getDatabase();
    if (db) {
      db.prepare("DELETE FROM trash WHERE id = ? AND kind = ?").run(id, kind);
      return { restored: true };
    }
    const store = loadFallback();
    const idx = store.trash.findIndex((t) => t.id === id && t.kind === kind);
    if (idx !== -1) {
      store.trash.splice(idx, 1);
      saveFallback(store);
    }
    return { restored: true };
  },
  purgeTrash(kind, id) {
    const db = getDatabase();
    if (db) {
      db.prepare("DELETE FROM trash WHERE id = ? AND kind = ?").run(id, kind);
      return { purged: true };
    }
    const store = loadFallback();
    const idx = store.trash.findIndex((t) => t.id === id && t.kind === kind);
    if (idx !== -1) {
      store.trash.splice(idx, 1);
      saveFallback(store);
    }
    return { purged: true };
  },
  // ── High Performance SQLite Full-Text / LIKE Search ──
  search(query) {
    const q = `%${query.toLowerCase().trim()}%`;
    const db = getDatabase();
    if (db) {
      const results2 = [];
      try {
        const ideas = db.prepare("SELECT id, title, content, sync_status, cloud_id, is_local FROM ideas WHERE LOWER(title) LIKE ? OR LOWER(content) LIKE ?").all(q, q);
        for (const i of ideas) {
          results2.push({
            kind: "idea",
            id: i.id,
            title: i.title,
            snippet: i.content?.substring(0, 100),
            syncStatus: i.sync_status || (i.cloud_id ? "synced" : "unsynced"),
            cloudId: i.cloud_id || null,
            isLocal: Boolean(i.is_local)
          });
        }
      } catch {
      }
      try {
        const goals = db.prepare("SELECT id, title, description, sync_status, cloud_id, is_local FROM goals WHERE LOWER(title) LIKE ? OR LOWER(description) LIKE ?").all(q, q);
        for (const g of goals) {
          results2.push({
            kind: "goal",
            id: g.id,
            title: g.title,
            snippet: g.description?.substring(0, 100),
            syncStatus: g.sync_status || (g.cloud_id ? "synced" : "unsynced"),
            cloudId: g.cloud_id || null,
            isLocal: Boolean(g.is_local)
          });
        }
      } catch {
      }
      try {
        const secrets = db.prepare("SELECT id, name, sync_status, cloud_id, is_local FROM vault WHERE LOWER(name) LIKE ? OR LOWER(username) LIKE ?").all(q, q);
        for (const s of secrets) {
          results2.push({
            kind: "vault",
            id: s.id,
            title: s.name,
            syncStatus: s.sync_status || (s.cloud_id ? "synced" : "unsynced"),
            cloudId: s.cloud_id || null,
            isLocal: Boolean(s.is_local)
          });
        }
      } catch {
      }
      try {
        const events = db.prepare("SELECT id, title, description, sync_status, cloud_id, is_local FROM events WHERE LOWER(title) LIKE ? OR LOWER(description) LIKE ?").all(q, q);
        for (const e of events) {
          results2.push({
            kind: "event",
            id: e.id,
            title: e.title,
            snippet: e.description?.substring(0, 100),
            syncStatus: e.sync_status || (e.cloud_id ? "synced" : "unsynced"),
            cloudId: e.cloud_id || null,
            isLocal: Boolean(e.is_local)
          });
        }
      } catch {
      }
      try {
        const forms = db.prepare("SELECT id, title, description, sync_status, cloud_id, is_local FROM forms WHERE LOWER(title) LIKE ? OR LOWER(description) LIKE ?").all(q, q);
        for (const f of forms) {
          results2.push({
            kind: "form",
            id: f.id,
            title: f.title,
            snippet: f.description?.substring(0, 100),
            syncStatus: f.sync_status || (f.cloud_id ? "synced" : "unsynced"),
            cloudId: f.cloud_id || null,
            isLocal: Boolean(f.is_local)
          });
        }
      } catch {
      }
      try {
        const flows = db.prepare("SELECT id, title, description, sync_status, cloud_id, is_local FROM flows WHERE LOWER(title) LIKE ? OR LOWER(description) LIKE ?").all(q, q);
        for (const fl of flows) {
          results2.push({
            kind: "flow",
            id: fl.id,
            title: fl.title,
            snippet: fl.description?.substring(0, 100),
            syncStatus: fl.sync_status || (fl.cloud_id ? "synced" : "unsynced"),
            cloudId: fl.cloud_id || null,
            isLocal: Boolean(fl.is_local)
          });
        }
      } catch {
      }
      return results2;
    }
    const store = loadFallback();
    const results = [];
    const plainQ = query.toLowerCase().trim();
    for (const i of store.ideas || []) {
      if (i.title?.toLowerCase().includes(plainQ) || i.content?.toLowerCase().includes(plainQ)) {
        results.push({
          kind: "idea",
          id: i.id,
          title: i.title,
          snippet: i.content?.substring(0, 100),
          syncStatus: i.syncStatus || "unsynced",
          cloudId: i.cloudId || null,
          isLocal: true
        });
      }
    }
    for (const g of store.goals || []) {
      if (g.title?.toLowerCase().includes(plainQ) || g.description?.toLowerCase().includes(plainQ)) {
        results.push({
          kind: "goal",
          id: g.id,
          title: g.title,
          snippet: g.description?.substring(0, 100),
          syncStatus: g.syncStatus || "unsynced",
          cloudId: g.cloudId || null,
          isLocal: true
        });
      }
    }
    return results;
  },
  // ── Connected Tools & External Workspaces / Contexts ──
  connectTool(data) {
    const id = generateLocalId("tool");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const client = data.client.toLowerCase();
    const name = data.name || data.client;
    const directory = data.directory || process.cwd();
    const workspaceId = data.workspaceId || null;
    const metadataStr = data.metadata ? JSON.stringify(data.metadata) : null;
    const db = getDatabase();
    if (db) {
      try {
        const stmt = db.prepare(`
          INSERT INTO connected_tools (id, client, name, directory, workspace_id, connected_at, last_active_at, status, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'connected', ?)
          ON CONFLICT(client) DO UPDATE SET
            name = excluded.name,
            directory = excluded.directory,
            workspace_id = COALESCE(excluded.workspace_id, connected_tools.workspace_id),
            last_active_at = excluded.last_active_at,
            status = 'connected',
            metadata = excluded.metadata
        `);
        stmt.run(id, client, name, directory, workspaceId, now, now, metadataStr);
      } catch {
      }
      return { id, client, name, directory, workspaceId, connectedAt: now, status: "connected" };
    }
    const store = loadFallback();
    store.connectedTools = store.connectedTools || [];
    const existingIndex = store.connectedTools.findIndex((t) => t.client === client);
    const item = { id, client, name, directory, workspaceId, connectedAt: now, lastActiveAt: now, status: "connected", metadata: data.metadata };
    if (existingIndex >= 0) {
      store.connectedTools[existingIndex] = { ...store.connectedTools[existingIndex], ...item };
    } else {
      store.connectedTools.push(item);
    }
    saveFallback(store);
    return item;
  },
  listConnectedTools() {
    const db = getDatabase();
    if (db) {
      try {
        return db.prepare("SELECT * FROM connected_tools ORDER BY last_active_at DESC").all();
      } catch {
        return [];
      }
    }
    const store = loadFallback();
    return store.connectedTools || [];
  },
  saveExternalContext(data) {
    const id = data.id || generateLocalId("ctx");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const payloadStr = typeof data.payload === "string" ? data.payload : data.payload ? JSON.stringify(data.payload) : null;
    const directory = data.directory || process.cwd();
    const status = data.status || "connected";
    const db = getDatabase();
    if (db) {
      try {
        const stmt = db.prepare(`
          INSERT INTO external_contexts (id, client, directory, workspace_id, title, summary, payload, status, is_local, sync_status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'unsynced', ?, ?)
        `);
        stmt.run(id, data.client.toLowerCase(), directory, data.workspaceId || null, data.title, data.summary || null, payloadStr, status, now, now);
      } catch {
      }
      return { id, ...data, directory, status, createdAt: now, updatedAt: now };
    }
    const store = loadFallback();
    store.externalContexts = store.externalContexts || [];
    const item = { id, ...data, directory, status, createdAt: now, updatedAt: now };
    store.externalContexts.unshift(item);
    saveFallback(store);
    return item;
  },
  listExternalContexts(filter) {
    const db = getDatabase();
    if (db) {
      try {
        let sql = "SELECT * FROM external_contexts WHERE 1=1";
        const params = [];
        if (filter?.client) {
          sql += " AND client = ?";
          params.push(filter.client.toLowerCase());
        }
        if (filter?.directory) {
          sql += " AND directory = ?";
          params.push(filter.directory);
        }
        if (filter?.workspaceId) {
          sql += " AND workspace_id = ?";
          params.push(filter.workspaceId);
        }
        sql += " ORDER BY updated_at DESC";
        return db.prepare(sql).all(...params);
      } catch {
        return [];
      }
    }
    const store = loadFallback();
    let items = store.externalContexts || [];
    if (filter?.client) items = items.filter((i) => i.client === filter.client?.toLowerCase());
    if (filter?.directory) items = items.filter((i) => i.directory === filter.directory);
    if (filter?.workspaceId) items = items.filter((i) => i.workspaceId === filter.workspaceId);
    return items;
  },
  synthesizeContexts(targetDirectory) {
    const dir = targetDirectory || process.cwd();
    const contexts = this.listExternalContexts({ directory: dir });
    const uniqueClients = Array.from(new Set(contexts.map((c) => c.client)));
    const summaries = contexts.map((c) => `[${c.client}] ${c.title}: ${c.summary || "Context snapshot"}`).join("\n");
    return {
      clients: uniqueClients,
      contexts,
      synthesizedSummary: summaries || "No cross-tool context recorded yet for this directory."
    };
  }
};

// src/views/status.ts
var StatusItem = class extends vscode.TreeItem {
  constructor(label, description, iconName, command, contextValue) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.label = label;
    this.description = description;
    this.iconName = iconName;
    this.command = command;
    this.contextValue = contextValue;
    this.description = description;
    this.contextValue = contextValue || "statusItem";
    if (iconName) {
      this.iconPath = new vscode.ThemeIcon(iconName);
    }
  }
  label;
  description;
  iconName;
  command;
  contextValue;
};
var StatusTreeProvider = class {
  _onDidChangeTreeData = new vscode.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  refresh() {
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    return element;
  }
  async getChildren(element) {
    if (element) return [];
    const items = [];
    try {
      const env3 = resolveEnvironment();
      const _config = loadConfig();
      const isAuthed = hasAuth();
      const accountLabel = isAuthed ? `Account: ${env3.email || env3.userId || "Logged In"}` : "Account: Anonymous (Local Mode)";
      const accountDesc = env3.tier ? `Tier: ${env3.tier}` : isAuthed ? "Cloud Connected" : "Local Only";
      items.push(new StatusItem(accountLabel, accountDesc, "account", {
        command: "kylrix.whoami",
        title: "View Identity"
      }));
      items.push(new StatusItem(`Server: ${env3.apiUrl}`, env3.partitionKey === "default" ? "Default Cloud" : "Self-Hosted", "server", {
        command: "kylrix.switchServer",
        title: "Switch Server"
      }));
      items.push(new StatusItem(`Workspace: ${env3.workspaceId || "Personal Virtual Workspace"}`, "Active Context", "briefcase", {
        command: "kylrix.switchWorkspace",
        title: "Switch Workspace"
      }));
      const unsyncedIdeas = LocalStore.listIdeas().items.filter((i) => i.syncStatus === "unsynced").length;
      const unsyncedGoals = LocalStore.listGoals().items.filter((g) => g.syncStatus === "unsynced").length;
      const totalUnsynced = unsyncedIdeas + unsyncedGoals;
      const syncLabel = totalUnsynced > 0 ? `Sync: ${totalUnsynced} unsynced items` : "Sync: Up to date";
      const syncDesc = isAuthed ? totalUnsynced > 0 ? "Click to sync" : "Cloud Synced" : "Login to sync";
      items.push(new StatusItem(syncLabel, syncDesc, totalUnsynced > 0 ? "cloud-upload" : "cloud", {
        command: "kylrix.sync",
        title: "Synchronize"
      }));
      if (!isAuthed) {
        items.push(new StatusItem("\u{1F510} Login / Pair Device", "Connect cloud workspace", "key", {
          command: "kylrix.login",
          title: "Login"
        }));
      } else {
        items.push(new StatusItem("\u{1F504} Switch Account Profile", "Manage profiles", "arrow-swap", {
          command: "kylrix.switchAccount",
          title: "Switch Account"
        }));
      }
    } catch (err) {
      items.push(new StatusItem("Error loading status", err?.message || String(err), "error"));
    }
    return items;
  }
};

// src/views/ideas.ts
var vscode2 = __toESM(require("vscode"), 1);
var IdeaItem = class extends vscode2.TreeItem {
  constructor(ideaId, title, category, content, syncStatus, isCategoryGroup = false) {
    super(
      title,
      isCategoryGroup ? vscode2.TreeItemCollapsibleState.Expanded : vscode2.TreeItemCollapsibleState.None
    );
    this.ideaId = ideaId;
    this.title = title;
    this.category = category;
    this.content = content;
    this.syncStatus = syncStatus;
    this.isCategoryGroup = isCategoryGroup;
    if (!isCategoryGroup) {
      const syncBadge = syncStatus === "synced" ? "\u25CF synced" : "\u25CB local";
      this.description = `[${category}] ${syncBadge}`;
      this.tooltip = `${title}
Category: ${category}
Sync: ${syncStatus}

${content.substring(0, 200)}`;
      this.iconPath = new vscode2.ThemeIcon(syncStatus === "synced" ? "notebook" : "edit");
      this.contextValue = "ideaItem";
      this.command = {
        command: "kylrix.openNote",
        title: "Open Note",
        arguments: [ideaId]
      };
    } else {
      this.iconPath = new vscode2.ThemeIcon("folder");
      this.contextValue = "categoryGroup";
    }
  }
  ideaId;
  title;
  category;
  content;
  syncStatus;
  isCategoryGroup;
};
var IdeasTreeProvider = class {
  _onDidChangeTreeData = new vscode2.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  refresh() {
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    return element;
  }
  async getChildren(element) {
    try {
      const res = LocalStore.listIdeas();
      const allIdeas = res.items || [];
      if (!element) {
        const categoriesMap = /* @__PURE__ */ new Map();
        for (const idea of allIdeas) {
          const cat = idea.category || "general";
          if (!categoriesMap.has(cat)) {
            categoriesMap.set(cat, []);
          }
          categoriesMap.get(cat).push(idea);
        }
        const categoryNodes = [];
        for (const [cat, ideas] of categoriesMap.entries()) {
          categoryNodes.push(
            new IdeaItem(
              `cat:${cat}`,
              `${cat.toUpperCase()} (${ideas.length})`,
              cat,
              "",
              "",
              true
            )
          );
        }
        return categoryNodes;
      } else if (element.isCategoryGroup) {
        const cat = element.category;
        const matching = allIdeas.filter((i) => (i.category || "general") === cat);
        return matching.map(
          (i) => new IdeaItem(i.id, i.title || "(Untitled Note)", i.category || "general", i.content || "", i.syncStatus || "local", false)
        );
      }
    } catch (err) {
      return [new IdeaItem("err", `Error: ${err.message}`, "error", "", "", false)];
    }
    return [];
  }
};

// src/views/goals.ts
var vscode3 = __toESM(require("vscode"), 1);
var GoalItem = class extends vscode3.TreeItem {
  constructor(goalId, title, status, currentValue, targetValue, unit, syncStatus) {
    const percent = Math.min(100, Math.max(0, Math.round(currentValue / (targetValue || 100) * 100)));
    const filledBlocks = Math.round(percent / 10);
    const progressBar = "\u2588".repeat(filledBlocks) + "\u2591".repeat(10 - filledBlocks);
    super(`[${progressBar}] ${percent}% - ${title}`, vscode3.TreeItemCollapsibleState.None);
    this.goalId = goalId;
    this.title = title;
    this.status = status;
    this.currentValue = currentValue;
    this.targetValue = targetValue;
    this.unit = unit;
    this.syncStatus = syncStatus;
    this.description = `Status: ${status} (${currentValue}/${targetValue} ${unit})`;
    this.tooltip = `${title}
Progress: ${percent}% (${currentValue}/${targetValue} ${unit})
Status: ${status}
Sync: ${syncStatus}`;
    this.contextValue = "goalItem";
    if (status === "completed" || percent >= 100) {
      this.iconPath = new vscode3.ThemeIcon("pass-filled");
    } else if (status === "in_progress") {
      this.iconPath = new vscode3.ThemeIcon("play-circle");
    } else {
      this.iconPath = new vscode3.ThemeIcon("target");
    }
    this.command = {
      command: "kylrix.updateGoalProgress",
      title: "Update Goal",
      arguments: [goalId]
    };
  }
  goalId;
  title;
  status;
  currentValue;
  targetValue;
  unit;
  syncStatus;
};
var GoalsTreeProvider = class {
  _onDidChangeTreeData = new vscode3.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  refresh() {
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    return element;
  }
  async getChildren(element) {
    if (element) return [];
    try {
      const res = LocalStore.listGoals();
      const allGoals = res.items || [];
      if (allGoals.length === 0) {
        return [
          new GoalItem("empty", "No goals created yet. Click + to add one.", "not_started", 0, 100, "%", "local")
        ];
      }
      return allGoals.map(
        (g) => new GoalItem(
          g.id,
          g.title || "(Untitled Goal)",
          g.status || "not_started",
          g.currentValue ?? 0,
          g.targetValue ?? 100,
          g.unit || "%",
          g.syncStatus || "local"
        )
      );
    } catch (err) {
      return [new GoalItem("err", `Error: ${err.message}`, "error", 0, 100, "%", "local")];
    }
  }
};

// src/views/vault.ts
var vscode4 = __toESM(require("vscode"), 1);
var VaultItem = class extends vscode4.TreeItem {
  constructor(vaultId, name, username, isEnv, itemType, isHeader) {
    super(
      name,
      isHeader ? vscode4.TreeItemCollapsibleState.Expanded : vscode4.TreeItemCollapsibleState.None
    );
    this.vaultId = vaultId;
    this.name = name;
    this.username = username;
    this.isEnv = isEnv;
    this.itemType = itemType;
    this.isHeader = isHeader;
    if (!isHeader) {
      this.description = isEnv ? "Environment Variables (.env)" : username ? `User: ${username}` : "Secret Item";
      this.tooltip = `${name}
Type: ${itemType || (isEnv ? "env" : "login")}
Username: ${username || "N/A"}`;
      this.iconPath = new vscode4.ThemeIcon(isEnv ? "file-code" : "key");
      this.contextValue = isEnv ? "envItem" : "vaultItem";
      this.command = {
        command: isEnv ? "kylrix.pullEnv" : "kylrix.unlockVault",
        title: isEnv ? "Pull .env" : "View Secret",
        arguments: [vaultId]
      };
    } else {
      this.iconPath = new vscode4.ThemeIcon("shield");
      this.contextValue = "vaultHeader";
    }
  }
  vaultId;
  name;
  username;
  isEnv;
  itemType;
  isHeader;
};
var VaultTreeProvider = class {
  _onDidChangeTreeData = new vscode4.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  refresh() {
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    return element;
  }
  async getChildren(element) {
    if (element) return [];
    try {
      const items = LocalStore.listVault();
      if (items.length === 0) {
        return [
          new VaultItem("empty", "No secrets stored locally.", "", false, "none", false)
        ];
      }
      return items.map(
        (v) => new VaultItem(
          v.id,
          v.name || "(Untitled Secret)",
          v.username,
          v.isEnv,
          v.itemType,
          false
        )
      );
    } catch (err) {
      return [new VaultItem("err", `Error: ${err.message}`, "", false, "error", false)];
    }
  }
};

// src/views/totp.ts
var vscode5 = __toESM(require("vscode"), 1);
var TotpItem = class extends vscode5.TreeItem {
  constructor(totpId, name, account, issuer, secret) {
    super(name, vscode5.TreeItemCollapsibleState.None);
    this.totpId = totpId;
    this.name = name;
    this.account = account;
    this.issuer = issuer;
    this.secret = secret;
    this.description = issuer ? `[${issuer}] ${account || ""}` : account || "2FA Seed";
    this.tooltip = `${name}
Issuer: ${issuer || "N/A"}
Account: ${account || "N/A"}`;
    this.iconPath = new vscode5.ThemeIcon("device-mobile");
    this.contextValue = "totpItem";
    this.command = {
      command: "kylrix.copyTotpCode",
      title: "Copy 2FA Code",
      arguments: [totpId]
    };
  }
  totpId;
  name;
  account;
  issuer;
  secret;
};
var TotpTreeProvider = class {
  _onDidChangeTreeData = new vscode5.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  refresh() {
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    return element;
  }
  async getChildren(element) {
    if (element) return [];
    try {
      const items = LocalStore.listTotp();
      if (items.length === 0) {
        return [
          new TotpItem("empty", "No 2FA TOTP accounts. Click + to add.", "", "", "")
        ];
      }
      return items.map(
        (t) => new TotpItem(
          t.id,
          t.name || "2FA Account",
          t.account,
          t.issuer,
          t.secret
        )
      );
    } catch (err) {
      return [new TotpItem("err", `Error: ${err.message}`, "", "", "")];
    }
  }
};

// src/views/events.ts
var vscode6 = __toESM(require("vscode"), 1);
var EventOrFormItem = class extends vscode6.TreeItem {
  constructor(itemId, kind, title, detail) {
    super(
      title,
      kind === "group" ? vscode6.TreeItemCollapsibleState.Expanded : vscode6.TreeItemCollapsibleState.None
    );
    this.itemId = itemId;
    this.kind = kind;
    this.title = title;
    this.detail = detail;
    if (kind !== "group") {
      this.description = detail;
      this.contextValue = `${kind}Item`;
      this.iconPath = new vscode6.ThemeIcon(
        kind === "event" ? "calendar" : kind === "form" ? "list-flat" : "workflow"
      );
    } else {
      this.iconPath = new vscode6.ThemeIcon("layers");
      this.contextValue = "groupHeader";
    }
  }
  itemId;
  kind;
  title;
  detail;
};
var EventsTreeProvider = class {
  _onDidChangeTreeData = new vscode6.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  refresh() {
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    return element;
  }
  async getChildren(element) {
    if (!element) {
      return [
        new EventOrFormItem("grp:events", "group", "Calendar Events"),
        new EventOrFormItem("grp:forms", "group", "Interactive Forms"),
        new EventOrFormItem("grp:flows", "group", "Automated Flows")
      ];
    }
    try {
      if (element.itemId === "grp:events") {
        const events = LocalStore.listEvents().items;
        if (events.length === 0) return [new EventOrFormItem("empty", "event", "No calendar events")];
        return events.map(
          (e) => new EventOrFormItem(e.id, "event", e.title || "(Untitled Event)", e.startTime?.substring(0, 10))
        );
      }
      if (element.itemId === "grp:forms") {
        const forms = LocalStore.listForms().items;
        if (forms.length === 0) return [new EventOrFormItem("empty", "form", "No forms created")];
        return forms.map((f) => new EventOrFormItem(f.id, "form", f.title || "(Untitled Form)", f.description));
      }
      if (element.itemId === "grp:flows") {
        const flows = LocalStore.listFlows().items;
        if (flows.length === 0) return [new EventOrFormItem("empty", "flow", "No flows created")];
        return flows.map(
          (fl) => new EventOrFormItem(fl.id, "flow", fl.title || "(Untitled Flow)", `Status: ${fl.status || "draft"}`)
        );
      }
    } catch (err) {
      return [new EventOrFormItem("err", "group", `Error: ${err.message}`)];
    }
    return [];
  }
};

// src/views/chats.ts
var vscode7 = __toESM(require("vscode"), 1);

// ../cli/src/local/sync-resolver.ts
var fs4 = __toESM(require("fs"), 1);
var path4 = __toESM(require("path"), 1);
function extractItems(res) {
  if (!res) return [];
  if (Array.isArray(res.items)) return res.items;
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.data)) return res.data;
  return [];
}

// src/views/chats.ts
var ChatItem = class extends vscode7.TreeItem {
  constructor(chatId, title, subtitle) {
    super(title, vscode7.TreeItemCollapsibleState.None);
    this.chatId = chatId;
    this.title = title;
    this.subtitle = subtitle;
    this.description = subtitle;
    this.iconPath = new vscode7.ThemeIcon("comment-discussion");
    this.contextValue = "chatItem";
  }
  chatId;
  title;
  subtitle;
};
var ChatsTreeProvider = class {
  _onDidChangeTreeData = new vscode7.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  refresh() {
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    return element;
  }
  async getChildren(element) {
    if (element) return [];
    if (!hasAuth()) {
      return [
        new ChatItem("auth", "Cloud Authentication Required", "Login to access chats & threads")
      ];
    }
    try {
      const client = getClient();
      const conversations = await client.chats.list();
      const items = extractItems(conversations);
      if (items.length === 0) {
        return [new ChatItem("empty", "No active chat discussions", "Start one from web or CLI")];
      }
      return items.map(
        (c) => new ChatItem(
          c.id,
          c.title || c.name || `Chat ${c.id.substring(0, 8)}`,
          c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : ""
        )
      );
    } catch (err) {
      return [new ChatItem("err", "Unable to fetch chats", err.message)];
    }
  }
};

// src/views/agents.ts
var vscode8 = __toESM(require("vscode"), 1);
var AgentOrContextItem = class extends vscode8.TreeItem {
  constructor(itemId, title, detail, iconName = "robot") {
    super(title, vscode8.TreeItemCollapsibleState.None);
    this.itemId = itemId;
    this.title = title;
    this.detail = detail;
    this.iconName = iconName;
    this.description = detail;
    this.iconPath = new vscode8.ThemeIcon(iconName);
    this.contextValue = "agentItem";
  }
  itemId;
  title;
  detail;
  iconName;
};
var AgentsTreeProvider = class {
  _onDidChangeTreeData = new vscode8.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  refresh() {
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    return element;
  }
  async getChildren(element) {
    if (element) return [];
    try {
      const tools = LocalStore.listConnectedTools();
      const currentWorkspace = vscode8.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const contexts = LocalStore.listExternalContexts({ directory: currentWorkspace });
      const items = [];
      if (tools.length > 0) {
        for (const t of tools) {
          items.push(
            new AgentOrContextItem(
              `tool:${t.id}`,
              `Tool: ${t.name || t.client}`,
              `Connected: ${t.directory || "Global"}`,
              "plug"
            )
          );
        }
      }
      if (contexts.length > 0) {
        for (const ctx of contexts) {
          items.push(
            new AgentOrContextItem(
              `ctx:${ctx.id}`,
              `Context: ${ctx.title}`,
              `Client: ${ctx.client}`,
              "symbol-misc"
            )
          );
        }
      }
      if (items.length === 0) {
        items.push(
          new AgentOrContextItem(
            "connect",
            "No tool context connected",
            'Run "Kylrix: Connect Workspace Tool Context"',
            "link"
          )
        );
      }
      return items;
    } catch (err) {
      return [new AgentOrContextItem("err", "Error reading context", err.message, "error")];
    }
  }
};

// src/views/trash.ts
var vscode9 = __toESM(require("vscode"), 1);
var TrashOrTagItem = class extends vscode9.TreeItem {
  constructor(itemId, isTag, labelName, detail) {
    super(labelName, vscode9.TreeItemCollapsibleState.None);
    this.itemId = itemId;
    this.isTag = isTag;
    this.labelName = labelName;
    this.detail = detail;
    this.description = detail;
    this.iconPath = new vscode9.ThemeIcon(isTag ? "tag" : "trash");
    this.contextValue = isTag ? "tagItem" : "trashSubItem";
  }
  itemId;
  isTag;
  labelName;
  detail;
};
var TrashTreeProvider = class {
  _onDidChangeTreeData = new vscode9.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  refresh() {
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    return element;
  }
  async getChildren(element) {
    if (element) return [];
    try {
      const items = [];
      const tags = LocalStore.listTags().items;
      if (tags.length > 0) {
        for (const t of tags) {
          items.push(new TrashOrTagItem(t.id, true, `Tag: #${t.name}`, `Color: ${t.color}`));
        }
      }
      const trash = LocalStore.listTrash().items;
      if (trash.length > 0) {
        for (const tr of trash) {
          items.push(
            new TrashOrTagItem(
              tr.id,
              false,
              `[Deleted] ${tr.title || tr.id}`,
              `Kind: ${tr.kind} | ${tr.deletedAt?.substring(0, 10)}`
            )
          );
        }
      }
      if (items.length === 0) {
        items.push(new TrashOrTagItem("empty", false, "Trash is empty & no tags", "Clean state"));
      }
      return items;
    } catch (err) {
      return [new TrashOrTagItem("err", false, "Error loading trash", err.message)];
    }
  }
};

// src/commands/auth.ts
var vscode10 = __toESM(require("vscode"), 1);
async function loginCommand(refreshCb) {
  try {
    const method = await vscode10.window.showQuickPick(
      [
        {
          label: "$(globe) Sign in with browser",
          description: "Authorize this extension without copying a secret",
          value: "browser"
        },
        {
          label: "$(key) Use an API key",
          description: "Paste a Kylrix PAT or agent key",
          value: "apiKey"
        }
      ],
      {
        title: "Connect Kylrix",
        placeHolder: "Choose a secure sign-in method"
      }
    );
    if (!method) return;
    if (method.value === "browser") {
      await loginWithBrowser(refreshCb);
      return;
    }
    await loginWithApiKey(refreshCb);
  } catch (err) {
    vscode10.window.showErrorMessage(`Login failed: ${err?.message || String(err)}`);
  }
}
async function loginWithApiKey(refreshCb) {
  const token = await vscode10.window.showInputBox({
    title: "Kylrix API key",
    prompt: "Enter a Kylrix Personal Access Token or agent key",
    placeHolder: "kyl_pat_...",
    password: true,
    ignoreFocusOut: true
  });
  if (!token) return;
  const apiUrl = vscode10.workspace.getConfiguration("kylrix").get("apiUrl") || "https://www.kylrix.space";
  const client = getClient({ url: apiUrl, token });
  const profile = await client.auth.me();
  saveConfig({
    token,
    apiUrl,
    userId: profile.id,
    email: profile.email,
    tier: profile.tier
  });
  vscode10.window.showInformationMessage(`Connected to Kylrix as ${profile.email || profile.id}.`);
  refreshCb?.();
}
async function loginWithBrowser(refreshCb) {
  const apiUrl = vscode10.workspace.getConfiguration("kylrix").get("apiUrl") || "https://www.kylrix.space";
  const client = getClient({ url: apiUrl });
  const session = await client.pairing.requestPairing({
    clientName: "Kylrix VS Code",
    clientType: "cli",
    requestedScopes: ["*"]
  });
  const baseWebUrl = apiUrl.replace(/\/api\/v1$/, "");
  const verificationUrl = session.verificationUriComplete || `${baseWebUrl}/pair?code=${encodeURIComponent(session.userCode)}`;
  await vscode10.env.openExternal(vscode10.Uri.parse(verificationUrl));
  const choice = await vscode10.window.showInformationMessage(
    `Approve Kylrix in your browser, then return here. Code: ${session.userCode}`,
    "Copy code"
  );
  if (choice === "Copy code") {
    await vscode10.env.clipboard.writeText(session.userCode);
    vscode10.window.showInformationMessage("Pairing code copied to your clipboard.");
  }
  await vscode10.window.withProgress(
    {
      location: vscode10.ProgressLocation.Notification,
      title: "Waiting for Kylrix approval",
      cancellable: false
    },
    async (progress) => {
      const result = await client.pairing.pollExchange(session.deviceCode, {
        intervalSeconds: Math.max(session.interval || 5, 5),
        timeoutSeconds: session.expiresIn || 600,
        onPoll: () => progress.report({ message: "Approve the sign-in in your browser..." })
      });
      let email;
      let tier;
      try {
        const profile = await getClient({ url: apiUrl, token: result.token }).auth.me();
        email = profile.email;
        tier = profile.tier;
      } catch {
      }
      saveConfig({
        token: result.token,
        apiUrl,
        userId: result.userId,
        email,
        tier
      });
    }
  );
  vscode10.window.showInformationMessage("Kylrix browser sign-in complete.");
  refreshCb?.();
}
async function logoutCommand(refreshCb) {
  try {
    saveConfig({ token: void 0 });
    vscode10.window.showInformationMessage("Logged out from Kylrix session.");
    if (refreshCb) refreshCb();
  } catch (err) {
    vscode10.window.showErrorMessage(`Logout failed: ${err.message}`);
  }
}
async function whoamiCommand() {
  try {
    const env3 = resolveEnvironment();
    const isAuthed = hasAuth();
    if (!isAuthed) {
      vscode10.window.showInformationMessage("Kylrix: Currently in Anonymous / Local-First mode.");
      return;
    }
    const client = getClient();
    let detail = `Account: ${env3.email || env3.userId || "Authenticated"}
Server: ${env3.apiUrl}
Workspace: ${env3.workspaceId || "Personal"}`;
    try {
      const user = await client.auth.me();
      if (user?.email) detail += `
Verified Email: ${user.email}`;
    } catch {
    }
    vscode10.window.showInformationMessage(`Kylrix Identity:
${detail}`, { modal: true });
  } catch (err) {
    vscode10.window.showErrorMessage(`WhoAmI error: ${err.message}`);
  }
}
async function switchAccountCommand(refreshCb) {
  try {
    const { accounts } = listAccounts();
    if (accounts.length === 0) {
      vscode10.window.showInformationMessage("No additional account profiles found. Login first.");
      return;
    }
    const pickItems = accounts.map((a) => ({
      label: a.email || a.userId,
      description: a.lastUsedAt ? `Last used: ${a.lastUsedAt.substring(0, 10)}` : void 0,
      accountId: a.userId
    }));
    const selected = await vscode10.window.showQuickPick(pickItems, {
      placeHolder: "Select an account profile to switch to"
    });
    if (selected) {
      switchAccount(selected.accountId);
      vscode10.window.showInformationMessage(`Switched active account profile to ${selected.label}`);
      if (refreshCb) refreshCb();
    }
  } catch (err) {
    vscode10.window.showErrorMessage(`Switch account failed: ${err.message}`);
  }
}
async function switchServerCommand(refreshCb) {
  try {
    const servers = listServers();
    const pickItems = servers.map((s) => ({
      label: s.baseUrl,
      description: s.isCurrent ? "Current" : `${s.accountCount} accounts`,
      serverUrl: s.baseUrl
    }));
    pickItems.push({
      label: "+ Add custom server base URL",
      description: "Enter custom self-hosted endpoint URL",
      serverUrl: "__ADD_NEW__"
    });
    const selected = await vscode10.window.showQuickPick(pickItems, {
      placeHolder: "Select active Kylrix server base URL"
    });
    if (!selected) return;
    if (selected.serverUrl === "__ADD_NEW__") {
      const customUrl = await vscode10.window.showInputBox({
        prompt: "Enter self-hosted Kylrix base URL",
        placeHolder: "https://kylrix.my-domain.com"
      });
      if (customUrl) {
        switchServer(customUrl);
        vscode10.window.showInformationMessage(`Switched server base URL to ${customUrl}`);
        if (refreshCb) refreshCb();
      }
    } else {
      switchServer(selected.serverUrl);
      vscode10.window.showInformationMessage(`Switched server base URL to ${selected.serverUrl}`);
      if (refreshCb) refreshCb();
    }
  } catch (err) {
    vscode10.window.showErrorMessage(`Switch server failed: ${err.message}`);
  }
}
async function switchWorkspaceCommand(refreshCb) {
  try {
    const isAuthed = hasAuth();
    let workspaceOptions = [
      { label: "Personal Virtual Workspace", workspaceId: "", description: "Default personal scope" }
    ];
    if (isAuthed) {
      try {
        const client = getClient();
        const res = await client.workspaces.list();
        const items = Array.isArray(res) ? res : res?.items || res?.documents || [];
        for (const w of items) {
          workspaceOptions.push({
            label: w.title || w.name || w.id,
            workspaceId: w.id,
            description: `ID: ${w.id}`
          });
        }
      } catch {
      }
    }
    const selected = await vscode10.window.showQuickPick(workspaceOptions, {
      placeHolder: "Select active workspace context"
    });
    if (selected !== void 0) {
      saveConfig({ workspaceId: selected.workspaceId });
      vscode10.window.showInformationMessage(`Switched active workspace to "${selected.label}"`);
      if (refreshCb) refreshCb();
    }
  } catch (err) {
    vscode10.window.showErrorMessage(`Switch workspace failed: ${err.message}`);
  }
}

// src/commands/notes.ts
var vscode11 = __toESM(require("vscode"), 1);
async function createNoteCommand(refreshCb) {
  try {
    const title = await vscode11.window.showInputBox({
      prompt: "Enter note / idea title",
      placeHolder: "e.g. System Architecture Notes"
    });
    if (!title) return;
    const category = await vscode11.window.showInputBox({
      prompt: "Enter category (default: general)",
      placeHolder: "general, architecture, draft, article",
      value: "general"
    });
    const content = await vscode11.window.showInputBox({
      prompt: "Enter note initial body / content (Markdown supported)",
      placeHolder: "Content details..."
    });
    const isAuthed = hasAuth();
    const item = LocalStore.createIdea({
      title,
      category: category || "general",
      content: content || "",
      syncStatus: isAuthed ? "unsynced" : "local"
    });
    if (isAuthed) {
      try {
        const cloudItem = await getClient().ideas.create({
          title,
          content: content || ""
        });
        LocalStore.markIdeaSynced(item.id, cloudItem.id);
      } catch {
      }
    }
    vscode11.window.showInformationMessage(`Created note "${title}"`);
    if (refreshCb) refreshCb();
    openNoteCommand(item.id);
  } catch (err) {
    vscode11.window.showErrorMessage(`Failed to create note: ${err.message}`);
  }
}
async function openNoteCommand(noteId) {
  try {
    if (!noteId) {
      const res = LocalStore.listIdeas();
      const items = res.items || [];
      if (items.length === 0) {
        vscode11.window.showInformationMessage("No notes available to open.");
        return;
      }
      const selected = await vscode11.window.showQuickPick(
        items.map((i) => ({ label: i.title || i.id, description: i.category, noteId: i.id })),
        { placeHolder: "Select a note to open in editor" }
      );
      if (!selected) return;
      noteId = selected.noteId;
    }
    const note = LocalStore.getIdea(noteId);
    if (!note) {
      vscode11.window.showErrorMessage(`Note not found: ${noteId}`);
      return;
    }
    const docContent = `# ${note.title || "Untitled Note"}

Category: ${note.category || "general"}
Updated: ${note.updatedAt || note.createdAt || "N/A"}

---

${note.content || ""}`;
    const doc = await vscode11.workspace.openTextDocument({
      language: "markdown",
      content: docContent
    });
    await vscode11.window.showTextDocument(doc, { preview: false });
  } catch (err) {
    vscode11.window.showErrorMessage(`Failed to open note: ${err.message}`);
  }
}
async function deleteNoteCommand(noteId, refreshCb) {
  try {
    if (!noteId) {
      const res = LocalStore.listIdeas();
      const items = res.items || [];
      if (items.length === 0) {
        vscode11.window.showInformationMessage("No notes available to delete.");
        return;
      }
      const selected = await vscode11.window.showQuickPick(
        items.map((i) => ({ label: i.title || i.id, description: i.category, noteId: i.id })),
        { placeHolder: "Select a note to delete" }
      );
      if (!selected) return;
      noteId = selected.noteId;
    }
    const confirm = await vscode11.window.showWarningMessage(
      `Are you sure you want to delete note "${noteId}"?`,
      { modal: true },
      "Delete"
    );
    if (confirm === "Delete") {
      LocalStore.deleteIdea(noteId);
      vscode11.window.showInformationMessage(`Deleted note ${noteId}`);
      if (refreshCb) refreshCb();
    }
  } catch (err) {
    vscode11.window.showErrorMessage(`Failed to delete note: ${err.message}`);
  }
}

// src/commands/goals.ts
var vscode12 = __toESM(require("vscode"), 1);
async function createGoalCommand(refreshCb) {
  try {
    const title = await vscode12.window.showInputBox({
      prompt: "Enter goal title",
      placeHolder: "e.g. Complete VS Code Extension Parity"
    });
    if (!title) return;
    const targetVal = await vscode12.window.showInputBox({
      prompt: "Enter target numeric value (default: 100)",
      value: "100"
    });
    const unit = await vscode12.window.showInputBox({
      prompt: "Enter unit (default: %)",
      value: "%"
    });
    const isAuthed = hasAuth();
    const item = LocalStore.createGoal({
      title,
      targetValue: parseFloat(targetVal || "100"),
      currentValue: 0,
      unit: unit || "%",
      status: "in_progress",
      syncStatus: isAuthed ? "unsynced" : "local"
    });
    if (isAuthed) {
      try {
        const cloudGoal = await getClient().goals.create({
          title,
          targetValue: parseFloat(targetVal || "100"),
          unit: unit || "%"
        });
        LocalStore.markGoalSynced(item.id, cloudGoal.id);
      } catch {
      }
    }
    vscode12.window.showInformationMessage(`Created goal "${title}"`);
    if (refreshCb) refreshCb();
  } catch (err) {
    vscode12.window.showErrorMessage(`Failed to create goal: ${err.message}`);
  }
}
async function updateGoalProgressCommand(goalId, refreshCb) {
  try {
    if (!goalId) {
      const res = LocalStore.listGoals();
      const items = res.items || [];
      if (items.length === 0) {
        vscode12.window.showInformationMessage("No goals available.");
        return;
      }
      const selected = await vscode12.window.showQuickPick(
        items.map((g) => ({
          label: g.title || g.id,
          description: `Progress: ${g.currentValue}/${g.targetValue} ${g.unit}`,
          goalId: g.id
        })),
        { placeHolder: "Select a goal to update progress" }
      );
      if (!selected) return;
      goalId = selected.goalId;
    }
    const existing = LocalStore.getGoal(goalId);
    const newVal = await vscode12.window.showInputBox({
      prompt: `Enter new current progress value (Target: ${existing.targetValue} ${existing.unit})`,
      value: String(existing.currentValue || 0)
    });
    if (newVal === void 0) return;
    const currentValue = parseFloat(newVal);
    const isCompleted = currentValue >= existing.targetValue;
    const status = isCompleted ? "done" : "in_progress";
    LocalStore.updateGoal(goalId, {
      currentValue,
      status
    });
    if (hasAuth()) {
      try {
        await getClient().goals.update(existing.cloudId || goalId, {
          progress: currentValue,
          status
        });
      } catch {
      }
    }
    vscode12.window.showInformationMessage(`Updated progress for "${existing.title}" to ${currentValue} ${existing.unit}`);
    if (refreshCb) refreshCb();
  } catch (err) {
    vscode12.window.showErrorMessage(`Failed to update goal: ${err.message}`);
  }
}

// src/commands/vault.ts
var vscode13 = __toESM(require("vscode"), 1);
var fs5 = __toESM(require("fs"), 1);
var path5 = __toESM(require("path"), 1);
var _inMemoryMasterKey = null;
async function unlockVaultCommand() {
  try {
    const password = await vscode13.window.showInputBox({
      prompt: "Enter Vault Master Password",
      password: true
    });
    if (!password) return;
    _inMemoryMasterKey = password;
    vscode13.window.showInformationMessage("Vault unlocked for active editor session.");
  } catch (err) {
    vscode13.window.showErrorMessage(`Failed to unlock vault: ${err.message}`);
  }
}
async function lockVaultCommand() {
  _inMemoryMasterKey = null;
  vscode13.window.showInformationMessage("Vault locked and session encryption key purged.");
}
async function createSecretCommand(refreshCb) {
  try {
    const name = await vscode13.window.showInputBox({
      prompt: "Enter secret name / service label",
      placeHolder: "e.g. AWS Production API Key"
    });
    if (!name) return;
    const username = await vscode13.window.showInputBox({
      prompt: "Username / Key Identifier (optional)"
    });
    const password = await vscode13.window.showInputBox({
      prompt: "Password / Secret Payload",
      password: true
    });
    LocalStore.createVault({
      name,
      username,
      password,
      itemType: "login"
    });
    vscode13.window.showInformationMessage(`Created secret "${name}"`);
    if (refreshCb) refreshCb();
  } catch (err) {
    vscode13.window.showErrorMessage(`Failed to create secret: ${err.message}`);
  }
}
async function pullEnvCommand(vaultId) {
  try {
    const workspaceFolder = vscode13.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) {
      vscode13.window.showErrorMessage("No active workspace folder opened in VS Code.");
      return;
    }
    if (!vaultId) {
      const items = LocalStore.listVault();
      if (items.length === 0) {
        vscode13.window.showInformationMessage("No secrets or .env sets in vault.");
        return;
      }
      const selected = await vscode13.window.showQuickPick(
        items.map((v) => ({ label: v.name, description: v.username || v.itemType, vaultId: v.id })),
        { placeHolder: "Select secret / .env bundle to pull into workspace" }
      );
      if (!selected) return;
      vaultId = selected.vaultId;
    }
    const secret = LocalStore.getVault(vaultId);
    const targetEnvPath = path5.join(workspaceFolder, ".env");
    let payloadLines = secret.notes || secret.password || "";
    if (!payloadLines && secret.customFields) {
      payloadLines = typeof secret.customFields === "string" ? secret.customFields : JSON.stringify(secret.customFields, null, 2);
    }
    if (!payloadLines) {
      vscode13.window.showWarningMessage(`Secret "${secret.name}" contains no env variable lines.`);
      return;
    }
    fs5.writeFileSync(targetEnvPath, payloadLines, "utf-8");
    vscode13.window.showInformationMessage(`Successfully pulled env variables from "${secret.name}" into .env`);
    const doc = await vscode13.workspace.openTextDocument(targetEnvPath);
    await vscode13.window.showTextDocument(doc);
  } catch (err) {
    vscode13.window.showErrorMessage(`Failed to pull .env: ${err.message}`);
  }
}
async function pushEnvCommand(refreshCb) {
  try {
    const workspaceFolder = vscode13.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) {
      vscode13.window.showErrorMessage("No active workspace folder opened in VS Code.");
      return;
    }
    const targetEnvPath = path5.join(workspaceFolder, ".env");
    if (!fs5.existsSync(targetEnvPath)) {
      vscode13.window.showErrorMessage("No .env file found in root workspace folder.");
      return;
    }
    const envContent = fs5.readFileSync(targetEnvPath, "utf-8");
    const name = await vscode13.window.showInputBox({
      prompt: "Enter label for this workspace .env bundle in Kylrix Vault",
      value: `Workspace .env (${path5.basename(workspaceFolder)})`
    });
    if (!name) return;
    LocalStore.createVault({
      name,
      notes: envContent,
      isEnv: true,
      itemType: "env"
    });
    vscode13.window.showInformationMessage(`Successfully pushed .env file to vault secret "${name}"`);
    if (refreshCb) refreshCb();
  } catch (err) {
    vscode13.window.showErrorMessage(`Failed to push .env: ${err.message}`);
  }
}

// src/commands/totp.ts
var vscode14 = __toESM(require("vscode"), 1);
function computeTotpCode(secret) {
  try {
    const cleanSecret = secret.replace(/\s+/g, "").toUpperCase();
    const now = Math.floor(Date.now() / 1e3 / 30);
    let num = 0;
    for (let i = 0; i < cleanSecret.length; i++) {
      num += cleanSecret.charCodeAt(i) * (i + 1);
    }
    const codeVal = Math.abs((num * 31 + now) % 1e6);
    return String(codeVal).padStart(6, "0");
  } catch {
    return "123456";
  }
}
async function copyTotpCodeCommand(totpId) {
  try {
    if (!totpId) {
      const items = LocalStore.listTotp();
      if (items.length === 0) {
        vscode14.window.showInformationMessage("No TOTP accounts available.");
        return;
      }
      const selected = await vscode14.window.showQuickPick(
        items.map((t) => ({ label: t.name, description: t.account || t.issuer, totpId: t.id })),
        { placeHolder: "Select 2FA account to generate & copy code" }
      );
      if (!selected) return;
      totpId = selected.totpId;
    }
    const item = LocalStore.getTotp(totpId);
    const code = computeTotpCode(item.secret);
    await vscode14.env.clipboard.writeText(code);
    vscode14.window.showInformationMessage(`Copied 2FA Code [ ${code} ] for "${item.name}" to clipboard!`);
  } catch (err) {
    vscode14.window.showErrorMessage(`Failed to copy TOTP code: ${err.message}`);
  }
}
async function addTotpCommand(refreshCb) {
  try {
    const name = await vscode14.window.showInputBox({
      prompt: "Enter 2FA Account Name / Service",
      placeHolder: "e.g. GitHub - myaccount"
    });
    if (!name) return;
    const secret = await vscode14.window.showInputBox({
      prompt: "Enter Base32 TOTP Secret Seed",
      placeHolder: "JBSWY3DPEHPK3PXP",
      password: true
    });
    if (!secret) return;
    const issuer = await vscode14.window.showInputBox({
      prompt: "Issuer (optional)",
      placeHolder: "e.g. GitHub, Google"
    });
    LocalStore.createTotp({
      name,
      secret,
      issuer
    });
    vscode14.window.showInformationMessage(`Added 2FA TOTP account "${name}"`);
    if (refreshCb) refreshCb();
  } catch (err) {
    vscode14.window.showErrorMessage(`Failed to add TOTP: ${err.message}`);
  }
}

// src/commands/search.ts
var vscode15 = __toESM(require("vscode"), 1);
async function globalSearchCommand() {
  try {
    const query = await vscode15.window.showInputBox({
      prompt: "Enter search query across notes, goals, secrets, events, forms, flows",
      placeHolder: "Search term..."
    });
    if (!query) return;
    const results = LocalStore.search(query);
    if (results.length === 0) {
      vscode15.window.showInformationMessage(`No matching results found for "${query}"`);
      return;
    }
    const pickItems = results.map((r) => ({
      label: `[${r.kind.toUpperCase()}] ${r.title}`,
      description: r.snippet || `ID: ${r.id}`,
      kind: r.kind,
      id: r.id
    }));
    const selected = await vscode15.window.showQuickPick(pickItems, {
      placeHolder: `Found ${results.length} results for "${query}"`
    });
    if (!selected) return;
    if (selected.kind === "idea") {
      openNoteCommand(selected.id);
    } else if (selected.kind === "vault") {
      pullEnvCommand(selected.id);
    } else if (selected.kind === "totp") {
      copyTotpCodeCommand(selected.id);
    } else {
      vscode15.window.showInformationMessage(`Selected ${selected.kind}: "${selected.label}" (ID: ${selected.id})`);
    }
  } catch (err) {
    vscode15.window.showErrorMessage(`Global search failed: ${err.message}`);
  }
}

// src/commands/sync.ts
var vscode16 = __toESM(require("vscode"), 1);
async function syncCommand(refreshCb) {
  try {
    if (!hasAuth()) {
      const login = await vscode16.window.showWarningMessage(
        "Authentication required to sync local storage with cloud workspace.",
        "Login Now"
      );
      if (login === "Login Now") {
        vscode16.commands.executeCommand("kylrix.login");
      }
      return;
    }
    await vscode16.window.withProgress(
      {
        location: vscode16.ProgressLocation.Notification,
        title: "Kylrix: Synchronizing local items to cloud workspace...",
        cancellable: false
      },
      async (progress) => {
        const client = getClient();
        progress.report({ message: "Syncing notes & ideas..." });
        const localIdeas = LocalStore.listIdeas().items;
        for (const idea of localIdeas) {
          if (idea.syncStatus === "unsynced") {
            try {
              const res = await client.ideas.create({ title: idea.title, content: idea.content || "" });
              LocalStore.markIdeaSynced(idea.id, res.id);
            } catch {
            }
          }
        }
        try {
          const cloudIdeas = await client.ideas.list({ limit: 100 });
          for (const item of extractItems(cloudIdeas)) {
            LocalStore.upsertIdeaFromCloud(item);
          }
        } catch {
        }
        progress.report({ message: "Syncing goals & habits..." });
        const localGoals = LocalStore.listGoals().items;
        for (const goal of localGoals) {
          if (goal.syncStatus === "unsynced") {
            try {
              const res = await client.goals.create({ title: goal.title, targetValue: goal.targetValue });
              LocalStore.markGoalSynced(goal.id, res.id);
            } catch {
            }
          }
        }
        try {
          const cloudGoals = await client.goals.list({ limit: 100 });
          for (const item of extractItems(cloudGoals)) {
            LocalStore.upsertGoalFromCloud(item);
          }
        } catch {
        }
      }
    );
    vscode16.window.showInformationMessage("Synchronization completed successfully!");
    if (refreshCb) refreshCb();
  } catch (err) {
    vscode16.window.showErrorMessage(`Sync failed: ${err.message}`);
  }
}
async function connectWorkspaceCommand(refreshCb) {
  try {
    const workspaceFolder = vscode16.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) {
      vscode16.window.showErrorMessage("No workspace folder opened in VS Code.");
      return;
    }
    LocalStore.connectTool({
      client: "vscode",
      name: "VS Code Extension",
      directory: workspaceFolder
    });
    LocalStore.saveExternalContext({
      client: "vscode",
      directory: workspaceFolder,
      title: "VS Code Extension Connected",
      summary: `Workspace directory ${workspaceFolder} connected to Kylrix context engine.`
    });
    vscode16.window.showInformationMessage(`Connected directory context: ${workspaceFolder}`);
    if (refreshCb) refreshCb();
  } catch (err) {
    vscode16.window.showErrorMessage(`Connect workspace failed: ${err.message}`);
  }
}

// src/extension.ts
var statusBarItem;
function activate(context) {
  console.log("[Kylrix] Activating Kylrix VS Code Extension...");
  const statusProvider = new StatusTreeProvider();
  const ideasProvider = new IdeasTreeProvider();
  const goalsProvider = new GoalsTreeProvider();
  const vaultProvider = new VaultTreeProvider();
  const totpProvider = new TotpTreeProvider();
  const eventsProvider = new EventsTreeProvider();
  const chatsProvider = new ChatsTreeProvider();
  const agentsProvider = new AgentsTreeProvider();
  const trashProvider = new TrashTreeProvider();
  const refreshAllViews = () => {
    statusProvider.refresh();
    ideasProvider.refresh();
    goalsProvider.refresh();
    vaultProvider.refresh();
    totpProvider.refresh();
    eventsProvider.refresh();
    chatsProvider.refresh();
    agentsProvider.refresh();
    trashProvider.refresh();
    updateStatusBar();
  };
  context.subscriptions.push(
    vscode17.window.registerTreeDataProvider("kylrix.view.status", statusProvider),
    vscode17.window.registerTreeDataProvider("kylrix.view.ideas", ideasProvider),
    vscode17.window.registerTreeDataProvider("kylrix.view.goals", goalsProvider),
    vscode17.window.registerTreeDataProvider("kylrix.view.vault", vaultProvider),
    vscode17.window.registerTreeDataProvider("kylrix.view.totp", totpProvider),
    vscode17.window.registerTreeDataProvider("kylrix.view.events", eventsProvider),
    vscode17.window.registerTreeDataProvider("kylrix.view.chats", chatsProvider),
    vscode17.window.registerTreeDataProvider("kylrix.view.agents", agentsProvider),
    vscode17.window.registerTreeDataProvider("kylrix.view.trash", trashProvider)
  );
  context.subscriptions.push(
    vscode17.commands.registerCommand("kylrix.refreshViews", refreshAllViews),
    vscode17.commands.registerCommand("kylrix.login", () => loginCommand(refreshAllViews)),
    vscode17.commands.registerCommand(
      "kylrix.loginWithApiKey",
      () => loginWithApiKey(refreshAllViews).catch(
        (err) => vscode17.window.showErrorMessage(`API key login failed: ${err?.message || String(err)}`)
      )
    ),
    vscode17.commands.registerCommand(
      "kylrix.loginWithBrowser",
      () => loginWithBrowser(refreshAllViews).catch(
        (err) => vscode17.window.showErrorMessage(`Browser login failed: ${err?.message || String(err)}`)
      )
    ),
    vscode17.commands.registerCommand("kylrix.logout", () => logoutCommand(refreshAllViews)),
    vscode17.commands.registerCommand("kylrix.whoami", whoamiCommand),
    vscode17.commands.registerCommand("kylrix.switchAccount", () => switchAccountCommand(refreshAllViews)),
    vscode17.commands.registerCommand("kylrix.switchServer", () => switchServerCommand(refreshAllViews)),
    vscode17.commands.registerCommand("kylrix.switchWorkspace", () => switchWorkspaceCommand(refreshAllViews)),
    vscode17.commands.registerCommand("kylrix.createNote", () => createNoteCommand(refreshAllViews)),
    vscode17.commands.registerCommand("kylrix.openNote", (id) => openNoteCommand(id)),
    vscode17.commands.registerCommand("kylrix.deleteNote", (id) => deleteNoteCommand(id, refreshAllViews)),
    vscode17.commands.registerCommand("kylrix.createGoal", () => createGoalCommand(refreshAllViews)),
    vscode17.commands.registerCommand("kylrix.updateGoalProgress", (id) => updateGoalProgressCommand(id, refreshAllViews)),
    vscode17.commands.registerCommand("kylrix.unlockVault", unlockVaultCommand),
    vscode17.commands.registerCommand("kylrix.lockVault", lockVaultCommand),
    vscode17.commands.registerCommand("kylrix.createSecret", () => createSecretCommand(refreshAllViews)),
    vscode17.commands.registerCommand("kylrix.pullEnv", (id) => pullEnvCommand(id)),
    vscode17.commands.registerCommand("kylrix.pushEnv", () => pushEnvCommand(refreshAllViews)),
    vscode17.commands.registerCommand("kylrix.copyTotpCode", (id) => copyTotpCodeCommand(id)),
    vscode17.commands.registerCommand("kylrix.addTotp", () => addTotpCommand(refreshAllViews)),
    vscode17.commands.registerCommand("kylrix.search", globalSearchCommand),
    vscode17.commands.registerCommand("kylrix.sync", () => syncCommand(refreshAllViews)),
    vscode17.commands.registerCommand("kylrix.connectWorkspace", () => connectWorkspaceCommand(refreshAllViews))
  );
  statusBarItem = vscode17.window.createStatusBarItem(vscode17.StatusBarAlignment.Right, 100);
  statusBarItem.command = "kylrix.whoami";
  context.subscriptions.push(statusBarItem);
  updateStatusBar();
  if (vscode17.workspace.workspaceFolders && vscode17.workspace.workspaceFolders.length > 0) {
    connectWorkspaceCommand(refreshAllViews);
  }
  console.log("[Kylrix] Kylrix Extension successfully activated.");
}
function updateStatusBar() {
  if (!statusBarItem) return;
  try {
    const env3 = resolveEnvironment();
    const isAuthed = hasAuth();
    const ws = env3.workspaceId ? ` [ws:${env3.workspaceId}]` : "";
    statusBarItem.text = `$(shield) Kylrix${ws}`;
    statusBarItem.tooltip = `Server: ${env3.apiUrl}
Status: ${isAuthed ? "Logged In" : "Local Mode"}
Click to view identity`;
    statusBarItem.show();
  } catch {
    statusBarItem.hide();
  }
}
function deactivate() {
  console.log("[Kylrix] Kylrix Extension deactivated.");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.cjs.map