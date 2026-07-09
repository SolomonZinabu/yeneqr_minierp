'use client';

// ============================================================
// Yene QR — AI Chat Widget Component
// Reusable chat interface for all AI agents
// ============================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, X, Minimize2, Maximize2, Loader2, Sparkles, Trash2 } from 'lucide-react';
import type { AgentType } from '@/lib/ai/types';
import { AGENT_INFO } from '@/lib/ai/types';
import { api } from '@/lib/api-client';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

interface Conversation {
  id: string;
  title: string | null;
  agentType: string;
  messageCount: number;
  lastMessageAt: string;
}

interface AIChatWidgetProps {
  agentType: AgentType;
  restaurantId: string;
  branchId?: string;
  sessionId?: string;
  language?: string;
  className?: string;
  /** If true, renders as a full panel (not floating widget) */
  isPanel?: boolean;
  /** If true, the widget starts open */
  defaultOpen?: boolean;
}

export function AIChatWidget({
  agentType,
  restaurantId,
  branchId,
  sessionId,
  language = 'en',
  className = '',
  isPanel = false,
  defaultOpen = false,
}: AIChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const info = AGENT_INFO[agentType];

  // Initialize with greeting
  useEffect(() => {
    if (messages.length === 0 && isOpen) {
      setMessages([{
        id: 'greeting',
        role: 'assistant',
        content: info.greeting,
        timestamp: new Date(),
      }]);
    }
  }, [isOpen, agentType]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load conversation history
  const loadHistory = useCallback(async () => {
    try {
      const params: Record<string, string> = {
        restaurantId,
        agentType,
        limit: '10',
      };
      if (sessionId) params.sessionId = sessionId;

      const data = await api.get<{ conversations: Conversation[] }>('/api/ai/conversations', params);
      setConversations(data.conversations || []);
    } catch (error) {
      console.error('Failed to load conversation history:', error);
    }
  }, [restaurantId, agentType, sessionId]);

  // Load a previous conversation
  const loadConversation = useCallback(async (convId: string) => {
    try {
      const data = await api.get<{ conversations: any[] }>('/api/ai/conversations', { conversationId: convId });

      setConversationId(convId);
      setShowHistory(false);

      // For now, start fresh with the conversation ID — 
      // the backend will use the conversation context
      setMessages([{
        id: 'system',
        role: 'system',
        content: 'Previous conversation loaded. Continue chatting below.',
        timestamp: new Date(),
      }]);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  }, []);

  // Send a message
  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Add loading indicator
    const loadingId = `loading-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: loadingId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    }]);

    try {
      const allMessages = messages
        .filter(m => m.role !== 'system' && !m.isLoading)
        .map(m => ({ role: m.role, content: m.content }));
      allMessages.push({ role: 'user', content: userMessage.content });

      const data = await api.post<{ conversationId: string; response: string; toolResults: any[]; usage?: any }>('/api/ai/chat', {
        messages: allMessages,
        agentType,
        restaurantId,
        branchId,
        conversationId,
        sessionId,
        language,
      });

      // Update conversation ID
      if (data.conversationId) {
        setConversationId(data.conversationId);
      }

      // Replace loading with actual response
      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, id: `assistant-${Date.now()}`, content: data.response, isLoading: false }
          : m
      ));
    } catch (error: any) {
      // Replace loading with error
      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, id: `error-${Date.now()}`, content: `Sorry, I encountered an error: ${error.message}. Please try again.`, isLoading: false }
          : m
      ));
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, isLoading, messages, agentType, restaurantId, branchId, conversationId, sessionId, language]);

  // Handle keyboard
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Quick action suggestions based on agent type
  const quickActions: Record<AgentType, string[]> = {
    owner: [
      'Show me today\'s sales',
      'What are my best selling items?',
      'Any low stock alerts?',
      'Suggest a promotion',
    ],
    kitchen: [
      'What should I cook next?',
      'Any batch cooking opportunities?',
      'Show order queue',
      'Any allergen warnings?',
    ],
    waiter: [
      'Which tables need attention?',
      'What orders are ready to serve?',
      'Suggest an upsell for table 3',
      'Any pending waiter calls?',
    ],
    customer: [
      'What do you recommend?',
      'I\'m vegetarian, what can I eat?',
      'Tell me about Doro Wot',
      'Any current deals?',
    ],
  };

  // Render message content with basic markdown support
  const renderContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      // Bold text
      let processed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Bullet points
      if (processed.startsWith('- ') || processed.startsWith('• ')) {
        processed = `<span class="ml-2">• ${processed.slice(2)}</span>`;
      }
      // Headers
      if (processed.startsWith('## ')) {
        return <h3 key={i} className="font-semibold text-sm mt-2 mb-1" dangerouslySetInnerHTML={{ __html: processed.slice(3) }} />;
      }
      if (processed.startsWith('# ')) {
        return <h2 key={i} className="font-bold text-base mt-2 mb-1" dangerouslySetInnerHTML={{ __html: processed.slice(2) }} />;
      }
      return <p key={i} className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: processed }} />;
    });
  };

  // PANEL MODE — full width inline panel
  if (isPanel) {
    return (
      <div className={`flex flex-col h-full bg-white border rounded-xl overflow-hidden ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ backgroundColor: info.color + '15' }}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{info.icon}</span>
            <div>
              <h3 className="font-semibold text-sm" style={{ color: info.color }}>{info.name}</h3>
              <p className="text-xs text-gray-500">{info.description.slice(0, 60)}...</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setMessages([{
                id: 'greeting',
                role: 'assistant',
                content: info.greeting,
                timestamp: new Date(),
              }]); setConversationId(null); }}
              className="p-1.5 rounded-lg hover:bg-white/60 text-gray-500"
              title="New conversation"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs" style={{ backgroundColor: info.color }}>
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
                msg.role === 'user'
                  ? 'bg-gray-900 text-white'
                  : msg.role === 'system'
                  ? 'bg-blue-50 text-blue-700 text-xs'
                  : 'bg-gray-100 text-gray-900'
              }`}>
                {msg.isLoading ? (
                  <div className="flex items-center gap-2 py-1">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    <span className="text-sm text-gray-400">Thinking...</span>
                  </div>
                ) : (
                  <div>{renderContent(msg.content)}</div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center">
                  <User className="w-4 h-4 text-gray-600" />
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions */}
        {messages.length <= 2 && !isLoading && (
          <div className="px-4 pb-2">
            <div className="flex flex-wrap gap-1.5">
              {quickActions[agentType].map((action, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(action); }}
                  className="text-xs px-2.5 py-1 rounded-full border hover:bg-gray-50 transition-colors"
                  style={{ borderColor: info.color + '40', color: info.color }}
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t p-3">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask ${info.name}...`}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0"
              style={{ focusRingColor: info.color }}
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="p-2 rounded-lg text-white disabled:opacity-40 transition-colors"
              style={{ backgroundColor: info.color }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // FLOATING WIDGET MODE
  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white z-50 hover:scale-105 transition-transform"
          style={{ backgroundColor: info.color }}
          title={info.name}
        >
          <Sparkles className="w-6 h-6" />
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className={`fixed bottom-6 right-6 z-50 flex flex-col bg-white rounded-2xl shadow-2xl border overflow-hidden transition-all ${
          isMinimized ? 'w-80 h-14' : 'w-96 h-[600px]'
        }`}>
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 cursor-pointer"
            style={{ backgroundColor: info.color + '15' }}
            onClick={() => isMinimized && setIsMinimized(false)}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{info.icon}</span>
              <div>
                <h3 className="font-semibold text-sm" style={{ color: info.color }}>{info.name}</h3>
                {!isMinimized && <p className="text-[10px] text-gray-500">{info.description.slice(0, 50)}...</p>}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1 rounded hover:bg-white/60 text-gray-400"
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded hover:bg-white/60 text-gray-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Body (hidden when minimized) */}
          {!isMinimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ maxHeight: '440px' }}>
                {messages.map(msg => (
                  <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px]" style={{ backgroundColor: info.color }}>
                        <Bot className="w-3 h-3" />
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
                      msg.role === 'user'
                        ? 'bg-gray-900 text-white text-sm'
                        : msg.role === 'system'
                        ? 'bg-blue-50 text-blue-700 text-xs'
                        : 'bg-gray-100 text-gray-900 text-sm'
                    }`}>
                      {msg.isLoading ? (
                        <div className="flex items-center gap-2 py-0.5">
                          <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                          <span className="text-xs text-gray-400">Thinking...</span>
                        </div>
                      ) : (
                        <div>{renderContent(msg.content)}</div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Actions */}
              {messages.length <= 2 && !isLoading && (
                <div className="px-3 pb-2">
                  <div className="flex flex-wrap gap-1">
                    {quickActions[agentType].slice(0, 3).map((action, i) => (
                      <button
                        key={i}
                        onClick={() => setInput(action)}
                        className="text-[10px] px-2 py-1 rounded-full border hover:bg-gray-50 transition-colors"
                        style={{ borderColor: info.color + '40', color: info.color }}
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="border-t p-2.5">
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Ask ${info.name}...`}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1"
                    style={{ focusRingColor: info.color }}
                    disabled={isLoading}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || isLoading}
                    className="p-1.5 rounded-lg text-white disabled:opacity-40 transition-colors"
                    style={{ backgroundColor: info.color }}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
