/* eslint-disable import/no-duplicates -- RNGH requires side-effect import before named */
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
/* eslint-enable import/no-duplicates */
import { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { BillsProvider } from './context/BillsContext';
import { SettingsProvider } from './context/SettingsContext';
import { NotificationPermissionProvider } from './context/NotificationPermissionContext';
import NotificationResponseBridge from './components/NotificationResponseBridge';
import HomeScreen from './screens/HomeScreen';
import AddBillScreen from './screens/AddBillScreen';
import BillDetailScreen from './screens/BillDetailScreen';
import NotificationSettingsScreen from './screens/NotificationSettingsScreen';
import SettingsScreen from './screens/SettingsScreen';
import CategoriesScreen from './screens/CategoriesScreen';
import StatsScreen from './screens/StatsScreen';
import OnboardingScreen, { HAS_ONBOARDED_KEY } from './screens/OnboardingScreen';
import { colors } from './theme';

const INACTIVE_TAB = colors.textMuted;

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.card,
    text: colors.text,
    border: colors.borderSubtle,
    notification: colors.primary,
  },
};

const RootStack = createNativeStackNavigator();
const HomeStack = createNativeStackNavigator();
const AddStack = createNativeStackNavigator();
const StatsStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const stackAnim = {
  animation: 'slide_from_right',
  gestureEnabled: true,
  fullScreenGestureEnabled: true,
};

const headerScreenOptions = {
  headerStyle: { backgroundColor: colors.primary },
  headerTintColor: colors.white,
  headerTitleStyle: { fontWeight: '600' },
  headerShadowVisible: true,
  contentStyle: { backgroundColor: colors.background },
};

function HeaderBackButton({ navigation }) {
  return (
    <Pressable
      onPress={() => navigation.goBack()}
      style={styles.headerBack}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Back to dashboard"
    >
      <Ionicons
        name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
        size={Platform.OS === 'ios' ? 28 : 24}
        color={colors.white}
      />
    </Pressable>
  );
}

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ ...headerScreenOptions, ...stackAnim }}>
      <HomeStack.Screen
        name="Dashboard"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <HomeStack.Screen
        name="BillDetail"
        component={BillDetailScreen}
        options={({ navigation }) => ({
          title: 'Bill details',
          headerBackTitleVisible: false,
          headerLeft: () => <HeaderBackButton navigation={navigation} />,
        })}
      />
      <HomeStack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={({ navigation }) => ({
          title: 'Notifications',
          headerBackTitleVisible: false,
          headerLeft: () => <HeaderBackButton navigation={navigation} />,
        })}
      />
      <HomeStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={({ navigation }) => ({
          title: 'Settings',
          headerBackTitleVisible: false,
          headerLeft: () => <HeaderBackButton navigation={navigation} />,
        })}
      />
      <HomeStack.Screen
        name="Categories"
        component={CategoriesScreen}
        options={({ navigation }) => ({
          title: 'Categories',
          headerBackTitleVisible: false,
          headerLeft: () => <HeaderBackButton navigation={navigation} />,
        })}
      />
    </HomeStack.Navigator>
  );
}

function AddStackNavigator() {
  return (
    <AddStack.Navigator screenOptions={{ ...headerScreenOptions, ...stackAnim }}>
      <AddStack.Screen
        name="AddBill"
        component={AddBillScreen}
        options={{ title: 'Add bill' }}
      />
    </AddStack.Navigator>
  );
}

function StatsStackNavigator() {
  return (
    <StatsStack.Navigator screenOptions={{ ...headerScreenOptions, ...stackAnim }}>
      <StatsStack.Screen
        name="StatsMain"
        component={StatsScreen}
        options={{ title: 'Charts' }}
      />
    </StatsStack.Navigator>
  );
}

function AppNavigator() {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = await AsyncStorage.getItem(HAS_ONBOARDED_KEY);
        if (!cancelled) {
          setInitialRoute(v === 'true' ? 'Main' : 'Onboarding');
        }
      } catch {
        if (!cancelled) {
          setInitialRoute('Onboarding');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (initialRoute == null) {
    return <View style={styles.bootSplash} />;
  }

  return (
    <RootStack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <RootStack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        options={{
          animation: 'fade',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <RootStack.Screen name="Main" component={MainTabs} />
    </RootStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: INACTIVE_TAB,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.borderSubtle,
          paddingTop: 4,
        },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="AddBillTab"
        component={AddStackNavigator}
        options={{
          tabBarLabel: 'Add Bill',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'add-circle' : 'add-circle-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="StatsTab"
        component={StatsStackNavigator}
        options={{
          tabBarLabel: 'Charts',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'bar-chart' : 'bar-chart-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <SettingsProvider>
          <BillsProvider>
            <NotificationPermissionProvider>
              <NavigationContainer theme={navigationTheme}>
                <NotificationResponseBridge />
                <StatusBar style="light" />
                <AppNavigator />
              </NavigationContainer>
            </NotificationPermissionProvider>
          </BillsProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  bootSplash: {
    flex: 1,
    backgroundColor: '#141C33',
  },
  headerBack: {
    paddingLeft: 8,
    paddingVertical: 8,
    paddingRight: 12,
    marginLeft: Platform.OS === 'android' ? 4 : 0,
  },
});
