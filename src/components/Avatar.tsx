import React from 'react';
import { View, Text, Image } from 'react-native';
import type { FamilyMember } from '../data/types';

interface AvatarProps {
  member: FamilyMember;
  size?: number;
  fontSize?: number;
}

export function Avatar({ member, size = 40, fontSize = 14 }: AvatarProps) {
  if (member.avatarUrl) {
    return (
      <Image
        source={{ uri: member.avatarUrl }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.5,
          borderColor: '#ffffff',
        }}
        resizeMode="cover"
      />
    );
  }

  const bg = member.role === 'owner' ? '#041E42' : '#0EA5E9';

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#ffffff',
      }}
    >
      <Text
        style={{
          color: '#ffffff',
          fontWeight: '700',
          fontSize,
          letterSpacing: 0.5,
        }}
      >
        {member.initials}
      </Text>
    </View>
  );
}
