import { useNetInfo } from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Brand } from '@/constants/theme';
import { ArrowIcon, HText } from '@/features/dashboard/home-ui';
import { scanErrorMessageKey } from '@/features/ocr/availability';
import { useOcrSettings } from '@/features/ocr/hooks';
import { OcrInactiveNotice } from '@/features/ocr/ocr-inactive-notice';
import { RoundButton } from '@/features/vehicles/add/add-ui';
import { FaceThumb, KeepSwitch, LegalSheet, ScanFrame, TipPills } from '@/features/vehicles/add/scan-parts';
import { setScanSession, type Face, type ScanItem } from '@/features/vehicles/add/scan-session';
import { setVehicleCreationDraft } from '@/features/vehicles/creation-draft';
import { withAlpha } from '@/features/vehicles/fleet-style';
import { filledCount, scanVehicleDocuments, type ScanErrorCode } from '@/features/vehicles/ocr';
import { useLanguage } from '@/i18n/use-language';

type Phase = 'capture' | 'analyzing' | 'error';
const CARD_RATIO = 54 / 85.6;
const FACES: Face[] = ['recto', 'verso'];

/**
 * Scanner la carte grise (recto puis verso). Aperçu caméra réel, cadre au format carte, déclencheur manuel, lampe et import depuis la galerie.
 * RIEN n'est détecté en direct (ni zones, ni netteté, ni reflet) : on ne montre que des conseils fixes. La lecture est faite par le serveur de lecture des documents,
 * une seule fois pour les deux faces ; les DEUX faces sont obligatoires (la lecture n'est proposée qu'avec le recto ET le verso).
 */
export default function ScannerCarteGriseScreen() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { availability, agencyId } = useOcrSettings();
  const netInfo = useNetInfo();
  const offline = netInfo.isConnected === false;
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [phase, setPhase] = useState<Phase>('capture');
  const [side, setSide] = useState<Face>('recto');
  const [photos, setPhotos] = useState<Record<Face, string | null>>({ recto: null, verso: null });
  const [torch, setTorch] = useState(false);
  const [keepPhoto, setKeepPhoto] = useState(true);
  const [legalOpen, setLegalOpen] = useState(false);
  const [shooting, setShooting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<ScanErrorCode | 'nothing_read' | null>(null);
  const [step, setStep] = useState(0);

  const frameWidth = Math.min(screenWidth - 40, 350);
  const frameHeight = Math.round(frameWidth * CARD_RATIO);
  const taken = FACES.filter((face) => photos[face]);
  const both = taken.length === 2;
  const active = availability === 'active';

  // Texte qui change pendant la lecture (pas de pourcentage : on ne sait pas combien de temps elle prendra).
  useEffect(() => {
    if (phase !== 'analyzing') return undefined;
    const timer = setInterval(() => setStep((current) => (current + 1) % 3), 1600);
    return () => clearInterval(timer);
  }, [phase]);

  function putPhoto(face: Face, uri: string) {
    setPhotos((previous) => ({ ...previous, [face]: uri }));
    setMessage(null);
    // Après le recto on passe au verso ; reprendre une face ne déplace pas l'autre.
    setSide(face === 'recto' && !photos.verso ? 'verso' : face);
  }

  async function shoot() {
    if (shooting || !cameraRef.current) return;
    setShooting(true);
    try {
      const picture = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!picture?.uri) throw new Error('no-uri');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      putPhoto(side, picture.uri);
    } catch {
      setMessage(t('vehicleAdd.scan.captureError'));
    } finally {
      setShooting(false);
    }
  }

  async function fromGallery() {
    const granted = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted.granted) {
      setMessage(t('vehicleAdd.scan.captureError'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    const uri = result.canceled ? null : (result.assets[0]?.uri ?? null);
    if (uri) putPhoto(side, uri);
  }

  /**
   * Lit le recto et le verso EN MÊME TEMPS : une seule analyse, lancée une seule fois, sur les deux photos ensemble. Un seul résultat réunit
   * ce qui est lisible sur l'une ou l'autre face. La durée affichée ensuite est la vraie.
   */
  async function analyze() {
    const entries: ScanItem[] = FACES.flatMap((face) => (photos[face] ? [{ face, uri: photos[face] as string }] : []));
    if (entries.length < FACES.length || offline) return; // recto ET verso
    setPhase('analyzing');
    setStep(0);
    setErrorCode(null);
    const startedAt = Date.now();
    const result = await scanVehicleDocuments(entries.map((entry) => entry.uri), { agencyId });
    // Rien de lisible (erreur, ou résultat vide) : on garde les photos et on propose de reprendre ou de saisir à la main.
    if (!result.ok || filledCount(result.fields) === 0) {
      setErrorCode(result.ok ? 'nothing_read' : result.error);
      setPhase('error');
      return;
    }
    setScanSession({ photos, scans: entries, merged: result.fields, durationMs: Date.now() - startedAt, fromCache: result.fromCache === true, keepPhoto, errorCode: null });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    router.replace('/flotte/nouveau/carte-lue');
  }

  function goManual() {
    setVehicleCreationDraft({ source: 'manual' });
    router.replace('/flotte/nouveau/finaliser');
  }

  // ---------------------------------------------------------------- états sans caméra
  const closeLabel = t('vehicleAdd.scan.closeScan');

  if (availability === 'loading') {
    return (
      <PlainScreen closeLabel={closeLabel}>
        <ActivityIndicator color={Brand.orange} />
      </PlainScreen>
    );
  }
  if (!active) {
    return (
      <PlainScreen closeLabel={closeLabel}>
        <OcrInactiveNotice availability={availability} />
        <PillButton label={t('vehicleAdd.scan.manual')} onPress={goManual} primary />
      </PlainScreen>
    );
  }
  if (phase === 'analyzing') {
    const steps = [t('vehicleAdd.scan.step1'), t('vehicleAdd.scan.step2'), t('vehicleAdd.scan.step3')];
    return (
      <PlainScreen closeLabel={closeLabel}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 14 }}>
          {FACES.filter((face) => photos[face]).map((face) => (
            <View key={face} style={{ width: 150, height: 96, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: Brand.strokeOnDark }}>
              <Image source={{ uri: photos[face] as string }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            </View>
          ))}
        </View>
        <View style={{ alignItems: 'center', gap: 12 }} accessibilityLiveRegion="polite">
          <ActivityIndicator color={Brand.orange} />
          <HText weight="semibold" size={15} color={Brand.white}>
            {t('vehicleAdd.scan.analyzing')}
          </HText>
          <HText size={13} color={Brand.mutedOnDark}>
            {steps[step]}
          </HText>
        </View>
      </PlainScreen>
    );
  }
  if (phase === 'error') {
    return (
      <PlainScreen closeLabel={closeLabel}>
        <View style={{ gap: 8 }}>
          <HText font="display" weight="bold" size={20} color={Brand.white} accessibilityRole="header">
            {t('vehicleAdd.scan.unreadable')}
          </HText>
          {errorCode && errorCode !== 'nothing_read' ? (
            <HText size={13} color={Brand.mutedOnDark}>
              {t(scanErrorMessageKey(errorCode))}
            </HText>
          ) : null}
        </View>
        <PillButton label={t('vehicleAdd.scan.retry')} onPress={analyze} primary />
        <PillButton label={t('vehicleAdd.scan.retake')} onPress={() => { setPhotos({ recto: null, verso: null }); setSide('recto'); setPhase('capture'); }} />
        <PillButton label={t('vehicleAdd.scan.manual')} onPress={goManual} />
      </PlainScreen>
    );
  }

  // ---------------------------------------------------------------- capture
  const title = side === 'recto' ? t('vehicleAdd.scan.titleRecto') : t('vehicleAdd.scan.titleVerso');
  const canRead = both;
  const readLabel = t('vehicleAdd.scan.readBoth');
  const cameraBlocked = !!permission && !permission.granted;
  const maskColor = withAlpha(Brand.scannerBackground, 0.62);

  return (
    <View style={{ flex: 1, backgroundColor: Brand.scannerBackground }}>
      <StatusBar style="light" />
      {permission?.granted ? <CameraView ref={cameraRef} style={{ position: 'absolute', top: 0, start: 0, end: 0, bottom: 0 }} facing="back" enableTorch={torch} /> : null}
      {/* Halo radial sombre par-dessus l'aperçu (lisibilité) */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, start: 0, end: 0, bottom: 0 }}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="scanVeil" cx="50%" cy="40%" rx="80%" ry="50%">
              <Stop offset="0" stopColor="#0B0D0E" stopOpacity={permission?.granted ? 0.15 : 0} />
              <Stop offset="0.6" stopColor="#0B0D0E" stopOpacity={permission?.granted ? 0.55 : 0.4} />
              <Stop offset="1" stopColor="#0B0D0E" stopOpacity={0.9} />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#scanVeil)" />
        </Svg>
      </View>

      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <RoundButton icon="close" label={t('vehicleAdd.scan.closeScan')} onPress={() => router.back()} />
        <View style={{ alignItems: 'center', gap: 2 }}>
          <HText font="display" weight="bold" size={16} color={Brand.white} accessibilityRole="header">
            {title}
          </HText>
          <HText weight="semibold" size={11} track={0.14} color={Brand.mutedOnDark}>
            {t('vehicleAdd.scan.step', { n: side === 'recto' ? 1 : 2 })}
          </HText>
        </View>
        <RoundButton icon="flash-outline" label={t('vehicleAdd.scan.torch')} onPress={() => setTorch((on) => !on)} active={torch} />
      </View>

      <View style={{ marginHorizontal: 20, marginTop: 14, flexDirection: 'row', gap: 6 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {FACES.map((face) => (
          <View key={face} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: photos[face] ? Brand.successOnDark : face === side ? Brand.orange : Brand.strokeOnDark }} />
        ))}
      </View>

      <View style={{ alignSelf: 'center', marginTop: 24, borderRadius: 18, backgroundColor: cameraBlocked ? maskColor : 'transparent' }}>
        <ScanFrame width={frameWidth} height={frameHeight} />
      </View>

      <View style={{ alignItems: 'center', gap: 12, marginTop: 18, paddingHorizontal: 20 }}>
        {cameraBlocked ? (
          <View style={{ alignItems: 'center', gap: 10 }}>
            <HText size={13} color={Brand.textOnDark} style={{ textAlign: 'center' }}>
              {permission?.canAskAgain ? t('vehicleAdd.scan.cameraAsk') : t('vehicleAdd.scan.cameraDenied')}
            </HText>
            <PillButton label={permission?.canAskAgain ? t('vehicleAdd.scan.allowCamera') : t('vehicleAdd.scan.gallery')} onPress={() => (permission?.canAskAgain ? void requestPermission() : void Linking.openSettings())} />
          </View>
        ) : (
          <View style={{ backgroundColor: withAlpha(Brand.graphite, 0.9), borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 }} accessibilityLiveRegion="polite">
            <HText weight="semibold" size={13} color={Brand.white}>
              {t('vehicleAdd.scan.placeCard')}
            </HText>
          </View>
        )}
        <TipPills tips={[t('vehicleAdd.scan.tipFlat'), t('vehicleAdd.scan.tipNoGlare'), t('vehicleAdd.scan.tipLight')]} />
        {message || offline ? (
          <HText size={12} weight="semibold" color={Brand.errorOnDark} style={{ textAlign: 'center' }} accessibilityLiveRegion="polite">
            {message ?? t('vehicleAdd.scan.offline')}
          </HText>
        ) : null}
      </View>

      {/* Panneau du bas */}
      <View style={{ position: 'absolute', start: 0, end: 0, bottom: 0, backgroundColor: Brand.scannerPanel, borderTopLeftRadius: 30, borderTopRightRadius: 30, borderTopWidth: 1, borderTopColor: Brand.surfaceOnDark, paddingTop: 16, paddingHorizontal: 20, paddingBottom: insets.bottom + 18, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={fromGallery} accessibilityRole="button" accessibilityLabel={t('vehicleAdd.scan.gallery')} style={{ width: 54, height: 54, borderRadius: 16, backgroundColor: Brand.surfaceOnDark, borderWidth: 1, borderColor: Brand.strokeOnDark, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="images-outline" size={22} color={Brand.white} />
          </Pressable>
          <Pressable
            onPress={shoot}
            disabled={cameraBlocked || shooting}
            accessibilityRole="button"
            accessibilityLabel={side === 'recto' ? t('vehicleAdd.scan.shootRecto') : t('vehicleAdd.scan.shootVerso')}
            style={{ width: 86, height: 86, borderRadius: 43, borderWidth: 4, borderColor: Brand.white, alignItems: 'center', justifyContent: 'center', opacity: cameraBlocked ? 0.4 : 1 }}
          >
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: Brand.orange, shadowColor: Brand.orange, shadowOpacity: 0.6, shadowRadius: 13, shadowOffset: { width: 0, height: 0 } }} />
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {FACES.map((face) => (
              <FaceThumb key={face} face={face} taken={!!photos[face]} current={side === face} onPress={() => setSide(face)} label={face === 'recto' ? t('vehicleAdd.scan.retakeRecto') : t('vehicleAdd.scan.retakeVerso')} />
            ))}
          </View>
        </View>

        {canRead ? (
          <Pressable
            onPress={analyze}
            disabled={offline}
            accessibilityRole="button"
            style={{ height: 50, borderRadius: 25, backgroundColor: Brand.orange, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: offline ? 0.5 : 1, shadowColor: Brand.orange, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 8 } }}
          >
            <HText weight="semibold" size={15} color={Brand.white}>
              {readLabel}
            </HText>
            <ArrowIcon color={Brand.white} size={16} />
          </Pressable>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 16, backgroundColor: Brand.graphite, borderWidth: 1, borderColor: Brand.borderOnDark }}>
          <Ionicons name="lock-closed-outline" size={18} color={Brand.mutedOnDark} />
          <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
            <HText weight="semibold" size={13} color={Brand.textOnDark}>
              {t('vehicleAdd.scan.keepLabel')}
            </HText>
            <HText size={11} color={Brand.mutedOnDark}>
              {t('vehicleAdd.scan.readBy')}
              <HText weight="semibold" size={11} color={Brand.orangeLight} onPress={() => setLegalOpen(true)} accessibilityRole="link">
                {t('vehicleAdd.scan.learnMore')}
              </HText>
            </HText>
          </View>
          <KeepSwitch value={keepPhoto} onChange={setKeepPhoto} label={t('vehicleAdd.scan.keepLabel')} />
        </View>
      </View>
      <LegalSheet visible={legalOpen} onClose={() => setLegalOpen(false)} />
    </View>
  );
}

/** Écran sombre simple (lecture en cours, erreur, lecture non active) avec le bouton fermer. */
function PlainScreen({ children, closeLabel }: { children: React.ReactNode; closeLabel: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: Brand.scannerBackground }}>
      <StatusBar style="light" />
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, flexDirection: 'row' }}>
        <RoundButton icon="close" label={closeLabel} onPress={() => router.back()} />
      </View>
      <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 16 }}>{children}</View>
    </View>
  );
}

function PillButton({ label, onPress, primary = false }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{ minHeight: 48, borderRadius: 24, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: primary ? Brand.orange : Brand.surfaceOnDark, borderWidth: primary ? 0 : 1, borderColor: Brand.strokeOnDark }}
    >
      <HText weight="semibold" size={14} color={Brand.white}>
        {label}
      </HText>
    </Pressable>
  );
}
