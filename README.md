# Estudo de Segurança · Verisure

Aplicativo web mobile-first publicado no GitHub Pages. O frontend usa Expo/React Native Web; Supabase fornece autenticação, banco, funções de servidor, armazenamento privado e chat.

## Publicação

O workflow `.github/workflows/deploy-pages.yml` publica o site em cada push para `main`. Configure `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` nos secrets do GitHub Actions. A chave pública pode aparecer no bundle; nunca coloque `service_role`, senha do banco ou segredo SMTP em `EXPO_PUBLIC_*`.

GitHub Pages publica somente o frontend. As migrations e a Edge Function desta aplicação também precisam ser aplicadas no projeto Supabase.

## Colaboração e segurança

O diretório de especialistas usa `specialist_directory`, separado do cadastro de autenticação, e as regras RLS mostram somente perfis aprovados e listados. Conversas individuais, recibos de leitura e anexos privados são habilitados pelas migrations `202611050001_specialist_directory.sql` e `202611050002_secure_collaboration.sql`. A migration `202611050003_employee_login_rate_limit.sql` adiciona limite temporário de tentativas ao login por matrícula. Grupos privados e criação validada no servidor são habilitados por `202611050004_team_groups.sql`.

As quatro migrations acima foram aplicadas ao projeto Supabase `amzgyfjrmzwkfwlldcwa` durante esta atualização. Para outros ambientes, aplique-as depois das migrations de autorização já existentes. O bucket `team-chat-attachments` é privado e aceita somente JPEG, PNG, WebP ou PDF até 10 MB. O diretório nunca consulta e-mail, telefone ou matrícula de outros especialistas.

Depois de alterar `supabase/functions/employee-login/index.ts`, publique a função separadamente com `supabase functions deploy employee-login`. O código usa o segredo de serviço apenas no servidor e chama a RPC `consume_employee_login_attempt`; a versão publicada precisa ser atualizada para que o limite seja aplicado aos logins.

O chat oferece o canal geral, conversas individuais e grupos privados persistidos. Notificações push, denúncia/bloqueio e o ciclo formal de aprovação de propostas ainda dependem de implementação adicional e não devem ser tratados como disponíveis.

## Cadastro e autorização

O especialista solicita acesso com nome completo, matrícula, e-mail `@verisure.com.br` e senha. A conta entra como pendente e não pode usar os módulos até a gestão aprovar. A entrada é feita com matrícula e senha; a função `employee-login` procura o e-mail corporativo no servidor e entrega tokens somente após verificar a aprovação. A senha nunca é salva no perfil.

1. Aplique todas as migrations de `supabase/migrations` em ordem pelo Supabase CLI ou SQL Editor. A `202611040002_employee_access_approval.sql` instala estados pendente/aprovado/recusado e protege as tabelas com RLS.
2. Publique a função de autenticação: `supabase functions deploy employee-login`. Ela usa `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` do ambiente Supabase. A chave de serviço permanece no servidor e nunca vai para o site.
3. Configure uma conta master no painel administrativo do Supabase depois de criar a conta pelo fluxo de cadastro. Substitua o e-mail no SQL abaixo e execute como operador com acesso administrativo:

   ```sql
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"master_admin"}'::jsonb
   where lower(email) = lower('gestor@verisure.com.br');

   update public.profiles p
   set access_status = 'approved', reviewed_at = now()
   from auth.users u
   where p.id = u.id and lower(u.email) = lower('gestor@verisure.com.br');
   ```

   Atualize a sessão dessa conta após mudar o papel. O claim `app_metadata` só pode ser alterado por operador confiável, nunca pelo formulário público. A conta master terá o menu **Autorizar acessos** para aprovar ou recusar solicitações.
4. Em Supabase Authentication, configure a confirmação de e-mail conforme a política da empresa. O endereço corporativo deve estar apto a receber a confirmação antes do primeiro login.
5. No GitHub Pages, use o endereço `https://entretrutas-sketch.github.io/estudo-de-seguranca/` como URL do site e allowlist de redirects no Supabase.

## Foto do perfil

O perfil permite escolher uma foto JPEG, PNG ou WebP de até 5 MB. O arquivo fica no bucket privado `profile-avatars`, em uma pasta por usuário, e a URL de visualização é assinada pelo Supabase.

## Desenvolvimento local

```bash
npm install
npm run web -- --port 8082
```

Copie `.env.example` para `.env` e configure a URL e a chave publishable do Supabase. O projeto usa Expo SDK 57. Verificações locais disponíveis: `npm exec tsc -- --noEmit`, `npm exec expo lint` e `npm exec expo export -- --platform web`.
