import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { GeminiService } from './gemini.service';
import { Gemini2Service } from './gemini2.service';
import { GroqService } from './groq.service';
@Module({
  imports: [],
  controllers: [AppController],
  providers: [
    GeminiService,
    Gemini2Service,
    GroqService,
  ],
})
export class AppModule {}
