import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SESSION_COOKIE_NAME } from '@dataroom/shared';
import { AppModule } from './app.module';
import { env } from './common/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Render (and most PaaS) terminate TLS at a proxy; without this, express
  // sees every request as coming from the proxy's IP, which would make the
  // /auth throttler rate-limit all users as one.
  app.set('trust proxy', 1);

  app.use(cookieParser());
  setupDocs(app);

  // Bind every interface, not just loopback: a container's health check and
  // router reach the process from outside it.
  await app.listen(env.PORT, '0.0.0.0');
}

/**
 * Serves the API reference at /docs, and the raw document at /docs-json.
 *
 * Every endpoint here is cookie-authenticated, which "Try it out" exercises
 * directly from the browser once you have signed in - so the reference doubles
 * as a way to poke at the API without reaching for a REST client.
 */
function setupDocs(app: NestExpressApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Data Room API')
    .setDescription(
      'Folders, PDF files and sharing for a due diligence data room. ' +
        'Every route except /health, /auth/register, /auth/login and /public/* ' +
        'requires the session cookie set by signing in.',
    )
    .setVersion('1.0')
    .addCookieAuth(SESSION_COOKIE_NAME, {
      type: 'apiKey',
      in: 'cookie',
      description: 'Session cookie issued by POST /auth/login.',
    })
    .build();

  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config), {
    jsonDocumentUrl: 'docs-json',
    swaggerOptions: { persistAuthorization: true },
  });
}

void bootstrap();
