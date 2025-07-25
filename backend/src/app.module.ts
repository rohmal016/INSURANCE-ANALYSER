import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GeminiService } from './gemini.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, GeminiService],
})
export class AppModule {}
