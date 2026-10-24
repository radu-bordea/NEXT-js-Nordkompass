### create the app
- create-next-app@latest nextjs-nordkompass .
- cd nextjs- nordkompass
- 

### libraries
- npm install @clerk/nextjs 
- npm install prisma @prisma/client
- npm instal zod
- npx shadcn@latest init
- npm install next-themes
- npm install lucide-react
- npm install suncalc
- npm install -D @types/suncalc
- npm install maplibre-gl

### prisma
- npm install prisma tsx --save-dev
- npm install @prisma/client @prisma/adapter-pg dotenv
- npx prisma init --output ../generated/prisma


- npm install prisma@7 tsx dotenv --save-dev
- npm install @prisma/client@7 @prisma/adapter-pg

- npm run db:migrate -- --name init
- npm run db:generate
- npm run db:seed

### deployments
- $env:DATABASE_URL="...main pooled..."; $env:DIRECT_URL="...main direct..."; npm run db:seed

### shadcn
- npx shadcn@latest add button card badge