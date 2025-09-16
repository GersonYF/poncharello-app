import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { HelloWave } from '@/components/hello-wave';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Link } from 'expo-router';
import React, { JSX, useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

export default function HomeScreen(): JSX.Element {
  // UI animation shared values
  const headerAnim = useSharedValue(0);
  const ctaScale = useSharedValue(1);

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerAnim.value,
    transform: [{ translateY: headerAnim.value ? 0 : -10 }],
  }));

  const ctaStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaScale.value }],
  }));

  useEffect(() => {
    headerAnim.value = withTiming(1, { duration: 600 });
    // small entrance pulse for CTA
    ctaScale.value = withSequence(withTiming(1.06, { duration: 200 }), withTiming(1, { duration: 220 }));
  }, [headerAnim, ctaScale]);

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#667eea', dark: '#1D3D47' }}
      headerImage={
        <LinearGradient
          // softer, more neutral gradient
          colors={['#3a7bd5', '#00d2ff']}
          start={[0, 0]}
          end={[1, 1]}
          style={styles.headerGradient}
        >
          <Animated.View style={[styles.headerContent, headerStyle] as any}>
            <View style={styles.iconContainerFixed}>
              <ThemedText style={styles.iconText}>🤖</ThemedText>
            </View>
            <ThemedText style={styles.courseTitle}>IA en Embebidos</ThemedText>
            <ThemedText style={styles.courseSubtitle}>Arduino BLE Controller</ThemedText>
          </Animated.View>
        </LinearGradient>
      }>

      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">¡Bienvenidos!</ThemedText>
        <HelloWave />
      </ThemedView>

      <ThemedView style={styles.summaryCardContainer}>
        <ThemedView style={styles.summaryCard}>
          <ThemedText style={styles.summaryTitle}>IA en Embebidos</ThemedText>
          <ThemedText style={styles.summarySubtitle}>Arduino BLE Controller • Ingeniería de Datos e IA</ThemedText>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <ThemedText style={styles.summaryIcon}>📡</ThemedText>
              <ThemedText style={styles.summaryText}>Conexión BLE</ThemedText>
            </View>
            <View style={styles.summaryItem}>
              <ThemedText style={styles.summaryIcon}>�️</ThemedText>
              <ThemedText style={styles.summaryText}>Visualización</ThemedText>
            </View>
            <View style={styles.summaryItem}>
              <ThemedText style={styles.summaryIcon}>⚡</ThemedText>
              <ThemedText style={styles.summaryText}>Respuesta</ThemedText>
            </View>
          </View>

          <View style={styles.participantsCompact}>
            <ThemedText style={styles.participantName}>Gerson Yarce Franco</ThemedText>
            <ThemedText style={styles.participantName}>David Velásquez Lenis</ThemedText>
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
            <Animated.View style={ctaStyle as any}>
              <ThemedView style={styles.linkButton}>
                <ThemedText type="subtitle" style={styles.linkText}>
                  🔗 Ir a Control Arduino
                </ThemedText>
              </ThemedView>
            </Animated.View>
          </Link.Trigger>
        </Link>
        <ThemedText>
          Navega a la pestaña Arduino para comenzar a usar el controlador BLE.
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.featuresContainerCompact}>
        <ThemedText type="subtitle">✨ Lo esencial</ThemedText>
        <View style={styles.featuresCompactRow}>
          <ThemedText style={styles.featureText}>Conexión BLE · Visualización · Respuesta</ThemedText>
        </View>
      </ThemedView>

      <ThemedView style={styles.instructionsContainerCompact}>
        <ThemedText type="subtitle">📋 Cómo empezar</ThemedText>
        <ThemedText style={styles.instructionShort}>1. Enciende tu Arduino con BLE</ThemedText>
        <ThemedText style={styles.instructionShort}>2. Ve a la pestaña Arduino</ThemedText>
        <ThemedText style={styles.instructionShort}>3. Presiona Buscar Dispositivos BLE</ThemedText>
      </ThemedView>

    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerGradient: {
    height: 280,
    width: '100%',
  },
  headerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 12,
  },
  iconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 30,
    padding: 15,
    marginBottom: 15,
  },
  iconText: {
    fontSize: 42,
    lineHeight: 48,
  },
  iconContainerFixed: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 40,
    padding: 18,
    marginBottom: 12,
    overflow: 'visible',
  },
  courseTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 40,
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
  /* new compact-summary styles */
  summaryCardContainer: {
    marginBottom: 18,
    paddingHorizontal: 10,
  },
  summaryCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  summarySubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryIcon: {
    fontSize: 20,
    marginBottom: 6,
  },
  summaryText: {
    fontSize: 12,
    textAlign: 'center',
  },
  participantsCompact: {
    marginTop: 8,
  },
  /* compact features */
  featuresContainerCompact: {
    marginBottom: 18,
  },
  featuresCompactRow: {
    paddingHorizontal: 10,
  },
  instructionShort: {
    fontSize: 14,
    marginBottom: 6,
  },
  instructionsContainerCompact: {
    gap: 8,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
});