import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class HttpService {
  authToken: string = '';

  constructor(private _http: HttpClient) {}

  constructUrl(route: string, params: object) {
    const url = `${environment['protocol']}://${environment['host']}/${environment.api[route]}`;
    return Object.keys(params).reduce(
      (key) => url.replace(`[${key}]`, params[key]),
      url
    );
  }

  get(route: string, urlParams = {}, queryParams = {}) {
    const url = this.constructUrl(route, urlParams);
    this._http.get(url, {
      headers: {
        ...(this.authToken ? { Authorization: this.authToken } : {}),
      },
      params: queryParams,
    });
  }

  post(route: string, payload: any, urlParams = {}, queryParams = {}) {
    const url = this.constructUrl(route, urlParams);
    this._http
      .post(url, payload, {
        headers: {
          ...(this.authToken ? { Authorization: this.authToken } : {}),
        },
        params: queryParams,
        observe: 'response',
      })
      .pipe(
        map((response) => {
          const { headers, body } = response;
          this.authToken = headers.get('Authorization') || '';
          return body;
        }),
        catchError((error) => throwError(() => error.error))
      );
  }
}
