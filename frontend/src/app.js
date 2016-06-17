import Cycle from './cycle';

const errorDetailsElement = document.getElementsByTagName('error-details')[0],
      errorElement = document.getElementsByTagName('error-display')[0];

// errorElement.addEventListener('click', event => errorElement.style.display = 'none');
window.addEventListener('error', event => showError(event.error));

function showError(error) {
  console.log(error);

  errorDetailsElement.getElementsByTagName('message')[0].innerHTML = `${error.message}`;
  errorDetailsElement.getElementsByTagName('stack')[0].innerHTML = `${encodeEntities(error.stack)}`;
  errorElement.style.display = 'flex';
}

// from Angular
// https://github.com/angular/angular.js/blob/v1.3.14/src/ngSanitize/sanitize.js#L435
const SURROGATE_PAIR_REGEXP = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g,
      NON_ALPHANUMERIC_REGEXP = /([^\#-~| |!])/g;
function encodeEntities(value) {
  return value.
    replace(/&/g, '&amp;').
    replace(SURROGATE_PAIR_REGEXP, function(value) {
      var hi = value.charCodeAt(0);
      var low = value.charCodeAt(1);
      return '&#' + (((hi - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000) + ';';
    }).
    replace(NON_ALPHANUMERIC_REGEXP, function(value) {
      return '&#' + value.charCodeAt(0) + ';';
    }).
    replace(/</g, '&lt;').
    replace(/>/g, '&gt;');
}

try {
  navigator.getUserMedia = (navigator.getUserMedia ||
                            navigator.webkitGetUserMedia ||
                            navigator.mozGetUserMedia ||
                            navigator.msGetUserMedia);

  const AudioContext = (window.AudioContext || webkitAudioContext);

  if (!navigator.getUserMedia) markNotCapable('No getUserMedia!');
  if (!navigator.mediaDevices) markNotCapable('No mediaDevices!');
  if (!AudioContext) markNotCapable('No AudioContext!');
  if (!MediaRecorder) markNotCapable('No MediaRecorder!');
}
catch (e) {
  markNotCapable(e);
}

if (/android/i.test(navigator.userAgent)) {
  const android = document.getElementsByTagName('android')[0];

  android.style.display = 'flex';
}

function markNotCapable(reason) {
  const notCapable = document.getElementById('not-capable'),
        capable = document.getElementById('capable');

  notCapable.style.display = 'flex';
  capable.style.display = 'none';

  notCapable.appendChild(document.createTextNode(reason));

  // alert(reason);
}

const audioContext = new AudioContext();

const noPermission = document.getElementById('no-permission'),
      authorized = document.getElementById('authorized'),
      hint = noPermission.children[1];

const recent = document.getElementById('recent'),
      nodes = document.getElementById('nodes'),
      history = document.getElementById('history'),
      time = document.getElementById('time'),
      recentMenu = document.getElementById('recent-menu');

const hoursEl = document.getElementsByTagName('hours')[0],
      minutesEl = document.getElementsByTagName('minutes')[0],
      secondsEl = document.getElementsByTagName('seconds')[0],
      millisecondsEl = document.getElementsByTagName('milliseconds')[0];

const storagePanel = document.getElementsByTagName('storage-panel')[0];

const audio = document.createElement('audio');

document.body.insertBefore(audio, document.body.firstChild);

// getUserMedia({
//   "audio": {
//     "mandatory": {
//         "googEchoCancellation": "false",
//         "googAutoGainControl": "false",
//         "googNoiseSuppression": "false",
//         "googHighpassFilter": "false"
//     },
//     "optional": []
//    },
// })
getUserMedia({audio: true})
  .then(attachRecorder)
  .then(attachAnalyser)
  // .then(attachPlaybackService)
  .then(draw)
  .catch(mediaError);

// const saveBlockDuration = 60 * 1000; // one minute
const saveBlockDuration = 5 * 1000; // five seconds
const smoothingTimeConstant = 0.66;

const barCounts = new Cycle([1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192/**//*, 16384, 32768*/]);
const accumulationPeriods = new Cycle([1000, 1000 / 2, 1000 / 4, 1000 / 8, 1000 / 16, 1000 / 32, 1000 / 64]);
const historyLengths = new Cycle([60, 90, 120, 150, 180, 240, 300, 500, 1000, 1500]);

const barPosition = ['left', 'top', 'right', 'bottom'];

const barCountCycle = barCounts.create(),
      accumulationPeriodsCycle = accumulationPeriods.create(),
      historyLengthCycle = historyLengths.create(),
      barPositionCycle = new Cycle(barPosition).create();

let data, accumulations = 0, accumulationStart;

const accumulator = [];


function getUserMedia(options) {
  return new Promise((resolve, reject) => navigator.getUserMedia(options, resolve, reject));
}


function play(blob, position = 0) {
  console.log(blob);
  const url = window.URL.createObjectURL(blob);

  audio.src = url;

  audio.currentTime = position / 1000;
  audio.play();
}

function attachRecorder(stream) {


  return {recorder, stream};
}

class Recorder {
  constructor (stream, duration) {
    this.recordings = [];
    // this.recording = new Recording(new MediaRecorder(stream), duration);
    this.recording = this._startRecording(stream, duration);

    // console.log('recording started');

    // this.recording.recordingEnding = () => {
    //   this.otherRecording = new Recording(new MediaRecorder(stream), duration);

    //   this.otherRecording =
    //   console.log('recording started');
    // };

    // this.recording.onDurationMet = () => {
    //   console.log('duration met');

    //   this.recordings.push([this.recording.start, this.recording.blob]);

    //   this.recording = this.otherRecording;
    // };
  }

  _startRecording (stream, duration) {
    console.log('recording started');

    const recording = new Recording(new MediaRecorder(stream), duration);

    recording.recordingEnding = () => {
      this.otherRecording = this._startRecording(stream, duration);
    };

    recording.onDurationMet = () => {
      console.log('duration met');

      this.recordings.push([this.recording.start, this.recording.blob]);

      const record = document.createElement('record');

      record.innerHTML = `${this.recording.start}, ${this.recording.blob.size} record`;

      const index = this.recordings.length - 1;
      record.addEventListener('click', event => {
        play(this.recordings[index][1]);
        // const blob = this.recordings[index][1];

        // const audio = document.createElement('audio');

        // audio.src = window.URL.createObjectURL(blob);
        // audio.play();
      });

      storagePanel.appendChild(record);


      this.recording = this.otherRecording;

      console.log(this.recordings);
    };

    return recording;
  }
}

// Manages the lifetime of a recording?
class Recording {
  constructor(recorder, duration) {
    this.recorder = recorder;
    this.duration = duration;
    this.start = new Date().getTime();

    this.data = [];

    console.log(recorder);

    recorder.addEventListener('dataavailable', event => {
      console.log(event.data);
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

      console.log('waiting', this.waitingForData);
      if (this.waitingForData) this.waitingForData();
    });

    recorder.addEventListener('stop', event => {
      // should be saved now
      console.log('recorder stopped');
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

let dataCount = 0;
let playback;
let shouldFinalize = false;
let callWhenFinalized;
function attachRecorder(stream) {
  const recorder = new Recorder(stream, saveBlockDuration),
        startTime = recorder.recording.start;
  // const recording = new Recording(new MediaRecorder(stream), saveBlockDuration),
  //       startTime = recording.start;

  // recording.onDurationMet = () => {
  //   const audio = document.createElement('audio');

  //   const url = window.URL.createObjectURL(recording.blob);

  //   console.log(url);

  //   audio.src = url;

  //   console.log('play');
  //   audio.play();
  // };


  // let currentRecorder = new MediaRecorder(stream),
  //     nextRecorder = new MediaRecorder(stream);

  // const startTime = new Date().getTime(),
  //       savedBlobs = [];

  // let data = [];
  // let dataSize = 0,
  //     totalDataSize = 0,
  //     lastSaveTime = startTime;

  // currentRecorder.ondataavailable = makeDataHandler(currentRecorder);
  // currentRecorder.start();

  updates.push(updateTime);

  playback = (time = startTime) => {

    let delta = time - startTime;

    if (delta < 0) { // is this the right boundary?

      delta = 0;
    }

    // shouldFinalize = true;
    // recorder.requestData();

    // recorder.stop();
    // secondRecorder.start();

    // callWhenFinalized = blob => play(blob, delta);

    console.log(startTime, delta, data);

    // recording.getLatestBlob().then(blob => console.log('blob', blob));

    // const blob = new Blob([savedBlobs[0], data]);
    // const url = window.URL.createObjectURL(blob);

    // audio.src = url;

    // audio.currentTime = delta / 1000;
    // audio.play();
  };

  return {recorder, stream, data};

  function makeDataHandler(recorder) {
    let data = new Blob();

    return event => {
      const now = new Date().getTime();
      if (event.data.size > 0) {
        const newData = new Blob([data, event.data]);

        // data.close();

        data = newData;

        if (newData.size < 1000) console.log(data);
      }

      if (now - lastSaveTime > saveBlockDuration) {

      }

    };
  }

  // function makeDataHandler(r) {
  //   const recorder = r;
  //   let data = [],
  //       finalize = false;

  //   // console.log(recorder, r);

  //   const reader = new FileReader();

  //   return event => {
  //     const now = new Date().getTime();

  //     if (event.data.size > 0) data.push(event.data);

  //     // console.log(r.state);

  //     if (finalize) {
  //       savedBlobs.push([now, new Blob(data)]);
  //       lastSaveTime = now;

  //       data.splice(0);
  //       if (dataCount++ < 3) console.log(savedBlobs);

  //       finalize = false;

  //       const blob = savedBlobs[savedBlobs.length - 1][1];
  //       reader.readAsBinaryString(blob.slice(0, 2048));

  //       reader.onload = event => console.log(blob, event, reader.result);

  //       // console.log('finalized');
  //     }
  //     else if (now - lastSaveTime > saveBlockDuration) {
  //       console.log('should finalize');

  //       finalize = true;

  //       // if (r.state !== 'inactive') {
  //       //   console.log('switching recorders');
  //       //   r.stop(); // should be a different condition
  //       // }

  //       // nextRecorder.ondataavailable = makeDataHandler(nextRecorder);
  //       // nextRecorder.start();

  //       // const tmp = currentRecorder;

  //       // currentRecorder = nextRecorder;
  //       // nextRecorder = tmp;
  //     }
  //   };
  // }

  // function addData(event) {
  //   const now = new Date().getTime();

  //   data.push(event.data);

  //   if (now - lastSaveTime > saveBlockDuration) {
  //     currentRecorder.stop();

  //     nextRecorder.ondataavailable = addData;
  //     nextRecorder.start();
  //   }
  // }

  // function addData(event) {
  //   const now = new Date().getTime();

  //   data.push(event.data);

  //   if (now - lastSaveTime > saveBlockDuration) shouldFinalize = true;

  //   if (shouldFinalize) {
  //     const blob = new Blob(data/*, {type: 'audio/webm;codecs=opus'}*/);
  //     savedBlobs.push([lastSaveTime, blob]);

  //     data = [];
  //     dataSize = 0;
  //     lastSaveTime = new Date().getTime();

  //     const record = document.createElement('record');
  //     record.innerHTML = `${lastSaveTime}, ${blob.size} record`;
  //     storagePanel.appendChild(record);

  //     record.addEventListener('click', () => {
  //       play(blob);
  //     });

  //     if (callWhenFinalized) {
  //       callWhenFinalized(blob);
  //       callWhenFinalized = undefined;
  //     }

  //     console.log('finalized', savedBlobs);
  //   }

  // }

  // function addData(event) {
  //   // should write out file if >1min of data collected
  //   if (event.data.size > 0) {
  //     data.push(event.data);
  //     dataSize += event.data.size;
  //     totalDataSize += event.data.size;
  //   }

  //   const now = new Date().getTime();

  //   if (now - lastSaveTime > saveBlockDuration) {
  //     const blob = new Blob(data);

  //     savedBlobs.push([lastSaveTime, blob]) ;

  //     data = [];
  //     dataSize = 0;

  //     lastSaveTime = now;

  //     console.log({savedBlobs});
  //   }
  // }

  function updateTime() {
    const duration = new Date().getTime() - startTime,
          milliseconds = duration % 1000,
          totalSeconds = Math.floor(duration / 1000),
          seconds = totalSeconds % 60,
          minutes = Math.floor(totalSeconds / 60);

    hoursEl.innerHTML = 0;
    minutesEl.innerHTML = minutes;
    secondsEl.innerHTML = seconds;
    millisecondsEl.innerHTML = milliseconds < 100 ? (milliseconds < 10 ? `00${milliseconds}` : `0${milliseconds}`) : milliseconds;

    // time.innerHTML = `${minutes > 0 ? minutes + " " : ''}${seconds > 0 ? seconds + "  " : ''}${milliseconds}`;
    // time.innerHTML = `+${((duration) / 1000).toFixed(2)}s`;

    return updateTime;
  }
}

function attachAnalyser({stream, data, lastSaveTime}) {
  const source = audioContext.createMediaStreamSource(stream),
        analyser = audioContext.createAnalyser(),
        rate = audioContext.sampleRate;

  analyser.smoothingTimeConstant = smoothingTimeConstant;
  setAnalyserSize(analyser, barCountCycle.value, nodes);
  setHistoryLength(historyLengthCycle.value);

  const gain = audioContext.createGain();

  gain.gain.value = 1; // here for tweaking

  source.connect(gain);
  gain.connect(analyser);

  recent.cycleBarCount = backwards => {
    if (backwards) barCountCycle.goBackward();
    else barCountCycle.goForward();

    setAnalyserSize(analyser, barCountCycle.value, nodes);

    return false;
  };

  nodes.cycleBarEffect = backwards => {
    nodes.classList.remove(barPositionCycle.value);

    if (backwards) {
      barPositionCycle.goBackward();
      // if (barPositionCycle.value === 'bottom') recent.cycleBarCount(true);
    }
    else {
      barPositionCycle.goForward();
      // if (barPositionCycle.value === 'left') recent.cycleBarCount();
    }

    nodes.classList.add(barPositionCycle.value);

    return false;
  };

  let hasMenu = false;
  let start = {x: 0, y: 0},
      last = {x: 0, y: 0};

  let timer;

  recent.mouseDown = event => {
    hasMenu = true;

    start.x = last.x = event.clientX;
    start.y = last.y = event.clientY;

    timer = setTimeout(() => {
      if (hasMenu) recentMenu.classList.add('visible');
      timer = undefined;
    }, 125);
  };

  recent.mouseUp = event => {
    hasMenu = false;
    recentMenu.classList.remove('visible');

    if (event.button === 0 && timer) {
      clearTimeout(timer);

      nodes.classList.toggle('vertical');

      timer = undefined;
    }
  };

  recent.mouseMove = event => {
    const total = {x: event.clientX - start.x, y: event.clientY - start.y};

    if (hasMenu) {
      // console.log('mousemove', event, total);

    }
  };

  recent.touchStart = event => {
    hasMenu = true;
    start.x = last.x = event.clientX;
    start.y = last.y = event.clientY;

    timer = setTimeout(() => {
      if (hasMenu) recentMenu.classList.add('visible');
      timer = undefined;
    }, 125);

    nodes.cycleBarEffect();

    return false;
  };

  recent.touchEnd = event => {
    hasMenu = false;
    recentMenu.classList.remove('visible');

    if (timer) {
      clearTimeout(timer);

      // nodes.classList.toggle('vertical');

      timer = undefined;
    }

    return false;
  };

  history.mouseDown = event => {
    console.log('mouseDown', event);
  };

  history.mouseUp = event => {
    if (event.button === 0) {
      const slice = event.target.tagName === 'SLICE' ? event.target : event.target.parentNode;

      updates.push(() => {
        if (indicators.mover) indicators.mover.classList.remove('mover');
        if (indicators.start) indicators.start.classList.remove('start');
        if (indicators.end) indicators.end.classList.remove('end');

        indicators.start = indicators.mover = slice;
        // indicators.end = history.firstChild;
        indicators.end = history.children[Math.max(0, history.children.length - position)];

        indicators.start.classList.add('start');
        indicators.end.classList.add('end');
        indicators.mover.classList.add('mover');
      });

      playback(slice.approximateTime);
    }
  };

  return {stream, data, lastSaveTime, analyser};
}

function setAnalyserSize(analyser, size, nodes) {
  let fftSize = Math.max(32, Math.min(32768, size * 4));

  analyser.fftSize = fftSize;

  const bins = analyser.frequencyBinCount,
        count = Math.min(bins / 2, size);

  data = new Uint8Array(bins / 2);

  // need to distribute current accumulations

  if (count > accumulator.length) {
    //growing, split
    const levels = count / ((2 * accumulator.length) || 1);

    console.log({levels, count, accumulator: accumulator.length});

    for (let i = count - 1; i >= 0; i--) {

    }
  }
  else {
    //shrinking, combine
  }

  for (let i = 0; i < count; i++) accumulator[i] = 0;
  accumulator.splice(count);

  for (let i = nodes.children.length; i < count; i++) nodes.appendChild(document.createElement('div'));
  for (let i = nodes.children.length - 1; i >= count; i--) nodes.children[i].remove();

  for (let i = 0; i < history.children.length; i++) {
    const slice = history.children[i];
    for (let i = slice.children.length; i < nodes.children.length; i++) slice.insertBefore(document.createElement('node'), slice.firstChild);
    for (let i = slice.children.length - 1; i >= nodes.children.length; i--) slice.children[0].remove();
  }
}

function setHistoryLength(length) {
  // for (let i = history.children.length; i < length; i++) history.appendChild(document.createElement('slice'));
  // for (let i = history.children.length; i < length; i++) history.appendChild(document.createElement('slice'));
  for (let i = history.children.length; i < length; i++) history.insertBefore(document.createElement('slice'), history.firstChild);
  for (let i = history.children.length - 1; i >= length; i--) history.children[i].remove();

  for (let i = 0; i < history.children.length; i++) {
    const slice = history.children[i];
    for (let i = slice.children.length; i < nodes.children.length; i++) slice.insertBefore(document.createElement('node'), slice.firstChild);
    for (let i = slice.children.length - 1; i >= nodes.children.length; i--) slice.children[0].remove();
  }

  // if (position > history.children.length) {
  //   position = history.children.length - 1;
  //   console.log('position', position);
  // }
}

let indicators = {mover: undefined, start: undefined, end: undefined};
let position = 0;

function draw({analyser}) {
  accumulationStart = new Date().getTime();

  noPermission.classList.add('granted');
  authorized.classList.add('authorized');

  updates.push(update);

  requestUpdateLoop();

  function update() {
    const now = new Date().getTime();

    analyser.getByteFrequencyData(data);

    const nextSliceIndex = position >= history.children.length ? 0 : history.children.length -1 - position;

    // if (now - accumulationStart > accumulationPeriod) {
    if (now - accumulationStart > accumulationPeriodsCycle.value) {
      if (nextSliceIndex === 0) history.insertBefore(history.children[history.children.length - 1], history.firstChild);

      const slice = history.children[nextSliceIndex];

      if (position < history.children.length) position++;

      // const slice = history.lastElementChild;

      slice.approximateTime = now;

      for (let i = 0; i < accumulator.length; i++) accumulator[i] = 0;

      slice.classList.remove('mover');
      slice.classList.remove('start');
      slice.classList.remove('end');

      if (indicators.mover) {
        indicators.mover.classList.remove('mover');

        if (indicators.mover === indicators.end) {
          indicators.start.classList.remove('start');
          indicators.end.classList.remove('end');

          indicators.start = indicators.end = indicators.mover = undefined;
        }
        else {
          indicators.mover = indicators.mover.previousElementSibling;

          if (indicators.mover) indicators.mover.classList.add('mover'); // can this be reorganized to remove the if?
        }
      }


      accumulations = 1;
      accumulationStart = now;
    }

    const vertical = nodes.className === '' || nodes.classList.contains('left') || nodes.classList.contains('right');

    let sum = 0;

    const barsCount = nodes.children.length;

    if (barsCount === 1) {
      const child = nodes.children[0];

      const total = data[0] + data[1] + data[2] + data[3] + data[4] + data[5] + data[6] + data[7],
            average = total / 8;

      // sum += av; // we want the background to be black in this case (barsCount === 1) [code needs some reworking]
      accumulator[0] += average;

      child.style.backgroundColor = `rgba(${average}, ${average}, ${average}, 1)`;

      const width = vertical ? `${average / 255 * 100}%` : 'auto',
            height = vertical ? 'auto' : `${average / 255 * 100}%`;

      child.style.width = width;
      child.style.height = height;
    }
    else if (barsCount === 2) {
      for (let i= 0; i < nodes.children.length; i++) {
        const child = nodes.children[i];

        const total = data[4 * i] + data[4 * i + 1] + data[4 * i + 2] + data[4 * i + 3],
              average = total / 4;

        sum += average;
        accumulator[i] += average;

        child.style.backgroundColor = `rgba(${average}, ${average}, ${average}, 1)`;

        const width = vertical ? `${average / 255 * 100}%` : 'auto',
              height = vertical ? 'auto' : `${average / 255 * 100}%`;

        child.style.width = width;
        child.style.height = height;
      }
    }
    else if (barsCount === 4) {
      for (let i= 0; i < nodes.children.length; i++) {
        const child = nodes.children[i];

        const total = data[2 * i] + data[2 * i + 1],
              average = total / 2;

        sum += average;
        accumulator[i] += average;

        child.style.backgroundColor = `rgba(${average}, ${average}, ${average}, 1)`;

        const width = vertical ? `${average / 255 * 100}%` : 'auto',
              height = vertical ? 'auto' : `${average / 255 * 100}%`;

        child.style.width = width;
        child.style.height = height;
      }
    }
    else {
      for (let i= 0; i < nodes.children.length; i++) {
        const  child = nodes.children[i];

        const value = data[i];

        sum += value;
        accumulator[i] += value;

        child.style.backgroundColor = `rgba(${value}, ${value}, ${value}, 1)`;

        const width = vertical ? `${value / 255 * 100}%` : 'auto',
              height = vertical ? 'auto' : `${value / 255 * 100}%`;

        child.style.width = width;
        child.style.height = height;
      }
    }

    // const slice = history.children[0];
    const slice = history.children[nextSliceIndex];
    for (let i = 0; i < slice.children.length; i++) {
      const node = slice.children[i];

      const averagedValue = Math.floor(accumulator[accumulator.length - i - 1] / accumulations);

      node.style.opacity = averagedValue / 255;
    }

    const total = sum / nodes.children.length;

    nodes.style.backgroundColor = `rgba(${total}, ${total}, ${total}, 1)`;

    accumulations++;

    return update;
  }
}

window.requestFullScreen = () => {
  if (document.body.requestFullScreen) document.body.requestFullScreen();
  else if (document.body.webkitRequestFullScreen) document.body.webkitRequestFullScreen();
  else if (document.body.mozRequestFullScreen) document.body.mozRequestFullScreen();
  else if (document.body.msRequestFullScreen) document.body.msRequestFullScreen();
};

window.cycleHistorySize = backwards => {
  if (backwards) historyLengthCycle.goBackward();
  else historyLengthCycle.goForward();

  setHistoryLength(historyLengthCycle.value);
};

window.cycleAccumulationPeriod = () => {
  accumulationPeriodsCycle.goForward();
  return false;
};

window.wheel = event => {
  console.log('wheel', event);
};

window.storage = () => {
  authorized.classList.toggle('storage');
};

document.body.addEventListener('webkitfullscreenchange', event => {
  document.body.classList.toggle('fullscreen');
});

const updates = [];

function requestUpdateLoop() {
  requestAnimationFrame(updateLoop);
}

function updateLoop() {
  processUpdates(updates);
  requestUpdateLoop();

  function processUpdates(updates) {
    const newUpdates = updates.map(update => update());

    updates.splice(0);
    updates.push(...newUpdates.filter(e => typeof e === 'function')); // should be this, but don't want to call typeof every time
  }
}

function mediaError(error) {
  // if (error.name === 'PermissionDeniedError') return; //ignore for now

  showError(error);

  // if (confirm(`An error occurred! (${error.message} ${error.stack}) Reload?`)) {
  //   window.location.reload();
  // }
}