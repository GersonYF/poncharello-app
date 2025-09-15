// app/(tabs)/arduino.tsx
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Buffer } from 'buffer';
// LinearGradient removed — headers use solid color now
import React, { JSX, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ListRenderItem,
  PermissionsAndroid,
  Platform,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

// Interfaces TypeScript
interface DeviceItem {
  id: string;
  name: string;
  rssi?: number;
  device: Device;
}

// (Image map removed; UI uses simple icons instead)

type BluetoothState = 'Unknown' | 'Resetting' | 'Unsupported' | 'Unauthorized' | 'PoweredOff' | 'PoweredOn';

// Nota: BleManager se inicializará dentro del componente para evitar errores en entornos
// sin el módulo nativo (Expo Go). Esto preserva el comportamiento BLE cuando el módulo
// está disponible.

export default function ArduinoScreen(): JSX.Element {
  const colorScheme = useColorScheme();
  // Ref to lazily create BleManager only when needed and available
  const managerRef = useRef<BleManager | null>(null);

  const getManager = (): BleManager | null => {
    if (managerRef.current) return managerRef.current;
    try {
      // Attempt to create a BleManager; may throw in Expo Go if native module missing
      managerRef.current = new BleManager();
      return managerRef.current;
    } catch {
      // Native module not available (Expo Go). Return null and keep UI functional.
      console.log('BleManager not available in this environment.');
      return null;
    }
  };
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<DeviceItem | null>(null);
  const [receivedData, setReceivedData] = useState<string>('');
  // removed currentImage state (we now use simple icon UI)
  // UI-only confidence percentage for display (no effect on BLE logic)
  const [confidence, setConfidence] = useState<number | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [bluetoothState, setBluetoothState] = useState<BluetoothState>('Unknown');
  const [demoMode, setDemoMode] = useState<boolean>(false);
  // UI animation shared values (purely visual, no logic changes)
  const headerAnim = useSharedValue(0);
  const scanScale = useSharedValue(1);
  const devicesOpacity = useSharedValue(0);
  const imageScale = useSharedValue(1);

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerAnim.value,
    transform: [{ translateY: headerAnim.value ? 0 : -12 }],
  }));

  const scanButtonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scanScale.value }],
  }));

  const devicesAnimStyle = useAnimatedStyle(() => ({
    opacity: devicesOpacity.value,
  }));

  const imageAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: imageScale.value }],
  }));

  useEffect(() => {
    devicesOpacity.value = withTiming(devices.length > 0 ? 1 : 0, { duration: 400 });
  }, [devices, devicesOpacity]);

  // demo loop ref
  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (receivedData) {
      imageScale.value = withSequence(withTiming(1.08, { duration: 140 }), withTiming(1, { duration: 220 }));
    }
  }, [receivedData, imageScale]);

  // cleanup demo interval on unmount
  useEffect(() => {
    return () => {
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
    };
  }, []);

  // UUIDs para diferentes tipos de módulos BLE
  const UART_SERVICE_UUID = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';
  const UART_RX_CHARACTERISTIC_UUID = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E';
  const ALTERNATIVE_SERVICE_UUID = 'FFE0';
  const ALTERNATIVE_CHARACTERISTIC_UUID = 'FFE1';

  // (Se eliminó el mapeo de imágenes; la UI ahora usa iconos simples)

  useEffect(() => {
    // Verificar estado del Bluetooth (si el manager existe)
    const mgr = getManager();
    let subscription: any = { remove: () => { } };
    if (mgr) {
      subscription = mgr.onStateChange((state: BluetoothState) => {
        setBluetoothState(state);
        if (state === 'PoweredOn') {
          requestPermissions();
        }
      }, true);
    }
    // animate header in
    headerAnim.value = withTiming(1, { duration: 600 });

    return () => {
      subscription.remove();
      if (managerRef.current && managerRef.current.destroy) {
        managerRef.current.destroy();
      }
    };
  }, [headerAnim]);

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
      } catch {
        console.log('Error requesting permissions');
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
      const mgr = getManager();
      if (!mgr) {
        // Running in environment without native BLE; stop scanning flow and keep UI responsive
        setIsScanning(false);
        return;
      }

      mgr.startDeviceScan(null, null, (error: any, device: any) => {
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
        const mgr2 = managerRef.current;
        if (mgr2 && mgr2.stopDeviceScan) mgr2.stopDeviceScan();
        setIsScanning(false);
      }, 10000);

    } catch {
      Alert.alert('Error', 'No se pudieron buscar dispositivos');
      setIsScanning(false);
    }
  };

  const connectToDevice = async (deviceItem: DeviceItem): Promise<void> => {
    try {
      setIsScanning(false);
      const mgr3 = managerRef.current;
      if (mgr3 && mgr3.stopDeviceScan) mgr3.stopDeviceScan();

      const mgr4 = getManager();
      if (!mgr4) throw new Error('BleManager not available');
      const device = await mgr4.connectToDevice(deviceItem.id);
      const deviceWithServices = await device.discoverAllServicesAndCharacteristics();

      setConnectedDevice(deviceItem);
      setIsConnected(true);

      await setupNotifications(deviceWithServices);
      Alert.alert('Éxito', `Conectado a ${deviceItem.name}`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      Alert.alert('Error', `No se pudo conectar: ${errorMessage}`);
    }
  };

  const setupNotifications = async (device: Device): Promise<void> => {
    try {
      const serviceUUIDs = [UART_SERVICE_UUID, ALTERNATIVE_SERVICE_UUID];
      const characteristicUUIDs = [UART_RX_CHARACTERISTIC_UUID, ALTERNATIVE_CHARACTERISTIC_UUID];

      let notificationSetup = false;

      for (const serviceUUID of serviceUUIDs) {
        for (const characteristicUUID of characteristicUUIDs) {
          try {
            await device.monitorCharacteristicForService(
              serviceUUID,
              characteristicUUID,
              (error, characteristic) => {
                if (error) return;

                if (characteristic?.value) {
                  const data = Buffer.from(characteristic.value, 'base64').toString('utf8');
                  const command = data.toLowerCase().trim();
                  handleReceivedData(command);
                }
              }
            );

            notificationSetup = true;
            break;
          } catch {
            continue;
          }
        }
        if (notificationSetup) break;
      }

      if (!notificationSetup) {
        simulateData();
      }

    } catch {
      simulateData();
    }
  };

  const simulateData = (): void => {
    const commands = ['siga', 'pare', 'gire_derecha', 'gire_izquierda', 'reversa'];
    let index = 0;

    const interval = setInterval(() => {
      if (isConnected) {
        const command = commands[index % commands.length];
        handleReceivedData(command);
        index++;
      } else {
        clearInterval(interval);
      }
    }, 3000);
  };

  // Demo loop which runs regardless of BLE connection when demoMode is enabled
  const startDemoLoop = (): void => {
    const commands = ['siga', 'pare', 'gire_derecha', 'gire_izquierda', 'reversa'];
    let index = 0;
    if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
    demoIntervalRef.current = setInterval(() => {
      const command = commands[index % commands.length];
      handleReceivedData(command);
      index++;
    }, 2200);
  };

  const stopDemoLoop = (): void => {
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }
  };

  const handleReceivedData = (command: string): void => {
    setReceivedData(command);
    // UI: (was setting an image); now we show an icon-based card so no image state

    // UI-only: map commands to a confidence percentage for the progress bar
    const confidenceMap: Record<string, number> = {
      'siga': 97,
      'pare': 76,
      'gire_derecha': 82,
      'gire_izquierda': 80,
      'reversa': 76,
    };

    const c = confidenceMap[command] ?? Math.min(99, Math.max(40, Math.floor(60 + Math.random() * 30)));
    setConfidence(c);
  };

  const disconnect = async (): Promise<void> => {
    try {
      // If demo mode is active, just stop demo and reset UI state
      if (demoMode) {
        stopDemoLoop();
        setDemoMode(false);
        setIsConnected(false);
        setConnectedDevice(null);
        setReceivedData('');
        return;
      }

      if (connectedDevice) {
        const mgr5 = managerRef.current;
        if (mgr5 && mgr5.cancelDeviceConnection) await mgr5.cancelDeviceConnection(connectedDevice.id);
      }

      setIsConnected(false);
      setConnectedDevice(null);
      setReceivedData('');

    } catch {
      setIsConnected(false);
      setConnectedDevice(null);
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

  // Compute a safe top offset so the BT indicator doesn't overlap the device status bar.
  // On Android we can read StatusBar.currentHeight; on iOS use a conservative safe inset.
  const statusBarOffset = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 20) : 44;
  const [headerTopHeight, setHeaderTopHeight] = useState<number>(0);

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

  // Small helpers for UI
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  type IconData = { symbol: string; color: string; bg: string };

  const getIconForCommand = (cmd: string): IconData => {
    switch (cmd) {
      case 'siga':
        return { symbol: '↑', color: '#157F28', bg: '#E6F4EA' }; // green
      case 'pare':
        return { symbol: '✖', color: '#C62828', bg: '#FBEAEA' }; // red
      case 'gire_derecha':
        return { symbol: '→', color: '#0B6CFF', bg: '#EAF3FF' }; // blue
      case 'gire_izquierda':
        return { symbol: '←', color: '#FF8A00', bg: '#FFF4E6' }; // orange
      case 'reversa':
        return { symbol: '↓', color: '#6A4BCF', bg: '#F0ECFB' }; // purple
      default:
        return { symbol: '○', color: '#667882', bg: '#F3F6F8' };
    }
  };

  const renderConnectedContent = (): JSX.Element => (
    <ThemedView style={styles.connectedSectionCentered}>
      <ThemedView style={styles.card}>
        <View style={{ width: '100%', alignItems: 'flex-end' }}>
          <TouchableOpacity style={styles.disconnectButton} onPress={disconnect}>
            <Text style={styles.disconnectButtonText}>🔌</Text>
          </TouchableOpacity>
        </View>
        <ThemedText style={styles.brandTitle}>Poncharello App</ThemedText>
        <ThemedText style={styles.demoText}>Modo Demostración</ThemedText>

        {
          // colored icon based on command
        }
        {(() => {
          const icon = getIconForCommand(receivedData);
          return (
            <Animated.View style={[styles.circle, { backgroundColor: icon.bg }, imageAnimStyle] as any}>
              <ThemedText style={[styles.iconLarge, { color: icon.color }]}>{icon.symbol}</ThemedText>
            </Animated.View>
          );
        })()}

        <ThemedText style={styles.commandTitle}>{receivedData ? capitalize(receivedData.replace('_', ' ')) : 'Esperando...'}</ThemedText>

        <ThemedText style={styles.confidenceLabel}>Confianza</ThemedText>
        {(() => {
          const icon = getIconForCommand(receivedData);
          const progressColor = icon.color;
          return (
            <View style={styles.progressBackground}>
              <View style={[styles.progressBar, { width: `${confidence ?? 0}%`, backgroundColor: progressColor }]} />
            </View>
          );
        })()}
        <ThemedText style={styles.confidenceValue}>{confidence != null ? `${confidence}%` : ''}</ThemedText>
      </ThemedView>
    </ThemedView>
  );

  const renderScanContent = (): JSX.Element => (
    <ThemedView style={styles.connectionSection}>
      <View style={styles.scanSection}>
        <Animated.View style={scanButtonAnimStyle as any}>
          <TouchableOpacity
            style={[
              styles.scanButton,
              (isScanning || bluetoothState !== 'PoweredOn') && styles.scanButtonDisabled,
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
        </Animated.View>
      </View>

      {devices.length > 0 && (
        <ThemedView style={styles.devicesSection}>
          <Animated.View style={devicesAnimStyle as any}>
            <ThemedText type="subtitle">Dispositivos encontrados ({devices.length}):</ThemedText>
            <FlatList<DeviceItem>
              data={devices}
              renderItem={renderDevice}
              keyExtractor={(item: DeviceItem) => item.id}
              style={styles.devicesList}
            />
          </Animated.View>
        </ThemedView>
      )}

      {devices.length === 0 && !isScanning && bluetoothState === 'PoweredOn' && (
        <ThemedView style={styles.emptyState}>
          <ThemedText style={styles.emptyStateText}>
            No se encontraron dispositivos.{'\n\n'}
            Consejos:{'\n'}
            • Asegúrate de que tu Arduino esté encendido{'\n'}
            • Verifica que el módulo BLE esté en modo discoverable{'\n'}
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
        // use a solid color header to better match the tab's UI and avoid heavy gradients
        <Animated.View style={[styles.headerSolid, styles.headerContent, headerStyle] as any}>
          <View
            style={styles.headerRowTop}
            onLayout={(e) => setHeaderTopHeight(e.nativeEvent.layout.height)}
          >
            <View />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ThemedText style={styles.demoLabel}>Demo</ThemedText>
              <Switch
                value={demoMode}
                onValueChange={(v) => {
                  setDemoMode(v);
                  if (v) {
                    // enable demo: mark as connected with a mock device and start loop
                    setIsConnected(true);
                    setConnectedDevice({ id: 'demo-device', name: 'Arduino-Sim', device: null as unknown as Device });
                    startDemoLoop();
                  } else {
                    // disable demo: stop loop and reset UI
                    stopDemoLoop();
                    setIsConnected(false);
                    setConnectedDevice(null);
                    setReceivedData('');
                  }
                }}
                thumbColor={demoMode ? '#fff' : '#fff'}
                trackColor={{ false: '#a3b0d9', true: '#2b6ef6' }}
              />
            </View>
          </View>

          <ThemedText style={styles.headerTitle}>Arduino BLE</ThemedText>
          <ThemedText style={styles.headerSubtitle}>
            {isConnected ? `🔗 ${connectedDevice?.name}` : '📱 Desconectado'}
          </ThemedText>
          <View style={[styles.bluetoothIndicator, { backgroundColor: getBluetoothStatusColor(), top: statusBarOffset + headerTopHeight + 40 }]}>
            <Text style={styles.bluetoothText}>{getBluetoothStatusText()}</Text>
          </View>
        </Animated.View>
      }
    >
      {isConnected ? renderConnectedContent() : renderScanContent()}
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerGradient: {
    height: 300,
    width: '100%',
  },
  headerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 34,
    paddingBottom: 16,
  },
  headerSolid: {
    backgroundColor: '#667eea',
    width: '100%',
    height: '100%',
    paddingTop: 8,
  },
  headerRowTop: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  demoLabel: {
    color: '#fff',
    fontWeight: '600',
    marginRight: 6,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 40,
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
    borderRadius: 60,
  },
  receivedText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#667eea',
    textTransform: 'uppercase',
    letterSpacing: 2,
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
  /* New card UI styles */
  connectedSectionCentered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  card: {
    width: '92%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: 20,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  demoText: {
    color: '#8a8f98',
    marginBottom: 18,
  },
  circle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    overflow: 'visible',
  },
  iconLarge: {
    fontSize: 56,
    lineHeight: 56,
    textAlign: 'center',
    textAlignVertical: 'center',
    alignSelf: 'center',
    marginVertical: 0,
  },
  commandTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 6,
    lineHeight: 36,
  },
  confidenceLabel: {
    color: '#8a8f98',
    marginBottom: 8,
  },
  progressBackground: {
    width: '80%',
    height: 8,
    backgroundColor: '#eef2ff',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#2b6ef6',
  },
  confidenceValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2b6ef6',
  },
});