import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata: {
    timestamp: Date;
    processingTime?: number;
  };
}

@Injectable()
export class ErrorHandlerInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    const startTime = Date.now();
    
    return next.handle().pipe(
      map(data => ({
        success: true,
        data,
        metadata: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      })),
      catchError(error => {
        const processingTime = Date.now() - startTime;
        
        // Handle different types of errors
        let errorResponse: any;
        
        if (error instanceof HttpException) {
          errorResponse = {
            code: this.getErrorCode(error.getStatus()),
            message: error.message,
            details: error.getResponse(),
          };
        } else if (error.message?.includes('Gemini')) {
          errorResponse = {
            code: 'AI_SERVICE_ERROR',
            message: 'AI analysis service temporarily unavailable',
            details: { originalError: error.message },
          };
        } else if (error.message?.includes('PDF')) {
          errorResponse = {
            code: 'PDF_PROCESSING_ERROR',
            message: 'PDF processing failed',
            details: { originalError: error.message },
          };
        } else {
          errorResponse = {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred',
            details: { originalError: error.message },
          };
        }
        
        return throwError(() => new HttpException({
          success: false,
          error: errorResponse,
          metadata: {
            timestamp: new Date(),
            processingTime,
          },
        }, error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR));
      }),
    );
  }
  
  private getErrorCode(status: number): string {
    switch (status) {
      case 400: return 'BAD_REQUEST';
      case 401: return 'UNAUTHORIZED';
      case 403: return 'FORBIDDEN';
      case 404: return 'NOT_FOUND';
      case 413: return 'PAYLOAD_TOO_LARGE';
      case 422: return 'UNPROCESSABLE_ENTITY';
      case 429: return 'TOO_MANY_REQUESTS';
      case 500: return 'INTERNAL_SERVER_ERROR';
      case 502: return 'BAD_GATEWAY';
      case 503: return 'SERVICE_UNAVAILABLE';
      default: return 'UNKNOWN_ERROR';
    }
  }
} 