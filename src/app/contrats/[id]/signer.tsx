import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { M3akPalette } from '@/constants/theme';
import { useAgencyDetails, useMyAgency, useMyProfile } from '@/features/agency/hooks';
import { contractTemplateContext, contractTemplateValues, resolveTemplate } from '@/features/contracts/contract-pdf';
import { useContract, useSignContract } from '@/features/contracts/hooks';
import { hasLanguageToggle, readingSections } from '@/features/contracts/template';
import { useContractTemplate } from '@/features/contracts/template-hooks';
import { useSignature } from '@/features/signatures/hooks';
import { buildSignature, isSignatureDrawn } from '@/features/signatures/signature';
import { SignaturePad, SignatureView } from '@/features/signatures/signature-pad';
import { useLanguage } from '@/i18n/use-language';
import { friendlyErrorKey } from '@/lib/user-errors';

type Lang = 'fr' | 'ar';

function formatDateTime(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleString(lang === 'ar' ? 'ar' : 'fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Deux étapes remises au client : 1) lire le contrat en entier, 2) signer à la main.
 * La signature de l'employé (profil) est ajoutée automatiquement ; sans elle, on propose de la créer.
 */
export default function SignerContratScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, language } = useLanguage();
  const agencyQuery = useMyAgency();
  const agencyId = agencyQuery.data?.agencyId;
  const detailsQuery = useAgencyDetails(agencyId);
  const profileQuery = useMyProfile(agencyId);
  const myStaffSignature = useSignature(profileQuery.data?.signaturePath);
  const storedTemplate = useContractTemplate(agencyId);
  const { data: contract, isLoading } = useContract(id);
  const signContract = useSignContract();

  const [step, setStep] = useState<'read' | 'sign'>('read');
  const [lang, setLang] = useState<Lang>(language === 'ar' ? 'ar' : 'fr');
  const [reachedEnd, setReachedEnd] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [paths, setPaths] = useState<string[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrawing = useCallback((value: boolean) => setDrawing(value), []);

  const handlePadChange = useCallback((next: string[], nextSize: { width: number; height: number }) => {
    setPaths(next);
    setSize(nextSize);
  }, []);

  // Pendant le tracé, le bouton « retour » (Android) est ignoré.
  useEffect(() => {
    if (!drawing) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [drawing]);

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 48) setReachedEnd(true);
  }

  if (isLoading || !contract || storedTemplate.isLoading) {
    return (
      <ThemedView className="flex-1">
        <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
          <ScreenHeader title={t('contract.sign.title')} showBack />
          <View className="flex-1 items-center justify-center">
            {isLoading || storedTemplate.isLoading ? <ActivityIndicator color={M3akPalette.mauve} /> : <ThemedText themeColor="textSecondary">{t('contract.notFound')}</ThemedText>}
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (contract.statut !== 'pret_a_signer') {
    return (
      <ThemedView className="flex-1">
        <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
          <ScreenHeader title={t('contract.sign.title')} showBack />
          <View className="flex-1 items-center justify-center px-8 gap-4">
            <ThemedText themeColor="textSecondary" className="text-center">
              {t('contract.sign.notReady')}
            </ThemedText>
            <Button label={t('common.back')} variant="secondary" onPress={() => router.back()} />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const agencyInfo = {
    nom: detailsQuery.data?.nom ?? agencyQuery.data?.agencyName ?? '',
    raisonSociale: detailsQuery.data?.raisonSociale,
    adresse: detailsQuery.data?.adresse,
    ville: detailsQuery.data?.ville,
    telephone: detailsQuery.data?.telephone,
    email: detailsQuery.data?.email,
  };
  const customTemplate = storedTemplate.data?.template ?? null;
  const allSections = readingSections(resolveTemplate(contract, agencyInfo, customTemplate), contractTemplateValues(contract, agencyInfo), contractTemplateContext(contract));
  const toggle = hasLanguageToggle(allSections);
  const sections = toggle ? allSections.filter((section) => !section.lang || section.lang === lang) : allSections;
  const isAr = lang === 'ar';
  const direction = { writingDirection: isAr ? ('rtl' as const) : ('ltr' as const), textAlign: isAr ? ('right' as const) : ('left' as const) };
  const money = (value: number) => `${value.toLocaleString('fr-FR')} MAD`;
  const staffSignature = myStaffSignature.data ?? null;
  const staffMissing = !!profileQuery.data && !profileQuery.data.signaturePath;
  const clientDrawn = isSignatureDrawn(paths) && size.width > 0;
  const stampMissing = !!detailsQuery.data && !detailsQuery.data.stampPath;
  const logoMissing = !!detailsQuery.data && !detailsQuery.data.logoUrl;
  const canSign = clientDrawn && !!staffSignature && !stampMissing && !logoMissing && !signContract.isPending;

  async function handleSign() {
    if (!contract || !canSign || !staffSignature) return;
    setError(null);
    try {
      await signContract.mutateAsync({
        contract: { id: contract.id, agencyId: contract.agencyId },
        clientSignature: buildSignature(paths, size.width, size.height),
        agencySignature: staffSignature,
        terms: customTemplate,
      });
      router.replace({ pathname: '/contrats/[id]', params: { id: contract.id } });
    } catch (e) {
      const raw = e instanceof Error ? e.message : JSON.stringify(e);
      setError(
        t(/contract_agency_stamp_required/.test(raw) ? 'contract.sign.stampMissing' : /contract_agency_logo_required/.test(raw) ? 'contract.sign.logoMissing' : friendlyErrorKey(e, 'contract.sign.error'))
      );
    }
  }

  const summaryRows: [string, string][] = [
    [t('locations.customer'), contract.customerNom],
    [t('locations.vehicle'), `${contract.vehicleMarque} ${contract.vehicleModele} · ${contract.vehicleImmatriculation}`],
    [t('locations.period'), `${formatDateTime(contract.dateDebutPrevue, lang)} → ${formatDateTime(contract.dateFinPrevue, lang)}`],
    [t('locations.prixTotal'), contract.prixTotal != null ? money(contract.prixTotal) : '—'],
    [t('locations.cautionBlocked'), money(contract.cautionMontant)],
  ];

  return (
    <ThemedView className="flex-1">
      {/* Pendant la signature, le glissement « retour » (iOS) est désactivé : il se déclenchait en signant près du bord. */}
      <Stack.Screen options={{ gestureEnabled: step === 'read' }} />
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right', 'bottom']}>
        <ScreenHeader title={step === 'read' ? t('contract.sign.readTitle') : t('contract.sign.signTitle')} subtitle={contract.numero} showBack />

        {step === 'read' ? (
          <View className="flex-1">
            <View className="flex-row gap-2 px-6 pb-3" style={{ display: toggle ? 'flex' : 'none' }}>
              {(['fr', 'ar'] as Lang[]).map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setLang(option)}
                  className={`rounded-full border px-4 py-2 ${lang === option ? 'border-[#7C3AED] bg-[#7C3AED]' : 'border-[#EAE5F2] bg-white'}`}
                >
                  <ThemedText type="small" style={{ color: lang === option ? '#ffffff' : '#211A2E' }}>
                    {option === 'fr' ? 'Français' : 'العربية'}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <ScrollView
              className="flex-1"
              contentContainerClassName="gap-4 px-6 pb-6"
              onScroll={handleScroll}
              scrollEventThrottle={64}
              onContentSizeChange={(_, height) => {
                if (height < 400) setReachedEnd(true);
              }}
            >
              <Card padded={false} className="px-4">
                {summaryRows.map(([label, value]) => (
                  <View key={label} className="border-b border-[#EAE5F2] py-3 last:border-b-0">
                    <ThemedText type="small" themeColor="textSecondary" style={direction}>
                      {label}
                    </ThemedText>
                    <ThemedText type="smallBold" style={direction}>
                      {value}
                    </ThemedText>
                  </View>
                ))}
              </Card>

              {sections.map((section, index) => (
                <View key={index} className="gap-1">
                  {section.title ? (
                    <ThemedText type="smallBold" style={{ writingDirection: section.rtl ? 'rtl' : 'ltr', textAlign: section.rtl ? 'right' : 'left' }}>
                      {section.title}
                    </ThemedText>
                  ) : null}
                  {section.text ? (
                    <ThemedText type="default" style={{ writingDirection: section.rtl ? 'rtl' : 'ltr', textAlign: section.rtl ? 'right' : 'left' }}>
                      {section.text}
                    </ThemedText>
                  ) : null}
                </View>
              ))}
            </ScrollView>

            <View className="gap-3 border-t border-[#EAE5F2] bg-white px-6 py-4">
              {!reachedEnd ? (
                <ThemedText type="small" themeColor="textSecondary" className="text-center">
                  {t('contract.sign.scrollHint')}
                </ThemedText>
              ) : null}
              <Pressable
                onPress={() => reachedEnd && setAccepted((value) => !value)}
                disabled={!reachedEnd}
                className="flex-row items-center gap-3"
                style={{ opacity: reachedEnd ? 1 : 0.4 }}
              >
                <View
                  className={`h-6 w-6 items-center justify-center rounded-md border-2 ${accepted ? 'border-[#7C3AED] bg-[#7C3AED]' : 'border-[#B3A6C2] bg-white'}`}
                >
                  {accepted ? <ThemedText style={{ color: '#fff', lineHeight: 18 }}>✓</ThemedText> : null}
                </View>
                <ThemedText type="small" style={{ flex: 1 }}>
                  {t('contract.sign.accept')}
                </ThemedText>
              </Pressable>
              <Button label={t('contract.sign.continue')} onPress={() => setStep('sign')} disabled={!accepted} />
            </View>
          </View>
        ) : (
          <View className="flex-1 gap-4 px-6 pb-6">
            <View className="flex-1 gap-2">
              <ThemedText type="smallBold">{t('contract.sign.clientSignature')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('contract.sign.clientHelp', { name: contract.customerNom })}
              </ThemedText>
              <SignaturePad
                clearLabel={t('profil.signature.clear')}
                placeholder={t('contract.sign.padPlaceholder')}
                onChange={handlePadChange}
                onDrawingChange={handleDrawing}
              />
            </View>

            <View className="gap-2">
              <ThemedText type="smallBold">{t('contract.sign.agencySignature')}</ThemedText>
              <Card className="items-center gap-3">
                {staffSignature ? (
                  <SignatureView signature={staffSignature} height={56} />
                ) : staffMissing ? (
                  <>
                    <ThemedText type="small" style={{ color: M3akPalette.warning }} className="text-center">
                      {t('contract.sign.staffMissing')}
                    </ThemedText>
                    <Button label={t('profil.signature.add')} variant="secondary" size="sm" onPress={() => router.push('/profil/signature')} />
                  </>
                ) : (
                  <ActivityIndicator color={M3akPalette.mauve} />
                )}
              </Card>
            </View>

            {stampMissing ? (
              <ThemedText type="small" style={{ color: M3akPalette.danger }}>
                {t(agencyQuery.data?.role === 'owner' ? 'contract.sign.stampMissingOwner' : 'contract.sign.stampMissing')}
              </ThemedText>
            ) : null}
            {logoMissing ? (
              <ThemedText type="small" style={{ color: M3akPalette.danger }}>
                {t(agencyQuery.data?.role === 'owner' ? 'contract.sign.logoMissingOwner' : 'contract.sign.logoMissing')}
              </ThemedText>
            ) : null}
            {logoMissing && agencyQuery.data?.role === 'owner' ? (
              <Button label={t('entreprise.logo.add')} variant="secondary" size="sm" onPress={() => router.push('/entreprise')} />
            ) : null}
            {stampMissing && agencyQuery.data?.role === 'owner' ? (
              <Button label={t('entreprise.stamp.add')} variant="secondary" size="sm" onPress={() => router.push('/entreprise')} />
            ) : null}
            {error ? (
              <ThemedText type="small" style={{ color: M3akPalette.danger }}>
                {error}
              </ThemedText>
            ) : null}
            <Button label={t('contract.sign.confirm')} onPress={handleSign} disabled={!canSign} loading={signContract.isPending} />
            <Button label={t('contract.sign.backToReading')} variant="ghost" size="sm" onPress={() => setStep('read')} disabled={signContract.isPending} />
          </View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}
