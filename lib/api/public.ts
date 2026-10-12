import { KYLRIX_API_V1_BASE } from '@/sdk/api';

/** Shared public install / docs constants for Developers + docs pages */

/** Core bundle: MCP + REST + autonomous agents (personal and agentic work). */
export const KYLRIX_SKILLS_INSTALL =
  'npx skills add kylrix/kylrix --skill mcp --skill api --skill agents';

/** All published skills in this repo (includes oauth2). */
export const KYLRIX_SKILLS_INSTALL_ALL =
  "npx skills add kylrix/kylrix --skill '*' -y";

export const KYLRIX_MCP_SKILL_INSTALL = 'npx skills add kylrix/kylrix --skill mcp';
export const KYLRIX_API_SKILL_INSTALL = 'npx skills add kylrix/kylrix --skill api';
export const KYLRIX_AGENTS_SKILL_INSTALL = 'npx skills add kylrix/kylrix --skill agents';
export const KYLRIX_OAUTH2_SKILL_INSTALL = 'npx skills add kylrix/kylrix --skill oauth2';
export const KYLRIX_SELFHOST_SKILL_INSTALL = 'npx skills add kylrix/kylrix --skill selfhost';

export const KYLRIX_API_BASE_PROD = `https://www.kylrix.space${KYLRIX_API_V1_BASE}`;
export const KYLRIX_DOCS_API = 'https://github.com/Kylrix/kylrix/blob/master/docs/api.md';
export const KYLRIX_DOCS_OAUTH2 = 'https://github.com/Kylrix/kylrix/blob/master/docs/oauth2.md';
export const KYLRIX_DOCS_AGENTS = 'https://github.com/Kylrix/kylrix/blob/master/docs/agents.md';
export const KYLRIX_DOCS_MCP = 'https://github.com/Kylrix/kylrix/blob/master/docs/mcp.md';


