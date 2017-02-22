// Manages the lifetime of a recording?
export default class Recording {
  constructor(recorder, duration) {
    this.recorder = recorder;
    this.duration = duration;
    this.start = new Date().getTime();

    this.data = [];

    recorder.addEventListener('dataavailable', event => {
      if (event.data.size > 0) {
        this.data.push(event.data); // hold on to this until needed, it's too expensive to push it into a Blob, just yet
      }

      const now = new Date().getTime();

      if (now - this.start > duration) {
        if (this.recorder.state === 'recording') {
          this.recordingEnding();
          this.recorder.stop();
        }
      }

      if (this.waitingForData) this.waitingForData();
    });

    recorder.addEventListener('stop', event => {
      // should be saved now
      this.onDurationMet();
    });

    // recorder.start(duration);
    recorder.start(2000);
  }

  get blob() {
    if (this.data.length === 0) return this._blob;

    this._blob = this._blob ? new Blob([this._blob].concat(this.data)) : new Blob(this.data);

    this.data.splice(0);

    return this._blob; // doesn't seem right
  }

  getLatestBlob() {
    if (!this.blobPromise) {
      this.blobPromise = new Promise((resolve, reject) => {
        this.waitingForData = () => {
          this.blobPromise = undefined;
          this.waitingForData = undefined;
          resolve(this.blob);
        };
        this.recorder.requestData();
      });
    }

    return this.blobPromise;
  }
}