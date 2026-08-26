interface AvatarProps {
  member: { name: string; initials: string; avatarUrl?: string };
  size: number;
  fontSize?: number;
  color?: string;
}

export function Avatar({ member, size, fontSize, color = '#041E42' }: AvatarProps) {
  if (member.avatarUrl) {
    return (
      <img
        src={member.avatarUrl}
        alt={member.name}
        style={{ width: size, height: size, borderRadius: 999, objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: color,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: fontSize ?? Math.round(size * 0.34),
        fontFamily: "'Bricolage Grotesque', sans-serif",
        flexShrink: 0,
      }}
    >
      {member.initials}
    </div>
  );
}
