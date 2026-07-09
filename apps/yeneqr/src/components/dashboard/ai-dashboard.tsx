'use client';

import React, { useState } from 'react';
import { AIInsightPanel } from '@/components/ai/ai-insight-panel';
import { AIChatWidget } from '@/components/ai/ai-chat-widget';
import { AIConfigPanel } from '@/components/ai/ai-config-panel';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MessageSquare, Settings } from 'lucide-react';

interface AIDashboardProps {
  restaurantId: string;
  branchId?: string;
}

export function AIDashboard({ restaurantId, branchId }: AIDashboardProps) {
  const [activeTab, setActiveTab] = useState('chat');

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span className="text-2xl">🧠</span>
          AI Assistant
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Your intelligent business partner — insights, analytics, and strategic recommendations
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="chat" className="gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-1.5">
            <Settings className="w-3.5 h-3.5" />
            Configuration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <AIChatWidget
                agentType="owner"
                restaurantId={restaurantId}
                branchId={branchId}
                isPanel={true}
                defaultOpen={true}
              />
            </div>
            <div>
              <AIInsightPanel restaurantId={restaurantId} branchId={branchId} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="config">
          <AIConfigPanel restaurantId={restaurantId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
