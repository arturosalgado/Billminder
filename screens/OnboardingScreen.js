import { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight } from '../theme';

export const HAS_ONBOARDED_KEY = 'hasOnboarded';

const GRADIENT_COLORS = ['#141C33', '#243A72', colors.primary];

const CHECKLIST = [
  'Add your bills once',
  'Get reminded automatically',
  'Track your spending visually',
];

export default function OnboardingScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);
  const [page, setPage] = useState(0);
  const [finishing, setFinishing] = useState(false);

  const markDone = useCallback(async () => {
    await AsyncStorage.setItem(HAS_ONBOARDED_KEY, 'true');
  }, []);

  const skipToHome = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      await markDone();
      navigation.replace('Main');
    } finally {
      setFinishing(false);
    }
  }, [finishing, markDone, navigation]);

  const addFirstBill = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      await markDone();
      navigation.replace('Main', {
        screen: 'AddBillTab',
        params: { screen: 'AddBill' },
      });
    } finally {
      setFinishing(false);
    }
  }, [finishing, markDone, navigation]);

  const onScrollEnd = useCallback(
    (e) => {
      const x = e.nativeEvent.contentOffset.x;
      const next = Math.round(x / Math.max(1, width));
      setPage(Math.min(2, Math.max(0, next)));
    },
    [width]
  );

  const goToPage = useCallback(
    (index) => {
      scrollRef.current?.scrollTo({
        x: index * width,
        animated: true,
      });
      setPage(index);
    },
    [width]
  );

  const topPad = Math.max(insets.top, 12);

  return (
    <LinearGradient colors={GRADIENT_COLORS} style={styles.gradient}>
      <View style={[styles.skipRow, { paddingTop: topPad }]}>
        <Pressable
          onPress={skipToHome}
          disabled={finishing}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Skip onboarding"
          style={({ pressed }) => [styles.skipPress, pressed && styles.pressed]}
        >
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        decelerationRate="fast"
        keyboardShouldPersistTaps="handled"
        onMomentumScrollEnd={onScrollEnd}
        onScrollEndDrag={onScrollEnd}
        style={styles.pager}
        contentContainerStyle={styles.pagerContent}
      >
        <View style={[styles.page, { width }]}>
          <View style={styles.pageInner}>
            <Ionicons
              name="wallet"
              size={112}
              color="rgba(255,255,255,0.92)"
              style={styles.heroIcon}
            />
            <Text style={styles.heading}>Never miss a bill</Text>
            <Text style={styles.subtitle}>
              BillMinder reminds you before every due date — even when the app
              is closed.
            </Text>
          </View>
        </View>

        <View style={[styles.page, { width }]}>
          <View style={styles.pageInner}>
            <Ionicons
              name="clipboard"
              size={88}
              color="rgba(255,255,255,0.88)"
              style={styles.checklistHero}
            />
            <View style={styles.checklistCard}>
              {CHECKLIST.map((line, index) => (
                <View
                  key={line}
                  style={[
                    styles.checkRow,
                    index === CHECKLIST.length - 1 && styles.checkRowLast,
                  ]}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={26}
                    color={colors.success}
                    style={styles.checkIcon}
                  />
                  <Text style={styles.checkText}>{line}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={[styles.page, { width }]}>
          <View style={styles.pageInner}>
            <Text style={styles.heading}>{"You're ready to go"}</Text>
            <Text style={styles.subtitle}>
              Set up your first bill now and BillMinder takes it from there.
            </Text>
            <Pressable
              onPress={addFirstBill}
              disabled={finishing}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && styles.primaryBtnPressed,
                finishing && styles.primaryBtnDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Add my first bill"
            >
              <Text style={styles.primaryBtnText}>Add My First Bill</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <View
        style={[styles.dotsRow, { paddingBottom: Math.max(insets.bottom, 20) }]}
      >
        {[0, 1, 2].map((i) => (
          <Pressable
            key={String(i)}
            onPress={() => goToPage(i)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Go to step ${i + 1} of 3`}
            style={styles.dotHit}
          >
            <View
              style={[styles.dot, i === page ? styles.dotActive : styles.dotIdle]}
            />
          </Pressable>
        ))}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  skipRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  skipPress: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  pressed: {
    opacity: 0.75,
  },
  skipText: {
    fontSize: fontSize.detailMetadata + 1,
    fontWeight: fontWeight.semibold,
    color: 'rgba(255,255,255,0.88)',
    textDecorationLine: 'underline',
  },
  pager: {
    flex: 1,
  },
  pagerContent: {
    flexGrow: 1,
  },
  page: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  pageInner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 24,
  },
  heroIcon: {
    alignSelf: 'center',
    marginBottom: 28,
  },
  heading: {
    fontSize: 28,
    fontWeight: fontWeight.bold,
    color: colors.white,
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 34,
    ...Platform.select({
      ios: { fontVariant: ['proportional-nums'] },
      default: {},
    }),
  },
  subtitle: {
    fontSize: fontSize.statsSubtitle,
    fontWeight: fontWeight.regular,
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 340,
    alignSelf: 'center',
  },
  checklistHero: {
    alignSelf: 'center',
    marginBottom: 24,
  },
  checklistCard: {
    marginTop: 0,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    maxWidth: 360,
    alignSelf: 'center',
    width: '100%',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  checkRowLast: {
    borderBottomWidth: 0,
  },
  checkIcon: {
    marginRight: 14,
  },
  checkText: {
    flex: 1,
    fontSize: fontSize.statsSubtitle,
    fontWeight: fontWeight.semibold,
    color: colors.white,
    lineHeight: 22,
  },
  primaryBtn: {
    marginTop: 28,
    maxWidth: 340,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: colors.white,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
  },
  primaryBtnPressed: {
    opacity: 0.92,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    fontSize: fontSize.addBillSave,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 12,
    gap: 10,
  },
  dotHit: {
    padding: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotIdle: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    backgroundColor: colors.white,
    width: 22,
    borderRadius: 4,
  },
});
