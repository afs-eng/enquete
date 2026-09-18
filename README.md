# Enquete da turma

Site estático para os alunos escolherem a camisa da turma, com votos centralizados no Supabase.

## Configurar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, execute o conteúdo completo de [`supabase/schema.sql`](supabase/schema.sql). Em uma instalação nova, ele cria a tabela, a restrição de voto único e a RPC do placar.
3. Em **Project Settings > API**, copie a **Project URL** e a chave **Publishable**.

## Publicar na Vercel

1. Importe este repositório na Vercel e mantenha a configuração padrão, sem comando de build.
2. Em **Project Settings > Environment Variables**, cadastre:
   - `SUPABASE_URL`: a Project URL do Supabase;
   - `SUPABASE_PUBLISHABLE_KEY`: a chave Publishable do Supabase.
3. Faça um novo deploy.

O arquivo `.env.example` documenta os nomes esperados. Não há segredo de servidor nesta integração.

## Teste manual

Depois do deploy, abra a página, selecione uma camisa, informe nome e e-mail e confirme. O botão **Ver resultado parcial** consulta `GET /api/votes` e mostra o placar compartilhado.

Para testar no terminal, substitua a URL pelo domínio publicado:

```bash
curl -i -X POST https://SEU-DOMINIO.vercel.app/api/votes \
  -H 'Content-Type: application/json' \
  --data '{"name":"Aluno Teste","email":"aluno.teste@example.com","shirtNumber":1}'

curl -i https://SEU-DOMINIO.vercel.app/api/votes
```

A primeira chamada deve retornar `201`; repetir o mesmo e-mail deve retornar `409`. A segunda retorna apenas os totais das camisas 1 a 7.
