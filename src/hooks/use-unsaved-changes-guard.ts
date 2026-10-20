import { useNavigation } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

import { useLanguage } from '@/i18n/use-language';

/**
 * Prévient avant de quitter un écran quand des modifications ne sont pas enregistrées (bouton retour, glissement,
 * retour Android). `onSave` (facultatif) ajoute le choix « Enregistrer et quitter » : il doit renvoyer true si
 * l'enregistrement a réussi ; sinon on reste sur l'écran.
 */
export function useUnsavedChangesGuard(dirty: boolean, onSave?: () => Promise<boolean>) {
  const navigation = useNavigation();
  const { t } = useLanguage();
  const leaving = useRef(false);

  // Sur iPhone, le glissement « retour » ferme l'écran nativement avant que l'application puisse le retenir : l'écran est
  // alors retiré côté système mais pas côté JS (erreur « removed natively but didn't get removed from JS state »).
  // Tant qu'il y a des modifications non enregistrées, on désactive donc ce glissement ; le bouton retour reste protégé.
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !dirty });
    return () => navigation.setOptions({ gestureEnabled: true });
  }, [dirty, navigation]);

  useEffect(() => {
    if (!dirty) return;
    return navigation.addListener('beforeRemove', (event) => {
      if (leaving.current) return;
      event.preventDefault();
      const leave = () => {
        leaving.current = true;
        navigation.dispatch(event.data.action);
      };
      Alert.alert(t('unsaved.title'), t('unsaved.body'), [
        { text: t('unsaved.stay'), style: 'cancel' },
        ...(onSave
          ? [
              {
                text: t('unsaved.save'),
                onPress: () => {
                  onSave().then((saved) => saved && leave());
                },
              },
            ]
          : []),
        { text: t('unsaved.discard'), style: 'destructive' as const, onPress: leave },
      ]);
    });
  }, [dirty, navigation, onSave, t]);
}
