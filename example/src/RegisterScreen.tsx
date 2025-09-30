import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { writeData } from 'wira-sdk';

function RegisterScreen() {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');

  const handleRegister = () => {
    if (name.trim().length === 0) {
      Alert.alert('Invalid Name', 'Please enter your name');
      return;
    }

    if (pin.length !== 4) {
      Alert.alert('Invalid PIN', 'Please enter a 4-digit PIN');
      return;
    }

    const userData = writeData('com.exampleapp', {
      credential: name,
      pinHash: pin,
    });

    if (!userData) {
      Alert.alert(
        'Registration',
        `Registration Success!\nName: ${name}\nPIN: ${pin}`
      );
    } else {
      Alert.alert(
        'Registration Failed',
        'An error occurred during registration.'
      );
    }
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
      <Text style={styles.title}>Create Your Account</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.nameInput}
          value={name}
          onChangeText={setName}
          placeholder="Enter your name"
          placeholderTextColor="#ccc"
        />
      </View>

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
          styles.registerButton,
          name.trim().length > 0 && pin.length === 4
            ? styles.registerButtonActive
            : styles.registerButtonInactive,
        ]}
        onPress={handleRegister}
        disabled={!(name.trim().length > 0 && pin.length === 4)}
      >
        <Text style={styles.registerButtonText}>Register</Text>
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
  inputContainer: {
    marginBottom: 20,
  },
  nameInput: {
    width: 200,
    height: 50,
    fontSize: 16,
    textAlign: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 10,
    backgroundColor: '#fff',
    color: 'black',
    paddingHorizontal: 15,
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
  registerButton: {
    width: 200,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  registerButtonActive: {
    backgroundColor: '#007AFF',
  },
  registerButtonInactive: {
    backgroundColor: '#ccc',
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default RegisterScreen;
