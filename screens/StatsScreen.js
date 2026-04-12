import { useMemo, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import Svg, { Circle, G } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useBills } from '../context/BillsContext';
import { useCategories } from '../context/CategoriesContext';
import { useSettings } from '../context/SettingsContext';
import {
  addMonth,
  formatMonthYear,
  isSameMonth,
  startOfDay,
} from '../utils/billUtils';
import {
  getCategoryMeta,
  normalizeCategoryInput,
} from '../utils/billCategories';
import { formatAmountMinor, normalizeCurrency } from '../utils/currencies';
import { colors, fontSize, fontWeight, layout, shadows } from '../theme';

const CHART_RADIUS = 102;
const TREND_BAR_TRACK_HEIGHT = 128;
const PAY_RING_SIZE = 152;
const PAY_RING_STROKE = 14;

function PaymentProgressRing({ pct }) {
  const size = PAY_RING_SIZE;
  const stroke = PAY_RING_STROKE;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = Math.min(1, Math.max(0, pct / 100));
  const dashOffset = circumference * (1 - progress);

  return (
    <View style={paymentRingStyles.wrap}>
      <Svg width={size} height={size} style={paymentRingStyles.svg}>
        <G rotation="-90" origin={`${cx}, ${cy}`}>
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={colors.summaryMonthlyTint}
            strokeWidth={stroke}
            fill="none"
          />
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={colors.success}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      <View style={paymentRingStyles.center} pointerEvents="none">
        <Text style={paymentRingStyles.pct}>{pct}</Text>
        <Text style={paymentRingStyles.pctSub}>% paid</Text>
      </View>
    </View>
  );
}

const paymentRingStyles = StyleSheet.create({
  wrap: {
    width: PAY_RING_SIZE,
    height: PAY_RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  svg: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
  pct: {
    fontSize: 36,
    fontWeight: fontWeight.bold,
    color: colors.text,
    ...Platform.select({
      ios: { fontVariant: ['tabular-nums'] },
      default: {},
    }),
  },
  pctSub: {
    marginTop: 2,
    fontSize: fontSize.homeMonthlyMetricLabel,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
});

export default function StatsScreen() {
  const { bills } = useBills();
  const { customCategories } = useCategories();
  const { defaultCurrency } = useSettings();

  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const shiftMonth = useCallback((delta) => {
    setViewMonth((m) => addMonth(new Date(m.getFullYear(), m.getMonth(), 1), delta));
  }, []);

  const {
    rows,
    totalMinor,
    displayCurrency,
    emptyReason,
    dueMinor,
    paidMinor,
    remainingMinor,
    pctPaid,
  } = useMemo(() => {
    const def = normalizeCurrency(defaultCurrency);
    const inMonth = bills.filter((b) =>
      isSameMonth(new Date(b.due), viewMonth)
    );
    const chartBills = inMonth.filter(
      (b) => normalizeCurrency(b.currency) === def
    );

    let emptyReason = null;
    if (inMonth.length === 0) {
      emptyReason = 'none';
    } else if (chartBills.length === 0) {
      emptyReason = 'currency';
    }

    const map = new Map();
    for (const b of chartBills) {
      const catId = normalizeCategoryInput(b.category, customCategories);
      const prev = map.get(catId) || 0;
      map.set(catId, prev + (Number(b.amountCents) || 0));
    }

    const list = [...map.entries()]
      .map(([categoryId, minor]) => {
        const meta = getCategoryMeta(categoryId, customCategories);
        return {
          categoryId,
          label: meta.label,
          color: meta.color,
          minor,
        };
      })
      .filter((r) => r.minor > 0)
      .sort((a, b) => b.minor - a.minor);

    const totalMinor = list.reduce((s, r) => s + r.minor, 0);

    const dueMinor = chartBills.reduce(
      (s, b) => s + (Number(b.amountCents) || 0),
      0
    );
    const paidMinor = chartBills
      .filter((b) => b.paid)
      .reduce((s, b) => s + (Number(b.amountCents) || 0), 0);
    const remainingMinor = Math.max(0, dueMinor - paidMinor);
    const pctPaid =
      dueMinor > 0
        ? Math.min(100, Math.round((paidMinor / dueMinor) * 100))
        : 0;

    return {
      rows: list,
      totalMinor,
      displayCurrency: def,
      emptyReason,
      dueMinor,
      paidMinor,
      remainingMinor,
      pctPaid,
    };
  }, [bills, viewMonth, customCategories, defaultCurrency]);

  const pieData = useMemo(
    () =>
      rows.map((r) => ({
        value: r.minor,
        color: r.color,
      })),
    [rows]
  );

  const { trendMonths, maxTrendMinor, summaryLine } = useMemo(() => {
    const def = normalizeCurrency(defaultCurrency);
    const now = new Date();
    const curStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const months = [];
    for (let off = 5; off >= 0; off--) {
      const monthStart = addMonth(curStart, -off);
      const billsIn = bills.filter(
        (b) =>
          isSameMonth(new Date(b.due), monthStart) &&
          normalizeCurrency(b.currency) === def
      );
      const totalMinor = billsIn.reduce(
        (s, b) => s + (Number(b.amountCents) || 0),
        0
      );
      const shortLabel = monthStart.toLocaleDateString('en-US', {
        month: 'short',
      });
      months.push({
        monthStart,
        shortLabel,
        totalMinor,
        isCurrent: off === 0,
      });
    }

    const maxTrendMinor = Math.max(1, ...months.map((m) => m.totalMinor));

    const fmt = (minor) => formatAmountMinor(minor, def);

    const cur = months[5];
    const prev = months[4];
    const curName = cur.monthStart.toLocaleDateString('en-US', {
      month: 'long',
    });
    const prevName = prev.monthStart.toLocaleDateString('en-US', {
      month: 'long',
    });

    let summaryText = '';
    let summaryColor = colors.textSecondary;
    if (prev.totalMinor === 0 && cur.totalMinor === 0) {
      summaryText = `${curName}: ${fmt(0)} — same as ${prevName}`;
    } else if (prev.totalMinor === 0 && cur.totalMinor > 0) {
      summaryText = `${curName}: ${fmt(cur.totalMinor)} — new vs ${prevName} (${fmt(0)}; no prior spend to compare %)`;
      summaryColor = colors.danger;
    } else {
      const delta = cur.totalMinor - prev.totalMinor;
      const pct =
        prev.totalMinor > 0
          ? Math.round((Math.abs(delta) / prev.totalMinor) * 1000) / 10
          : 0;
      if (delta < 0) {
        summaryText = `${curName}: ${fmt(cur.totalMinor)} — down ${pct}% vs ${prevName}`;
        summaryColor = colors.success;
      } else if (delta > 0) {
        summaryText = `${curName}: ${fmt(cur.totalMinor)} — up ${pct}% vs ${prevName}`;
        summaryColor = colors.danger;
      } else {
        summaryText = `${curName}: ${fmt(cur.totalMinor)} — same as ${prevName}`;
      }
    }

    return {
      trendMonths: months,
      maxTrendMinor,
      summaryLine: { text: summaryText, color: summaryColor },
    };
  }, [bills, defaultCurrency]);

  const insightChips = useMemo(() => {
    const def = normalizeCurrency(defaultCurrency);
    const todayStart = startOfDay(new Date());
    const chips = [];

    const overdueCount = bills.filter(
      (b) => !b.paid && startOfDay(new Date(b.due)) < todayStart
    ).length;
    if (overdueCount > 0) {
      chips.push({
        key: 'overdue',
        text: `${overdueCount} overdue bill${overdueCount === 1 ? '' : 's'}`,
        tone: 'danger',
      });
    }

    const prevMonthStart = addMonth(viewMonth, -1);
    const sumDueInMonth = (monthStart) =>
      bills
        .filter(
          (b) =>
            isSameMonth(new Date(b.due), monthStart) &&
            normalizeCurrency(b.currency) === def
        )
        .reduce((s, b) => s + (Number(b.amountCents) || 0), 0);

    const curSpend = sumDueInMonth(viewMonth);
    const prevSpend = sumDueInMonth(prevMonthStart);

    if (curSpend !== prevSpend) {
      if (prevSpend === 0 && curSpend > 0) {
        chips.push({
          key: 'mom',
          text: 'Spending up — new vs last month (was $0)',
          tone: 'warning',
        });
      } else if (prevSpend > 0) {
        const deltaPct =
          Math.round(((curSpend - prevSpend) / prevSpend) * 1000) / 10;
        if (deltaPct > 0) {
          chips.push({
            key: 'mom',
            text: `Spending up ${deltaPct}% vs last month`,
            tone: 'warning',
          });
        } else if (deltaPct < 0) {
          chips.push({
            key: 'mom',
            text: `Spending down ${Math.abs(deltaPct)}% vs last month`,
            tone: 'success',
          });
        }
      }
    }

    if (rows.length > 0 && totalMinor > 0) {
      const top = rows[0];
      const catPct =
        Math.round((top.minor / totalMinor) * 1000) / 10;
      chips.push({
        key: 'topcat',
        text: `${top.label} is ${catPct}% of spending`,
        tone: 'primary',
      });
    }

    const billsInViewMonth = bills.filter(
      (b) =>
        isSameMonth(new Date(b.due), viewMonth) &&
        normalizeCurrency(b.currency) === def
    );
    if (
      billsInViewMonth.length > 0 &&
      billsInViewMonth.every((b) => b.paid)
    ) {
      chips.push({
        key: 'allclear',
        text: 'All clear — nothing due!',
        tone: 'success',
      });
    }

    return chips.slice(0, 4);
  }, [bills, viewMonth, defaultCurrency, rows, totalMinor]);

  const monthTitle = formatMonthYear(viewMonth);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.screenTitle}>Spending by category</Text>
      <Text style={styles.subtitle}>
        Bills due in the selected month, grouped by category.
      </Text>

      <View style={styles.monthPickerCard}>
        <Text style={styles.monthPickerCaption}>
          Month for category donut and breakdown
        </Text>
        <View style={styles.monthPickerRow}>
          <Pressable
            onPress={() => shiftMonth(-1)}
            style={({ pressed }) => [
              styles.monthArrow,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
          >
            <Ionicons name="chevron-back" size={26} color={colors.primary} />
          </Pressable>
          <Text style={styles.monthLabel}>{monthTitle}</Text>
          <Pressable
            onPress={() => shiftMonth(1)}
            style={({ pressed }) => [
              styles.monthArrow,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Next month"
          >
            <Ionicons name="chevron-forward" size={26} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      {emptyReason === 'currency' ? (
        <Text style={styles.emptyNote}>
          {`No bills due in ${monthTitle} in ${normalizeCurrency(defaultCurrency)}. Change default currency in Settings or pick another month.`}
        </Text>
      ) : null}

      {rows.length === 0 ? (
        <View style={styles.emptyChart}>
          <Ionicons
            name="pie-chart-outline"
            size={56}
            color={colors.textMuted}
          />
          <Text style={styles.emptyChartText}>
            {emptyReason === 'none'
              ? `No bills due in ${monthTitle}.`
              : 'Nothing to chart for this month.'}
          </Text>
        </View>
      ) : (
        <View style={styles.chartWrap}>
          <PieChart
            data={pieData}
            donut
            radius={CHART_RADIUS}
            innerRadius={62}
            innerCircleColor={colors.card}
            extraRadius={0}
            paddingHorizontal={10}
            paddingVertical={14}
            isAnimated
            centerLabelComponent={() => (
              <View style={styles.centerLabel}>
                <Text style={styles.centerLabelCaption}>Total</Text>
                <Text style={styles.centerLabelAmount} numberOfLines={2}>
                  {formatAmountMinor(totalMinor, displayCurrency)}
                </Text>
              </View>
            )}
          />
        </View>
      )}

      <Text style={styles.trendSectionTitle}>Six-month trend</Text>
      <Text style={styles.trendHint}>
        Totals for bills due in each month ({normalizeCurrency(defaultCurrency)}).
      </Text>
      <View style={styles.trendChartCard}>
        <View style={styles.trendBarsRow}>
          {trendMonths.map((m) => {
            const ratio =
              maxTrendMinor > 0 ? m.totalMinor / maxTrendMinor : 0;
            const fillHeight =
              m.totalMinor <= 0
                ? 0
                : Math.max(6, Math.round(ratio * TREND_BAR_TRACK_HEIGHT));
            const fillColor = m.isCurrent ? colors.success : colors.primary;
            return (
              <View
                key={`${m.monthStart.getFullYear()}-${m.monthStart.getMonth()}`}
                style={styles.trendCol}
              >
                <Text style={styles.trendAmountAbove} numberOfLines={1}>
                  {formatAmountMinor(
                    m.totalMinor,
                    normalizeCurrency(defaultCurrency)
                  )}
                </Text>
                <View style={styles.trendBarTrack}>
                  <View
                    style={[
                      styles.trendBarFill,
                      {
                        height: fillHeight,
                        backgroundColor: fillColor,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.trendMonthBelow}>{m.shortLabel}</Text>
              </View>
            );
          })}
        </View>
      </View>
      <Text style={[styles.trendSummary, { color: summaryLine.color }]}>
        {summaryLine.text}
      </Text>

      <Text style={styles.paymentSectionTitle}>Payment progress</Text>
      <Text style={styles.paymentSectionHint}>
        {`Totals for bills due in ${monthTitle} (${displayCurrency}).`}
      </Text>
      <View style={styles.paymentCard}>
        <PaymentProgressRing pct={pctPaid} />
        <View style={styles.paymentStatsRow}>
          <View style={styles.paymentStatCol}>
            <Text style={styles.paymentStatLabel}>Total due</Text>
            <Text
              style={[styles.paymentStatValue, { color: colors.danger }]}
              numberOfLines={1}
            >
              {formatAmountMinor(dueMinor, displayCurrency)}
            </Text>
          </View>
          <View style={styles.paymentStatCol}>
            <Text style={styles.paymentStatLabel}>Total paid</Text>
            <Text
              style={[styles.paymentStatValue, { color: colors.success }]}
              numberOfLines={1}
            >
              {formatAmountMinor(paidMinor, displayCurrency)}
            </Text>
          </View>
          <View style={styles.paymentStatCol}>
            <Text style={styles.paymentStatLabel}>Remaining</Text>
            <Text
              style={[styles.paymentStatValue, { color: colors.primary }]}
              numberOfLines={1}
            >
              {formatAmountMinor(remainingMinor, displayCurrency)}
            </Text>
          </View>
        </View>
      </View>

      {insightChips.length > 0 ? (
        <>
          <Text style={styles.insightsSectionTitle}>Insights</Text>
          <View style={styles.insightsChipsRow}>
            {insightChips.map((chip) => (
              <View
                key={chip.key}
                style={[
                  styles.insightChip,
                  chip.tone === 'danger' && styles.insightChipDanger,
                  chip.tone === 'warning' && styles.insightChipWarning,
                  chip.tone === 'success' && styles.insightChipSuccess,
                  chip.tone === 'primary' && styles.insightChipPrimary,
                ]}
              >
                <Text
                  style={[
                    styles.insightChipText,
                    chip.tone === 'danger' && styles.insightChipTextDanger,
                    chip.tone === 'warning' && styles.insightChipTextWarning,
                    chip.tone === 'success' && styles.insightChipTextSuccess,
                    chip.tone === 'primary' && styles.insightChipTextPrimary,
                  ]}
                  numberOfLines={2}
                >
                  {chip.text}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {rows.length > 0 ? (
        <>
          <Text style={styles.legendTitle}>Breakdown</Text>
          <View style={styles.legendCard}>
            {rows.map((r, i) => {
              const pct =
                totalMinor > 0
                  ? Math.round((r.minor / totalMinor) * 1000) / 10
                  : 0;
              return (
                <View
                  key={r.categoryId}
                  style={[styles.legendRow, i > 0 && styles.legendRowBorder]}
                >
                  <View
                    style={[styles.legendSwatch, { backgroundColor: r.color }]}
                  />
                  <View style={styles.legendMain}>
                    <Text style={styles.legendName}>{r.label}</Text>
                    <Text style={styles.legendMeta}>
                      {formatAmountMinor(r.minor, displayCurrency)} · {pct}%
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: 12,
    paddingBottom: 48,
  },
  screenTitle: {
    fontSize: fontSize.statsTitle,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: fontSize.statsSubtitle,
    fontWeight: fontWeight.regular,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 20,
  },
  monthPickerCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 20,
    ...shadows.card,
  },
  monthPickerCaption: {
    fontSize: fontSize.homeBillDueDate - 1,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  monthPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthArrow: {
    padding: 8,
    minWidth: 44,
    alignItems: 'center',
  },
  monthLabel: {
    flex: 1,
    fontSize: fontSize.detailSectionTitle,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
    paddingHorizontal: 4,
    ...Platform.select({
      ios: { fontVariant: ['tabular-nums'] },
      default: {},
    }),
  },
  pressed: {
    opacity: 0.75,
  },
  emptyNote: {
    fontSize: fontSize.detailMetadata,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  chartWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    minHeight: CHART_RADIUS * 2 + 36,
    paddingVertical: 8,
  },
  centerLabel: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    maxWidth: CHART_RADIUS * 1.25,
  },
  centerLabelCaption: {
    fontSize: fontSize.homeMonthlyMetricLabel,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  centerLabelAmount: {
    fontSize: fontSize.homeMonthlyMetricValue - 2,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  legendTitle: {
    fontSize: fontSize.detailSectionTitle,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    marginBottom: 10,
  },
  legendCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
    ...shadows.card,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  legendRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
  },
  legendSwatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 12,
  },
  legendMain: {
    flex: 1,
    minWidth: 0,
  },
  legendName: {
    fontSize: fontSize.detailMetadata,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: 4,
  },
  legendMeta: {
    fontSize: fontSize.homeBillDueDate,
    fontWeight: fontWeight.regular,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  emptyChart: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyChartText: {
    marginTop: 12,
    fontSize: fontSize.statsSubtitle,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  trendSectionTitle: {
    fontSize: fontSize.detailSectionTitle,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    marginTop: 8,
    marginBottom: 6,
  },
  trendHint: {
    fontSize: fontSize.detailMetadata,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  trendChartCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: 16,
    paddingHorizontal: 6,
    marginBottom: 12,
    ...shadows.card,
  },
  trendBarsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  trendCol: {
    flex: 1,
    alignItems: 'center',
    maxWidth: 72,
    minWidth: 0,
  },
  trendAmountAbove: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
    width: '100%',
  },
  trendBarTrack: {
    width: '78%',
    height: TREND_BAR_TRACK_HEIGHT,
    borderRadius: 6,
    backgroundColor: colors.summaryMonthlyTint,
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    overflow: 'hidden',
  },
  trendBarFill: {
    width: '100%',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  trendMonthBelow: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  trendSummary: {
    fontSize: fontSize.detailMetadata,
    fontWeight: fontWeight.semibold,
    lineHeight: 22,
    marginBottom: 16,
  },
  paymentSectionTitle: {
    fontSize: fontSize.detailSectionTitle,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    marginTop: 4,
    marginBottom: 6,
  },
  paymentSectionHint: {
    fontSize: fontSize.detailMetadata,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  paymentCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: 20,
    paddingHorizontal: 12,
    marginBottom: 24,
    ...shadows.card,
  },
  paymentStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingHorizontal: 4,
  },
  paymentStatCol: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  paymentStatLabel: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: 6,
    textAlign: 'center',
  },
  paymentStatValue: {
    fontSize: fontSize.homeBillDueDate,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    ...Platform.select({
      ios: { fontVariant: ['tabular-nums'] },
      default: {},
    }),
  },
  insightsSectionTitle: {
    fontSize: fontSize.detailSectionTitle,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    marginBottom: 12,
  },
  insightsChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  insightChip: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    maxWidth: '100%',
  },
  insightChipDanger: {
    backgroundColor: colors.dangerBackground,
    borderColor: colors.dangerBorder,
  },
  insightChipWarning: {
    backgroundColor: colors.warningBackground,
    borderColor: colors.warningBorder,
  },
  insightChipSuccess: {
    backgroundColor: colors.successBackground,
    borderColor: colors.successBorder,
  },
  insightChipPrimary: {
    backgroundColor: colors.primaryMutedBackground,
    borderColor: colors.borderSubtle,
  },
  insightChipText: {
    fontSize: fontSize.homeBillDueDate,
    fontWeight: fontWeight.semibold,
    lineHeight: 18,
  },
  insightChipTextDanger: {
    color: colors.danger,
  },
  insightChipTextWarning: {
    color: colors.warning,
  },
  insightChipTextSuccess: {
    color: colors.success,
  },
  insightChipTextPrimary: {
    color: colors.primary,
  },
});
