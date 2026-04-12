import { Platform } from 'react-native';

/**
 * BillMinder design tokens — use these instead of hard-coded colours.
 */
export const colors = {
  primary: '#4660AF',
  danger: '#D94040',
  success: '#2EA05A',
  warning: '#D48228',

  background: '#F5F6FA',
  card: '#FFFFFF',
  white: '#FFFFFF',

  /** Primary text (replaces slate-900 style) */
  text: '#1E2433',
  /** Secondary labels, subtitles */
  textSecondary: '#5A6478',
  /** Muted / captions / inactive icons */
  textMuted: '#7A8499',
  /** Home bill list due date line */
  textBillDueMuted: '#8A8FA8',
  /** Placeholders */
  textPlaceholder: '#9AA3B8',

  /** Borders and dividers */
  border: '#D8DCE8',
  borderSubtle: '#E8EBF2',

  /** Input / elevated fields on background */
  inputBackground: '#FFFFFF',

  /** Light tints for pills and banners */
  dangerBackground: '#FDECEC',
  dangerBorder: '#F5C4C4',
  successBackground: '#E8F5ED',
  successBorder: '#B8DCC4',
  warningBackground: '#FDF4EB',
  warningBorder: '#EDD4B8',
  primaryMutedBackground: '#EEF1FA',

  /** Home monthly summary card (subtle blue tint) */
  summaryMonthlyTint: '#E8ECF7',

  /** Modal overlay (tinted with primary) */
  overlayScrim: 'rgba(70, 96, 175, 0.35)',

  /** Home bill row left accent when paid (grey) */
  billRowPaidAccent: '#B4B8C8',

  /** Add form: light grey field outline */
  inputBorderLight: '#E0E3EB',
};

export const shadows = {
  /** White cards on the main background */
  card: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
    },
    android: {
      elevation: 3,
    },
    default: {},
  }),
  fab: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
    },
    android: {
      elevation: 6,
    },
    default: {},
  }),
  footer: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
    },
    android: {
      elevation: 8,
    },
    default: {},
  }),
  /** Home bill list row — elevated card */
  billListRow: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    android: {
      elevation: 2,
    },
    default: {},
  }),
};

/** Horizontal inset for main screen content */
export const layout = {
  screenPaddingHorizontal: 16,
  addBillFieldGap: 20,
};

/**
 * Typography — point sizes for RN `fontSize` (density-independent).
 */
export const fontSize = {
  /** HomeScreen */
  homeNotifyBanner: 13,
  homeAppTitle: 28,
  homeMonth: 16,
  homeSummaryLabel: 14,
  homeSummaryAmount: 32,
  homeMonthlyCardTitle: 18,
  homeMonthlyMetricLabel: 12,
  homeMonthlyMetricValue: 17,
  homeSearchInput: 16,
  homeSearchEmptyMessage: 15,
  homeOverduePill: 14,
  homeAllClear: 15,
  homeSectionTitle: 18,
  homeBillName: 17,
  homeBillDueDate: 13,
  homeBillAmount: 17,
  homeEmptyTitle: 20,
  homeEmptySubtitle: 15,
  homeFilterTab: 14,

  /** AddBillScreen */
  addBillLabel: 15,
  addBillInput: 16,
  addBillDateHint: 13,
  addBillChevron: 12,
  addBillSave: 17,
  addBillModalTitle: 16,
  addBillModalTitleCenter: 17,
  addBillModalAction: 16,
  addBillPickerItem: 18,
  addBillModalPrimary: 17,

  /** BillDetailScreen */
  detailTitle: 22,
  detailAmount: 16,
  detailMetadata: 13,
  detailSectionTitle: 18,
  detailHistoryMonth: 16,
  detailHistoryPill: 13,
  detailFooterBtn: 17,
  detailMissingBody: 17,
  detailMissingBtn: 16,

  /** StatsScreen */
  statsTitle: 24,
  statsSubtitle: 16,
};

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};

/** Home list amount colour by `billStatus` / `STATUS` value */
export function billListAmountColor(status) {
  switch (status) {
    case 'overdue':
      return colors.danger;
    case 'dueSoon':
      return colors.warning;
    case 'paid':
      return colors.success;
    default:
      return colors.primary;
  }
}

/** Home bill card left border — overdue / due soon / upcoming / paid */
export function billRowLeftBorderColor(status) {
  switch (status) {
    case 'overdue':
      return colors.danger;
    case 'dueSoon':
      return colors.warning;
    case 'paid':
      return colors.billRowPaidAccent;
    default:
      return colors.primary;
  }
}
