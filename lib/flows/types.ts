import type { WorkflowChain } from '@/lib/workflow-engine';

export type FlowVerifyKind = 'kylrix' | 'ecosystem' | null;

export type FlowPublisher = {
  handle: string;
  verified: FlowVerifyKind;
};

export type DiscoverFlow = WorkflowChain & {
  publisher: FlowPublisher;
  source: 'builtin' | 'community' | 'yours';
  installed?: boolean;
};

export const KYLRIX_PUBLISHER: FlowPublisher = {
  handle: '@kylrix',
  verified: 'kylrix',
};
