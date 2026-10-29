import { Tabs } from 'expo-router/js-tabs';

import { AppTabBar } from '@/components/bottom-tab-bar';

/**
 * Les 5 onglets sont un vrai navigateur : chaque onglet reste monté et garde sa pile d'écrans et sa position de
 * défilement quand on change d'onglet. Les adresses (/clients, /flotte/…) ne changent pas : « (tabs) » est un groupe.
 */
export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <AppTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="accueil" />
      <Tabs.Screen name="flotte" />
      <Tabs.Screen name="clients" />
      <Tabs.Screen name="locations" />
      <Tabs.Screen name="equipe" />
    </Tabs>
  );
}
