import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port      = config.get<number>('PORT', 4000);
  const isProd    = config.get<string>('NODE_ENV') === 'production';
  const frontendUrl = config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cookieParser());

  // production: FRONTEND_URL만 허용 / 개발: 전체 허용
  app.enableCors({
    origin: isProd
      ? frontendUrl
      : (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) =>
          callback(null, true),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  await app.listen(port);
  console.log(`🚀 Backend running on http://localhost:${port}/api`);
  if (isProd) console.log(`🔒 CORS restricted to: ${frontendUrl}`);
}
bootstrap();
