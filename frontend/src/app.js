import Cycle from './cycle';


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

const now = document.getElementById('now'),
      nodes = document.getElementById('nodes'),
      history = document.getElementById('history'),
      time = document.getElementById('time'),
      nowMenu = document.getElementById('now-menu');

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

// const saveBlockTime = 60 * 1000; // one minute
const saveBlockTime = 5 * 1000; // five seconds
const smoothingTimeConstant = 0.66;

const barCounts = new Cycle([1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192/*, 16384, 32768*/]);
const accumulationPeriods = new Cycle([1000, 1000 / 2, 1000 / 4, 1000 / 8, 1000 / 16, 1000 / 32, 1000 / 64]);
const historySizes = new Cycle([10, 25, 50, 100, 175, 300, 500, 800, 1200]);

const barCountCycle = barCounts.create(),
      accumulationPeriodsCycle = accumulationPeriods.create(),
      historySizesCycle = historySizes.create();

let data, accumulations = 0, accumulationStart = -1000;

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


let playback;
let shouldFinalize = false;
let callWhenFinalized;
function attachRecorder(stream) {
  let currentRecorder = new MediaRecorder(stream),
      nextRecorder = new MediaRecorder(stream);

  const startTime = new Date().getTime(),
        savedBlobs = [];

  let data = [];
  let dataSize = 0,
      totalDataSize = 0,
      lastSaveTime = startTime;

  currentRecorder.ondataavailable = makeDataHandler(currentRecorder);
  currentRecorder.start();

  updates.push(updateTime);

  playback = (time = lastSaveTime) => {

    let delta = time - lastSaveTime;

    if (delta < 0) { // is this the right boundary?

      delta = 0;
    }

    // shouldFinalize = true;
    // recorder.requestData();

    // recorder.stop();
    // secondRecorder.start();

    // callWhenFinalized = blob => play(blob, delta);

    console.log(lastSaveTime, delta, data);

    // const blob = new Blob([savedBlobs[0], data]);
    // const url = window.URL.createObjectURL(blob);

    // audio.src = url;

    // audio.currentTime = delta / 1000;
    // audio.play();
  };

  return {currentRecorder, nextRecorder, stream, data, lastSaveTime};

  function makeDataHandler(r) {
    const recorder = r;
    let data = [],
        finalize = false;

    // console.log(recorder, r);

    return event => {
      const now = new Date().getTime();

      data.push(event.data);

      // console.log(r.state);

      if (finalize) {
        savedBlobs.push([now, new Blob(data)]);
        lastSaveTime = now;

        data.splice(0);

        // console.log('finalized');
      }
      else if (now - lastSaveTime > saveBlockTime) {
        console.log('should finalize');

        finalize = true;

        if (r.state !== 'inactive') {
          console.log('switching recorders');
          r.stop(); // should be a different condition
        }

        nextRecorder.ondataavailable = makeDataHandler(nextRecorder);
        nextRecorder.start();

        const tmp = currentRecorder;

        currentRecorder = nextRecorder;
        nextRecorder = tmp;
      }
    };
  }

  // function addData(event) {
  //   const now = new Date().getTime();

  //   data.push(event.data);

  //   if (now - lastSaveTime > saveBlockTime) {
  //     currentRecorder.stop();

  //     nextRecorder.ondataavailable = addData;
  //     nextRecorder.start();
  //   }
  // }

  // function addData(event) {
  //   const now = new Date().getTime();

  //   data.push(event.data);

  //   if (now - lastSaveTime > saveBlockTime) shouldFinalize = true;

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

  //   if (now - lastSaveTime > saveBlockTime) {
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

  const gain = audioContext.createGain();

  gain.gain.value = 1; // here for tweaking

  source.connect(gain);
  gain.connect(analyser);

  now.cycleBarCount = backwards => {
    if (backwards) barCountCycle.goBackward();
    else barCountCycle.goForward();

    setAnalyserSize(analyser, barCountCycle.value, nodes);

    return false;
  };

  let hasMenu = false;
  let start = {x: 0, y: 0},
      last = {x: 0, y: 0};

  let timer;

  now.mouseDown = event => {
    hasMenu = true;

    start.x = last.x = event.clientX;
    start.y = last.y = event.clientY;

    timer = setTimeout(() => {
      if (hasMenu) nowMenu.classList.add('visible');
      timer = undefined;
    }, 125);
  };

  now.mouseUp = event => {
    hasMenu = false;
    nowMenu.classList.remove('visible');

    if (event.button === 0 && timer) {
      clearTimeout(timer);

      nodes.classList.toggle('vertical');

      timer = undefined;
    }
  };

  now.mouseMove = event => {
    const total = {x: event.clientX - start.x, y: event.clientY - start.y};

    if (hasMenu) {
      // console.log('mousemove', event, total);

    }
  };

  now.touchStart = event => {
    hasMenu = true;
    start.x = last.x = event.clientX;
    start.y = last.y = event.clientY;

    timer = setTimeout(() => {
      if (hasMenu) nowMenu.classList.add('visible');
      timer = undefined;
    }, 125);

    return false;
  };

  now.touchEnd = event => {
    hasMenu = false;
    nowMenu.classList.remove('visible');

    if (timer) {
      clearTimeout(timer);

      nodes.classList.toggle('vertical');

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
        indicators.end = history.firstChild;

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

  // setHistoryLength(historySizesCycle.value);

  // need to distribute current accumulations

  for (let i = 0; i < count; i++) accumulator[i] = 0;
  accumulator.splice(count);

  for (let i = nodes.children.length; i < count; i++) nodes.appendChild(document.createElement('div'));
  for (let i = nodes.children.length - 1; i >= count; i--) nodes.children[i].remove();
}

function setHistoryLength(length) {
  // for (let i = history.children.length; i < length; i++) history.appendChild(document.createElement('slice'));
  for (let i = history.children.length - 1; i >= length; i--) history.children[i].remove();
}

let indicators = {mover: undefined, start: undefined, end: undefined};

function draw({analyser}) {
  noPermission.classList.add('granted');
  authorized.classList.add('authorized');

  updates.push(update);

  requestUpdateLoop();

  function update() {
    const now = new Date().getTime();

    analyser.getByteFrequencyData(data);


    // if (now - accumulationStart > accumulationPeriod) {
    if (now - accumulationStart > accumulationPeriodsCycle.value) {
      const slice = history.children.length >= historySizesCycle.value ? history.lastElementChild : document.createElement('slice');
      for (let i = slice.children.length; i < nodes.children.length; i++) slice.appendChild(document.createElement('node'));
      for (let i = slice.children.length - 1; i >= nodes.children.length; i--) slice.children[i].remove();

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

      history.insertBefore(slice, history.firstChild);

      accumulations = 1;
      accumulationStart = now;
    }

    const vertical = nodes.className === 'vertical';

    let sum = 0;

    const barsCount = nodes.children.length;

    if (barsCount === 1) {
      const child = nodes.children[0];

      const total = data[0] + data[1] + data[2] + data[3] + data[4] + data[5] + data[6] + data[7],
            average = total / 8;

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

    const slice = history.children[0];
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
  if (backwards) historySizesCycle.goBackward();
  else historySizesCycle.goForward();

  setHistoryLength(historySizesCycle.value);
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
  console.log(error); // should report these?

  if (error.name === 'PermissionDeniedError') return; //ignore for now

  if (confirm(`An error occurred! (${error.message} ${error.stack}) Reload?`)) {
    window.location.reload();
  }
}