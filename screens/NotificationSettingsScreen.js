import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, layout } from '../theme';

export default function NotificationSettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notifications</Text>
      <Text style={styles.body}>
        Reminder timing, quiet hours, and permission controls will appear here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: 24,
  },
  title: {
    fontSize: fontSize.statsTitle,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    marginBottom: 12,
  },
  body: {
    fontSize: fontSize.statsSubtitle,
    fontWeight: fontWeight.regular,
    color: colors.textSecondary,
    lineHeight: 24,
  },
});
