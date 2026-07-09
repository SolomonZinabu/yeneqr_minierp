'use client';

// ============================================================
// Yene QR — AI Suggestion Card Component
// Displays proactive AI suggestions with accept/dismiss actions
// ============================================================

import React, { useState } from 'react';
import { Check, X, Sparkles, AlertTriangle, TrendingUp, Package, Users } from 'lucide-react';
import { api } from '@/lib/api-client';

interface AISuggestionCardProps {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  agentType: string;
  actionType?: string;
  onAccept?: (id: string) => void;
  onDismiss?: (id: string) => void;
  className?: string;
}

const categoryIcons: Record<string, React.ReactNode> = {
  menu_optimization: <Sparkles className="w-4 h-4" />,
  demand_forecast: <TrendingUp className="w-4 h-4" />,
  inventory_alert: <Package className="w-4 h-4" />,
  prep_priority: <AlertTriangle className="w-4 h-4" />,
  upsell_opportunity: <TrendingUp className="w-4 h-4" />,
  customer_sentiment: <Users className="w-4 h-4" />,
};

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

export function AISuggestionCard({
  id,
  title,
  description,
  category,
  priority,
  agentType,
  actionType,
  onAccept,
  onDismiss,
  className = '',
}: AISuggestionCardProps) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await api.patch('/api/ai/suggestions', { suggestionId: id, action: 'accept' });
      onAccept?.(id);
    } catch (error) {
      console.error('Failed to accept suggestion:', error);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDismiss = async () => {
    setIsDismissing(true);
    try {
      await api.patch('/api/ai/suggestions', { suggestionId: id, action: 'dismiss', dismissedReason: 'User dismissed' });
      onDismiss?.(id);
    } catch (error) {
      console.error('Failed to dismiss suggestion:', error);
    } finally {
      setIsDismissing(false);
    }
  };

  return (
    <div className={`bg-white rounded-xl border p-4 hover:shadow-md transition-shadow ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
            {categoryIcons[category] || <Sparkles className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-sm text-gray-900 truncate">{title}</h4>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${priorityColors[priority]}`}>
                {priority}
              </span>
            </div>
            <p className="text-xs text-gray-600 line-clamp-2">{description}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-gray-400 capitalize">{category.replace(/_/g, ' ')}</span>
              {actionType && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-600">
                  {actionType.replace(/_/g, ' ')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleAccept}
            disabled={isAccepting || isDismissing}
            className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-50 transition-colors"
            title="Accept suggestion"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={handleDismiss}
            disabled={isAccepting || isDismissing}
            className="p-1.5 rounded-lg bg-gray-50 text-gray-400 hover:bg-gray-100 disabled:opacity-50 transition-colors"
            title="Dismiss suggestion"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface AISuggestionListProps {
  restaurantId: string;
  agentType?: string;
  className?: string;
}

export function AISuggestionList({ restaurantId, agentType, className = '' }: AISuggestionListProps) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const params: Record<string, string> = { restaurantId, status: 'pending', limit: '5' };
        if (agentType) params.agentType = agentType;

        const data = await api.get<{ suggestions: any[] }>('/api/ai/suggestions', params);
        setSuggestions(data.suggestions || []);
      } catch (error) {
        console.error('Failed to load suggestions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestions();
    const interval = setInterval(fetchSuggestions, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [restaurantId, agentType]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="text-center py-6 text-gray-400">
        <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No active suggestions</p>
        <p className="text-xs">AI suggestions will appear here based on your restaurant data</p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {suggestions.map(s => (
        <AISuggestionCard
          key={s.id}
          id={s.id}
          title={s.title}
          description={s.description}
          category={s.category}
          priority={s.priority}
          agentType={s.agentType}
          actionType={s.actionType}
          onAccept={(id) => setSuggestions(prev => prev.filter(s => s.id !== id))}
          onDismiss={(id) => setSuggestions(prev => prev.filter(s => s.id !== id))}
        />
      ))}
    </div>
  );
}
