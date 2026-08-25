import { useTheme } from '../theme/ThemeContext';
import type { Tab } from '../data/types';
import { TAB_ORDER, TabIcon } from './TabIcons';

interface TabBarProps {
  active: Tab;
  onSelect: (tab: Tab) => void;
}

export function TabBar({ active, onSelect }: TabBarProps) {
  const theme = useTheme();
  return (
    <div
      className="tab-bar"
      style={{ background: theme.surface, borderTop: `1px solid ${theme.border}` }}
    >
      {TAB_ORDER.map((t) => {
        const isActive = active === t.key;
        const color = isActive ? '#041E42' : theme.mutedLight;
        return (
          <div key={t.key} className="tab-bar-item" onClick={() => onSelect(t.key)} style={{ color }}>
            <TabIcon tab={t.key} color={color} weight={isActive ? '2.1' : '1.8'} />
            <span style={{ fontSize: 10.5, fontWeight: isActive ? 700 : 500 }}>{t.label}</span>
          </div>
        );
      })}
    </div>
  );
}
