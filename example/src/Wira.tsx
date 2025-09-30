import { Alert, Button, StyleSheet, View } from 'react-native';
import { signInWithWira, NativeWiraProvider } from 'wira-sdk';

function Wira({ navigation }: any) {
  const requestPermissionAndExecute = async (action: any) => {
    try {
      console.log('Requesting permission to access data...');
      const granted = await NativeWiraProvider.requestAccessDataPermission();
      console.log('Permission granted:', granted);
      if (granted) {
        return action();
      } else {
        Alert.alert(
          'Permission Requested',
          'Check your settings to grant access.'
        );
        return 'permission_denied';
      }
    } catch (error) {
      console.error('Permission request failed:', error);
      Alert.alert('Error', 'Failed to request permission.');
    }
  };

  const signIn = async () => {
    console.log('Sign In with Wira clicked');
    const userData = await requestPermissionAndExecute(() =>
      signInWithWira('com.exampleapp')
    );
    if (userData === 'permission_denied') {
      return;
    }

    if (userData) {
      console.log('Signed in:', userData);
      navigation.navigate('Login', { userData });
    } else {
      navigation.navigate('Register', { userData });
    }
  };

  return (
    <View style={styles.container}>
      <Button title="Sign In with Wira" onPress={signIn} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 25,
    marginBottom: 20,
  },
});

export default Wira;
