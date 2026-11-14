/* eslint-disable import/first -- les « jest.mock » doivent précéder les imports */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import ar from '@/i18n/locales/ar.json';
import fr from '@/i18n/locales/fr.json';

const mockLookup = (dict: unknown, key: string): string => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dict) as string;
const mockState = { language: 'fr' };
const mockT = (key: string, o?: Record<string, unknown>) => (mockLookup(mockState.language === 'ar' ? ar : fr, key) ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(o?.[name] ?? ''));

jest.mock('@/i18n/use-language', () => ({ useLanguage: () => ({ language: mockState.language, t: mockT }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(async () => undefined), ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@react-native-community/datetimepicker', () => ({ __esModule: true, default: () => null, DateTimePickerAndroid: { open: jest.fn() } }));
jest.mock('expo-image-manipulator', () => ({}));
jest.mock('expo-camera', () => ({ CameraView: () => null, useCameraPermissions: () => [{ granted: true }, jest.fn()] }));
jest.mock('expo-image-picker', () => ({}));
jest.mock('@/features/vehicles/add/scan-parts', () => ({ ScanFrame: () => null }));

import { AngleGrid, Button, ChoiceTiles, ColorSwatches, DangerLink, DateField, DocumentList, DocumentSlot, EmptyState, FormField, InfoBanner, NumberStepper, PhotoTile, PriceStepper, SaveBar, SearchList, Segmented } from '..';

const hidden = { includeHiddenElements: true };

describe('FormField', () => {
  it('vide : l’exemple en texte d’aide, jamais « — » ni « 0 »', async () => {
    await render(<FormField label="Couleur" value="" onChangeText={jest.fn()} placeholder="ex. Blanc" />);
    expect(screen.getByPlaceholderText('ex. Blanc')).toBeTruthy();
    expect(screen.queryByText('—')).toBeNull();
  });

  it('en cours : les suggestions s’affichent sous le champ pendant la saisie et se choisissent d’un tap', async () => {
    const onPick = jest.fn();
    await render(<FormField label="Marque" value="Dac" onChangeText={jest.fn()} suggestions={['Dacia', 'Daewoo']} onPickSuggestion={onPick} />);
    expect(screen.queryByText('Dacia')).toBeNull(); // pas de suggestions hors saisie
    await fireEvent(screen.getByLabelText('Marque'), 'focus');
    await fireEvent.press(screen.getByText('Dacia'));
    expect(onPick).toHaveBeenCalledWith('Dacia');
  });

  it('erreur : jamais pendant la frappe ; à la sortie du champ, avec un message précis', async () => {
    await render(<FormField label="N° de série (VIN)" value="UU1LSDAAH5432" onChangeText={jest.fn()} error="13 caractères sur 17. Vérifiez la carte grise." />);
    await fireEvent(screen.getByLabelText('N° de série (VIN)'), 'focus');
    expect(screen.queryByText(/13 caractères sur 17/)).toBeNull();
    await fireEvent(screen.getByLabelText('N° de série (VIN)'), 'blur');
    expect(screen.getByText('13 caractères sur 17. Vérifiez la carte grise.')).toBeTruthy();
  });

  it('erreur : affichée aussi à l’enregistrement (showError), sans avoir quitté le champ', async () => {
    await render(<FormField label="VIN" value="x" onChangeText={jest.fn()} error="Trop court." showError />);
    expect(screen.getByText('Trop court.')).toBeTruthy();
  });

  it('lu par l’IA : badge jusqu’à ce que l’utilisateur modifie la valeur', async () => {
    await render(<FormField label="Modèle" value="Logan" onChangeText={jest.fn()} aiRead />);
    expect(screen.getByText("Lu par l'IA")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Modèle'), 'Logan MCV');
    expect(screen.queryByText("Lu par l'IA")).toBeNull();
  });

  it('verrouillé : non modifiable, la raison est écrite', async () => {
    await render(<FormField label="Propriétaire" value="AGENCE TEST" onChangeText={jest.fn()} locked lockedReason="Vient de la carte grise" />);
    expect(screen.getByText('Vient de la carte grise')).toBeTruthy();
    expect(screen.getByLabelText('Propriétaire').props.editable).toBe(false);
    expect(screen.getByLabelText('Propriétaire').props.accessibilityState).toEqual({ disabled: true });
  });

  it('unité dans le champ et milliers séparés ; onChangeText reçoit les chiffres', async () => {
    const onChange = jest.fn();
    await render(<FormField label="Kilométrage" value="45200" onChangeText={onChange} unit="km" thousands />);
    expect(screen.getByDisplayValue('45 200')).toBeTruthy();
    expect(screen.getByText('km')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Kilométrage'), '45 2001');
    expect(onChange).toHaveBeenCalledWith('452001');
  });
});

describe('nombres et prix', () => {
  it('NumberStepper : − et +, bornes, vide sans « 0 » ni « — »', async () => {
    const onChange = jest.fn();
    await render(<NumberStepper label="Places" value={5} onChange={onChange} min={2} max={9} />);
    await fireEvent.press(screen.getByLabelText('Moins'));
    expect(onChange).toHaveBeenLastCalledWith(4);
    await fireEvent.press(screen.getByLabelText('Plus'));
    expect(onChange).toHaveBeenLastCalledWith(6);
  });

  it('NumberStepper : valeur vide → le premier « + » donne le minimum', async () => {
    const onChange = jest.fn();
    await render(<NumberStepper label="Places" value={null} onChange={onChange} min={2} />);
    expect(screen.queryByText('0')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Plus'));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('PriceStepper : pas de 50, minimum 50, saisie directe, suggestions au tap', async () => {
    const onChange = jest.fn();
    const onWeek = jest.fn();
    await render(<PriceStepper label="Prix par jour" value={500} onChange={onChange} suggestions={[{ label: 'Semaine : 3 000 (−15 %)', onPress: onWeek }]} />);
    await fireEvent.press(screen.getByLabelText('Plus'));
    expect(onChange).toHaveBeenLastCalledWith(550);
    await fireEvent.press(screen.getByLabelText('Moins'));
    expect(onChange).toHaveBeenLastCalledWith(450);
    await fireEvent.changeText(screen.getByLabelText('Prix par jour'), '6 200');
    expect(onChange).toHaveBeenLastCalledWith(6200);
    await fireEvent.press(screen.getByText('Semaine : 3 000 (−15 %)'));
    expect(onWeek).toHaveBeenCalled();
    expect(screen.getByText('MAD / jour')).toBeTruthy();
  });

  it('PriceStepper : au minimum, « − » est désactivé', async () => {
    await render(<PriceStepper label="Prix par jour" value={50} onChange={jest.fn()} />);
    expect(screen.getByLabelText('Moins').props.accessibilityState.disabled).toBe(true);
  });
});

describe('choix', () => {
  const gears = [{ value: 'manuelle', label: 'Manuelle' }, { value: 'automatique', label: 'Automatique' }];

  it('Segmented : valeur connue sélectionnée, rien d’« À choisir »', async () => {
    await render(<Segmented label="Boîte de vitesses" options={gears} value="manuelle" onChange={jest.fn()} />);
    expect(screen.getByLabelText('Manuelle').props.accessibilityState.checked).toBe(true);
    expect(screen.queryByText('À choisir')).toBeNull();
  });

  it('Segmented : valeur inconnue → aucune présélection, « À choisir » ; un tap choisit', async () => {
    const onChange = jest.fn();
    await render(<Segmented label="Boîte de vitesses" options={gears} value={null} onChange={onChange} />);
    expect(screen.getByText('À choisir')).toBeTruthy();
    expect(screen.getByLabelText('Manuelle').props.accessibilityState.checked).toBe(false);
    expect(screen.getByLabelText('Automatique').props.accessibilityState.checked).toBe(false);
    await fireEvent.press(screen.getByLabelText('Automatique'));
    expect(onChange).toHaveBeenCalledWith('automatique');
  });

  it('ChoiceTiles : 7 tuiles dont Minibus sur une seule ligne qui défile', async () => {
    const options = ['Économique', 'Compacte', 'Berline', 'SUV', 'Utilitaire', 'Minibus', 'Luxe'].map((label) => ({ value: label.toLowerCase(), label, icon: 'car-outline' as const }));
    const onChange = jest.fn();
    await render(<ChoiceTiles label="Catégorie" options={options} value="suv" onChange={onChange} />);
    expect(screen.getAllByRole('radio', hidden)).toHaveLength(7);
    expect(screen.getByLabelText('SUV').props.accessibilityState.checked).toBe(true);
    await fireEvent.press(screen.getByLabelText('Minibus'));
    expect(onChange).toHaveBeenCalledWith('minibus');
  });

  it('ColorSwatches : « BLANC » est affiché « Blanc » et sélectionne la bonne pastille, sans rien écrire', async () => {
    const onChange = jest.fn();
    await render(<ColorSwatches label="Couleur" value="BLANC" onChange={onChange} />);
    expect(screen.getByLabelText('Blanc').props.accessibilityState.checked).toBe(true);
    expect(screen.getAllByText('Blanc').length).toBeGreaterThan(0);
    expect(onChange).not.toHaveBeenCalled(); // la base n'est pas réécrite avant un changement
  });

  it('ColorSwatches : changer de pastille enregistre la valeur normalisée', async () => {
    const onChange = jest.fn();
    await render(<ColorSwatches label="Couleur" value="BLANC" onChange={onChange} />);
    await fireEvent.press(screen.getByLabelText('Rouge'));
    expect(onChange).toHaveBeenCalledWith('Rouge');
  });

  it('ColorSwatches : valeur inconnue → « Autre » avec la valeur dans un champ texte', async () => {
    await render(<ColorSwatches label="Couleur" value="Vert olive" onChange={jest.fn()} />);
    expect(screen.getByLabelText('Autre').props.accessibilityState.checked).toBe(true);
    expect(screen.getByDisplayValue('Vert olive')).toBeTruthy();
  });

  it('ColorSwatches : aucune couleur → aucune pastille choisie', async () => {
    await render(<ColorSwatches label="Couleur" value={null} onChange={jest.fn()} />);
    expect(screen.getByLabelText('Blanc').props.accessibilityState.checked).toBe(false);
  });
});

describe('DateField', () => {
  it('vide : « Choisir une date », jamais « — »', async () => {
    await render(<DateField label="Prochaine vidange" value={null} onChange={jest.fn()} />);
    expect(screen.getByText('Choisir une date')).toBeTruthy();
    expect(screen.queryByText('—')).toBeNull();
  });

  it('date en clair + rappel relatif', async () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 3);
    const iso = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`;
    await render(<DateField label="Prochaine vidange" value={iso} onChange={jest.fn()} extra="· ou à 55 200 km" />);
    expect(screen.getByText('dans 3 jours · ou à 55 200 km')).toBeTruthy();
  });

  it('erreur : seulement quand showError', async () => {
    await render(<DateField label="Fin" value={null} onChange={jest.fn()} error="Choisissez la date de fin." showError />);
    expect(screen.getByText('Choisissez la date de fin.')).toBeTruthy();
  });
});

describe('boutons', () => {
  it('principal : appelle onPress', async () => {
    const onPress = jest.fn();
    await render(<Button label="Enregistrer" onPress={onPress} />);
    await fireEvent.press(screen.getByLabelText('Enregistrer'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('chargement : non cliquable avec « Enregistrement… »', async () => {
    const onPress = jest.fn();
    await render(<Button label="Enregistrer" onPress={onPress} loading />);
    expect(screen.getByText('Enregistrement…')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Enregistrer'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('désactivé : dit POURQUOI, dessous', async () => {
    const onPress = jest.fn();
    await render(<Button label="Continuer" onPress={onPress} disabled disabledReason="Choisissez d'abord un client." />);
    expect(screen.getByText("Choisissez d'abord un client.")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Continuer'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('lien rouge discret : appelle onPress', async () => {
    const onPress = jest.fn();
    await render(<DangerLink label="Archiver ce véhicule" onPress={onPress} />);
    await fireEvent.press(screen.getByText('Archiver ce véhicule'));
    expect(onPress).toHaveBeenCalled();
  });

  it('lien rouge désactivé : la raison est écrite', async () => {
    await render(<DangerLink label="Archiver ce véhicule" onPress={jest.fn()} disabled reason="Elle est en location." />);
    expect(screen.getByText('Elle est en location.')).toBeTruthy();
  });
});

describe('SaveBar', () => {
  it('invisible sans modification', async () => {
    await render(<SaveBar changes={[]} onSave={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.queryByText('Enregistrer')).toBeNull();
  });

  it('apparaît avec le nombre et la liste des champs', async () => {
    await render(<SaveBar changes={['Boîte', 'kilométrage', 'couleur']} onSave={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByText('3 modifications')).toBeTruthy();
    expect(screen.getByText('Boîte, kilométrage, couleur')).toBeTruthy();
  });

  it('une modification : « 1 modification » ; Annuler et Enregistrer appellent leurs fonctions', async () => {
    const onSave = jest.fn();
    const onCancel = jest.fn();
    await render(<SaveBar changes={['Couleur']} onSave={onSave} onCancel={onCancel} />);
    expect(screen.getByText('1 modification')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Enregistrer'));
    await fireEvent.press(screen.getByLabelText('Annuler'));
    expect(onSave).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it('enregistrement en cours : non cliquable', async () => {
    const onSave = jest.fn();
    await render(<SaveBar changes={['Couleur']} onSave={onSave} onCancel={jest.fn()} busy />);
    await fireEvent.press(screen.getByLabelText('Enregistrement…'));
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('photos et documents', () => {
  it('DocumentSlot vide : un seul geste « Scanner », libellé dessous', async () => {
    const onScan = jest.fn();
    await render(<DocumentSlot label="Verso" hint="à ajouter" uri={null} onScan={onScan} />);
    expect(screen.getByText('Verso · à ajouter')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Scanner : Verso'));
    expect(onScan).toHaveBeenCalled();
    expect(screen.queryByText('Galerie')).toBeNull(); // la galerie est proposée depuis la caméra
  });

  it('DocumentSlot rempli : badge « 9 champs lus » et menu Voir · Remplacer · Supprimer', async () => {
    const onView = jest.fn();
    const onRemove = jest.fn();
    await render(<DocumentSlot label="Recto" uri="file:///recto.jpg" readCount={9} onScan={jest.fn()} onView={onView} onReplace={jest.fn()} onRemove={onRemove} />);
    expect(screen.getByText('9 champs lus')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Plus d’actions : Recto'.replace('’', "'")));
    expect(await screen.findByText('Voir', hidden)).toBeTruthy();
    expect(screen.getByText('Remplacer', hidden)).toBeTruthy();
    await fireEvent.press(screen.getByText('Supprimer', hidden));
    expect(onRemove).toHaveBeenCalled();
  });

  it('PhotoTile : envoi en cours annoncé avec le pourcentage', async () => {
    await render(<PhotoTile uri="file:///a.jpg" state="uploading" progress={0.4} label="Avant" />);
    expect(screen.getByLabelText('Avant. Envoi en cours 40 %')).toBeTruthy();
  });

  it('PhotoTile : photo principale', async () => {
    await render(<PhotoTile uri="file:///a.jpg" state="added" main label="Avant" />);
    expect(screen.getByText('PRINCIPALE')).toBeTruthy();
  });

  it('PhotoTile : inutilisable → raison et « Réessayer » (la photo n’est pas enregistrée)', async () => {
    const onRetry = jest.fn();
    await render(<PhotoTile uri="file:///a.jpg" state="rejected" reason="Photo trop petite" label="Avant" onRetry={onRetry} />);
    expect(screen.getByText('Photo trop petite')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Réessayer'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('AngleGrid : 6 angles, avancement « 1 sur 6 », case vide avec l’icône de l’angle', async () => {
    const angles = ['Avant', 'Arrière', 'Côté gauche', 'Côté droit', 'Intérieur', 'Compteur'];
    const slots = angles.map((label, index) => ({ key: label, label, icon: 'car-outline' as const, uri: index === 0 ? 'file:///a.jpg' : null, main: index === 0 }));
    const onPress = jest.fn();
    await render(<AngleGrid slots={slots} onPress={onPress} />);
    expect(screen.getByText('1 sur 6')).toBeTruthy();
    expect(screen.getByText('PRINCIPALE')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Ajouter la photo arrière'));
    expect(onPress).toHaveBeenCalledWith('Arrière');
  });

  it('DocumentList : une ligne par document, « Scanner » en orange s’il manque', async () => {
    const onScan = jest.fn();
    await render(
      <DocumentList
        rows={[
          { key: 'cg', name: 'Carte grise', sub: "Recto et verso · lue par l'IA", subTone: 'ok', thumbUri: 'file:///cg.jpg', action: { label: 'Voir', onPress: jest.fn() } },
          { key: 'vt', name: 'Visite technique', sub: 'Pas encore ajoutée', action: { label: 'Scanner', tone: 'primary', onPress: onScan } },
        ]}
      />,
    );
    expect(screen.getByText("Recto et verso · lue par l'IA")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Scanner : Visite technique'));
    expect(onScan).toHaveBeenCalled();
  });
});

describe('états vides, bandeau, liste avec recherche', () => {
  it('EmptyState : titre, phrase et puces d’action', async () => {
    const onChip = jest.fn();
    await render(<EmptyState icon="construct-outline" title="Aucun entretien prévu" text="BIBIP vous préviendra avant chaque échéance" chips={[{ label: '+ Vidange', onPress: onChip }]} />);
    await fireEvent.press(screen.getByText('+ Vidange'));
    expect(onChip).toHaveBeenCalled();
    expect(screen.getByText('Aucun entretien prévu')).toBeTruthy();
  });

  it('InfoBanner : texte fort + texte atténué dans un seul bloc lisible', async () => {
    await render(<InfoBanner strong="9 champs remplis depuis la carte grise." muted="Il reste la boîte et le kilométrage." />);
    expect(screen.getByLabelText('9 champs remplis depuis la carte grise. Il reste la boîte et le kilométrage.')).toBeTruthy();
  });

  it('SearchList : filtre par la recherche et choisit en un tap', async () => {
    const onSelect = jest.fn();
    const options = Array.from({ length: 12 }, (_, i) => ({ value: `v${i}`, label: ['Casablanca', 'Rabat', 'Fès', 'Marrakech', 'Tanger', 'Agadir', 'Meknès', 'Oujda', 'Kénitra', 'Tétouan', 'Safi', 'Nador'][i] }));
    await render(<SearchList visible title="Ville" options={options} selected={null} onSelect={onSelect} onClose={jest.fn()} />, {});
    await fireEvent.changeText(screen.getByLabelText('Rechercher', hidden), 'ra');
    expect(screen.queryByText('Casablanca', hidden)).toBeNull(); // « Casablanca » ne contient pas « ra »
    await fireEvent.press(screen.getByText('Rabat', hidden));
    expect(onSelect).toHaveBeenCalledWith('v1');
  });

  it('SearchList : aucun résultat', async () => {
    await render(<SearchList visible title="Ville" options={[{ value: 'a', label: 'Casablanca' }]} selected={null} onSelect={jest.fn()} onClose={jest.fn()} searchable />);
    await fireEvent.changeText(screen.getByLabelText('Rechercher', hidden), 'zzz');
    expect(screen.getByText('Aucun résultat', hidden)).toBeTruthy();
  });
});

describe('arabe (RTL)', () => {
  it('libellés du kit en arabe', async () => {
    mockState.language = 'ar';
    await render(<SaveBar changes={['اللون']} onSave={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByText('تعديل واحد')).toBeTruthy();
    expect(screen.getByLabelText('حفظ')).toBeTruthy();
    mockState.language = 'fr';
  });

  it('ChoiceTiles : une tuile peut avoir une image comme icône (teintée) et reste choisissable', async () => {
    const onChange = jest.fn();
    await render(<ChoiceTiles<'a' | 'b'> label="Type" value="a" onChange={onChange} options={[{ value: 'a', label: 'Freins', icon: 1 }, { value: 'b', label: 'Pneus', icon: 'ellipse-outline' }]} />);
    expect(screen.getByLabelText('Freins').props.accessibilityState.checked).toBe(true);
    await fireEvent.press(screen.getByLabelText('Pneus'));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
