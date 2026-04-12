import { useCallback, useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  ScrollView,
  Pressable,
  View,
  Modal,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
import { useBills } from '../context/BillsContext';
import { useCategories } from '../context/CategoriesContext';
import {
  buildBillsCsv,
  shareBillsCsvFile,
  showExportErrorAlert,
} from '../utils/exportBillsCsv';
import { colors, fontSize, fontWeight, layout, shadows } from '../theme';
import { CURRENCY_OPTIONS, normalizeCurrency } from '../utils/currencies';

const TOAST_MS = 2800;

const APP_VERSION =
  Constants.expoConfig?.version ??
  Constants.manifest2?.extra?.expoClient?.version ??
  '1.0.0';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { defaultCurrency, setDefaultCurrency } = useSettings();
  const { bills } = useBills();
  const { customCategories } = useCategories();

  const [exportSheetOpen, setExportSheetOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    if (!toastVisible) return undefined;
    const t = setTimeout(() => setToastVisible(false), TOAST_MS);
    return () => clearTimeout(t);
  }, [toastVisible]);

  const onSelectCurrency = useCallback(
    (code) => {
      void setDefaultCurrency(code);
    },
    [setDefaultCurrency]
  );

  const runExport = useCallback(
    async (dialogTitle) => {
      setExportSheetOpen(false);
      try {
        const csv = buildBillsCsv(bills, customCategories);
        await shareBillsCsvFile(csv, { dialogTitle });
        setToastVisible(true);
      } catch (e) {
        showExportErrorAlert(e);
      }
    },
    [bills, customCategories]
  );

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => navigation.navigate('Categories')}
          style={({ pressed }) => [
            styles.settingsRow,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Categories"
        >
          <Text style={styles.settingsRowLabel}>Categories</Text>
          <View style={styles.settingsRowRight}>
            <Text style={styles.settingsRowHint}>Add or edit</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </View>
        </Pressable>

        <Pressable
          onPress={() => setExportSheetOpen(true)}
          style={({ pressed }) => [
            styles.settingsRow,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Export data"
        >
          <Text style={styles.settingsRowLabel}>Export Data</Text>
          <View style={styles.settingsRowRight}>
            <Text style={styles.settingsRowHint}>CSV</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </View>
        </Pressable>

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>
          Default currency
        </Text>
        <Text style={styles.hint}>
          New bills will use this currency by default. You can change it per bill
          when adding a bill.
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.currencyRow}
        >
          {CURRENCY_OPTIONS.map((opt) => {
            const active = normalizeCurrency(defaultCurrency) === opt.code;
            return (
              <Pressable
                key={opt.code}
                onPress={() => onSelectCurrency(opt.code)}
                style={({ pressed }) => [
                  styles.currencyPill,
                  active && styles.currencyPillActive,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Default currency ${opt.caption}`}
              >
                <Text
                  style={[
                    styles.currencyPillText,
                    active && styles.currencyPillTextActive,
                  ]}
                >
                  {opt.caption}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.versionFooter}>{`BillMinder v${APP_VERSION}`}</Text>
      </ScrollView>

      <Modal
        visible={exportSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setExportSheetOpen(false)}
      >
        <View style={styles.sheetRoot}>
          <Pressable
            style={styles.sheetBackdropPress}
            onPress={() => setExportSheetOpen(false)}
            accessibilityLabel="Dismiss export options"
          />
          <View
            style={[
              styles.sheetCard,
              { paddingBottom: Math.max(insets.bottom, 20) + 8 },
            ]}
          >
          <Text style={styles.sheetTitle}>Export bills</Text>
          <Text style={styles.sheetSubtitle}>
            Share a CSV of all bills. You can save to Files, send by email, or use
            AirDrop.
          </Text>
          <Pressable
            onPress={() => runExport('Save CSV file')}
            style={({ pressed }) => [
              styles.sheetOption,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Save CSV file"
          >
            <Ionicons name="document-text-outline" size={22} color={colors.primary} />
            <Text style={styles.sheetOptionText}>Save CSV File</Text>
          </Pressable>
          <Pressable
            onPress={() => runExport('Email CSV')}
            style={({ pressed }) => [
              styles.sheetOption,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Email CSV"
          >
            <Ionicons name="mail-outline" size={22} color={colors.primary} />
            <Text style={styles.sheetOptionText}>Email CSV</Text>
          </Pressable>
          <Pressable
            onPress={() => setExportSheetOpen(false)}
            style={({ pressed }) => [
              styles.sheetCancel,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </Pressable>
        </View>
        </View>
      </Modal>

      {toastVisible ? (
        <View
          style={[
            styles.toast,
            { bottom: Math.max(insets.bottom, 16) + (Platform.OS === 'ios' ? 8 : 0) },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.toastText}>
            Export ready — choose where to save it.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: fontSize.detailSectionTitle,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    marginBottom: 8,
  },
  hint: {
    fontSize: fontSize.detailMetadata,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 16,
  },
  currencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 4,
    paddingRight: layout.screenPaddingHorizontal,
  },
  currencyPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.card,
    marginRight: 8,
    marginBottom: 8,
  },
  currencyPillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMutedBackground,
  },
  currencyPillText: {
    fontSize: fontSize.addBillInput - 1,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  currencyPillTextActive: {
    color: colors.primary,
  },
  pressed: {
    opacity: 0.88,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  settingsRowLabel: {
    fontSize: fontSize.addBillInput,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  settingsRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsRowHint: {
    fontSize: fontSize.detailMetadata,
    color: colors.textMuted,
    marginRight: 4,
  },
  sectionTitleSpaced: {
    marginTop: 16,
  },
  versionFooter: {
    marginTop: 36,
    marginBottom: 8,
    textAlign: 'center',
    fontSize: fontSize.detailMetadata - 1,
    fontWeight: fontWeight.regular,
    color: colors.textMuted,
  },
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(30, 36, 51, 0.45)',
  },
  sheetBackdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    ...shadows.footer,
  },
  sheetTitle: {
    fontSize: fontSize.detailSectionTitle,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: 6,
  },
  sheetSubtitle: {
    fontSize: fontSize.detailMetadata,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryMutedBackground,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 12,
  },
  sheetOptionText: {
    fontSize: fontSize.addBillInput,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  sheetCancel: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  sheetCancelText: {
    fontSize: fontSize.addBillInput,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  toast: {
    position: 'absolute',
    left: layout.screenPaddingHorizontal,
    right: layout.screenPaddingHorizontal,
    backgroundColor: 'rgba(30, 36, 51, 0.92)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    ...shadows.card,
  },
  toastText: {
    fontSize: fontSize.detailMetadata,
    fontWeight: fontWeight.semibold,
    color: colors.white,
    textAlign: 'center',
    lineHeight: 20,
  },
});
