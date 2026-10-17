import { Component, type ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { reportError } from '../utils/errorReporting';

type Props = { children: ReactNode };
type State = { failed: boolean };

/** Shows a recovery screen instead of a blank app when a screen throws while rendering. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    reportError(error, { where: 'render', fatal: true });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          Your records are safe. The problem has been reported. Reopen this screen, and if it keeps happening, close and restart the app.
        </Text>
        <TouchableOpacity accessibilityRole="button" onPress={() => this.setState({ failed: false })} style={styles.btn}>
          <Text style={styles.btnText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '800', color: '#082F67', marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 20, color: '#475569', textAlign: 'center', marginBottom: 20 },
  btn: { minHeight: 48, paddingHorizontal: 24, borderRadius: 12, backgroundColor: '#082F67', alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
