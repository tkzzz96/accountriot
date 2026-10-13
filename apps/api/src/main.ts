import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  // Allow the configured origin plus loopback hosts on any port, so http://127.0.0.1:3000 or a changed WEB_PORT still work locally.
  const loopback = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
  app.enableCors({
    origin: (origin, cb) => cb(null, !origin || origin === configuredOrigin || loopback.test(origin)),
  });

  const config = new DocumentBuilder()
    .setTitle("Prospex API")
    .setDescription("AI-powered GTM automation platform API")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Prospex API running on http://localhost:${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
