import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { env } from './common/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Render (and most PaaS) terminate TLS at a proxy; without this, express
  // sees every request as coming from the proxy's IP, which would make the
  // /auth throttler rate-limit all users as one.
  app.set('trust proxy', 1);

  await app.listen(env.PORT);
}

void bootstrap();
