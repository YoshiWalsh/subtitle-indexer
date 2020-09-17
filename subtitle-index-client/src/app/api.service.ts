import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class APIService {
  
    constructor(private http: HttpClient) {
    }

    search(phrase: string): Observable<Array<any>> {
        return this.http.get<Array<any>>('http://localhost:3100/api/search', {
            params: {
                phrase: phrase
            }
        });
    }

    loadSubtitleTrack(trackId: number): Observable<any> {
        return this.http.get<any>('http://localhost:3100/api/tracks/' + trackId);
    }

    loadFileDetails(fileId: number): Observable<any> {
        return this.http.get<any>('http://localhost:3100/api/files/' + fileId);
    }

    render(payload: any): Observable<any> {
        return this.http.post<any>('http://localhost:3100/api/render', payload);
    }
}