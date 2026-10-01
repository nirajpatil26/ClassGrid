import React from 'react';
import { CalendarDays, MapPin, CheckSquare, BookOpen } from 'lucide-react';

export type ActiveTab = 'today' | 'rooms' | 'attendance' | 'notes';

interface BottomNavProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  pendingNotesCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  pendingNotesCount = 0,
}) => {
  const tabs = [
    {
      id: 'today' as ActiveTab,
      label: 'Schedule',
      icon: CalendarDays,
    },
    {
      id: 'rooms' as ActiveTab,
      label: 'Classrooms',
      icon: MapPin,
    },
    {
      id: 'attendance' as ActiveTab,
      label: 'Attendance',
      icon: CheckSquare,
    },
    {
      id: 'notes' as ActiveTab,
      label: 'Notes Log',
      icon: BookOpen,
      badge: pendingNotesCount > 0 ? pendingNotesCount : undefined,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#08070d]/95 backdrop-blur-lg border-t border-fuchsia-950/80 pb-[env(safe-area-inset-bottom)] sm:hidden shadow-[0_-4px_20px_rgba(217,70,239,0.06)]">
      <div className="grid grid-cols-4 max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`flex flex-col items-center justify-center py-2.5 px-1 transition-all relative ${
                isActive
                  ? 'text-fuchsia-300 font-semibold'
                  : 'text-slate-400 hover:text-fuchsia-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'text-fuchsia-400 scale-110' : 'text-slate-400'}`} />
                {tab.badge && (
                  <span className="absolute -top-1 -right-2 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-[0_0_8px_rgba(217,70,239,0.6)]">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-1 tracking-tight">{tab.label}</span>
              {isActive && (
                <div className="absolute top-0 w-8 h-0.5 bg-gradient-to-r from-fuchsia-500 to-pink-500 shadow-[0_0_8px_rgba(217,70,239,0.9)] rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
