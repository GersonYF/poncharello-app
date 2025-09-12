import { Image } from 'expo-image';
import { Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { HelloWave } from '@/components/hello-wave';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Link } from 'expo-router';
import { JSX } from 'react';

export default function HomeScreen(): JSX.Element {
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#667eea', dark: '#1D3D47' }}
      headerImage={
        <LinearGradient
          colors={['#667eea', '#764ba2', '#f093fb']}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View style={styles.iconContainer}>
              <ThemedText style={styles.iconText}>🤖</ThemedText>
            </View>
            <ThemedText style={styles.courseTitle}>IA en Embebidos</ThemedText>
            <ThemedText style={styles.courseSubtitle}>Arduino BLE Controller</ThemedText>
          </View>
        </LinearGradient>
      }>
      
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">¡Bienvenidos!</ThemedText>
        <HelloWave />
      </ThemedView>

      <ThemedView style={styles.projectInfoContainer}>
        <ThemedText type="subtitle">📚 Información del Proyecto</ThemedText>
        <ThemedView style={styles.infoCard}>
          <ThemedText style={styles.courseName}>
            <ThemedText type="defaultSemiBold">Curso:</ThemedText> IA en Embebidos
          </ThemedText>
          <ThemedText style={styles.program}>
            <ThemedText type="defaultSemiBold">Programa:</ThemedText> Ingeniería de Datos e IA
          </ThemedText>
        </ThemedView>
      </ThemedView>

      <ThemedView style={styles.participantsContainer}>
        <ThemedText type="subtitle">👥 Participantes</ThemedText>
        <ThemedView style={styles.participantCard}>
          <View style={styles.participantItem}>
            <ThemedText style={styles.participantIcon}>👨‍💻</ThemedText>
            <ThemedText style={styles.participantName}>Gerson Yarce Franco</ThemedText>
          </View>
          <View style={styles.participantItem}>
            <ThemedText style={styles.participantIcon}>👨‍💻</ThemedText>
            <ThemedText style={styles.participantName}>David Velásquez Lenis</ThemedText>
          </View>
          <View style={styles.participantItem}>
            <ThemedText style={styles.participantIcon}>👨‍💻</ThemedText>
            <ThemedText style={styles.participantName}>Juan Mayorquin</ThemedText>
          </View>
        </ThemedView>
      </ThemedView>

      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">🚀 Proyecto: Control Arduino BLE</ThemedText>
        <ThemedText>
          Esta aplicación permite conectarse a dispositivos Arduino mediante{' '}
          <ThemedText type="defaultSemiBold">Bluetooth Low Energy (BLE)</ThemedText> para recibir 
          comandos y mostrar imágenes correspondientes en tiempo real.
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.stepContainer}>
        <Link href="/arduino">
          <Link.Trigger>
            <ThemedView style={styles.linkButton}>
              <ThemedText type="subtitle" style={styles.linkText}>
                🔗 Ir a Control Arduino
              </ThemedText>
            </ThemedView>
          </Link.Trigger>
        </Link>
        <ThemedText>
          Navega a la pestaña Arduino para comenzar a usar el controlador BLE.
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.featuresContainer}>
        <ThemedText type="subtitle">✨ Características</ThemedText>
        <View style={styles.featuresList}>
          <View style={styles.featureItem}>
            <ThemedText style={styles.featureIcon}>📡</ThemedText>
            <ThemedText style={styles.featureText}>Conexión BLE en tiempo real</ThemedText>
          </View>
          <View style={styles.featureItem}>
            <ThemedText style={styles.featureIcon}>🖼️</ThemedText>
            <ThemedText style={styles.featureText}>Visualización de comandos</ThemedText>
          </View>
          <View style={styles.featureItem}>
            <ThemedText style={styles.featureIcon}>🎮</ThemedText>
            <ThemedText style={styles.featureText}>Interfaz intuitiva</ThemedText>
          </View>
          <View style={styles.featureItem}>
            <ThemedText style={styles.featureIcon}>⚡</ThemedText>
            <ThemedText style={styles.featureText}>Respuesta instantánea</ThemedText>
          </View>
        </View>
      </ThemedView>

      <ThemedView style={styles.techContainer}>
        <ThemedText type="subtitle">🛠️ Tecnologías</ThemedText>
        <View style={styles.techGrid}>
          <View style={styles.techItem}>
            <ThemedText style={styles.techIcon}>⚛️</ThemedText>
            <ThemedText style={styles.techName}>React Native</ThemedText>
          </View>
          <View style={styles.techItem}>
            <ThemedText style={styles.techIcon}>📱</ThemedText>
            <ThemedText style={styles.techName}>Expo Router</ThemedText>
          </View>
          <View style={styles.techItem}>
            <ThemedText style={styles.techIcon}>🔵</ThemedText>
            <ThemedText style={styles.techName}>BLE PLX</ThemedText>
          </View>
          <View style={styles.techItem}>
            <ThemedText style={styles.techIcon}>🤖</ThemedText>
            <ThemedText style={styles.techName}>Arduino</ThemedText>
          </View>
        </View>
      </ThemedView>

      <ThemedView style={styles.instructionsContainer}>
        <ThemedText type="subtitle">📋 Instrucciones de Uso</ThemedText>
        <View style={styles.instructionsList}>
          <ThemedText style={styles.instructionStep}>
            <ThemedText type="defaultSemiBold">1.</ThemedText> Enciende tu dispositivo Arduino con módulo BLE
          </ThemedText>
          <ThemedText style={styles.instructionStep}>
            <ThemedText type="defaultSemiBold">2.</ThemedText> Ve a la pestaña "Arduino" en la aplicación
          </ThemedText>
          <ThemedText style={styles.instructionStep}>
            <ThemedText type="defaultSemiBold">3.</ThemedText> Presiona "Buscar Dispositivos BLE"
          </ThemedText>
          <ThemedText style={styles.instructionStep}>
            <ThemedText type="defaultSemiBold">4.</ThemedText> Selecciona tu Arduino de la lista
          </ThemedText>
          <ThemedText style={styles.instructionStep}>
            <ThemedText type="defaultSemiBold">5.</ThemedText> ¡Disfruta viendo los comandos en tiempo real!
          </ThemedText>
        </View>
      </ThemedView>

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
  iconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 30,
    padding: 15,
    marginBottom: 15,
  },
  iconText: {
    fontSize: 40,
  },
  courseTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 5,
  },
  courseSubtitle: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    opacity: 0.9,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  projectInfoContainer: {
    gap: 12,
    marginBottom: 20,
  },
  infoCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.2)',
    gap: 8,
  },
  courseName: {
    fontSize: 16,
  },
  program: {
    fontSize: 16,
  },
  participantsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  participantCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.2)',
    gap: 12,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  participantIcon: {
    fontSize: 24,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '500',
  },
  stepContainer: {
    gap: 8,
    marginBottom: 20,
  },
  linkButton: {
    backgroundColor: '#667eea',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  linkText: {
    color: '#fff',
    fontWeight: '600',
  },
  featuresContainer: {
    gap: 12,
    marginBottom: 20,
  },
  featuresList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  featureIcon: {
    fontSize: 20,
  },
  featureText: {
    fontSize: 15,
    fontWeight: '500',
  },
  techContainer: {
    gap: 12,
    marginBottom: 20,
  },
  techGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  techItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(156, 39, 176, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(156, 39, 176, 0.2)',
  },
  techIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  techName: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  instructionsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  instructionsList: {
    gap: 12,
  },
  instructionStep: {
    fontSize: 15,
    lineHeight: 22,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
});