import { useState, useEffect } from 'react';
import { useHeaderHeight } from '@react-navigation/elements';
import { useBills } from '../context/BillsContext';
import { useCategories } from '../context/CategoriesContext';
import { useSettings } from '../context/SettingsContext';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { colors, fontSize, fontWeight, layout } from '../theme';
import { BILL_CATEGORIES } from '../utils/billCategories';
import {
  CURRENCY_OPTIONS,
  CURRENCY_MINOR_UNITS,
  DEFAULT_CURRENCY,
  amountKeyboardType,
  amountPlaceholder,
  isValidCurrencyAmountString,
  normalizeCurrency,
  parseAmountStringToMinor,
  sanitizeCurrencyAmountInput,
} from '../utils/currencies';
import { REPEAT_OPTIONS } from '../utils/billRecurrence';
const REMIND_OPTIONS = ['On the day', '1 day before', '3 days before', '7 days before'];

function formatDisplayDate(d) {
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function AddBillScreen({ navigation }) {
  const headerHeight = useHeaderHeight();
  const { addBill } = useBills();
  const { mergedCategories } = useCategories();
  const { defaultCurrency, settingsHydrated } = useSettings();
  const initialDate = new Date();
  const [billName, setBillName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [dueDate, setDueDate] = useState(initialDate);
  const [webDateStr, setWebDateStr] = useState(
    initialDate.toISOString().split('T')[0]
  );
  const [repeat, setRepeat] = useState(REPEAT_OPTIONS[0]);
  const [category, setCategory] = useState(BILL_CATEGORIES[0].id);
  const [remind, setRemind] = useState(REMIND_OPTIONS[0]);

  const [androidDateOpen, setAndroidDateOpen] = useState(false);
  const [iosDateOpen, setIosDateOpen] = useState(false);

  const [listModal, setListModal] = useState({
    visible: false,
    title: '',
    options: [],
    onSelect: () => {},
  });

  const [pickerTemp, setPickerTemp] = useState('');

  useEffect(() => {
    if (settingsHydrated) setCurrency(normalizeCurrency(defaultCurrency));
  }, [settingsHydrated, defaultCurrency]);

  const openListModal = (title, options, current, onSelect) => {
    setPickerTemp(current);
    setListModal({
      visible: true,
      title,
      options,
      onSelect,
    });
  };

  const closeListModal = () => {
    setListModal((m) => ({ ...m, visible: false }));
  };

  const confirmListModal = () => {
    listModal.onSelect(pickerTemp);
    closeListModal();
  };

  const onAndroidDateChange = (event, selectedDate) => {
    setAndroidDateOpen(false);
    if (event.type === 'dismissed') {
      return;
    }
    if (selectedDate) {
      setDueDate(selectedDate);
    }
  };

  const openDatePicker = () => {
    if (Platform.OS === 'android') {
      setAndroidDateOpen(true);
    } else {
      setIosDateOpen(true);
    }
  };

  const onWebDateChange = (t) => {
    setWebDateStr(t);
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
      const parsed = new Date(`${t}T12:00:00`);
      if (!Number.isNaN(parsed.getTime())) {
        setDueDate(parsed);
      }
    }
  };

  const saveBill = async () => {
    const trimmedName = billName.trim();
    if (!trimmedName) {
      Alert.alert('Name required', 'Please enter a bill name.');
      return;
    }

    if (!isValidCurrencyAmountString(amount, currency)) {
      Alert.alert(
        'Invalid amount',
        'Use digits only, with an optional decimal (e.g. 12.30).'
      );
      return;
    }

    const amountCents = parseAmountStringToMinor(amount, currency);
    if (amountCents < 0) {
      Alert.alert('Invalid amount', 'Amount cannot be negative.');
      return;
    }

    const added = await addBill({
      name: trimmedName,
      amountCents,
      due: dueDate,
      repeat,
      category,
      currency: normalizeCurrency(currency),
      remind,
    });
    if (!added) {
      Alert.alert('Could not save', 'Please check the bill name and amount.');
      return;
    }

    setBillName('');
    setAmount('');
    setDueDate(new Date());
    setWebDateStr(new Date().toISOString().split('T')[0]);
    setRepeat(REPEAT_OPTIONS[0]);
    setCategory(BILL_CATEGORIES[0].id);
    setCurrency(normalizeCurrency(defaultCurrency));
    setRemind(REMIND_OPTIONS[0]);

    navigation.navigate('HomeTab', { screen: 'Dashboard' });
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
      enabled
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
      >
        <Text style={styles.label}>Bill Name</Text>
        <TextInput
          style={styles.input}
          value={billName}
          onChangeText={setBillName}
          placeholder="e.g. Rent"
          placeholderTextColor={colors.textPlaceholder}
        />

        <Text style={styles.label}>Currency</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.currencyPickerRow}
          style={styles.currencyPickerScroll}
        >
          {CURRENCY_OPTIONS.map((opt) => {
            const active = normalizeCurrency(currency) === opt.code;
            return (
              <Pressable
                key={opt.code}
                onPress={() => setCurrency(opt.code)}
                style={({ pressed }) => [
                  styles.currencyPickerPill,
                  active && styles.currencyPickerPillActive,
                  pressed && styles.pressedOpacity,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={opt.caption}
              >
                <Text
                  style={[
                    styles.currencyPickerPillText,
                    active && styles.currencyPickerPillTextActive,
                  ]}
                >
                  {opt.caption}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.label}>Amount</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={(t) =>
            setAmount(sanitizeCurrencyAmountInput(t, currency))
          }
          placeholder={amountPlaceholder(currency)}
          placeholderTextColor={colors.textPlaceholder}
          keyboardType={amountKeyboardType(currency)}
          inputMode={
            CURRENCY_MINOR_UNITS[normalizeCurrency(currency)] === 0
              ? 'numeric'
              : 'decimal'
          }
        />

        <Text style={styles.label}>Due Date</Text>
        {Platform.OS === 'web' ? (
          <TextInput
            style={styles.input}
            value={webDateStr}
            onChangeText={onWebDateChange}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textPlaceholder}
          />
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.input,
              styles.dateRow,
              pressed && styles.pressedRow,
            ]}
            onPress={openDatePicker}
          >
            <Text style={styles.dateText}>{formatDisplayDate(dueDate)}</Text>
            <Text style={styles.dateHint}>Tap to change</Text>
          </Pressable>
        )}

        {Platform.OS === 'android' && androidDateOpen ? (
          <DateTimePicker
            value={dueDate}
            mode="date"
            display="default"
            onChange={onAndroidDateChange}
          />
        ) : null}

        <Text style={styles.label}>Repeat</Text>
        <Pressable
          style={({ pressed }) => [
            styles.selectTrigger,
            pressed && styles.pressedRow,
          ]}
          onPress={() =>
            openListModal('Repeat', REPEAT_OPTIONS, repeat, setRepeat)
          }
        >
          <Text style={styles.selectTriggerText}>{repeat}</Text>
          <Text style={styles.chevron}>▼</Text>
        </Pressable>

        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryPillWrap}>
          {mergedCategories.map((c) => {
            const selected = category === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => setCategory(c.id)}
                style={({ pressed }) => [
                  styles.categoryPill,
                  selected
                    ? [
                        styles.categoryPillSelected,
                        { backgroundColor: c.color, borderColor: c.color },
                      ]
                    : [
                        styles.categoryPillOutline,
                        { borderColor: c.color },
                      ],
                  pressed && styles.pressedOpacity,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Category ${c.label}`}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    selected && styles.categoryPillTextSelected,
                  ]}
                >
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Remind me</Text>
        <Pressable
          style={({ pressed }) => [
            styles.selectTrigger,
            pressed && styles.pressedRow,
          ]}
          onPress={() =>
            openListModal('Remind me', REMIND_OPTIONS, remind, setRemind)
          }
        >
          <Text style={styles.selectTriggerText}>{remind}</Text>
          <Text style={styles.chevron}>▼</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            pressed && styles.pressedOpacity,
          ]}
          onPress={saveBill}
        >
          <Text style={styles.saveButtonText}>Save Bill</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={iosDateOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIosDateOpen(false)}
      >
        <View style={styles.iosDateModalRoot}>
          <Pressable
            style={styles.iosDateBackdrop}
            onPress={() => setIosDateOpen(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setIosDateOpen(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </Pressable>
              <Text style={styles.modalTitle}>Due date</Text>
              <Pressable onPress={() => setIosDateOpen(false)}>
                <Text style={styles.modalDone}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={dueDate}
              mode="date"
              display="spinner"
              onChange={(_, d) => d && setDueDate(d)}
              themeVariant="light"
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={listModal.visible}
        animationType="fade"
        transparent
        onRequestClose={closeListModal}
      >
        <View style={styles.listModalRoot}>
          <Pressable style={styles.listModalBackdrop} onPress={closeListModal} />
          <View style={styles.pickerCard}>
            <Text style={styles.modalTitleCenter}>{listModal.title}</Text>
            <Picker
              selectedValue={pickerTemp}
              onValueChange={(v) => setPickerTemp(v)}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              {listModal.options.map((opt) => (
                <Picker.Item key={opt} label={opt} value={opt} />
              ))}
            </Picker>
            <Pressable
              style={({ pressed }) => [
                styles.modalPrimaryBtn,
                pressed && styles.pressedOpacity,
              ]}
              onPress={confirmListModal}
            >
              <Text style={styles.modalPrimaryBtnText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: 16,
    paddingBottom: 220,
  },
  label: {
    fontSize: fontSize.addBillLabel,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    marginBottom: 8,
    marginTop: 0,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.inputBorderLight,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: fontSize.addBillInput,
    color: colors.text,
    marginBottom: layout.addBillFieldGap,
    backgroundColor: colors.card,
  },
  dateRow: {
    justifyContent: 'center',
  },
  dateText: {
    fontSize: fontSize.addBillInput,
    color: colors.text,
    fontWeight: fontWeight.medium,
  },
  dateHint: {
    fontSize: fontSize.addBillDateHint,
    color: colors.textSecondary,
    marginTop: 4,
  },
  pressedRow: {
    opacity: 0.88,
    backgroundColor: colors.primaryMutedBackground,
  },
  selectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.inputBorderLight,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: layout.addBillFieldGap,
    backgroundColor: colors.card,
  },
  selectTriggerText: {
    fontSize: fontSize.addBillInput,
    color: colors.text,
    flex: 1,
  },
  chevron: {
    fontSize: fontSize.addBillChevron,
    color: colors.textMuted,
    marginLeft: 8,
  },
  categoryPillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: layout.addBillFieldGap,
    marginHorizontal: -4,
    marginTop: -4,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    marginHorizontal: 4,
    marginTop: 8,
    backgroundColor: colors.card,
  },
  categoryPillSelected: {},
  categoryPillOutline: {
    backgroundColor: colors.card,
  },
  categoryPillText: {
    fontSize: fontSize.addBillInput - 1,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  categoryPillTextSelected: {
    color: colors.white,
  },
  currencyPickerScroll: {
    marginBottom: layout.addBillFieldGap,
    marginHorizontal: -4,
  },
  currencyPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingRight: layout.screenPaddingHorizontal,
  },
  currencyPickerPill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.card,
    marginHorizontal: 4,
  },
  currencyPickerPillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMutedBackground,
  },
  currencyPickerPillText: {
    fontSize: fontSize.addBillInput - 2,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  currencyPickerPillTextActive: {
    color: colors.primary,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: layout.addBillFieldGap,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: fontSize.addBillSave,
    fontWeight: fontWeight.semibold,
  },
  pressedOpacity: {
    opacity: 0.88,
  },
  iosDateModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  iosDateBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlayScrim,
  },
  listModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  listModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlayScrim,
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  modalTitle: {
    fontSize: fontSize.addBillModalTitle,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  modalTitleCenter: {
    fontSize: fontSize.addBillModalTitleCenter,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 8,
    marginTop: 8,
  },
  modalCancel: {
    fontSize: fontSize.addBillModalAction,
    color: colors.textSecondary,
  },
  modalDone: {
    fontSize: fontSize.addBillModalAction,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  pickerCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
    maxHeight: '55%',
  },
  picker: {
    width: '100%',
  },
  pickerItem: {
    fontSize: fontSize.addBillPickerItem,
  },
  modalPrimaryBtn: {
    marginHorizontal: layout.screenPaddingHorizontal,
    marginTop: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalPrimaryBtnText: {
    color: colors.white,
    fontSize: fontSize.addBillModalPrimary,
    fontWeight: fontWeight.semibold,
  },
});
