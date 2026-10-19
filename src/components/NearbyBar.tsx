import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import type { LocState } from '../hooks/useNearbyDirectory';

const PRIMARY = '#0EA5E9';

export function NearbyBar({ loc, radiusKm, count, noun, onRefresh }: { loc: LocState; radiusKm?: number; count: number; noun: string; onRefresh: () => void }) {
  const theme = useTheme();
  const text =
    loc === 'locating' ? 'Finding your location...'
    : loc === 'ok' ? `${count} ${noun} near you${radiusKm ? ` (within ${radiusKm} km)` : ''}`
    : loc === 'denied' ? 'Location is off, so this shows Abuja. Allow location to see places near you.'
    : 'Could not get your location, so this shows Abuja.';
  return (
    <View style={styles.row}>
      <Text style={[styles.text, { color: theme.muted }]}>{text}</Text>
      {loc !== 'locating' && (
        <TouchableOpacity activeOpacity={0.7} onPress={onRefresh} style={[styles.btn, { borderColor: PRIMARY }]}>
          <Text style={[styles.btnText, { color: PRIMARY }]}>{loc === 'ok' ? 'Refresh' : 'Use my location'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  text: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 16 },
  btn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  btnText: { fontSize: 12, fontWeight: '700' },
});
