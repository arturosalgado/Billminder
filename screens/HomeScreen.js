import { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  FlatList,
  Platform,
  ScrollView,
  TextInput,
  Keyboard,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useBills } from '../context/BillsContext';
import { useCategories } from '../context/CategoriesContext';
import { useNotificationPermission } from '../context/NotificationPermissionContext';
import {
  billStatus,
  formatBillAmount,
  formatDueDateShort,
  formatMonthYear,
  isSameMonth,
  startOfDay,
} from '../utils/billUtils';
import {
  getCategoryMeta,
  normalizeCategoryInput,
  sumEstimatedMonthlyByCurrency,
} from '../utils/billCategories';
import {
  formatAmountMinor,
  formatAmountMinorWithCode,
  normalizeCurrency,
} from '../utils/currencies';
import { isNonRecurringRepeat } from '../utils/billRecurrence';
import {
  billListAmountColor,
  billRowLeftBorderColor,
  colors,
  fontSize,
  fontWeight,
  layout,
  shadows,
} from '../theme';

const LOADING_MIN_MS = 500;

const FILTER_KEYS = ['all', 'upcoming', 'overdue', 'paid'];

const FILTER_TAB_CONFIG = {
  all: { icon: 'layers-outline', a11y: 'All bills' },
  upcoming: { icon: 'today-outline', a11y: 'Upcoming bills' },
  overdue: { icon: 'alert-circle-outline', a11y: 'Overdue bills' },
  paid: { icon: 'checkmark-circle-outline', a11y: 'Paid bills' },
};

const FILTER_DISPLAY_NAME = {
  all: 'All',
  upcoming: 'Upcoming',
  overdue: 'Overdue',
  paid: 'Paid',
};

const SORT_KEYS = ['due', 'amount', 'name'];

const SORT_TAB_CONFIG = {
  due: { label: 'Due Date', a11y: 'Sort by due date, earliest first' },
  amount: { label: 'Amount', a11y: 'Sort by amount, largest first' },
  name: { label: 'Name', a11y: 'Sort by name, A to Z' },
};

function compareBillsForSort(a, b, sortBy) {
  if (sortBy === 'amount') {
    const d = b.amountCents - a.amountCents;
    if (d !== 0) return d;
  } else if (sortBy === 'name') {
    const n = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    if (n !== 0) return n;
  } else {
    const ta = startOfDay(a.due).getTime();
    const tb = startOfDay(b.due).getTime();
    if (ta !== tb) return ta - tb;
  }
  return a.id.localeCompare(b.id);
}

function sortBillsCopy(bills, sortBy) {
  return [...bills].sort((a, b) => compareBillsForSort(a, b, sortBy));
}

function filterCounts(bills, todayStart) {
  let upcoming = 0;
  let overdue = 0;
  let paid = 0;
  for (const b of bills) {
    if (b.paid) {
      paid += 1;
      continue;
    }
    const dueStart = startOfDay(b.due);
    if (dueStart < todayStart) overdue += 1;
    else upcoming += 1;
  }
  return {
    all: bills.length,
    upcoming,
    overdue,
    paid,
  };
}

function billNameMatchesSearch(bill, queryLower) {
  if (!queryLower) return true;
  return bill.name.toLowerCase().includes(queryLower);
}

function billMatchesFilter(bill, filter, todayStart) {
  switch (filter) {
    case 'paid':
      return bill.paid;
    case 'overdue':
      if (bill.paid) return false;
      return startOfDay(bill.due) < todayStart;
    case 'upcoming':
      if (bill.paid) return false;
      return startOfDay(bill.due) >= todayStart;
    default:
      return true;
  }
}

function BillListSkeleton() {
  return (
    <View style={styles.skeletonWrap} accessibilityLabel="Loading bills">
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <View style={styles.skeletonRow}>
            <View style={styles.skeletonMain}>
              <View style={styles.skeletonTitle} />
              <View style={styles.skeletonChip} />
              <View style={styles.skeletonDue} />
            </View>
            <View style={styles.skeletonAmount} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function HomeScreen({ navigation }) {
  const { bills, billsHydrated, refreshBills } = useBills();
  const { mergedCategories, customCategories } = useCategories();
  const mountedAtRef = useRef(Date.now());
  const [contentReady, setContentReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [sortBy, setSortBy] = useState('due');
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);
  const { permissionStatus, notificationsReady } = useNotificationPermission();

  const dismissSearchKeyboard = useCallback(() => {
    Keyboard.dismiss();
    searchInputRef.current?.blur();
  }, []);

  useFocusEffect(
    useCallback(() => {
      setFilter('all');
      setCategoryFilter(null);
      return () => {
        setSortBy('due');
      };
    }, [])
  );

  useEffect(() => {
    if (!billsHydrated) return undefined;
    const elapsed = Date.now() - mountedAtRef.current;
    const remaining = Math.max(0, LOADING_MIN_MS - elapsed);
    const id = setTimeout(() => setContentReady(true), remaining);
    return () => clearTimeout(id);
  }, [billsHydrated]);
  const showNotificationBanner =
    Platform.OS !== 'web' &&
    notificationsReady &&
    permissionStatus === 'denied';
  const today = useMemo(() => new Date(), []);
  const todayStart = useMemo(() => startOfDay(today), [today]);

  const { billsWithStatus, monthlySummary } = useMemo(() => {
    const byCurrencyMap = new Map();

    const enriched = bills.map((bill) => {
      const status = billStatus(bill, todayStart);
      if (isSameMonth(bill.due, today)) {
        const c = normalizeCurrency(bill.currency);
        if (!byCurrencyMap.has(c)) {
          byCurrencyMap.set(c, { dueMinor: 0, paidMinor: 0 });
        }
        const agg = byCurrencyMap.get(c);
        agg.dueMinor += bill.amountCents;
        if (bill.paid) agg.paidMinor += bill.amountCents;
      }
      return { ...bill, status };
    });

    const byCurrency = [...byCurrencyMap.entries()]
      .map(([currency, v]) => ({
        currency,
        dueMinor: v.dueMinor,
        paidMinor: v.paidMinor,
        remainingMinor: v.dueMinor - v.paidMinor,
      }))
      .sort((a, b) => a.currency.localeCompare(b.currency));

    const monthAllClear =
      byCurrency.length === 0 ||
      byCurrency.every((x) => x.remainingMinor <= 0);

    return {
      billsWithStatus: enriched,
      monthlySummary: {
        byCurrency,
        monthAllClear,
      },
    };
  }, [bills, today, todayStart]);

  const counts = useMemo(
    () => filterCounts(bills, todayStart),
    [bills, todayStart]
  );

  const filteredBills = useMemo(
    () =>
      billsWithStatus.filter((b) =>
        billMatchesFilter(b, filter, todayStart)
      ),
    [billsWithStatus, filter, todayStart]
  );

  const categoryFilteredBills = useMemo(() => {
    if (!categoryFilter) return filteredBills;
    return filteredBills.filter(
      (b) =>
        normalizeCategoryInput(b.category, customCategories) === categoryFilter
    );
  }, [filteredBills, categoryFilter, customCategories]);

  const categoryMonthlyByCurrency = useMemo(() => {
    if (!categoryFilter) return [];
    const inCategory = filteredBills.filter(
      (b) =>
        normalizeCategoryInput(b.category, customCategories) === categoryFilter
    );
    return sumEstimatedMonthlyByCurrency(inCategory);
  }, [filteredBills, categoryFilter, customCategories]);

  const searchTrimmed = searchQuery.trim();
  const searchActive = searchTrimmed.length > 0;

  const listBills = useMemo(() => {
    if (!searchActive) return categoryFilteredBills;
    const q = searchTrimmed.toLowerCase();
    return categoryFilteredBills.filter((b) =>
      billNameMatchesSearch(b, q)
    );
  }, [searchActive, searchTrimmed, categoryFilteredBills]);

  const sortedListBills = useMemo(
    () => sortBillsCopy(listBills, sortBy),
    [listBills, sortBy]
  );

  const monthLabel = formatMonthYear(today);

  const goToAddBill = () =>
    navigation.navigate('AddBillTab', { screen: 'AddBill' });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshBills();
    } finally {
      setRefreshing(false);
    }
  }, [refreshBills]);

  const isEmpty = bills.length === 0;
  const showLoading = !contentReady;
  const showEmptyState = contentReady && isEmpty;

  const renderBill = ({ item }) => {
    const cat = getCategoryMeta(item.category, customCategories);
    return (
    <Pressable
      style={({ pressed }) => [
        styles.rowCard,
        { borderLeftColor: billRowLeftBorderColor(item.status) },
        pressed && styles.rowCardPressed,
      ]}
      onPress={() => {
        dismissSearchKeyboard();
        navigation.navigate('BillDetail', { billId: item.id });
      }}
    >
      <View style={styles.rowInner}>
        <View style={styles.rowMain}>
          <Text style={styles.billName}>{item.name}</Text>
          <View
            style={[
              styles.rowCategoryChip,
              { backgroundColor: `${cat.color}22`, borderColor: cat.color },
            ]}
          >
            <Text style={[styles.rowCategoryChipText, { color: cat.color }]}>
              {cat.label}
            </Text>
          </View>
          <View style={styles.dueRow}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color={colors.textBillDueMuted}
              style={styles.dueCalendarIcon}
            />
            <Text style={styles.dueDate}>
              Due {formatDueDateShort(item.due)}
            </Text>
          </View>
        </View>
        <Text
          style={[
            styles.amount,
            { color: billListAmountColor(item.status) },
          ]}
        >
          {formatBillAmount(item)}
        </Text>
        {!isNonRecurringRepeat(item.repeat) ? (
          <Ionicons
            name="repeat"
            size={18}
            color={colors.primary}
            style={styles.rowRepeatIcon}
          />
        ) : null}
        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.textMuted}
          style={styles.rowChevron}
        />
      </View>
    </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTitleBlock}>
            <Text style={styles.appName}>BillMinder</Text>
            <Text style={styles.month}>{monthLabel}</Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('Settings')}
            style={({ pressed }) => [
              styles.headerSettingsBtn,
              pressed && styles.headerSettingsBtnPressed,
            ]}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={26} color={colors.white} />
          </Pressable>
        </View>

        {showNotificationBanner ? (
          <View style={styles.notifyBanner}>
            <Text style={styles.notifyBannerText}>
              Enable notifications in Settings to get bill reminders
            </Text>
          </View>
        ) : null}

        {showLoading ? (
          <BillListSkeleton />
        ) : (
          <>
            <View style={styles.searchBarOuter}>
              <View style={styles.searchBarInner}>
                <Ionicons
                  name="search"
                  size={20}
                  color={colors.textMuted}
                  style={styles.searchMagnifier}
                />
                <TextInput
                  ref={searchInputRef}
                  style={styles.searchInput}
                  placeholder="Search bills…"
                  placeholderTextColor={colors.textPlaceholder}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  returnKeyType="search"
                  onSubmitEditing={dismissSearchKeyboard}
                  autoCorrect={false}
                  autoCapitalize="none"
                  accessibilityLabel="Search bills by name"
                  {...(Platform.OS === 'ios' ? { clearButtonMode: 'never' } : {})}
                />
                {searchQuery.length > 0 ? (
                  <Pressable
                    onPress={() => {
                      setSearchQuery('');
                      dismissSearchKeyboard();
                    }}
                    hitSlop={10}
                    style={styles.searchClearBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                  >
                    <Ionicons
                      name="close-circle"
                      size={22}
                      color={colors.textMuted}
                    />
                  </Pressable>
                ) : null}
              </View>
            </View>

            {showEmptyState && !searchActive ? (
              <View style={styles.emptyBlock}>
                <Ionicons
                  name="receipt-outline"
                  size={80}
                  color={colors.primary}
                  style={styles.emptyIcon}
                />
                <Text style={styles.emptyTitle}>No bills yet</Text>
                <Text style={styles.emptySubtitle}>
                  {`Add your first bill and BillMinder will remind you before it's due.`}
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.emptyCta,
                    pressed && styles.emptyCtaPressed,
                  ]}
                  onPress={goToAddBill}
                  accessibilityRole="button"
                  accessibilityLabel="Add your first bill"
                >
                  <Text style={styles.emptyCtaText}>Add Your First Bill</Text>
                </Pressable>
              </View>
            ) : (
              <>
            <Pressable
              onPress={dismissSearchKeyboard}
              style={({ pressed }) => [
                styles.monthlySummaryCard,
                pressed && styles.monthlySummaryPressed,
              ]}
            >
              <Text style={styles.monthlySummaryTitle}>{monthLabel}</Text>
              {(() => {
                const rows =
                  monthlySummary.byCurrency.length > 0
                    ? monthlySummary.byCurrency
                    : [
                        {
                          currency: 'USD',
                          dueMinor: 0,
                          paidMinor: 0,
                          remainingMinor: 0,
                        },
                      ];
                const multi = rows.length > 1;
                if (multi) {
                  const dueLine = rows
                    .map((r) =>
                      formatAmountMinorWithCode(r.dueMinor, r.currency)
                    )
                    .join(' / ');
                  const paidLine = rows
                    .map((r) =>
                      formatAmountMinorWithCode(r.paidMinor, r.currency)
                    )
                    .join(' / ');
                  return (
                    <View style={styles.monthlySummaryStack}>
                      <View style={styles.monthlyStackRow}>
                        <Text style={styles.monthlyStatLabel}>Due</Text>
                        <Text style={styles.monthlyStackValueDue}>{dueLine}</Text>
                      </View>
                      <View style={styles.monthlyStackRow}>
                        <Text style={styles.monthlyStatLabel}>Paid</Text>
                        <Text style={styles.monthlyStackValuePaid}>
                          {paidLine}
                        </Text>
                      </View>
                      <View style={styles.monthlyStackRow}>
                        {monthlySummary.monthAllClear ? (
                          <View style={styles.monthlyAllClearStack}>
                            <Ionicons
                              name="checkmark-circle"
                              size={18}
                              color={colors.success}
                            />
                            <Text style={styles.monthlyAllClearText}>
                              All clear!
                            </Text>
                          </View>
                        ) : (
                          <>
                            <Text style={styles.monthlyStatLabel}>Remaining</Text>
                            <Text style={styles.monthlyStackValueRemaining}>
                              {rows
                                .map((r) =>
                                  formatAmountMinorWithCode(
                                    r.remainingMinor,
                                    r.currency
                                  )
                                )
                                .join(' / ')}
                            </Text>
                          </>
                        )}
                      </View>
                    </View>
                  );
                }
                const r = rows[0];
                return (
                  <View style={styles.monthlySummaryRow}>
                    <View style={styles.monthlyStatCol}>
                      <Text style={styles.monthlyStatLabel}>Due</Text>
                      <Text style={styles.monthlyStatValueDue}>
                        {formatAmountMinor(r.dueMinor, r.currency)}
                      </Text>
                    </View>
                    <View style={styles.monthlyStatCol}>
                      <Text style={styles.monthlyStatLabel}>Paid</Text>
                      <Text style={styles.monthlyStatValuePaid}>
                        {formatAmountMinor(r.paidMinor, r.currency)}
                      </Text>
                    </View>
                    <View style={styles.monthlyStatCol}>
                      {monthlySummary.monthAllClear ? (
                        <View style={styles.monthlyAllClear}>
                          <Ionicons
                            name="checkmark-circle"
                            size={18}
                            color={colors.success}
                          />
                          <Text style={styles.monthlyAllClearText}>All clear!</Text>
                        </View>
                      ) : (
                        <>
                          <Text style={styles.monthlyStatLabel}>Remaining</Text>
                          <Text style={styles.monthlyStatValueRemaining}>
                            {formatAmountMinor(r.remainingMinor, r.currency)}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                );
              })()}
            </Pressable>

            {!searchActive ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabsScrollContent}
              style={styles.tabsScroll}
            >
              {FILTER_KEYS.map((key) => {
                const active = filter === key;
                const count = counts[key];
                const cfg = FILTER_TAB_CONFIG[key];
                const overdueAlert = key === 'overdue' && counts.overdue > 0;
                const iconColor = active
                  ? colors.white
                  : overdueAlert
                    ? colors.danger
                    : colors.textSecondary;
                const countColor = iconColor;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setFilter(key)}
                    style={({ pressed }) => [
                      styles.tabChip,
                      active && styles.tabChipActive,
                      !active &&
                        overdueAlert &&
                        styles.tabChipOverdueAlert,
                      pressed && styles.tabChipPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${cfg.a11y}, ${count} bills`}
                  >
                    <View style={styles.tabChipInner}>
                      <Ionicons name={cfg.icon} size={20} color={iconColor} />
                      <Text
                        style={[
                          styles.tabCount,
                          styles.tabCountSpacing,
                          { color: countColor },
                        ]}
                      >
                        {count}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
            ) : null}

            {!searchActive ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sortPillsScrollContent}
                style={styles.sortPillsScroll}
              >
                {SORT_KEYS.map((key) => {
                  const active = sortBy === key;
                  const cfg = SORT_TAB_CONFIG[key];
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setSortBy(key)}
                      style={({ pressed }) => [
                        styles.sortPill,
                        active && styles.sortPillActive,
                        pressed && styles.tabChipPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={cfg.a11y}
                    >
                      <Text
                        style={[
                          styles.sortPillText,
                          active && styles.sortPillTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {cfg.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            {!searchActive ? (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryFilterScrollContent}
                  style={styles.categoryFilterScroll}
                >
                  {mergedCategories.map((c) => {
                    const active = categoryFilter === c.id;
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() =>
                          setCategoryFilter((prev) =>
                            prev === c.id ? null : c.id
                          )
                        }
                        style={({ pressed }) => [
                          styles.categoryFilterPill,
                          active
                            ? {
                                backgroundColor: c.color,
                                borderColor: c.color,
                              }
                            : {
                                backgroundColor: colors.card,
                                borderColor: c.color,
                              },
                          pressed && styles.tabChipPressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`Filter by ${c.label}`}
                      >
                        <Text
                          style={[
                            styles.categoryFilterPillText,
                            active && styles.categoryFilterPillTextActive,
                            !active && { color: c.color },
                          ]}
                          numberOfLines={1}
                        >
                          {c.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                {categoryFilter != null ? (
                  <View style={styles.categoryMonthlyRow}>
                    <Text style={styles.categoryMonthlyLabel}>
                      Est. monthly ({getCategoryMeta(categoryFilter, customCategories).label})
                    </Text>
                    <Text style={styles.categoryMonthlyValue}>
                      {(categoryMonthlyByCurrency.length > 0
                        ? categoryMonthlyByCurrency
                        : [{ currency: 'USD', minor: 0 }]
                      )
                        .map((x) =>
                          formatAmountMinorWithCode(x.minor, x.currency)
                        )
                        .join(' / ')}
                    </Text>
                  </View>
                ) : null}
              </>
            ) : null}

            <Pressable onPress={dismissSearchKeyboard}>
              <Text style={styles.sectionTitle}>Bills</Text>
            </Pressable>
            <FlatList
              data={sortedListBills}
              keyExtractor={(item) => item.id}
              renderItem={renderBill}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.primary}
                  colors={[colors.primary]}
                />
              }
              ListEmptyComponent={
                searchActive ? (
                  <View style={styles.searchEmptyWrap}>
                    <Ionicons
                      name="search-outline"
                      size={40}
                      color={colors.textBillDueMuted}
                      style={styles.searchEmptyIcon}
                    />
                    <Text style={styles.searchEmptyText}>
                      {`No bills found for "${searchTrimmed}"`}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.filterEmpty}>
                    {categoryFilter
                      ? `No bills matching ${FILTER_DISPLAY_NAME[filter]} in ${getCategoryMeta(categoryFilter, customCategories).label}.`
                      : `No bills matching ${FILTER_DISPLAY_NAME[filter]}.`}
                  </Text>
                )
              }
            />

            <Pressable
              style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
              onPress={goToAddBill}
              accessibilityRole="button"
              accessibilityLabel="Add bill"
            >
              <Ionicons name="add" size={30} color={colors.white} />
            </Pressable>
              </>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: 8,
    paddingBottom: 20,
    backgroundColor: colors.primary,
  },
  headerTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  headerSettingsBtn: {
    padding: 8,
    marginRight: -4,
  },
  headerSettingsBtnPressed: {
    opacity: 0.85,
  },
  notifyBanner: {
    marginHorizontal: layout.screenPaddingHorizontal,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.warningBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  notifyBannerText: {
    fontSize: fontSize.homeNotifyBanner,
    color: colors.warning,
    lineHeight: 18,
    textAlign: 'center',
    fontWeight: fontWeight.semibold,
  },
  appName: {
    fontSize: fontSize.homeAppTitle,
    fontWeight: fontWeight.bold,
    color: colors.white,
    letterSpacing: -0.5,
  },
  month: {
    fontSize: fontSize.homeMonth,
    color: 'rgba(255,255,255,0.88)',
    marginTop: 4,
    fontWeight: fontWeight.medium,
  },
  searchBarOuter: {
    marginHorizontal: layout.screenPaddingHorizontal,
    marginTop: 12,
  },
  searchBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.inputBorderLight,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    minHeight: 44,
  },
  searchMagnifier: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: Platform.OS === 'android' ? 36 : 24,
    fontSize: fontSize.homeSearchInput,
    color: colors.text,
    paddingVertical: Platform.OS === 'android' ? 6 : 0,
  },
  searchClearBtn: {
    marginLeft: 4,
    padding: 2,
  },
  monthlySummaryCard: {
    marginHorizontal: layout.screenPaddingHorizontal,
    marginTop: 12,
    padding: 18,
    backgroundColor: colors.summaryMonthlyTint,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.card,
  },
  monthlySummaryTitle: {
    fontSize: fontSize.homeMonthlyCardTitle,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: 16,
  },
  monthlySummaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  monthlySummaryStack: {
    gap: 12,
  },
  monthlyStackRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  monthlyStackValueDue: {
    flex: 1,
    marginLeft: 12,
    fontSize: fontSize.homeMonthlyMetricValue - 1,
    fontWeight: fontWeight.bold,
    color: colors.danger,
    textAlign: 'right',
  },
  monthlyStackValuePaid: {
    flex: 1,
    marginLeft: 12,
    fontSize: fontSize.homeMonthlyMetricValue - 1,
    fontWeight: fontWeight.bold,
    color: colors.success,
    textAlign: 'right',
  },
  monthlyStackValueRemaining: {
    flex: 1,
    marginLeft: 12,
    fontSize: fontSize.homeMonthlyMetricValue - 1,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    textAlign: 'right',
  },
  monthlyAllClearStack: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
  monthlyStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  monthlyStatLabel: {
    fontSize: fontSize.homeMonthlyMetricLabel,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
    textAlign: 'center',
  },
  monthlyStatValueDue: {
    fontSize: fontSize.homeMonthlyMetricValue,
    fontWeight: fontWeight.bold,
    color: colors.danger,
    textAlign: 'center',
  },
  monthlyStatValuePaid: {
    fontSize: fontSize.homeMonthlyMetricValue,
    fontWeight: fontWeight.bold,
    color: colors.success,
    textAlign: 'center',
  },
  monthlyStatValueRemaining: {
    fontSize: fontSize.homeMonthlyMetricValue,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    textAlign: 'center',
  },
  monthlyAllClear: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
  },
  monthlyAllClearText: {
    marginTop: 6,
    fontSize: fontSize.homeMonthlyMetricLabel,
    fontWeight: fontWeight.bold,
    color: colors.success,
    textAlign: 'center',
  },
  monthlySummaryPressed: {
    opacity: 0.96,
  },
  searchEmptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: layout.screenPaddingHorizontal,
  },
  searchEmptyIcon: {
    marginBottom: 12,
    opacity: 0.85,
  },
  searchEmptyText: {
    fontSize: fontSize.homeSearchEmptyMessage,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  tabsScroll: {
    flexGrow: 0,
  },
  tabsScrollContent: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: 10,
    paddingBottom: 10,
    paddingRight: layout.screenPaddingHorizontal + 4,
    alignItems: 'center',
    flexDirection: 'row',
  },
  tabChip: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    minWidth: 56,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabChipOverdueAlert: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerBackground,
  },
  tabChipPressed: {
    opacity: 0.88,
  },
  tabCount: {
    fontSize: fontSize.homeFilterTab,
    fontWeight: fontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  tabCountSpacing: {
    marginLeft: 4,
  },
  sortPillsScroll: {
    flexGrow: 0,
  },
  sortPillsScrollContent: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: 0,
    paddingBottom: 8,
    paddingRight: layout.screenPaddingHorizontal + 4,
    alignItems: 'center',
    flexDirection: 'row',
  },
  sortPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    minHeight: 32,
    justifyContent: 'center',
  },
  sortPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sortPillText: {
    fontSize: fontSize.homeFilterTab - 1,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  sortPillTextActive: {
    color: colors.white,
  },
  categoryFilterScroll: {
    flexGrow: 0,
  },
  categoryFilterScrollContent: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: 4,
    paddingBottom: 6,
    paddingRight: layout.screenPaddingHorizontal + 4,
    alignItems: 'center',
    flexDirection: 'row',
  },
  categoryFilterPill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 2,
    marginRight: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  categoryFilterPillText: {
    fontSize: fontSize.homeFilterTab - 1,
    fontWeight: fontWeight.semibold,
  },
  categoryFilterPillTextActive: {
    color: colors.white,
  },
  categoryMonthlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingBottom: 8,
    marginTop: -2,
  },
  categoryMonthlyLabel: {
    fontSize: fontSize.homeBillDueDate,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    flex: 1,
    marginRight: 12,
  },
  categoryMonthlyValue: {
    fontSize: fontSize.homeBillAmount - 1,
    fontWeight: fontWeight.bold,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  sectionTitle: {
    fontSize: fontSize.homeSectionTitle,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    paddingHorizontal: layout.screenPaddingHorizontal,
    marginTop: 8,
    marginBottom: 8,
  },
  filterEmpty: {
    textAlign: 'center',
    fontSize: fontSize.homeFilterTab,
    color: colors.textSecondary,
    paddingVertical: 24,
    paddingHorizontal: layout.screenPaddingHorizontal,
  },
  listContent: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingBottom: 100,
  },
  rowCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderLeftWidth: 4,
    marginBottom: 10,
    ...shadows.billListRow,
  },
  rowCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowMain: {
    flex: 1,
  },
  billName: {
    fontSize: fontSize.homeBillName,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  rowCategoryChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
  },
  rowCategoryChipText: {
    fontSize: fontSize.homeBillDueDate - 1,
    fontWeight: fontWeight.semibold,
  },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  dueCalendarIcon: {
    marginRight: 6,
  },
  dueDate: {
    fontSize: fontSize.homeBillDueDate,
    fontWeight: fontWeight.regular,
    color: colors.textBillDueMuted,
    flexShrink: 1,
  },
  amount: {
    fontSize: fontSize.homeBillAmount,
    fontWeight: fontWeight.bold,
    textAlign: 'right',
    marginRight: 8,
    minWidth: 64,
  },
  rowRepeatIcon: {
    marginRight: 4,
  },
  rowChevron: {
    marginLeft: 2,
  },
  fab: {
    position: 'absolute',
    right: layout.screenPaddingHorizontal,
    bottom: Platform.OS === 'ios' ? 28 : 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.fab,
  },
  fabPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  skeletonWrap: {
    flex: 1,
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: 16,
    paddingBottom: 24,
  },
  skeletonCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.borderSubtle,
    marginBottom: 10,
    overflow: 'hidden',
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  skeletonMain: {
    flex: 1,
    marginRight: 12,
  },
  skeletonTitle: {
    height: 17,
    width: '62%',
    borderRadius: 6,
    backgroundColor: colors.borderSubtle,
  },
  skeletonChip: {
    height: 22,
    width: '36%',
    borderRadius: 8,
    backgroundColor: colors.summaryMonthlyTint,
    marginTop: 10,
  },
  skeletonDue: {
    height: 13,
    width: '48%',
    borderRadius: 6,
    backgroundColor: colors.borderSubtle,
    marginTop: 10,
  },
  skeletonAmount: {
    width: 72,
    height: 20,
    borderRadius: 6,
    backgroundColor: colors.borderSubtle,
  },
  emptyBlock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingBottom: 48,
  },
  emptyIcon: {
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: fontSize.homeEmptyTitle,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: fontSize.homeEmptySubtitle,
    fontWeight: fontWeight.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
    marginBottom: 28,
  },
  emptyCta: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  emptyCtaPressed: {
    opacity: 0.9,
  },
  emptyCtaText: {
    color: colors.white,
    fontSize: fontSize.homeAllClear,
    fontWeight: fontWeight.semibold,
  },
});
