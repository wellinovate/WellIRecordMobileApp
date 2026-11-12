import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PIN_LENGTH } from '../utils/pinCore';
import { hapticFeedback } from '../utils/haptics';

/** Six dots and a number pad. It only edits the digits it is given; the caller decides what a full PIN does. */
export function PinPad({
  value,
  onChange,
  disabled,
  dark = true,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  dark?: boolean;
}) {
  const ink = dark ? '#ffffff' : '#082F67';
  const soft = dark ? 'rgba(255,255,255,0.14)' : '#E2E8F0';
  const press = (d: string) => {
    if (disabled || value.length >= PIN_LENGTH) return;
    hapticFeedback.light();
    onChange(value + d);
  };
  const back = () => {
    if (disabled || !value) return;
    onChange(value.slice(0, -1));
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '<'];

  return (
    <View style={styles.wrap} accessibilityLabel={`PIN, ${value.length} of ${PIN_LENGTH} digits entered`}>
      <View style={styles.dots}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View key={i} style={[styles.dot, { borderColor: ink }, i < value.length && { backgroundColor: ink }]} />
        ))}
      </View>
      <View style={styles.grid}>
        {keys.map((k, i) =>
          k === '' ? (
            <View key={i} style={styles.key} />
          ) : (
            <TouchableOpacity
              key={i}
              accessibilityRole="button"
              accessibilityLabel={k === '<' ? 'Delete' : k}
              disabled={disabled}
              onPress={() => (k === '<' ? back() : press(k))}
              style={[styles.key, k !== '<' && { backgroundColor: soft }, disabled && { opacity: 0.4 }]}
            >
              <Text style={[styles.keyText, { color: ink }]}>{k === '<' ? '⌫' : k}</Text>
            </TouchableOpacity>
          ),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', alignSelf: 'stretch' },
  dots: { flexDirection: 'row', gap: 14, marginVertical: 18 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', width: 252, justifyContent: 'space-between', rowGap: 12 },
  key: { width: 74, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontSize: 24, fontWeight: '600' },
});
