import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { Card, Header, PrimaryButton, Screen } from '@/components/mobile-ui';
import { COLORS } from '@/lib/app-context';

export default function StudyGuidanceModal() {
  return <Screen><Header title="Orientação técnica"/><View style={{ padding: 20 }}><Card><Text style={{ color: COLORS.ink, fontWeight: '900', fontSize: 17 }}>Estudo consultivo</Text><Text style={{ color: COLORS.muted, fontSize: 13, lineHeight: 20, marginTop: 8 }}>As quantidades e locais sugeridos ajudam na conversa comercial. A instalação final deve ser definida por técnico habilitado após vistoria e avaliação de privacidade, campo de visão e infraestrutura.</Text><PrimaryButton onPress={() => router.back()} style={{ marginTop: 18 }}>Voltar ao estudo</PrimaryButton></Card></View></Screen>;
}
