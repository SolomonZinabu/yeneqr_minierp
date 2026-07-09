// ============================================================
// Yene QR — Base Agent Class
// Shared logic for all AI agents
// ============================================================

import { aiChat, generateConversationTitle } from '../service';
import { buildRestaurantContext } from '../context/restaurant-context';
import { executeTool } from '../tools';
import type { AgentType, AIMessage, AIToolDefinition, AIToolResult, AgentContext } from '../types';
import { AGENT_INFO } from '../types';
import type { ResolvedAgentConfig } from '../config/agent-config-service';

export abstract class BaseAgent {
  abstract readonly agentType: AgentType;
  abstract readonly systemPromptTemplate: string;
  abstract readonly tools: AIToolDefinition[];

  get info() {
    return AGENT_INFO[this.agentType];
  }

  /**
   * Get the list of tools filtered by config (enabled/disabled lists)
   */
  getFilteredTools(config: ResolvedAgentConfig): AIToolDefinition[] {
    let filtered = this.tools;

    // If enabledTools is set, only include those
    if (config.enabledTools && config.enabledTools.length > 0) {
      const enabledSet = new Set(config.enabledTools);
      filtered = filtered.filter(t => enabledSet.has(t.function.name));
    }

    // Remove explicitly disabled tools
    if (config.disabledTools && config.disabledTools.length > 0) {
      const disabledSet = new Set(config.disabledTools);
      filtered = filtered.filter(t => !disabledSet.has(t.function.name));
    }

    return filtered;
  }

  /**
   * Build the complete system prompt with real-time restaurant context + custom config
   */
  async buildSystemPrompt(context: AgentContext, config: ResolvedAgentConfig): Promise<string> {
    const restaurantContext = await buildRestaurantContext(
      context.restaurantId,
      this.agentType,
      context
    );

    const customInstructionsSection = config.customInstructions
      ? `\n## RESTAURANT-SPECIFIC INSTRUCTIONS:\n${config.customInstructions}\n`
      : '';

    return `${this.systemPromptTemplate}
${customInstructionsSection}
## CURRENT RESTAURANT DATA:
${restaurantContext}

## INSTRUCTIONS:
- Always respond in ${context.language === 'am' ? 'Amharic (አማርኛ)' : 'English'} unless the user writes in another language.
- Be concise but thorough. Use bullet points for lists.
- When referencing specific items, include their names and prices.
- If you're unsure about something, say so rather than guessing.
- For actions that modify data (creating promotions, updating prices, etc.), clearly state what you're going to do and ask for confirmation.
- Use the available tools to get real-time data when needed — don't rely solely on the context above as it may be slightly stale.
${this.getAdditionalInstructions()}
`;
  }

  protected getAdditionalInstructions(): string {
    return '';
  }

  /**
   * Process a chat message through the agent with tool-use loop
   */
  async chat(
    messages: AIMessage[],
    context: AgentContext,
    config: ResolvedAgentConfig,
    onStream?: (chunk: string) => void
  ): Promise<{ response: string; toolResults: AIToolResult[]; usage?: any }> {
    // Check if agent is enabled
    if (!config.isEnabled) {
      return {
        response: 'This AI assistant is currently disabled for your restaurant. Please contact your restaurant administrator to enable it.',
        toolResults: [],
      };
    }

    const systemPrompt = await this.buildSystemPrompt(context, config);
    const filteredTools = this.getFilteredTools(config);
    const toolResults: AIToolResult[] = [];
    let currentMessages = [...messages];
    let iterations = 0;
    const maxIterations = config.maxToolIterations;

    while (iterations < maxIterations) {
      iterations++;

      const result = await aiChat({
        messages: currentMessages,
        systemPrompt,
        tools: filteredTools.length > 0 ? filteredTools : undefined,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      });

      // If there are tool calls, execute them and continue
      if (result.toolCalls && result.toolCalls.length > 0) {
        // Add assistant message with tool calls
        currentMessages.push({
          role: 'assistant',
          content: result.content,
          toolCalls: result.toolCalls.map(tc => ({
            id: tc.id,
            name: tc.name,
            arguments: typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments),
          })),
        });

        // Execute each tool call
        for (const toolCall of result.toolCalls) {
          const toolName = toolCall.name;

          // Check if tool is explicitly disabled by config
          if (config.disabledTools.includes(toolName)) {
            toolResults.push({
              toolCallId: toolCall.id,
              name: toolName,
              result: 'This tool is disabled for your restaurant configuration.',
              error: 'Tool disabled by configuration',
            });
            currentMessages.push({
              role: 'tool',
              content: 'Error: This tool is disabled for your restaurant configuration.',
              toolCallId: toolCall.id,
            });
            continue;
          }

          try {
            const executionResult = await executeTool(
              toolName,
              toolCall.arguments,
              context,
              this.agentType
            );

            const toolResult: AIToolResult = {
              toolCallId: toolCall.id,
              name: toolName,
              result: typeof executionResult.data === 'string'
                ? executionResult.data
                : JSON.stringify(executionResult.data),
              error: executionResult.error,
            };
            toolResults.push(toolResult);

            // Add tool result to conversation
            currentMessages.push({
              role: 'tool',
              content: executionResult.error
                ? `Error: ${executionResult.error}`
                : (typeof executionResult.data === 'string'
                  ? executionResult.data
                  : JSON.stringify(executionResult.data)),
              toolCallId: toolCall.id,
            });
          } catch (error: any) {
            toolResults.push({
              toolCallId: toolCall.id,
              name: toolName,
              result: 'Execution failed',
              error: error.message,
            });
            currentMessages.push({
              role: 'tool',
              content: `Error executing tool: ${error.message}`,
              toolCallId: toolCall.id,
            });
          }
        }
        // Continue the loop to let the AI process tool results
        continue;
      }

      // No tool calls — return the final response
      if (onStream && result.content) {
        onStream(result.content);
      }

      return {
        response: result.content,
        toolResults,
        usage: result.usage,
      };
    }

    return {
      response: 'I reached the maximum number of tool calls. Please try again with a more specific question.',
      toolResults,
    };
  }

  /**
   * Generate a title for a new conversation
   */
  async generateTitle(firstMessage: string): Promise<string> {
    return generateConversationTitle(firstMessage);
  }
}
