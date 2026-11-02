import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import TaskList from '@/components/tasks/TaskList';
import { Task } from '@/types';

// Mock contexts
const mockTasks: Task[] = [];
let mockFilter = { labels: [] as string[], search: '', status: '' };
const mockDeleteTask = vi.fn(async () => {});
const mockCompleteTask = vi.fn(async (id: string) => {
  const t = mockTasks.find((task) => task.id === id);
  if (t) {
    t.status = t.status === 'done' ? 'pending' : 'done';
  }
});

vi.mock('@/context/TaskContext', () => ({
  useTask: () => ({
    getFilteredTasks: () => mockTasks,
    filter: mockFilter,
    setFilter: (f: any) => { mockFilter = f; },
    deleteTask: mockDeleteTask,
    completeTask: mockCompleteTask,
    projects: [],
    selectedProjectId: null,
    getTagFilterOptions: () => [],
    labels: [
      { name: 'urgent', color: '#EF4444' },
      { name: 'work', color: '#6366F1' },
    ],
    ecosystemTags: [],
    refreshEcosystemTags: vi.fn(),
  }),
}));

vi.mock('@/context/FABContext', () => ({
  useFAB: () => ({
    setConfiguration: vi.fn(),
    resetConfiguration: vi.fn(),
  }),
}));

vi.mock('@/context/UnifiedDrawerContext', () => ({
  useUnifiedDrawer: () => ({
    open: vi.fn(),
    close: vi.fn(),
  }),
}));

vi.mock('@/context/ResourcePinContext', () => ({
  useResourcePins: () => ({
    isPinned: vi.fn(() => false),
  }),
}));

vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    activeWorkspace: { id: 'ws_test', title: 'Test Workspace', isPersonal: false },
  }),
}));

vi.mock('@/context/SelectionContext', () => ({
  useSelection: () => ({
    enterSelectMode: vi.fn(),
    isSelectMode: false,
    isSelected: vi.fn(() => false),
    toggleSelect: vi.fn(),
  }),
}));

vi.mock('@/components/ui/DynamicSidebar', () => ({
  useDynamicSidebar: () => ({
    openSidebar: vi.fn(),
    closeSidebar: vi.fn(),
  }),
}));

vi.mock('@/components/ui/OverlayContext', () => ({
  useOverlay: () => ({
    openOverlay: vi.fn(),
    closeOverlay: vi.fn(),
  }),
}));

vi.mock('@/components/ui/ContextMenuContext', () => ({
  useContextMenu: () => ({
    openMenu: vi.fn(),
  }),
}));

vi.mock('@/context/SudoContext', () => ({
  useSudo: () => ({
    promptSudo: vi.fn(),
  }),
}));

vi.mock('@/context/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'usr_test', name: 'Test User' },
  }),
}));

vi.mock('@/context/ProUpgradeContext', () => ({
  useProUpgrade: () => ({
    openProUpgrade: vi.fn(),
  }),
}));

vi.mock('@/components/objects/ObjectCreateDrawer', () => ({
  ObjectCreateDrawer: () => null,
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Goals & Flow Invariants (goals-invariants.test.tsx)', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    mockTasks.length = 0;
    mockFilter = { labels: [], search: '', status: '' };
    vi.clearAllMocks();
  });

  it('Completed Goals section is ALWAYS rendered, defaults to expanded, and displays both active and completed goals', async () => {
    const activeGoal: Task = {
      id: 'goal_active_1',
      title: 'Build Autonomous AI Pipeline',
      description: 'Ship high-throughput agent flow',
      status: 'pending',
      priority: 'urgent',
      dueDate: new Date(Date.now() + 86400000),
      labels: ['urgent'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: 'usr_test',
    };

    const completedGoal: Task = {
      id: 'goal_done_1',
      title: 'Setup Ota Verification Spec',
      description: 'Decoupled verification pipeline',
      status: 'done',
      priority: 'high',
      dueDate: new Date(Date.now() - 86400000),
      labels: ['work'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: 'usr_test',
    };

    mockTasks.push(activeGoal, completedGoal);

    const root = createRoot(container);
    await act(async () => {
      root.render(<TaskList />);
    });

    // Verify Active Goals section exists
    expect(container.textContent).toContain('Active Goals (1)');
    expect(container.textContent).toContain('Build Autonomous AI Pipeline');

    // Invariant: Completed Goals section header is rendered
    expect(container.textContent).toContain('Completed (1)');

    // Invariant: showCompletedSection defaults to true (expanded)
    expect(container.textContent).toContain('Workspace Integrity');
    expect(container.textContent).toContain('Purge finished goals');
    expect(container.textContent).toContain('Setup Ota Verification Spec');

    // Invariant: Priority/urgency badges and labels are preserved
    expect(container.textContent?.toLowerCase()).toContain('urgent');
    expect(container.textContent?.toLowerCase()).toContain('high');

    root.unmount();
    container.remove();
  });

  it('marking a goal as complete moves it into completed list without removing the section', async () => {
    const goalToComplete: Task = {
      id: 'goal_dynamic_1',
      title: 'Deploy Production Node',
      description: 'Run production rollout',
      status: 'pending',
      priority: 'low',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: 'usr_test',
    };

    mockTasks.push(goalToComplete);

    const root = createRoot(container);
    await act(async () => {
      root.render(<TaskList />);
    });

    expect(container.textContent).toContain('Active Goals (1)');
    expect(container.textContent).toContain('Deploy Production Node');
    expect(container.textContent).not.toContain('Completed (');

    // Mark goal as complete
    await act(async () => {
      await mockCompleteTask('goal_dynamic_1');
      root.render(<TaskList />);
    });

    // Invariant: Goal is moved to completed list and completed section is rendered
    expect(container.textContent).toContain('Completed (1)');
    expect(container.textContent).toContain('Deploy Production Node');
    expect(container.textContent).not.toContain('Active Goals (1)');

    root.unmount();
    container.remove();
  });

  it('renders all urgency levels correctly (urgent, high, medium, low) and due dates', async () => {
    const now = new Date();
    const urgentGoal: Task = {
      id: 'g_urgent',
      title: 'Goal Urgent',
      status: 'pending',
      priority: 'urgent',
      dueDate: now,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      userId: 'usr_test',
    };
    const mediumGoal: Task = {
      id: 'g_medium',
      title: 'Goal Medium',
      status: 'pending',
      priority: 'medium',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      userId: 'usr_test',
    };

    mockTasks.push(urgentGoal, mediumGoal);

    const root = createRoot(container);
    await act(async () => {
      root.render(<TaskList />);
    });

    expect(container.textContent).toContain('Goal Urgent');
    expect(container.textContent).toContain('Goal Medium');
    expect(container.textContent?.toLowerCase()).toContain('urgent');
    expect(container.textContent?.toLowerCase()).toContain('medium');

    root.unmount();
    container.remove();
  });
});
