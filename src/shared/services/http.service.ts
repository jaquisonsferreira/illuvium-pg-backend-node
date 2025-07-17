import { Injectable } from '@nestjs/common';
import { Observable, of } from 'rxjs';

interface HttpResponse<T> {
  data: T;
  status: number;
  statusText: string;
  headers: any;
  config: any;
}

@Injectable()
export class HttpService {
  get<T = any>(url: string, config?: any): Observable<HttpResponse<T>> {
    // Stub implementation
    return of({
      data: {} as T,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { url, ...config },
    });
  }

  post<T = any>(
    url: string,
    data?: any,
    config?: any,
  ): Observable<HttpResponse<T>> {
    // Stub implementation
    return of({
      data: {} as T,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { url, data, ...config },
    });
  }
}
