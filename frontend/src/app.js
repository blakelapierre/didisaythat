import Cycle from './cycle';
import Recording from './recording';

const errorDetailsElement = document.getElementsByTagName('error-details')[0],
      errorElement = document.getElementsByTagName('error-display')[0];

// errorElement.addEventListener('click', event => errorElement.style.display = 'none');
window.addEventListener('error', event => showError(event.error));

function showError(error) {
  console.log(error);
  console.dir(error);

  if (error.name === 'SecurityError' && window.location.protocol === 'http') {
    errorDetailsElement.getElementsByTagName('message')[0].innerHTML = `${error.message}`;
    errorDetailsElement.getElementsByTagName('stack')[0].innerHTML = `Attempting to load over https...`;
    errorElement.style.display = 'flex';
    window.location.href = window.location.href.replace(/^http/, 'https');
  }
  else {
    errorDetailsElement.getElementsByTagName('message')[0].innerHTML = `${error.message}`;
    errorDetailsElement.getElementsByTagName('stack')[0].innerHTML = `${encodeEntities(error.stack)}`;
    errorElement.style.display = 'flex';
  }
}

// from Angular
// https://github.com/angular/angular.js/blob/v1.3.14/src/ngSanitize/sanitize.js#L435
const SURROGATE_PAIR_REGEXP = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g,
      NON_ALPHANUMERIC_REGEXP = /([^\#-~| |!])/g;
function encodeEntities(value = '') {
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

function markNotCapable(reason) {
  const notCapable = document.getElementById('not-capable'),
        capable = document.getElementById('capable');

  notCapable.style.display = 'flex';
  capable.style.display = 'none';

  notCapable.appendChild(document.createTextNode(reason));
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

handleAndroidComponent();

function handleAndroidComponent() {
  if (/android/i.test(navigator.userAgent)) {
    let androidMessageCount = parseInt(localStorage.getItem('androidMessageCount'));

    if (isNaN(androidMessageCount)) androidMessageCount = 3;

    if (androidMessageCount > 0) {
      const android = document.getElementsByTagName('android')[0],
            close = android.getElementsByTagName('close')[0];

      android.style.display = 'flex';
      androidMessageCount--;

      if (androidMessageCount === 0) {
        close.innerHTML = 'Don\'t Remind Me Again';
      }
      else if (androidMessageCount === 1) {
        close.innerHTML = `Remind Me At Least 1 More Time`;
      }
      else {
        close.innerHTML = `Remind Me At Least ${androidMessageCount} More Times`;
      }

      close.close = () => {
        android.style.display = 'none';

        localStorage.setItem('androidMessageCount', androidMessageCount);

        return false;
      };
    }
  }
}

function attach(root, context) {
  const subContext = context.attach(root /* ? */); /* ? */
  for (let i = 0; i < root.children.length; i++) attach(root.children[i], subContext);
}

class Context {
  constructor(config) {
    this.context = contextify(config);

    function contextify(config) {
      for (let name in config) {
        let item = config[name];

        if (typeof item === 'object') item = contextify(item);

        // http://stackoverflow.com/questions/8955533/javascript-jquery-split-camelcase-string-and-add-hyphen-rather-than-space
        const tagName = name.replace(/([a-zA-Z])(?=[A-Z])/g, '$1-').toUpperCase();

        config[tagName] = bounce(tagName, item);
      }

      return config;
    }

    // not sure if this is really what I want
    function bounce(tagName, item) {
      return (element, context) => {
        item(element, context, tagName);
        return context;
      };
    }
  }

  attach (element) {
    const {tagName} = element,
          context = this.context[tagName];

    return context ? context(element, this) : this;
  }
}

const context = new Context({
  notCapable (element, context) {
    console.log('not-capable', element, context);
  },

  capable (element, context) {
    console.log('capable', element, context);
  }
});

attach(document.body, context);

const request = window.indexedDB.open('dist.lol');

let db;
request.onerror = event => {
  console.log('error opening request', event, request);
};

request.onsuccess = event => {
  console.log('request open', event, request);
  db = request.result;
};

request.onupgradeneeded = event => {
  console.log('needs upgrade', event);
  event.target.result.createObjectStore('recordings', {autoIncrement: true});
};

const audioContext = new AudioContext();

const noPermission = document.getElementById('no-permission'),
      authorized = document.getElementById('authorized'),
      hint = noPermission.children[1];


const upper = document.getElementsByTagName('upper')[0],
      recent = upper.getElementsByTagName('recent')[0],
      nodes = recent.getElementsByTagName('nodes')[0],
      history = document.getElementById('history'),
      time = document.getElementById('time'),
      recentMenu = document.getElementById('recent-menu');

const hoursEl = document.getElementsByTagName('hours')[0],
      minutesEl = document.getElementsByTagName('minutes')[0],
      secondsEl = document.getElementsByTagName('seconds')[0],
      millisecondsEl = document.getElementsByTagName('milliseconds')[0];

const storagePanel = document.getElementsByTagName('storage-panel')[0];

const lower = document.getElementsByTagName('lower')[0];

addMenu(upper);
addMenu(lower);

upper.onmousewheel = event => recent.cycleBarCount(event.deltaY < 0); // probably should do this better?
upper.onwheel = event => recent.cycleBarCount(event.deltaY < 0); // probably should do this better?

function addMenu(container) {
  const menu = container.getElementsByTagName('menu')[0];

  let timer, defaultFn;
  let touches, move;

  container.onmousedown = event => {
    console.log('container mouse down');
    if (event.button === 0) {
      defaultFn = mouseDefault;
      queueMenu(event.clientX, event.clientY);
    }

    return false;
  };

  container.oncontextmenu = event => {
    nodes.cycleBarEffect(true);

    return false;
  };

  container.ontouchstart = event => {
    if (event.touches.length === 1) {
      const [{clientX, clientY}] = event.touches;

      defaultFn = touchDefault;
      queueMenu(clientX, clientY);
    }

    return false;
  };

  container.ontouchend = processEnd;
  container.onmouseup = processEnd;

  container.onmousemove = event => {
    move = event;
  };

  container.ontouchmove = event => {
    touches = event.touches;
  };

  function mouseDefault(event) {
    nodes.cycleBarEffect();
  }

  function touchDefault(event) {

  }

  function queueMenu(x, y) {
    timer = setTimeout(() => {
      const e = touches ? touches[0] : move;
      showMenu(e.clientX, e.clientY);
      // showMenu(x, y);
      timer = undefined;
    }, 125);
  }

  function processEnd(event) {
    if (timer) {
      clearTimeout(timer);
      defaultFn(event);

      timer = undefined;
    }

    return hideMenu(event);
  }

  function showMenu(x, y) {
    menu.style.display = 'flex';
    menu.style.left = `${x - menu.clientWidth / 2}px`;
    menu.style.top = `${y - menu.clientHeight / 2}px`;

    return false;
  }

  function hideMenu(event) {
    menu.style.display = 'none';

    return false;
  }
}

// // probably need better names than these
// const options = {
//   upper: {
//     'Bars': {
//       'more': nodes.cycleBarCount(), // should just be a state modification?
//       'less': nodes.cycleBarCount(backwards) // should just be a state modification?
//     },
//     'Smoothing': {
//       'more': () => {},
//       'less': () => {}
//     },
//     'Gain': {
//       'more': () => {},
//       'less': () => {}
//     }
//   },
//   lower: {
//     'Speed': {
//       'faster': () => {},
//       'slower': () => {}
//     },
//     'Length': {
//       'more': () => {},
//       'less': () => {}
//     },
//     'Quality': {
//       'hard': () => {},
//       'soft': () => {}
//     }
//   },
//   storage: {
//     'Rows': {
//       'more': () => {},
//       'less': () => {}
//     }
//   }
// };

const audio = document.createElement('audio');

document.body.insertBefore(audio, document.body.firstChild);

const mainCanvas = document.createElement('canvas'),
      mainContext = mainCanvas.getContext('2d'),
      displayCanvas = document.createElement('canvas'),
      displayContext = displayCanvas.getContext('2d'),
      mainPixel = mainContext.createImageData(1, 1),
      mainPixelData = mainPixel.data,
      mainCanvasColumnTime = [];

history.appendChild(displayCanvas);

mainContext.imageSmoothingEnabled = false;
displayContext.imageSmoothingEnabled = false;

window.addEventListener('resize', event => setCanvasSize(displayCanvas, displayContext));
history.addEventListener('resize', event => setCanvasSize(displayCanvas, displayContext));

window.addEventListener('keyup', keyup);

const commands = {
  '66': event => {
    if (mainCanvas.parentElement) mainCanvas.parentElement.removeChild(mainCanvas);
    else {
      authorized.appendChild(mainCanvas);
      setTimeout(() => disableSmoothing(mainContext), 1000); // does nothing?
    }
  }
};

function keyup(event) {
  console.log(event.keyCode);
  const command = commands[event.keyCode];

  if (command) return command(event);
}

displayCanvas.addEventListener('click', event => {
  const sliceIndex = Math.floor(event.offsetX / displayCanvas.width * mainCanvas.width);

  console.log(sliceIndex, mainCanvasColumnTime[sliceIndex]);

});


// not sure what to name this yet
class X {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.pixel =  this.context.createImageData(1, 1);
    this.pixelData = this.pixel.data;

    this.views = [];

    canvas.className = 'buffer-canvas';
  }

  createView() {
    const canvas = document.createElement('canvas'),
          context = canvas.getContext('2d');

    return {canvas, context};
  }

  createMovingView() {

  }

  updateViews() {
    // should use something better than this
    for (let i = 0; i < this.views.length; i++) {
      if (shouldUpdate(this.views[i])) update(this.views[i]);
    }
  }

  setSize(width, height) {
    setCanvasSize(this.canvas, this.context, width, height);
  }

  setParameters(storageRowCount, historyLength, barCount) {
    console.log('parameters', storageRowCount, historyLength, barCount);
    this.setSize((storageRowCount + 1) * historyLength, barCount);

    this.nextSliceIndex = this.canvas.width - 1;
  }

  setSlice(accumulator) {
    const {canvas, context, nextSliceIndex, pixel, pixelData} = this;

    for (let i = 0; i < canvas.height; i++) {
      const value = accumulationStrategy.getValue(accumulator, accumulator.length - 1 - i);

      pixelData[0] = value;
      pixelData[1] = value;
      pixelData[2] = value;
      pixelData[3] = 255;

      context.putImageData(pixel, nextSliceIndex, i);
    }
  }

  finishSlice(accumulator) {
    if (accumulator) this.setSlice(accumulator);

    this.nextSliceIndex = (this.nextSliceIndex === 0 ? this.canvas.width : this.nextSliceIndex) - 1;
  }

  drawTo(canvas, context, distance = 1) {
    const wi = Math.min(distance, this.canvas.width - this.nextSliceIndex),
          vwwi = this.canvas.width - wi;

    if (vwwi > 0) {
      context.drawImage(this.canvas, 0, 0, vwwi, this.canvas.height, vwwi, 0, canvas.width, canvas.height);
    }
    context.drawImage(this.canvas, this.nextSliceIndex, 0, wi, this.canvas.height, 0, 0, canvas.width, canvas.height);


    // const xStart = this.nextSliceIndex;

    // let width = this.canvas.width - xStart;

    // // console.log('Drawing', {xStart, width, canvasWidth: this.canvas.width});

    // if (xStart + width > this.canvas.width) {
    //   width = this.canvas.width - xStart;

    //   const missing = canvas.width - width;

    //   const x = this.canvas.width - missing;
    //   const otherXStart = x / this.canvas.wdith * canvas.width;
    //   const remainingWidth = missing / this.canvas.width * canvas.width;

    //   context.drawImage(this.canvas, 0, 0, x, this.canvas.height, otherXStart, 0, remainingWidth, canvas.height);
    //   console.log('draw', {x});
    // }

    // context.drawImage(this.canvas, xStart, 0, width, this.canvas.height, 0, 0, canvas.width, canvas.height);
  }
}

const canvasBuffer = new X(mainCanvas);

// canvasBuffer.setParameters(4, 60, 2);

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
const saveBlockDuration = 30 * 1000; // five seconds
const smoothingTimeConstant = 0.66;

const barCounts = new Cycle([1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192/**//*, 16384, 32768*/]);
const accumulationPeriods = new Cycle([1000, 1000 / 2, 1000 / 4, 1000 / 8, 1000 / 16, 1000 / 32, 1000 / 64, 1000 / 128]);
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
  const url = window.URL.createObjectURL(blob);

  audio.src = url;

  audio.currentTime = position / 1000;
  audio.play();
}

class RecordingDataSource {
  constructor () {
    this.recordings = [];
  }

  addRecording ({start, blob}) {
    this.recordings.push([start, blob]);

    try {
      const transaction = db.transaction(['recordings'], 'readwrite');

      transaction.oncomplete = event => console.log('complete', event);
      transaction.onerror = event => console.log('error', event, transaction);

      const store = transaction.objectStore('recordings');
      const request = store.add({start, blob});

      request.onsuccess = event => console.log('success', event, request);
    }
    catch (e) {
      const reader = new FileReader();

      reader.onload = () => {
        const transaction = db.transaction(['recordings'], 'readwrite');

        transaction.oncomplete = event => console.log('complete', event);
        transaction.onerror = event => console.log('error', event, transaction);

        const store = transaction.objectStore('recordings');
        const request = store.add({start, data: reader.result});

        request.onsuccess = event => console.log('success', event, request);
      };

      reader.readAsDataURL(blob);

      console.log(`saved ${start}`);
    }
  }
}

const recordingDataSource = new RecordingDataSource();

class Recorder {
  constructor (stream, duration) {
    this.recording = this._startRecording(stream, duration);
  }

  _startRecording (stream, duration) {
    const recording = new Recording(new MediaRecorder(stream), duration);

    recording.recordingEnding = () => {
      this.otherRecording = this._startRecording(stream, duration);
    };

    recording.onDurationMet = () => {
      recordingDataSource.addRecording(this.recording);
      // this.recordings.push([this.recording.start, this.recording.blob]);

      this.recording = this.otherRecording;
    };

    return recording;
  }
}

let dataCount = 0;
let playback;
let shouldFinalize = false;
let callWhenFinalized;
function attachRecorder(stream) {
  const recorder = new Recorder(stream, saveBlockDuration),
        startTime = recorder.recording.start;

  updates.push(updateTime);

  playback = (time = startTime) => {

    let delta = time - startTime;

    console.log('playback', time, delta, startTime);

    if (delta < 0) { // is this the right boundary?

      delta = 0;
    }

    // shouldFinalize = true;
    // recorder.requestData();

    // recorder.stop();
    // secondRecorder.start();

    // callWhenFinalized = blob => play(blob, delta);

    // console.log(startTime, delta, data);

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

  function updateTime() {
    const duration = new Date().getTime() - startTime,
          milliseconds = duration % 1000,
          totalSeconds = Math.floor(duration / 1000),
          seconds = totalSeconds % 60,
          minutes = Math.floor(totalSeconds / 60) % 60,
          totalMinutes = Math.floor(duration / (60 * 1000)),
          hours = Math.floor(totalMinutes / 60);

    hoursEl.innerHTML = hours;
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

  history.onmousedown = event => {
    console.log('mouseDown', event);
    event.stopPropagation();
    return false;
  };

  history.onmouseup = event => {
    console.log('mouseUp');
    if (event.button === 0) {
      const slice = event.target.tagName === 'SLICE' ? event.target : event.target.parentNode;

      updates.push(() => {
        console.log(indicators);
        if (indicators.mover) indicators.mover.classList.remove('mover');
        if (indicators.start) indicators.start.classList.remove('start');
        if (indicators.end) indicators.end.classList.remove('end');

        indicators.start = indicators.mover = slice;
        // indicators.end = history.firstChild;
        indicators.end = history.children[Math.max(0, history.children.length - position)];

        if (indicators.start) indicators.start.classList.add('start');
        if (indicators.end) indicators.end.classList.add('end');
        if (indicators.mover) indicators.mover.classList.add('mover');
      });

      playback(slice.approximateTime);

      event.stopPropagation();
    }
  };

  history.oncontextmenu = event => {
    event.stopPropagation();
    return cycleAccumulationPeriod();
  };

  history.onmousewheel = event => cycleHistorySize(event.deltaY < 0);
  history.onwheel = event => cycleHistorySize(event.deltaY < 0);

  return {stream, data, lastSaveTime, analyser};
}

const accumulationStrategies = {
  'mean': {
    'split': (accumulator, count) => {
      const levels = Math.log2(count) - Math.log2(accumulator.length || 1),
            divisor = Math.pow(2, levels);

      for (let i = 0; i < count / divisor; i++) {
        const parts = (accumulator[i] / divisor || 0) / (accumulations || 1);

        accumulator[divisor*i] = parts;
        accumulator[divisor*i+1] = parts;
      }

      accumulations = 1;
    },
    'combine': (accumulator, count) => {
      //shrinking, combine
      const levels = Math.log2(accumulator.length || 1) - Math.log2(count || 1),
            divisor = Math.pow(2, levels);

      for (let i = 0; i < accumulator.length; i++) {
        let sum = 0;
        for (let j = 0; j < divisor; j++) sum += accumulator[i * j + j];
        accumulator[i] = sum / divisor;
      }
    },
    'add': (accumulator, position, value) => {
      accumulator[position] += value;
    },
    'getValue': (accumulator, position) => {
      return  accumulator[position] / accumulations;
    }
  },
  'max': {
    split(accumulator, count) {

    },
    combine(accumulator, count) {

    },
    add(accumulator, position, value) {
      accumulator[position] = Math.max(accumulator[position] || 0, value);
    },
    getValue(accumulator, position) {
      return accumulator[position];
    }
  },
  'min': {
    split() {},
    combine() {},
    add(accumulator, position, value) {
      accumulator[position] = Math.min(accumulator[position] || 255, value);
    },
    getValue(accumulator, position) {
      return accumulator[position];
    }
  }
};

let accumulationStrategy = accumulationStrategies.mean;
// let accumulationStrategy = accumulationStrategies.max;
// let accumulationStrategy = accumulationStrategies.min;

function setAnalyserSize(analyser, size, nodes) {
  let fftSize = Math.max(32, Math.min(32768, size * 4));

  analyser.fftSize = fftSize;

  const bins = analyser.frequencyBinCount,
        count = Math.min(bins / 2, size);

  data = new Uint8Array(bins / 2);

  // need to distribute current accumulations

  if (count > accumulator.length) accumulationStrategy.split(accumulator, count);
  else accumulationStrategy.combine(accumulator, count);

  accumulator.splice(count);

  for (let i = nodes.children.length; i < count; i++) nodes.appendChild(document.createElement('div'));
  for (let i = nodes.children.length - 1; i >= count; i--) nodes.children[i].remove();

  canvasBuffer.setParameters(4, historyLengthCycle.value, barCountCycle.value);
}

function setHistoryLength(length) {
  console.log(length);

  canvasBuffer.setParameters(4, length, barCountCycle.value);
}

let indicators = {mover: undefined, start: undefined, end: undefined};
let position = 0, offsets = {data: 0, view: 0};
let lastUpdate, currentTime;

const averageNext = [];

averageNext[8] = (data,b) => (data[b] + data[b+1] + data[b+2] + data[b+3] + data[b+4] + data[b+5] + data[b+6] + data[b+7]) / 8;
averageNext[4] = (data,b) => (data[b] + data[b+1] + data[b+2] + data[b+3]) / 4;
averageNext[2] = (data,b) => (data[b] + data[b+1]) / 2;
averageNext[1] = (data,b) => data[b];

function accumulate(vertical, j, c) {
  for (let i = 0; i < j; i++) {
    const child = nodes.children[i],
          average = averageNext[c](data, j === 1 ? 0 : (j === 2 ? 4 * i : (j === 4 ? 2 * i : i))); // !

    accumulationStrategy.add(accumulator, i, average);

    setStyle(vertical, child, Math.round(average));
  }
}

function setStyle(vertical, child, value) {
  child.style.backgroundColor = `rgba(${value}, ${value}, ${value}, 1)`;

  const percent = `${value / 255 * 100}%`;

  if (vertical) {
    child.style.width = percent;
    child.style.height = 'auto';
  }
  else {
    child.style.width = 'auto';
    child.style.height = percent;
  }
}

function draw({analyser}) {
  accumulationStart = new Date().getTime();

  noPermission.classList.add('granted');
  authorized.classList.add('authorized');

  setCanvasSize(displayCanvas, displayContext);

  updates.push(update);

  requestUpdateLoop();

  console.log(analyser);

  function update() {
    const now = new Date().getTime();

    lastUpdate = now;
    currentTime = analyser.context.currentTime;

    analyser.getByteFrequencyData(data);

    if (now - accumulationStart > accumulationPeriodsCycle.value) {
      if (position < mainCanvas.width) position++;
      if (position === mainCanvas.width) offsets.view++; // might want >= ?
      offsets.data++;

      for (let i = 0; i < accumulator.length; i++) accumulator[i] = 0;

      canvasBuffer.finishSlice();

      accumulations = 1;
      accumulationStart = now;
    }

    const vertical = nodes.className === '' || nodes.classList.contains('left') || nodes.classList.contains('right');

    let sum = 0;

    const barsCount = nodes.children.length;

    accumulate(vertical, nodes.children.length, Math.max(1, 8 / barsCount)); // vertical shouldn't be passed through here!

    // const nextSliceIndex = position >= mainCanvas.width ? 0 : mainCanvas.width -1 - position;
    const nextSliceIndex = mainCanvas.width - ((position + offsets.view) % mainCanvas.width) - 1;

    mainCanvasColumnTime[nextSliceIndex] = accumulationStart;

    canvasBuffer.setSlice(accumulator);
    canvasBuffer.drawTo(displayCanvas, displayContext, historyLengthCycle.value);

    const total = sum / nodes.children.length;

    nodes.style.backgroundColor = `rgba(${total}, ${total}, ${total}, 1)`;

    accumulations++;

    return update;
  }
}

window.requestFullScreen = () => {
  console.log('going full', document.body); // fullscreen stopped working in my chrome?
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

window.toggleStorage = createStorageToggler();

let storageRowCount = 4;

function createStorageToggler() {
  let drawFn;
  const contexts = [];

  return function toggleStorage() {
    if (storagePanel.children.length === 0) {
      authorized.classList.add('storage');

      const width = storagePanel.clientWidth,
            height = storagePanel.clientHeight / storageRowCount;

      for (let i = 0; i < storageRowCount; i++) {
        const {canvas, context} = canvasBuffer.createView();

        storagePanel.appendChild(canvas);
        setCanvasSize(canvas, context, width, height);

        contexts.push(context);
      }

      window.addEventListener('resize', resize);

      // is there a better way to abstract this out?
      drawFn = () => {
        for (let i = 0; i < contexts.length; i++) {
          const context = contexts[i];

          context.drawImage(mainCanvas,
            (storageRowCount - i - 1) * (mainCanvas.width / storageRowCount), 0, mainCanvas.width / storageRowCount, mainCanvas.height,
            0, 0, context.canvas.width, context.canvas.height);
        }

        return drawFn;
      };

      updates.push(drawFn);
    }
    else {
      drawFn = undefined;
      for (let i = storagePanel.children.length - 1; i >= 0; i--) storagePanel.removeChild(storagePanel.children[i]);
      contexts.splice(0);
      authorized.classList.remove('storage');
      window.removeEventListener('resize', resize);
    }
  };

  function resize() {
    updates.push(() => {
      const width = storagePanel.clientWidth,
            height = storagePanel.clientHeight / storageRowCount;

      for (let i = 0; i < storageRowCount; i++) {
        const context = contexts[i];
        setCanvasSize(context.canvas, context, width, height);

        console.log(width, height);
      }
    });
  }
}

document.body.addEventListener('webkitfullscreenchange', event => {
  document.body.classList.toggle('fullscreen');
});

document.onfullscreenchange = event => {
  console.log('fullscreen');
  document.body.classList.toggle('fullscreen');
};

document.onmozfullscreenchange = event => {
  document.body.classList.toggle('fullscreen');
};

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
}

function setCanvasSize(canvas, context, width, height) {
  const parent = canvas.parentElement;

  canvas.width = width === undefined ? parent.clientWidth : width;
  canvas.height = height === undefined ? parent.clientHeight : height;

  console.log(canvas.width, canvas.height);

  disableSmoothing(context);
}

function disableSmoothing(context) {
  context.imageSmoothingEnabled = false;
  context.webkitImageSmoothingEnabled = false;
  context.msImageSmoothingEnabled = false;
}