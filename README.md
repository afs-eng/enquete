# Enquete da turma

Site estático para os alunos escolherem a camisa da turma, com autenticação por magic link e votos centralizados no Supabase.

## Configurar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Em **Authentication > Providers > Email**, habilite o provedor **Email** e mantenha o acesso por magic link habilitado.
3. Em **Authentication > URL Configuration**, configure:
   - **Site URL**: `https://SEU-DOMINIO.vercel.app`;
   - **Redirect URLs**: `https://SEU-DOMINIO.vercel.app/` (adicione também o domínio de preview se for usá-lo).
4. No **SQL Editor**, execute o conteúdo completo de [`supabase/schema.sql`](supabase/schema.sql). Em uma instalação nova, ele cria a tabela protegida, as restrições de voto único, as políticas RLS e a RPC do placar.
5. Em **Project Settings > API**, copie a **Project URL** e a chave **Publishable**. Essa chave é pública; a API ainda exige o JWT do usuário para gravar votos.

## Publicar na Vercel

1. Importe este repositório na Vercel e mantenha a configuração padrão, sem comando de build.
2. Em **Project Settings > Environment Variables**, cadastre somente:
   - `SUPABASE_URL`: a Project URL do Supabase;
   - `SUPABASE_PUBLISHABLE_KEY`: a chave Publishable do Supabase.
3. Remova qualquer variável antiga de chave administrativa, se existir, e faça um novo deploy.

O arquivo `.env.example` documenta os nomes esperados. Não há segredo de servidor nesta integração e nenhuma chave administrativa deve ser adicionada ao projeto.

O frontend deve carregar o cliente Supabase, [`/api/supabase-config.js`](api/supabase-config.js) e depois `script.js`. O arquivo de configuração entrega apenas URL e chave pública sem cache. O HTML deve fornecer os IDs `authStatus` e `changeEmail` além dos campos existentes.

## Teste manual

Depois do deploy, selecione uma camisa, informe nome e e-mail e confirme. O primeiro envio deve mostrar a mensagem de link enviado; abra o magic link recebido. Ao voltar para a página, o e-mail estará confirmado e bloqueado, e o segundo envio registrará o voto.

Use **Trocar e-mail** para sair, liberar o campo e repetir o fluxo com outro usuário no mesmo dispositivo. Repetir um voto para a mesma conta ou e-mail deve retornar `409`. Sessão ausente ou expirada retorna `401`.

O botão **Ver resultado parcial** consulta `GET /api/votes`, que retorna somente os totais das camisas 1 a 7:

```bash
curl -i https://SEU-DOMINIO.vercel.app/api/votes
```

Para testar o POST manualmente, primeiro obtenha um access token de uma sessão autenticada e substitua `SEU_ACCESS_TOKEN`:

```bash
curl -i -X POST https://SEU-DOMINIO.vercel.app/api/votes \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer SEU_ACCESS_TOKEN' \
  --data '{"name":"Aluno Teste","shirtNumber":1}'
```

A chamada autenticada deve retornar `201`. O e-mail nunca é aceito do corpo da requisição: ele é obtido da sessão autenticada.
