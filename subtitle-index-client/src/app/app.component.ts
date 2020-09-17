import { Component } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser'
import { APIService } from './api.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'subtitle-index-client';
  
  availableModules = 3;
  currentModule = 0;

  query = {
    phrase: '',
    searching: false
  };

  editing = {
    loading: false,
    videoTrackId: 0,
    audioTrackId: 0,
    videoTracks: [],
    audioTracks: [],
    startSeconds: 0,
    endSeconds: 0,
    subtitleTrackId: 0,
    fileId: 0,
    conversationId: 0,
    subtitleFile: {},
    subtitleFileTracks: [],
    subtitleTrack: {},
    subtitleTrackDialogue: [],
    rendering: false,
  };

  results = [];

  outputFile = null;

  constructor(private sanitizer: DomSanitizer, private api: APIService) {}

  shiftModules(amount: number) {
    this.currentModule += amount;
  }

  gotoModule(index: number) {
    this.currentModule = index;
  }

  search() {
    if(this.query.searching) {
      return;
    }
    this.query.searching = true;
    this.api.search(this.query.phrase).subscribe(results => {
      this.results = results.map(r => {
        const segments = [];
        const startHighlightToken = "{\\start}";
        const endHighlightToken = "{\\end}";
        let acc = "";
        let highlighting = false;
        let i = 0;
        while(i < r.preview.length) {
          if(!highlighting && r.preview.substr(i, startHighlightToken.length) === startHighlightToken) {
            if(acc.length > 0) {
              segments.push({
                highlight: false,
                text: acc
              });
              acc = "";
            }
            highlighting = true;
            i += startHighlightToken.length;
          } else if(highlighting && r.preview.substr(i, endHighlightToken.length) === endHighlightToken) {
            if(acc.length > 0) {
              segments.push({
                highlight: true,
                text: acc
              });
              acc = "";
            }
            highlighting = false;
            i += endHighlightToken.length;
          } else {
            acc += r.preview[i];
            i++;
          }
        }

        r.previewSegments = segments;
        return r;
      });

      this.query.searching = false;
    });
  }

  selectResult(result) {
    if(this.editing.loading) {
      return;
    }
    this.editing.loading = true;
    this.editing.fileId = result.fileId;
    this.editing.subtitleTrackId = result.trackId;
    this.editing.conversationId = result.conversationId;

    this.gotoModule(1);

    this.api.loadSubtitleTrack(this.editing.subtitleTrackId).subscribe(d => {
      this.editing.subtitleTrack = d.track;
      this.editing.subtitleTrackDialogue = d.lines.map(l => {
        l.selected = true;
        this.editing.loading = false;
        return l;
      });

      const conversationEvents = this.editing.subtitleTrackDialogue.filter(l => l.conversationId === this.editing.conversationId);
      this.editing.startSeconds = conversationEvents.sort((a, b) => a.event.Start - b.event.Start)[0].event.Start;
      this.editing.endSeconds = conversationEvents.sort((a, b) => b.event.End - a.event.End)[0].event.End;
    });


    // There's a race condition here, I don't care.
    this.api.loadFileDetails(this.editing.fileId).subscribe(d => {
      this.editing.subtitleFile = d.file;
      this.editing.subtitleFileTracks = d.tracks;

      this.editing.videoTracks = d.tracks.filter(t => t.type === 'video');
      this.editing.audioTracks = d.tracks.filter(t => t.type === 'audio');
    });
  }

  render() {
    if(this.editing.rendering) {
      return;
    }
    this.editing.rendering = true;
    this.outputFile = null;

    this.api.render({
      outputFormat: "mp4",
      startSeconds: this.editing.startSeconds,
      endSeconds: this.editing.endSeconds,
      videoTrackId: this.editing.videoTrackId,
      audioTrackId: this.editing.audioTrackId,
      preamble: (this.editing.subtitleTrack as any).preamble,
      nondialogueEvents: (this.editing.subtitleTrack as any).nondialogueEvents,
      dialogueEvents: this.editing.subtitleTrackDialogue.filter(l => l.selected).map(l => l.event),
    }).subscribe(r => {
      this.editing.rendering = false;
      this.outputFile = "http://localhost:3100" + r.outputFile;
    })
  }
}
