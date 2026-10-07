import { setRequestLocale } from 'next-intl/server';
import { CreateCharacter } from '@/components/tools/chalito/CreateCharacter';

// "Crea tu personaje": a photo becomes the person's own companion (a row on Chalito's Inicio).
export default async function CreateCharacterPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <CreateCharacter page />;
}
