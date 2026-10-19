import { Text, View } from 'react-native';

// Marks a locator result that is a provider registered and approved on WelliRecord.
export function WelliBadge() {
  return (
    <View style={{ backgroundColor: '#DCFCE7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Text style={{ color: '#166534', fontSize: 10, fontWeight: '700' }}>WelliRecord</Text>
    </View>
  );
}
