import { describe, expect, it } from 'vitest';
import {
  AgentBroadcast,
  AgentCapabilityCatalog,
  AgentCapabilityDescriptor,
  AgentChannel,
  AgentCollaborationSession,
  AgentConsensus,
  AgentConversation,
  AgentConversationHistory,
  AgentCoordinator,
  AgentDelegationRequest,
  AgentDirectory,
  AgentDiscoveryService,
  AgentHealthMonitor,
  AgentMailbox,
  AgentMediator,
  AgentMessage,
  AgentNegotiation,
  AgentOrchestrator,
  AgentPresence,
  AgentSharedContext,
  AgentSharedMemoryReference,
  AgentSubscription,
  AgentTask,
  AgentTaskAssignment,
  AgentTaskQueue,
  AgentTaskResult,
  AgentVoting,
  AgentHeartbeat,
} from './index';

describe('collaboration framework', () => {
  it('discovers agents by capability, role, tags, health, availability, and tenant', () => {
    const directory = new AgentDirectory();
    const discovery = new AgentDiscoveryService(directory);

    const catalog = new AgentCapabilityCatalog();
    catalog.register(
      new AgentCapabilityDescriptor({
        id: 'cap-analytics',
        name: 'analytics',
        category: 'intelligence',
        tags: ['beta', 'tenant-a'],
      }),
    );

    directory.register({
      id: 'agent-1',
      name: 'Analyst',
      role: 'analyst',
      version: '1.0.0',
      tenant: 'tenant-a',
      capabilities: ['analytics'],
      tags: ['beta'],
      available: true,
      health: 'healthy',
      trust: 0.9,
    });

    directory.register({
      id: 'agent-2',
      name: 'Worker',
      role: 'worker',
      version: '1.2.0',
      tenant: 'tenant-b',
      capabilities: ['workflow'],
      tags: ['stable'],
      available: false,
      health: 'degraded',
      trust: 0.4,
    });

    const discovered = discovery.discover({
      capability: 'analytics',
      role: 'analyst',
      tags: ['beta'],
      tenant: 'tenant-a',
      available: true,
      health: 'healthy',
      version: '1.0.0',
    });

    expect(discovered).toHaveLength(1);
    expect(discovered[0]?.id).toBe('agent-1');
    expect(catalog.get('cap-analytics')?.name).toBe('analytics');
  });

  it('delegates tasks, handles cancellation, and records results', async () => {
    const coordinator = new AgentCoordinator();
    const queue = new AgentTaskQueue();

    const task = new AgentTask({ id: 'task-1', type: 'workflow', payload: { plan: 'review' } });
    const assignment = new AgentTaskAssignment({ taskId: task.id, agentId: 'agent-1' });

    queue.enqueue(task);
    const queued = queue.peek();
    expect(queued?.id).toBe(task.id);

    const delegated = await coordinator.delegate(
      new AgentDelegationRequest({
        task,
        assignment,
        deadlineMs: 2000,
        retryCount: 1,
      }),
    );

    expect(delegated.succeeded).toBe(true);
    expect(delegated.data?.status).toBe('accepted');

    const cancelled = await coordinator.cancel(task.id);
    expect(cancelled.succeeded).toBe(true);

    const result = new AgentTaskResult({ taskId: task.id, status: 'cancelled' });
    expect(result.status).toBe('cancelled');
  });

  it('supports messaging, subscriptions, and shared context', async () => {
    const mailbox = new AgentMailbox();
    const channel = new AgentChannel('coordination');
    const subscription = new AgentSubscription({ channelId: channel.id, subscriberId: 'agent-1' });
    const broadcast = new AgentBroadcast({ channelId: channel.id, payload: { event: 'ready' } });

    const message = new AgentMessage({
      id: 'msg-1',
      from: 'agent-1',
      to: 'agent-2',
      type: 'request',
      payload: { operation: 'sync' },
    });

    await mailbox.send(message);
    await mailbox.publish(broadcast);
    channel.subscribe(subscription);

    const stored = mailbox.get(message.id);
    expect(stored?.payload.operation).toBe('sync');
    expect(channel.subscriptions).toHaveLength(1);

    const sharedContext = new AgentSharedContext({ id: 'ctx-1', tenant: 'tenant-a' });
    sharedContext.attachReference(
      new AgentSharedMemoryReference({ id: 'mem-1', uri: 'memory://facts/1' }),
    );
    const history = new AgentConversationHistory();
    history.append(new AgentConversation({ role: 'system', content: 'coordinate' }));
    expect(sharedContext.references).toHaveLength(1);
    expect(history.entries).toHaveLength(1);
  });

  it('supports negotiation and consensus with weighted voting', async () => {
    const negotiation = new AgentNegotiation();
    const proposal = await negotiation.propose({
      capability: 'analytics',
      resource: 'cpu',
      priority: 2,
      conflict: 'shared quota',
    });
    expect(proposal.succeeded).toBe(true);

    const consensus = new AgentConsensus();
    const vote = new AgentVoting({ voterId: 'agent-1', value: 1, weight: 2 });
    const result = await consensus.evaluate([
      vote,
      new AgentVoting({ voterId: 'agent-2', value: 1, weight: 1 }),
    ]);
    expect(result.succeeded).toBe(true);
    expect(result.data?.decision).toBe('accept');
  });

  it('tracks presence, heartbeats, and health', async () => {
    const presence = new AgentPresence({ agentId: 'agent-1', status: 'available' });
    const heartbeat = new AgentHeartbeat({
      agentId: 'agent-1',
      timestamp: new Date().toISOString(),
    });
    const monitor = new AgentHealthMonitor();

    monitor.observe(presence, heartbeat);
    const snapshot = monitor.snapshot();

    expect(snapshot['agent-1']?.status).toBe('available');
    expect(snapshot['agent-1']?.lastHeartbeat).toBeDefined();
  });

  it('orchestrates a collaboration session through a mediator', async () => {
    const orchestrator = new AgentOrchestrator();
    const mediator = new AgentMediator(orchestrator);
    const session = new AgentCollaborationSession({ id: 'session-1', tenant: 'tenant-a' });

    const started = await mediator.start(session);
    expect(started.succeeded).toBe(true);

    const completed = await mediator.complete(session.id);
    expect(completed.succeeded).toBe(true);
  });
});
