import { useCallback, useLayoutEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Alert,
  Modal,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useBills } from '../context/BillsContext';
import { useCategories } from '../context/CategoriesContext';
import { getCategoryMeta } from '../utils/billCategories';
import { formatBillAmount, formatDueDateLong } from '../utils/billUtils';
import { REPEAT_OPTIONS } from '../utils/billRecurrence';
import { colors, fontSize, fontWeight, layout, shadows } from '../theme';

function DetailRow({ label, value, isLast, variant }) {
  const isAmount = variant === 'amount';
  return (
    <View style={[styles.detailRow, isLast && styles.detailRowLast]}>
      <Text style={styles.detailMetaLabel}>{label}</Text>
      <Text
        style={isAmount ? styles.detailAmountValue : styles.detailMetaValue}
      >
        {value}
      </Text>
    </View>
  );
}

export default function BillDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { bills, markPaid, snoozeReminder, removeBill, updateBillRecurrence } =
    useBills();
  const { customCategories } = useCategories();
  const [recurrenceModalOpen, setRecurrenceModalOpen] = useState(false);
  const [recurrencePickerTemp, setRecurrencePickerTemp] = useState(
    REPEAT_OPTIONS[0]
  );
  const billId = route.params?.billId;
  const bill = bills.find((b) => b.id === billId);

  const confirmDelete = useCallback(() => {
    if (!bill) return;
    Alert.alert(
      'Delete bill',
      'Are you sure you want to delete this bill?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            removeBill(bill.id);
            navigation.goBack();
          },
        },
      ]
    );
  }, [bill, removeBill, navigation]);

  useLayoutEffect(() => {
    if (!bill) {
      navigation.setOptions({ headerRight: undefined });
      return;
    }
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate('NotificationSettings')}
          style={styles.headerBell}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Notification settings"
        >
          <Ionicons name="notifications-outline" size={24} color={colors.white} />
        </Pressable>
      ),
    });
  }, [navigation, bill]);

  if (!bill) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>Bill not found.</Text>
        <Pressable
          style={styles.missingBtn}
          onPress={() => navigation.navigate('Dashboard')}
        >
          <Text style={styles.missingBtnText}>Back to dashboard</Text>
        </Pressable>
      </View>
    );
  }

  const onMarkPaid = () => {
    void markPaid(bill.id);
    navigation.popToTop();
  };

  const openRecurrenceModal = () => {
    setRecurrencePickerTemp(bill.repeat);
    setRecurrenceModalOpen(true);
  };

  const confirmRecurrence = () => {
    updateBillRecurrence(bill.id, recurrencePickerTemp);
    setRecurrenceModalOpen(false);
  };

  const onSnooze = () => {
    snoozeReminder(bill.id, 3);
  };

  const categoryMeta = getCategoryMeta(bill.category, customCategories);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>{bill.name}</Text>
        <View
          style={[
            styles.headerCategoryPill,
            {
              borderColor: categoryMeta.color,
              backgroundColor: `${categoryMeta.color}22`,
            },
          ]}
        >
          <Text
            style={[styles.headerCategoryPillText, { color: categoryMeta.color }]}
          >
            {categoryMeta.label}
          </Text>
        </View>

        <View style={styles.card}>
          <DetailRow
            variant="amount"
            label="Amount"
            value={formatBillAmount(bill)}
          />
          <DetailRow label="Due date" value={formatDueDateLong(bill.due)} />
          <DetailRow label="Recurrence" value={bill.repeat} />
          <DetailRow label="Remind me" value={bill.remind} isLast />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.editRecurrenceBtn,
            pressed && styles.pressed,
          ]}
          onPress={openRecurrenceModal}
          accessibilityRole="button"
          accessibilityLabel="Edit recurrence"
        >
          <Ionicons name="repeat" size={20} color={colors.primary} />
          <Text style={styles.editRecurrenceText}>Edit Recurrence</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        <Text style={styles.sectionTitle}>Payment History</Text>
        <View style={styles.historyCard}>
          {bill.paymentHistory.map((entry, index) => (
            <View
              key={`${entry.month}-${index}`}
              style={[
                styles.historyRow,
                index > 0 && styles.historyRowBorder,
              ]}
            >
              <Text style={styles.historyMonth}>{entry.month}</Text>
              <View style={styles.paidPill}>
                <Text style={styles.paidPillText}>{entry.status}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        {!bill.paid ? (
          <Pressable
            style={({ pressed }) => [styles.btnPaid, pressed && styles.pressed]}
            onPress={onMarkPaid}
          >
            <View style={styles.btnPaidInner}>
              <Ionicons
                name="checkmark-circle"
                size={22}
                color={colors.white}
              />
              <Text style={styles.btnPaidText}>Mark as Paid</Text>
            </View>
          </Pressable>
        ) : null}
        <Pressable
          style={({ pressed }) => [styles.btnSnooze, pressed && styles.pressed]}
          onPress={onSnooze}
        >
          <Text style={styles.btnSnoozeText}>Snooze 3 Days</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.btnDelete, pressed && styles.pressed]}
          onPress={confirmDelete}
        >
          <View style={styles.btnDeleteInner}>
            <Ionicons
              name="trash-outline"
              size={22}
              color={colors.danger}
            />
            <Text style={styles.btnDeleteText}>Delete</Text>
          </View>
        </Pressable>
      </View>

      <Modal
        visible={recurrenceModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setRecurrenceModalOpen(false)}
      >
        <View style={styles.recurrenceModalRoot}>
          <Pressable
            style={styles.recurrenceModalBackdrop}
            onPress={() => setRecurrenceModalOpen(false)}
          />
          <View style={styles.recurrenceModalCard}>
            <Text style={styles.recurrenceModalTitle}>Recurrence</Text>
            <Picker
              selectedValue={recurrencePickerTemp}
              onValueChange={(v) => setRecurrencePickerTemp(v)}
              style={styles.recurrencePicker}
              itemStyle={styles.recurrencePickerItem}
            >
              {REPEAT_OPTIONS.map((opt) => (
                <Picker.Item key={opt} label={opt} value={opt} />
              ))}
            </Picker>
            <Pressable
              style={({ pressed }) => [
                styles.recurrenceModalDone,
                pressed && styles.pressed,
              ]}
              onPress={confirmRecurrence}
            >
              <Text style={styles.recurrenceModalDoneText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: 8,
    paddingBottom: 24,
  },
  heading: {
    fontSize: fontSize.detailTitle,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  headerCategoryPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    marginBottom: 20,
  },
  headerCategoryPillText: {
    fontSize: fontSize.detailMetadata,
    fontWeight: fontWeight.bold,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    marginBottom: 28,
    ...shadows.card,
  },
  detailRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailMetaLabel: {
    fontSize: fontSize.detailMetadata,
    fontWeight: fontWeight.regular,
    color: colors.textBillDueMuted,
    marginBottom: 6,
  },
  detailAmountValue: {
    fontSize: fontSize.detailAmount,
    fontWeight: fontWeight.regular,
    color: colors.text,
  },
  detailMetaValue: {
    fontSize: fontSize.detailMetadata,
    fontWeight: fontWeight.regular,
    color: colors.textBillDueMuted,
  },
  sectionTitle: {
    fontSize: fontSize.detailSectionTitle,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    marginBottom: 12,
  },
  historyCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
    marginBottom: 16,
    ...shadows.card,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  historyRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
  },
  historyMonth: {
    fontSize: fontSize.detailHistoryMonth,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  paidPill: {
    backgroundColor: colors.successBackground,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  paidPillText: {
    fontSize: fontSize.detailHistoryPill,
    fontWeight: fontWeight.bold,
    color: colors.success,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  footer: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
    backgroundColor: colors.card,
    gap: 12,
    ...shadows.footer,
  },
  btnPaid: {
    backgroundColor: colors.success,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPaidInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  btnPaidText: {
    color: colors.white,
    fontSize: fontSize.detailFooterBtn,
    fontWeight: fontWeight.bold,
  },
  btnSnooze: {
    backgroundColor: colors.card,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  btnSnoozeText: {
    color: colors.primary,
    fontSize: fontSize.detailFooterBtn,
    fontWeight: fontWeight.semibold,
  },
  btnDelete: {
    backgroundColor: colors.card,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.danger,
  },
  btnDeleteInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  btnDeleteText: {
    color: colors.danger,
    fontSize: fontSize.detailFooterBtn,
    fontWeight: fontWeight.semibold,
  },
  pressed: {
    opacity: 0.9,
  },
  missing: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: layout.screenPaddingHorizontal,
    backgroundColor: colors.background,
  },
  missingText: {
    fontSize: fontSize.detailMissingBody,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  missingBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  missingBtnText: {
    color: colors.white,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.detailMissingBtn,
  },
  headerBell: {
    paddingRight: 16,
    paddingVertical: 8,
    paddingLeft: 8,
  },
  editRecurrenceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 28,
    gap: 10,
  },
  editRecurrenceText: {
    flex: 1,
    fontSize: fontSize.detailAmount,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  recurrenceModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  recurrenceModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlayScrim,
  },
  recurrenceModalCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
    maxHeight: '50%',
  },
  recurrenceModalTitle: {
    fontSize: fontSize.addBillModalTitleCenter,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  recurrencePicker: {
    width: '100%',
  },
  recurrencePickerItem: {
    fontSize: 18,
  },
  recurrenceModalDone: {
    marginHorizontal: layout.screenPaddingHorizontal,
    marginTop: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  recurrenceModalDoneText: {
    color: colors.white,
    fontSize: fontSize.addBillModalPrimary,
    fontWeight: fontWeight.semibold,
  },
});
