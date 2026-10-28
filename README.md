# Estudo de Segurança · Verisure

Aplicativo Expo/React Native com navegação por abas e menu lateral, fluxo de estudo em cinco etapas, pack local de equipamentos, catálogo e módulos para propostas, condições, chat, perfil, configurações e ajuda.

## Executar localmente

```bash
npm install
npm run web -- --port 8082
# ou: npx expo start
```

## Publicação contínua no GitHub Pages

O workflow `.github/workflows/deploy-pages.yml` publica o export web a cada push para `main` e também pode ser iniciado manualmente. Para habilitar:

1. Em Settings → Secrets and variables → Actions, crie `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` usando os valores públicos do projeto Supabase. A chave publishable pode estar no bundle web; nunca cadastre `service_role` ou segredo SMTP como variável `EXPO_PUBLIC_*`.
2. Em Settings → Pages, escolha GitHub Actions como fonte de publicação.
3. Em Supabase → Authentication → URL Configuration, configure o endereço do site publicado e adicione `https://entretrutas-sketch.github.io/estudo-de-seguranca/`, `https://entretrutas-sketch.github.io/estudo-de-seguranca/auth/callback` e `verisureestudo://auth/callback` à lista de redirects permitidos.
4. Aplique as migrations do backend e configure SMTP e Microsoft OAuth conforme as instruções acima antes de liberar o app para especialistas.

O site estático fica servido pelo GitHub Pages, enquanto autenticação, dados, armazenamento e chat dependem do Supabase ativo. GitHub Pages não executa um servidor mobile ou backend 24 horas; builds Android/iOS e publicação nas lojas são etapas separadas.

TypeScript está estrito. Verificações disponíveis:

```bash
npm exec tsc -- --noEmit
npm exec expo lint
npm exec expo export -- --platform web
npm exec expo-doctor
```

## Supabase e acesso por código Outlook/Microsoft

O repositório original não tinha API tRPC/Drizzle ou migrations de backend. Esta implementação usa Supabase Auth, Postgres, RPC, Storage privado e Realtime. O projeto Supabase e as migrations já foram configurados para o ambiente local conectado.

1. Crie/seleciona um projeto Supabase. Copie `.env.example` para `.env` e defina `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Apenas a chave publishable/anon pode ir no app; nunca use service role, senha de banco ou segredo OAuth no bundle.
2. Aplique em sequência `supabase/migrations/202610270001_initial_schema.sql` até `supabase/migrations/202610270005_profile_avatars.sql` pelo Supabase CLI ou SQL Editor.
3. A migration 004 carrega as referências informadas para KIT PROTECTION, BT4, BT6 e BT8, ativa esses registros e mantém preços, limites e composição em `public.commercial_catalog`; os limites gerais da composição personalizada ficam em `public.commercial_settings`. A proposta livre aceita valores brutos informados pelo especialista, mas valida limites e recalcula tudo no RPC antes de persistir.
4. Administradores comerciais podem manter as linhas do catálogo e as regras no Supabase Table Editor/SQL Editor sem alterar o app. Para permitir leitura/edição pelo cliente autenticado, defina o claim confiável `app_metadata.role` como `commercial_admin` (ou `admin`) no usuário de gestão. Exemplo executado por um operador com acesso SQL administrativo: `update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"commercial_admin"}'::jsonb where id = '<UUID-DO-ADMIN>';`. Atualize a sessão do usuário após alterar o claim. Especialistas não recebem permissão para editar catálogo ou regras.
5. O acesso sem senha solicita um código de uso único para o endereço digitado e confirma com `verifyOtp`. Para receber na caixa Outlook, a pessoa deve informar seu endereço Outlook ou corporativo Microsoft; contas `@gmail.com` e `@googlemail.com` são recusadas no fluxo de código. Em Supabase → Authentication → Email Templates, inclua `{{ .Token }}` no template de Magic Link/OTP para que a mensagem contenha o código de seis dígitos. O envio é feito pelo Supabase Auth; configure SMTP próprio em Supabase → Authentication → SMTP Settings, com um remetente autorizado. O SMTP do Microsoft 365 pode exigir SMTP AUTH habilitado e configuração compatível com a política do tenant; nunca coloque senha de e-mail ou segredo SMTP no app.
6. O botão “Entrar com conta Microsoft” exige um app OAuth criado no Microsoft Entra ID e configurado em Supabase → Authentication → Providers → Azure. Cadastre no Entra o callback `https://<project-ref>.supabase.co/auth/v1/callback`, habilite `email`, `openid`, `profile` e a permissão delegada Microsoft Graph `User.Read`. O Client ID e o segredo ficam somente no Supabase. Cadastre também o scheme `verisureestudo://auth/callback` e a URL web em Authentication → URL Configuration.
7. Após consentimento Microsoft, o app busca a foto oficial em Microsoft Graph e salva no bucket privado `profile-avatars`. A foto só aparece se existir no perfil Microsoft e o usuário/provedor permitir o acesso. Aplique todas as migrations, reinicie o Expo e teste em build web/nativo.

Para liberar o chat, a gestão deve adicionar somente especialistas autorizados em `public.team_chat_members`, definindo `enabled = true` no SQL Editor (por exemplo, inserindo o `auth.users.id` depois de confirmar o e-mail). RLS bloqueia leitura e envio de quem não estiver nessa tabela.

## Variáveis de ambiente

| Variável | Necessária | Uso |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Sim para backend | URL pública do projeto Supabase |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sim para backend | Chave pública do cliente; nunca `service_role` |

Credenciais Microsoft OAuth e SMTP ficam no painel Supabase, não no app. `DATABASE_URL`, `JWT_SECRET`, client secret e senha de SMTP não podem ser incluídos no bundle mobile.

## O que está disponível no código

- Rascunho local nativo em SecureStore, tokens nativos protegidos por SecureStore, avaliação de acessos, reverse geocoding editável, consentimento e upload de fotos ao bucket privado quando o backend estiver configurado. Preferências sem dados pessoais usam AsyncStorage. Na web, o rascunho fica somente na sessão atual.
- Autenticação e estudos separados por usuário com Supabase, RPC de preço/salvamento e criação idempotente de proposta; RLS e auditoria comercial via migration.
- Chat geral via Supabase Realtime com indicador de conexão; sem serviço configurado, o app não inventa mensagens nem simula envio.
- Ao finalizar um estudo sincronizado, o app registra uma proposta com snapshot de preços do catálogo, descontos validados, data/hora e versão; mostra uma prévia, gera PDF de três páginas, permite imprimir/salvar e compartilhar o arquivo pela folha nativa. Abrir o compartilhamento não significa que a mensagem foi enviada.
- “Criar proposta comercial” permite combinar um kit ativo ou composição personalizada, acrescentar equipamentos e itens livres, informar apenas os totais brutos e descontos, revisar e emitir PDF. Totais são calculados no servidor por `create_custom_proposal`; valores individuais de equipamento não são armazenados ou exibidos.
- A proposta usa o logotipo e os assets do catálogo, omite campos opcionais vazios e gera a mensagem de WhatsApp sem preços individuais ou percentuais de desconto.
- Imagens do pack em `assets/equipment/`, nomeadas conforme o inventário original. O catálogo usa `FlatList`, tamanho explícito, rótulo acessível e fallback visual.

## Dependências externas e limites conhecidos

- O login usa código de verificação por e-mail e login OAuth Microsoft. A entrega do OTP requer SMTP configurado no Supabase; a foto requer Microsoft OAuth habilitado, permissão Graph `User.Read`, bucket privado e uma foto existente no perfil Microsoft.
- A migration 004 ativa as referências comerciais fornecidas nesta solicitação. A operação deve revisar os preços correntes e atribuir o claim de administrador antes de uso comercial; a função personalizada depende da aplicação das quatro migrations.
- O chat implementa uma conversa geral compartilhada entre contas autenticadas do mesmo projeto, recibo temporal de leitura e badge de não lidas. Conversas privadas, anexos no chat e push notification/som não estão implementados; a preferência de som não ativa notificação.
- Fotos do estudo são enviadas somente após consentimento, ao bucket privado e com limite de 10 MB por arquivo. A retenção, acesso e processo de exclusão devem ser definidos pela operação antes do uso com clientes.
- `npm test` executa testes unitários de limites comerciais, conteúdo de proposta e mensagem WhatsApp; não há testes de integração contra Supabase neste checkout. Expo Doctor, tsc e export web validam código/configuração local, não login real, dispositivos Android/iOS, autorização RLS remota ou envio WhatsApp.
- Build, assinatura e publicação nas lojas exigem Apple/Google developer accounts e credenciais de distribuição.
