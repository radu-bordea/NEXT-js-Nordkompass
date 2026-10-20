import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.url(),
  CLERK_SECRET_KEY: z.string().min(1),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  MET_USER_AGENT: z.string().min(5),
  CRON_SECRET: z.string().min(16),
  NEXT_PUBLIC_APP_URL: z.url(),
});

export const env = schema.parse(process.env);