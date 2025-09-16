// app/(tabs)/arduino.tsx
import React, { useState, useEffect, JSX } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
  ListRenderItem,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { BleManager, Device, Characteristic } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import ParallaxScrollView from '@/components/parallax-scroll-view';

// Interfaces TypeScript
interface DeviceItem {
  id: string;
  name: string;
  rssi?: number;
  device: Device;
}

interface ImageMap {
  [key: string]: string;
}

type BluetoothState = 'Unknown' | 'Resetting' | 'Unsupported' | 'Unauthorized' | 'PoweredOff' | 'PoweredOn';

// Inicializar BLE Manager
const manager = new BleManager();

export default function ArduinoScreen(): JSX.Element {
  const colorScheme = useColorScheme();
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<DeviceItem | null>(null);
  const [writeCharacteristic, setWriteCharacteristic] = useState<Characteristic | null>(null);
  const [receivedData, setReceivedData] = useState<string>('');
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [bluetoothState, setBluetoothState] = useState<BluetoothState>('Unknown');
  const [inferenceCount, setInferenceCount] = useState<number>(0);
  const [lastPrediction, setLastPrediction] = useState<string>('');
  const [confidence, setConfidence] = useState<number>(0);

  // UUIDs para diferentes tipos de módulos BLE
  const UART_SERVICE_UUID = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';
  const UART_TX_CHARACTERISTIC_UUID = '6E400002-B5A3-F393-E0A9-E50E24DCCA9E';
  const UART_RX_CHARACTERISTIC_UUID = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E';
  const ALTERNATIVE_SERVICE_UUID = 'FFE0';
  const ALTERNATIVE_CHARACTERISTIC_UUID = 'FFE1';

  // Mapeo de comandos a imágenes específicas para señales de tránsito
  const imageMap: ImageMap = {
    'siga': 'https://placehold.co/200/4CAF50/FFFFFF?text=SIGA',
    'pare': 'https://placehold.co/200/FF4444/FFFFFF?text=PARE',
    'gire_derecha': 'https://placehold.co/200/2196F3/FFFFFF?text=GIRE+A+LA+DERECHA',
    'gire_izquierda': 'https://placehold.co/200/FF9800/FFFFFF?text=GIRE+A+LA+IZQUIERDA',
    'reversa': 'https://placehold.co/200/9C27B0/FFFFFF?text=REVERSA',
  };

  useEffect(() => {
    // Verificar estado del Bluetooth
    const subscription = manager.onStateChange((state: BluetoothState) => {
      setBluetoothState(state);
      if (state === 'PoweredOn') {
        requestPermissions();
      }
    }, true);

    return () => {
      subscription.remove();
      manager.destroy();
    };
  }, []);

  const requestPermissions = async (): Promise<void> => {
    if (Platform.OS === 'android') {
      try {
        if (Platform.Version >= 31) {
          const permissions = [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ];
          
          const granted = await PermissionsAndroid.requestMultiple(permissions);
          
          const allPermissionsGranted = Object.values(granted).every(
            permission => permission === PermissionsAndroid.RESULTS.GRANTED
          );
          
          if (!allPermissionsGranted) {
            Alert.alert('Permisos', 'Se necesitan permisos de Bluetooth y ubicación');
          }
        }
      } catch (error) {
        console.log('Error requesting permissions:', error);
      }
    }
  };

  const scanDevices = async (): Promise<void> => {
    if (bluetoothState !== 'PoweredOn') {
      Alert.alert('Bluetooth', 'Por favor activa el Bluetooth');
      return;
    }

    setIsScanning(true);
    setDevices([]);

    try {
      manager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          console.log('Scan error:', error);
          return;
        }

        if (device?.name && !devices.find(d => d.id === device.id)) {
          setDevices(prevDevices => {
            const exists = prevDevices.find(d => d.id === device.id);
            if (!exists) {
              const newDevice: DeviceItem = {
                id: device.id,
                name: "" + device.name,
                rssi: device.rssi || undefined,
                device: device
              };
              return [...prevDevices, newDevice];
            }
            return prevDevices;
          });
        }
      });

      setTimeout(() => {
        manager.stopDeviceScan();
        setIsScanning(false);
      }, 10000);

    } catch (error) {
      Alert.alert('Error', 'No se pudieron buscar dispositivos');
      setIsScanning(false);
    }
  };

  const connectToDevice = async (deviceItem: DeviceItem): Promise<void> => {
    try {
      setIsScanning(false);
      manager.stopDeviceScan();

      console.log('Conectando a:', deviceItem.name);
      const device = await manager.connectToDevice(deviceItem.id);
      const deviceWithServices = await device.discoverAllServicesAndCharacteristics();
      
      setConnectedDevice(deviceItem);
      setIsConnected(true);

      await setupNotifications(deviceWithServices);
      Alert.alert('Éxito', `Conectado a ${deviceItem.name}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      Alert.alert('Error', `No se pudo conectar: ${errorMessage}`);
    }
  };

  const setupNotifications = async (device: Device): Promise<void> => {
    try {
      const serviceUUIDs = [UART_SERVICE_UUID, ALTERNATIVE_SERVICE_UUID];
      const characteristicUUIDs = [UART_RX_CHARACTERISTIC_UUID, ALTERNATIVE_CHARACTERISTIC_UUID];
      const writeCharacteristicUUIDs = [UART_TX_CHARACTERISTIC_UUID, ALTERNATIVE_CHARACTERISTIC_UUID];

      let notificationSetup = false;

      // Configurar notificaciones para recibir datos
      for (const serviceUUID of serviceUUIDs) {
        for (const characteristicUUID of characteristicUUIDs) {
          try {
            console.log(`Intentando configurar notificaciones: ${serviceUUID}/${characteristicUUID}`);
            
            await device.monitorCharacteristicForService(
              serviceUUID,
              characteristicUUID,
              (error, characteristic) => {
                if (error) {
                  console.log('Monitor error:', error);
                  return;
                }

                if (characteristic?.value) {
                  const data = Buffer.from(characteristic.value, 'base64').toString('utf8');
                  const command = data.toLowerCase().trim();
                  console.log('Datos recibidos del Arduino:', command);
                  handleReceivedData(command);
                }
              }
            );
            
            notificationSetup = true;
            console.log('Notificaciones configuradas exitosamente');
            break;
          } catch (error) {
            console.log(`Error con ${serviceUUID}/${characteristicUUID}:`, error);
            continue;
          }
        }
        if (notificationSetup) break;
      }

      // Configurar característica de escritura para enviar comandos
      for (const serviceUUID of serviceUUIDs) {
        for (const writeUUID of writeCharacteristicUUIDs) {
          try {
            const services = await device.services();
            for (const service of services) {
              if (service.uuid.toLowerCase() === serviceUUID.toLowerCase()) {
                const characteristics = await service.characteristics();
                for (const char of characteristics) {
                  if (char.uuid.toLowerCase() === writeUUID.toLowerCase() && char.isWritableWithResponse) {
                    setWriteCharacteristic(char);
                    console.log('Característica de escritura configurada');
                    break;
                  }
                }
              }
            }
          } catch (error) {
            console.log('Error configurando escritura:', error);
          }
        }
      }

      if (!notificationSetup) {
        console.log('No se pudieron configurar notificaciones, iniciando simulación');
        simulateData();
      }

    } catch (error) {
      console.log('Setup notifications error:', error);
      simulateData();
    }
  };

  const simulateData = (): void => {
    const commands = ['siga', 'pare', 'gire_derecha', 'gire_izquierda', 'reversa'];
    let index = 0;
    
    const interval = setInterval(() => {
      if (isConnected) {
        const command = commands[index % commands.length];
        const simulatedData = `${command}:${(0.7 + Math.random() * 0.3).toFixed(2)}:sim_${command}`;
        handleReceivedData(simulatedData);
        index++;
      } else {
        clearInterval(interval);
      }
    }, 4000);
  };

  const handleReceivedData = (command: string): void => {
    console.log('Comando recibido del Arduino:', command);
    
    // Incrementar contador de inferencias
    setInferenceCount(prev => prev + 1);
    
    // Verificar si el comando contiene información detallada (formato: comando:confianza:clase)
    if (command.includes(':')) {
      const parts = command.split(':');
      const actualCommand = parts[0];
      const confidenceValue = parseFloat(parts[1]) || 0;
      const originalClass = parts[2] || '';
      
      // Actualizar estados
      setConfidence(confidenceValue);
      setLastPrediction(originalClass);
      
      // Mostrar información detallada
      const confidencePercent = (confidenceValue * 100).toFixed(1);
      setReceivedData(`${actualCommand.toUpperCase()} (${confidencePercent}%)`);
      
      // Log detallado para debugging
      console.log(`Predicción: ${originalClass} -> Comando: ${actualCommand} (Confianza: ${confidencePercent}%)`);
      
      // Mostrar imagen correspondiente
      if (imageMap[actualCommand]) {
        setCurrentImage(imageMap[actualCommand]);
      } else {
        setCurrentImage(`https://placehold.co/200/6C63FF/FFFFFF?text=${encodeURIComponent(actualCommand.toUpperCase())}`);
      }
    } else {
      // Comando simple sin información adicional
      setReceivedData(command.toUpperCase());
      
      if (imageMap[command]) {
        setCurrentImage(imageMap[command]);
      } else {
        // Comandos de estado especiales
        switch(command) {
          case 'connected':
            setCurrentImage('https://placehold.co/200/00FF00/FFFFFF?text=CONECTADO');
            break;
          case 'inferencing':
            setCurrentImage('https://placehold.co/200/0066FF/FFFFFF?text=ANALIZANDO');
            break;
          case 'ready':
            setCurrentImage('https://placehold.co/200/00FF7F/FFFFFF?text=LISTO');
            break;
          case 'error':
            setCurrentImage('https://placehold.co/200/FF0000/FFFFFF?text=ERROR');
            break;
          case 'auto_enabled':
            setCurrentImage('https://placehold.co/200/4CAF50/FFFFFF?text=AUTO+ON');
            break;
          case 'auto_disabled':
            setCurrentImage('https://placehold.co/200/FF9800/FFFFFF?text=AUTO+OFF');
            break;
          case 'fast_mode':
            setCurrentImage('https://placehold.co/200/2196F3/FFFFFF?text=MODO+RAPIDO');
            break;
          case 'slow_mode':
            setCurrentImage('https://placehold.co/200/9C27B0/FFFFFF?text=MODO+LENTO');
            break;
          default:
            setCurrentImage(`https://placehold.co/200/6C63FF/FFFFFF?text=${encodeURIComponent(command.toUpperCase())}`);
        }
      }
    }
  };

  const sendCommandToArduino = async (cmd: string): Promise<void> => {
    if (!isConnected || !writeCharacteristic) {
      Alert.alert('Error', 'No hay dispositivo conectado o característica de escritura no disponible');
      return;
    }

    try {
      const data = Buffer.from(cmd, 'utf8').toString('base64');
      await writeCharacteristic.writeWithResponse(data);
      console.log(`Comando enviado al Arduino: ${cmd}`);
      
      // Mostrar feedback visual
      Alert.alert('Éxito', `Comando "${cmd}" enviado al Arduino`);
    } catch (error) {
      console.error('Error enviando comando:', error);
      Alert.alert('Error', 'No se pudo enviar el comando');
    }
  };

  const disconnect = async (): Promise<void> => {
    try {
      if (connectedDevice) {
        await manager.cancelDeviceConnection(connectedDevice.id);
      }
      
      setIsConnected(false);
      setConnectedDevice(null);
      setWriteCharacteristic(null);
      setCurrentImage(null);
      setReceivedData('');
      setInferenceCount(0);
      setConfidence(0);
      setLastPrediction('');
      
    } catch (error) {
      setIsConnected(false);
      setConnectedDevice(null);
      setWriteCharacteristic(null);
      setCurrentImage(null);
      setReceivedData('');
    }
  };

  const getBluetoothStatusColor = (): string => {
    switch (bluetoothState) {
      case 'PoweredOn': return '#4CAF50';
      case 'PoweredOff': return '#f44336';
      default: return '#FF9800';
    }
  };

  const getBluetoothStatusText = (): string => {
    switch (bluetoothState) {
      case 'PoweredOn': return 'BT ✓';
      case 'PoweredOff': return 'BT ✗';
      case 'Unauthorized': return 'BT ⚠️';
      default: return 'BT ?';
    }
  };

  const getConfidenceColor = (): string => {
    if (confidence >= 0.8) return '#4CAF50'; // Verde - Alta confianza
    if (confidence >= 0.6) return '#FF9800'; // Naranja - Media confianza
    return '#f44336'; // Rojo - Baja confianza
  };

  const renderDevice: ListRenderItem<DeviceItem> = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.deviceItem,
        { backgroundColor: Colors[colorScheme ?? 'light'].background }
      ]}
      onPress={() => connectToDevice(item)}
    >
      <View style={styles.deviceInfo}>
        <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
        <ThemedText style={styles.deviceId}>{item.id}</ThemedText>
        {item.rssi && (
          <ThemedText style={styles.deviceRssi}>Señal: {item.rssi} dBm</ThemedText>
        )}
      </View>
      <View style={styles.connectButton}>
        <Text style={styles.connectButtonText}>Conectar</Text>
      </View>
    </TouchableOpacity>
  );

  const renderStatsSection = (): JSX.Element => (
    <ThemedView style={styles.statsSection}>
      <ThemedText type="subtitle">📊 Estadísticas:</ThemedText>
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{inferenceCount}</Text>
          <Text style={styles.statLabel}>Inferencias</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: getConfidenceColor() }]}>
            {(confidence * 100).toFixed(1)}%
          </Text>
          <Text style={styles.statLabel}>Confianza</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{lastPrediction || 'N/A'}</Text>
          <Text style={styles.statLabel}>Última Clase</Text>
        </View>
      </View>
    </ThemedView>
  );

  const renderControlButtons = (): JSX.Element => (
    <ThemedView style={styles.controlSection}>
      <ThemedText type="subtitle">🎮 Control del Arduino:</ThemedText>
      <View style={styles.controlButtonsContainer}>
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => sendCommandToArduino('inference')}
        >
          <Text style={styles.controlButtonText}>Inferencia Manual</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => sendCommandToArduino('auto_on')}
        >
          <Text style={styles.controlButtonText}>Auto ON</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => sendCommandToArduino('auto_off')}
        >
          <Text style={styles.controlButtonText}>Auto OFF</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => sendCommandToArduino('fast')}
        >
          <Text style={styles.controlButtonText}>Rápido</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => sendCommandToArduino('slow')}
        >
          <Text style={styles.controlButtonText}>Lento</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => sendCommandToArduino('status')}
        >
          <Text style={styles.controlButtonText}>Estado</Text>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );

  const renderConnectedContent = (): JSX.Element => (
    <ThemedView style={styles.connectedSection}>
      <TouchableOpacity style={styles.disconnectButton} onPress={disconnect}>
        <Text style={styles.disconnectButtonText}>🔌 Desconectar</Text>
      </TouchableOpacity>

      {renderStatsSection()}

      <ThemedView style={styles.imageSection}>
        <ThemedText type="subtitle">📡 Resultado de IA:</ThemedText>
        
        {currentImage ? (
          <View style={styles.imageContainer}>
            <Image 
              source={{ uri: currentImage }} 
              style={styles.displayImage} 
              contentFit="cover"
            />
            <ThemedText style={styles.receivedText}>{receivedData}</ThemedText>
            <ThemedText style={styles.timestampText}>
              Recibido: {new Date().toLocaleTimeString()}
            </ThemedText>
          </View>
        ) : (
          <View style={styles.waitingContainer}>
            <View style={styles.pulseCircle} />
            <ThemedText style={styles.waitingText}>
              Esperando datos del Arduino...{'\n'}
              Ejecuta una inferencia para ver resultados
            </ThemedText>
          </View>
        )}
      </ThemedView>

      {renderControlButtons()}

      <ThemedView style={styles.commandsSection}>
        <ThemedText type="subtitle">⚡ Comandos de prueba:</ThemedText>
        <ThemedText style={styles.commandsSubtitle}>
          Toca para simular (útil para testing)
        </ThemedText>
        <View style={styles.commandsList}>
          {Object.keys(imageMap).map((command: string) => (
            <TouchableOpacity 
              key={command} 
              style={[
                styles.commandItem,
                receivedData.toLowerCase().includes(command) && styles.commandItemActive
              ]}
              onPress={() => handleReceivedData(command)}
            >
              <Text style={[
                styles.commandText,
                receivedData.toLowerCase().includes(command) && styles.commandTextActive
              ]}>
                {command}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ThemedView>
    </ThemedView>
  );

  const renderScanContent = (): JSX.Element => (
    <ThemedView style={styles.connectionSection}>
      <View style={styles.scanSection}>
        <TouchableOpacity
          style={[
            styles.scanButton,
            (isScanning || bluetoothState !== 'PoweredOn') && styles.scanButtonDisabled
          ]}
          onPress={scanDevices}
          disabled={isScanning || bluetoothState !== 'PoweredOn'}
        >
          {isScanning ? (
            <>
              <ActivityIndicator color="#fff" />
              <Text style={[styles.scanButtonText, { marginLeft: 10 }]}>Buscando...</Text>
            </>
          ) : (
            <Text style={styles.scanButtonText}>
              {bluetoothState === 'PoweredOn' ? 'Buscar Dispositivos BLE' : 'Activar Bluetooth'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {devices.length > 0 && (
        <ThemedView style={styles.devicesSection}>
          <ThemedText type="subtitle">
            Dispositivos encontrados ({devices.length}):
          </ThemedText>
          <FlatList<DeviceItem>
            data={devices}
            renderItem={renderDevice}
            keyExtractor={(item: DeviceItem) => item.id}
            style={styles.devicesList}
          />
        </ThemedView>
      )}

      {devices.length === 0 && !isScanning && bluetoothState === 'PoweredOn' && (
        <ThemedView style={styles.emptyState}>
          <ThemedText style={styles.emptyStateText}>
            No se encontraron dispositivos.{'\n\n'}
            Busca "IA-Embebidos-Nano33" para conectar a tu Arduino.{'\n\n'}
            Consejos:{'\n'}
            • Asegúrate de que tu Arduino esté encendido{'\n'}
            • Verifica que el código esté ejecutándose{'\n'}
            • Mantén los dispositivos cerca (menos de 10m)
          </ThemedText>
        </ThemedView>
      )}
    </ThemedView>
  );

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#667eea', dark: '#1D3D47' }}
      headerImage={
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <ThemedText style={styles.headerTitle}>IA en Embebidos</ThemedText>
            <ThemedText style={styles.headerSubtitle}>
              {isConnected ? `🔗 ${connectedDevice?.name}` : '📱 Desconectado'}
            </ThemedText>
            <View style={[styles.bluetoothIndicator, { backgroundColor: getBluetoothStatusColor() }]}>
              <Text style={styles.bluetoothText}>
                {getBluetoothStatusText()}
              </Text>
            </View>
          </View>
        </LinearGradient>
      }
    >
      {isConnected ? renderConnectedContent() : renderScanContent()}
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerGradient: {
    height: 250,
    width: '100%',
  },
  headerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.9,
  },
  bluetoothIndicator: {
    position: 'absolute',
    top: 20,
    right: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  bluetoothText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  connectionSection: {
    gap: 20,
  },
  scanSection: {
    marginBottom: 8,
  },
  scanButton: {
    backgroundColor: '#667eea',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  scanButtonDisabled: {
    opacity: 0.5,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  devicesSection: {
    gap: 8,
  },
  devicesList: {
    maxHeight: 300,
  },
  deviceItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deviceInfo: {
    flex: 1,
    gap: 4,
  },
  deviceId: {
    fontSize: 12,
    opacity: 0.6,
  },
  deviceRssi: {
    fontSize: 12,
    opacity: 0.6,
  },
  connectButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  connectButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    textAlign: 'center',
    lineHeight: 24,
    opacity: 0.7,
  },
  connectedSection: {
    gap: 20,
  },
  disconnectButton: {
    backgroundColor: '#f44336',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  disconnectButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  statsSection: {
    padding: 20,
    borderRadius: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#667eea',
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  imageSection: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  imageContainer: {
    alignItems: 'center',
    gap: 12,
  },
  displayImage: {
    width: 200,
    height: 200,
    borderRadius: 20,
  },
  receivedText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#667eea',
    letterSpacing: 1,
  },
  timestampText: {
    fontSize: 12,
    opacity: 0.5,
    fontStyle: 'italic',
  },
  waitingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 20,
  },
  waitingText: {
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.7,
  },
  pulseCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#667eea',
    opacity: 0.3,
  },
  controlSection: {
    padding: 20,
    borderRadius: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  controlButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  controlButton: {
    backgroundColor: '#FF4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: '30%',
    alignItems: 'center',
  },
  controlButtonText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 12,
  },
  commandsSection: {
    padding: 20,
    borderRadius: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  commandsSubtitle: {
    fontSize: 14,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  commandsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  commandItem: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#667eea',
  },
  commandItemActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  commandText: {
    color: '#667eea',
    fontWeight: '500',
    fontSize: 14,
  },
  commandTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});
