import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Wira from './Wira';
import LoginScreen from './LoginScreen';
import RegisterScreen from './RegisterScreen';
import {
  createStaticNavigation,
  useNavigation,
} from '@react-navigation/native';

const RootStack = createNativeStackNavigator({
  screens: {
    Home: {
      screen: AppContent,
      options: { title: 'App A' },
    },
    Login: {
      screen: LoginScreen,
    },
    Register: {
      screen: RegisterScreen,
    },
  },
});

const Navigation = createStaticNavigation(RootStack);

export default function App() {
  return (
    <SafeAreaProvider>
      <Navigation />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <Wira navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
