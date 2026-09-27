'use client';

// ConsoleTabs — shared client tab shell for admin pages mixing server-rendered
// client islands (keeps TabsList overflow hardening from ui/tabs).

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface ConsoleTabDef {
  value: string;
  label: string;
  content: React.ReactNode;
}

export function ConsoleTabs({ tabs }: { tabs: ConsoleTabDef[] }) {
  const [active, setActive] = useState(tabs[0]?.value ?? '');
  return (
    <Tabs value={active} onValueChange={setActive} className="w-full min-w-0">
      <TabsList className="w-fit">
        {tabs.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value} className="mt-4 min-w-0">
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
