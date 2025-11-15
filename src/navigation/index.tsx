import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HeaderButton, Text } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createStaticNavigation,
  StaticParamList,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Image } from 'react-native';
import scanner from '../assets/scanner.png';
import { Home } from './screens/Home';
import { Scanner } from './screens/Scanner';
import Ionicons from '@expo/vector-icons/Ionicons';

const HomeTabs = createBottomTabNavigator({

  screens: {
    Home: {
      screen: Home,
      options: {
        title: 'Home',
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          return <Ionicons name="home-outline" size={size} color={color} />
        },
      },
    },
    Scanner: {
      screen: Scanner,
      options: {
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          return <Ionicons name="camera-outline" size={size} color={color} />
        },
      },
    },
  },
});

const RootStack = createNativeStackNavigator({
  screens: {
    HomeTabs: {
      screen: HomeTabs,
      options: {
        title: 'Home',
        headerShown: false,
      },
    },
  },
});

export const Navigation = createStaticNavigation(RootStack);

type RootStackParamList = StaticParamList<typeof RootStack>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
