import { NextRequest } from 'next/server';
import { withApiGuard, jsonOk, type ApiActor } from '@/lib/api/guard';
import { ApiResources } from '@/lib/api/resources';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Public HTTP API for Personal Access Tokens.
 *
 * Auth: Authorization: Bearer kyl_pat_<id>_<secret>
 *
 * REST CRUD only — tools are internal infrastructure, not an HTTP surface.
 *
 *   GET/POST          /api/v1/notes
 *   GET/PATCH/DELETE  /api/v1/notes/:id
 *   GET/POST          /api/v1/goals
 *   GET/PATCH/DELETE  /api/v1/goals/:id
 *   GET               /api/v1/flows
 *   GET               /api/v1/me
 */
async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  const raw = await req.json().catch(() => ({}));
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

async function dispatch(req: NextRequest, parts: string[], actor: ApiActor) {
  const method = req.method.toUpperCase();
  const [a, b, c] = parts;

  if (method === 'GET' && a === 'me' && !b) {
    return jsonOk(await ApiResources.me(actor));
  }

  // Notes
  if (a === 'notes' && !b) {
    if (method === 'GET') {
      const limit = Number(req.nextUrl.searchParams.get('limit') || 25);
      return jsonOk(await ApiResources.listNotes(actor, limit));
    }
    if (method === 'POST') {
      return jsonOk(await ApiResources.createNote(actor, await readBody(req)));
    }
  }
  if (a === 'notes' && b && !c) {
    if (method === 'GET') return jsonOk(await ApiResources.getNote(actor, b));
    if (method === 'PATCH' || method === 'PUT') {
      return jsonOk(await ApiResources.updateNote(actor, b, await readBody(req)));
    }
    if (method === 'DELETE') return jsonOk(await ApiResources.deleteNote(actor, b));
  }

  // Goals
  if (a === 'goals' && !b) {
    if (method === 'GET') {
      const limit = Number(req.nextUrl.searchParams.get('limit') || 25);
      return jsonOk(await ApiResources.listGoals(actor, limit));
    }
    if (method === 'POST') {
      return jsonOk(await ApiResources.createGoal(actor, await readBody(req)));
    }
  }
  if (a === 'goals' && b && !c) {
    if (method === 'GET') return jsonOk(await ApiResources.getGoal(actor, b));
    if (method === 'PATCH' || method === 'PUT') {
      return jsonOk(await ApiResources.updateGoal(actor, b, await readBody(req)));
    }
    if (method === 'DELETE') return jsonOk(await ApiResources.deleteGoal(actor, b));
  }

  if (method === 'GET' && a === 'flows' && !b) {
    const limit = Number(req.nextUrl.searchParams.get('limit') || 25);
    return jsonOk(await ApiResources.listFlows(actor, limit));
  }

  // Retired dual surface — tools stay in-process only
  if (a === 'tools') {
    const err = new Error(
      'Use REST resource routes (e.g. POST /api/v1/notes). Tool execution is not a public API.'
    );
    (err as any).status = 410;
    (err as any).code = 'gone';
    throw err;
  }

  const err = new Error('Not found');
  (err as any).status = 404;
  (err as any).code = 'not_found';
  throw err;
}

async function handle(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await ctx.params;
  return withApiGuard(req, (actor) => dispatch(req, path, actor));
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
