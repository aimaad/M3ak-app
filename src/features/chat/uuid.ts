/** Identifiant v4 créé par l'app : une conversation neuve garde le même identifiant même si l'envoi est réessayé (plus de doublons). */
export function newId(random: () => number = Math.random): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(random() * 16);
    return (char === 'x' ? value : (value & 0x3) | 0x8).toString(16);
  });
}
