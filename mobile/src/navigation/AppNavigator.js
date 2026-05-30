import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { darkColors, lightColors } from '../theme';
import AuthScreen from '../screens/AuthScreen';
import DashboardScreen from '../screens/DashboardScreen';
import MatchesScreen from '../screens/MatchesScreen';
import GroupsScreen from '../screens/GroupsScreen';
import PredictionsScreen from '../screens/PredictionsScreen';
import RankingScreen from '../screens/RankingScreen';
import AccountScreen from '../screens/AccountScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const TAB_ICONS = {
  Start: 'home',
  Mecze: 'calendar',
  Grupy: 'grid',
  Typowanie: 'pencil',
  Ranking: 'trophy',
  Konto: 'person',
};

function MainTabs() {
  const { getCurrentTheme, getAccentColor } = useApp();
  const theme = getCurrentTheme();
  const C = theme === 'dark' ? darkColors : lightColors;
  const accent = getAccentColor();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons
            name={focused ? TAB_ICONS[route.name] : `${TAB_ICONS[route.name]}-outline`}
            size={size}
            color={color}
          />
        ),
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: {
          backgroundColor: C.surface,
          borderTopColor: C.line,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
        headerStyle: { backgroundColor: C.surface, borderBottomColor: C.line, borderBottomWidth: 1 },
        headerTintColor: C.ink,
        headerTitleStyle: { fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
        headerShadowVisible: false,
      })}
    >
      <Tab.Screen name="Start" component={DashboardScreen} />
      <Tab.Screen name="Mecze" component={MatchesScreen} />
      <Tab.Screen name="Grupy" component={GroupsScreen} />
      <Tab.Screen name="Typowanie" component={PredictionsScreen} />
      <Tab.Screen name="Ranking" component={RankingScreen} />
      <Tab.Screen name="Konto" component={AccountScreen} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { loading, gameState, getCurrentTheme } = useApp();
  const theme = getCurrentTheme();
  const C = theme === 'dark' ? darkColors : lightColors;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.paper }}>
        <ActivityIndicator color={C.orange} size="large" />
      </View>
    );
  }

  const isLoggedIn = Boolean(gameState?.user?.accountId);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isLoggedIn ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
