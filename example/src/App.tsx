import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
  return (
    <SafeAreaProvider>
      <Text>Hello world</Text>
    </SafeAreaProvider>
  );
}
