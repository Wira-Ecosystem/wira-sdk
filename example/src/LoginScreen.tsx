import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';

function LoginScreen({ route }: any) {
  const [pin, setPin] = useState('');
  const userData = route.params?.userData;

  const handleLogin = () => {
    if (pin.length !== 4) {
      Alert.alert('Invalid PIN', 'Please enter a 4-digit PIN');
      return;
    }

    if (pin !== userData?.pinHash) {
      Alert.alert('Login Failed', 'Invalid PIN');
      return;
    }

    // Handle login logic here
    Alert.alert(
      'Login',
      `Login Success with: ${route.params.userData?.credential}`
    );
  };

  const handlePinChange = (text: string) => {
    // Only allow numeric input and limit to 4 digits
    const numericText = text.replace(/[^0-9]/g, '');
    if (numericText.length <= 4) {
      setPin(numericText);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter Your PIN</Text>

      <View style={styles.pinContainer}>
        <TextInput
          style={styles.pinInput}
          value={pin}
          onChangeText={handlePinChange}
          keyboardType="numeric"
          secureTextEntry
          maxLength={4}
          placeholder="••••"
          placeholderTextColor="#ccc"
        />
      </View>

      <TouchableOpacity
        style={[
          styles.loginButton,
          pin.length === 4
            ? styles.loginButtonActive
            : styles.loginButtonInactive,
        ]}
        onPress={handleLogin}
        disabled={pin.length !== 4}
      >
        <Text style={styles.loginButtonText}>Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 40,
    color: '#333',
  },
  pinContainer: {
    marginBottom: 30,
  },
  pinInput: {
    width: 200,
    height: 60,
    color: 'black',
    fontSize: 32,
    textAlign: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 10,
    backgroundColor: '#fff',
    letterSpacing: 10,
  },
  loginButton: {
    width: 200,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  loginButtonActive: {
    backgroundColor: '#007AFF',
  },
  loginButtonInactive: {
    backgroundColor: '#ccc',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default LoginScreen;
