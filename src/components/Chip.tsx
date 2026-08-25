import { useTheme } from '../theme/ThemeContext';

interface ChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

export function Chip({ label, active, onClick }: ChipProps) {
  const theme = useTheme();
  return (
    <div
      onClick={onClick}
      className="chip"
      style={{
        background: active ? '#041E42' : theme.surface,
        color: active ? '#fff' : theme.text,
        border: `1px solid ${active ? '#041E42' : theme.border}`,
      }}
    >
      {label}
    </div>
  );
}
