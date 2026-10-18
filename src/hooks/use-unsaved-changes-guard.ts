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
