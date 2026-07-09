// ============================================================
// Yene QR — Agent Registry
// Factory for creating AI agent instances
// ============================================================

import type { AgentType } from '../types';
import { BaseAgent } from './base-agent';
import { OwnerAgent } from './owner-agent';
import { KitchenAgent } from './kitchen-agent';
import { WaiterAgent } from './waiter-agent';
import { CustomerAgent } from './customer-agent';

const agentRegistry: Record<AgentType, () => BaseAgent> = {
  owner: () => new OwnerAgent(),
  kitchen: () => new KitchenAgent(),
  waiter: () => new WaiterAgent(),
  customer: () => new CustomerAgent(),
};

export function getAgent(agentType: AgentType): BaseAgent {
  const factory = agentRegistry[agentType];
  if (!factory) {
    throw new Error(`Unknown agent type: ${agentType}`);
  }
  return factory();
}

export { BaseAgent, OwnerAgent, KitchenAgent, WaiterAgent, CustomerAgent };
