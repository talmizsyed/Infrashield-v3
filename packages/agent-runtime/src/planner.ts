import type { AgentPlan, AgentTask } from './types';

export class AgentPlanner {
  public plan(goal: string): AgentPlan {
    const assess: AgentTask = {
      id: 'assess',
      title: `Assess ${goal}`,
      dependencies: [],
      subtasks: [],
    };
    const execute: AgentTask = {
      id: 'execute',
      title: `Execute ${goal}`,
      dependencies: [assess.id],
      subtasks: [],
    };
    return {
      goal,
      tasks: [assess, execute],
      executionGraph: [
        { taskId: assess.id, dependsOn: assess.dependencies },
        { taskId: execute.id, dependsOn: execute.dependencies },
      ],
    };
  }
}
