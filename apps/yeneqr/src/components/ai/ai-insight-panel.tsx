'use client';

// ============================================================
// Yene QR — AI Insight Panel for Owner Dashboard
// Displays AI-generated business insights, trends, and suggestions
// ============================================================

import React, { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, TrendingDown, DollarSign, Users, Package, Star, ChevronRight, Loader2 } from 'lucide-react';
import { AIChatWidget } from './ai-chat-widget';
import { AISuggestionList } from './ai-suggestion-card';
import { api } from '@/lib/api-client';

interface AIInsightPanelProps {
  restaurantId: string;
  branchId?: string;
  className?: string;
}

interface InsightData {
  metric: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
}

export function AIInsightPanel({ restaurantId, branchId, className = '' }: AIInsightPanelProps) {
  const [insights, setInsights] = useState<InsightData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const data = await api.get<any>(`/api/restaurants/${restaurantId}/analytics`);
        setInsights([
            {
              metric: "Today's Revenue",
              value: `ETB ${data.todayRevenueCents != null ? (data.todayRevenueCents / 100).toFixed(2) : '0.00'}`,
              change: data.revenueChange ? `${data.revenueChange > 0 ? '+' : ''}${data.revenueChange}%` : undefined,
              trend: data.revenueChange > 0 ? 'up' : data.revenueChange < 0 ? 'down' : 'neutral',
              icon: <DollarSign className="w-4 h-4" />,
            },
            {
              metric: 'Orders Today',
              value: String(data.todayOrders || 0),
              change: data.ordersChange ? `${data.ordersChange > 0 ? '+' : ''}${data.ordersChange}%` : undefined,
              trend: data.ordersChange > 0 ? 'up' : data.ordersChange < 0 ? 'down' : 'neutral',
              icon: <Package className="w-4 h-4" />,
            },
            {
              metric: 'Avg Order Value',
              value: `ETB ${data.avgOrderValueCents != null ? (data.avgOrderValueCents / 100).toFixed(2) : '0.00'}`,
              icon: <TrendingUp className="w-4 h-4" />,
            },
            {
              metric: 'Customer Rating',
              value: data.avgRating ? `${data.avgRating}/5` : 'N/A',
              icon: <Star className="w-4 h-4" />,
            },
          ]);
      } catch (error) {
        console.error('Failed to load insights:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, [restaurantId]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h2 className="font-semibold text-sm text-gray-900">AI Insights</h2>
            <p className="text-[10px] text-gray-500">Powered by Yene Business AI</p>
          </div>
        </div>
        <button
          onClick={() => setShowChat(!showChat)}
          className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-1"
        >
          <Sparkles className="w-3 h-3" />
          Ask AI
        </button>
      </div>

      {/* Quick Insights Grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {insights.map((insight, i) => (
            <div key={i} className="bg-white rounded-xl border p-3 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">{insight.metric}</span>
                <span className="text-gray-400">{insight.icon}</span>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-lg font-bold text-gray-900">{insight.value}</span>
                {insight.change && (
                  <span className={`text-[10px] font-medium flex items-center gap-0.5 mb-0.5 ${
                    insight.trend === 'up' ? 'text-green-600' : insight.trend === 'down' ? 'text-red-600' : 'text-gray-500'
                  }`}>
                    {insight.trend === 'up' ? <TrendingUp className="w-3 h-3" /> : insight.trend === 'down' ? <TrendingDown className="w-3 h-3" /> : null}
                    {insight.change}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI Suggestions */}
      <div>
        <h3 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-indigo-500" />
          AI Suggestions
        </h3>
        <AISuggestionList restaurantId={restaurantId} agentType="owner" />
      </div>

      {/* Chat Panel (expandable) */}
      {showChat && (
        <div className="h-[400px]">
          <AIChatWidget
            agentType="owner"
            restaurantId={restaurantId}
            branchId={branchId}
            isPanel={true}
            defaultOpen={true}
          />
        </div>
      )}
    </div>
  );
}
