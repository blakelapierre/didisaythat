navigator.getUserMedia = (navigator.getUserMedia ||
                          navigator.webkitGetUserMedia ||
                          navigator.mozGetUserMedia ||
                          navigator.msGetUserMedia);

const AudioContext = (window.AudioContext || webkitAudioContext);

if (!navigator.getUserMedia) alert('No getUserMedia!');
if (!navigator.mediaDevices) alert('No mediaDevices!');
if (!AudioContext) alert('No AudioContext!');
if (!MediaRecorder) alert('No MediaRecorder!');

const audioContext = new AudioContext();

const now = document.getElementById('now'),
      nodes = document.getElementById('nodes'),
      history = document.getElementById('history'),
      size = document.getElementById('size'),
      nowMenu = document.getElementById('now-menu');

const audio = document.createElement('audio');

document.body.insertBefore(audio, document.body.firstChild);

getUserMedia({audio: true})
  .then(attachRecorder)
  .then(attachAnalyser)
  .then(attachPlaybackService)
  .then(draw)
  .catch(refresh);

const smoothingTimeConstant = 0.66;

const sizes = [32, 64, 128, 256, 512, 1024, 2048, /*4096, 8192, 16384, 32768*/];
const accumulationPeriods = [1000, 1000 / 2, 1000 / 4, 1000 / 8, 1000 / 16, 1000 / 32, 1000 / 64];
const historySizes = [10, 25, 50, 100, 175, 300, 500, 800, 1200];

let currentSize = 0;

let currentAccumulationPeriodIndex = 3,
    accumulationPeriod = accumulationPeriods[currentAccumulationPeriodIndex];

let currentHistorySizeIndex = 1,
    historyLength = historySizes[currentHistorySizeIndex];

let data, accumulations = 0, accumulationStart = new Date().getTime();

const accumulator = [];


function getUserMedia(options) {
  return new Promise((resolve, reject) => navigator.getUserMedia(options, resolve, reject));
}

function attachRecorder(stream) {
  const recorder = new MediaRecorder(stream),
        startTime = new Date().getTime(),
        data = [];

  let dataSize = 0;

  recorder.ondataavailable = addData;

  recorder.start(1000);

  updates.push(updateSize);

  return {stream, data, startTime};

  function addData(event) {
    data.push(event.data);
    dataSize += event.data.size;
  }

  function updateSize() {
    size.innerHTML = dataSize;

    return updateSize;
  }
}


function attachAnalyser({stream, data, startTime}) {
  const source = audioContext.createMediaStreamSource(stream),
        analyser = audioContext.createAnalyser(),
        rate = audioContext.sampleRate;

  analyser.smoothingTimeConstant = smoothingTimeConstant;
  setAnalyserSize(analyser, sizes[currentSize], nodes);

  source.connect(analyser);

  now.cycleFFTSize = backwards => {
    if (backwards) {
      currentSize = currentSize - 1;
      if (currentSize < 0) currentSize = sizes.length - 1;
    }
    else {
      currentSize = (currentSize + 1) % sizes.length;
    }

    currentSize = currentSize % sizes.length;

    setAnalyserSize(analyser, sizes[currentSize], nodes);

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

  history.mouseDown = event => {
    console.log(event);
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

  return {stream, data, startTime, analyser};
}


let playback;
function attachPlaybackService({stream, data, startTime, analyser}) {
  // document.body.appendChild(audio);

  playback = (time = startTime) => {
    const blob = new Blob(data);
    const delta = time - startTime;

    const url = window.URL.createObjectURL(blob);

    console.log('playback', time, delta, url);

    audio.src = url;

    audio.currentTime = delta / 1000;
    audio.play();
  };


  return {stream, data, analyser, playback};
}

function setAnalyserSize(analyser, size, nodes) {
  analyser.fftSize = size;

  const bins = analyser.frequencyBinCount,
        count = bins / 2;

  data = new Uint8Array(count);

  setHistoryLength(historyLength);

  for (let i = 0; i < count; i++) accumulator[i] = 0;
  accumulator.splice(count);
  for (let i = nodes.children.length; i < count; i++) nodes.appendChild(document.createElement('div'));
  for (let i = nodes.children.length - 1; i >= count; i--) nodes.children[i].remove();
}

function setHistoryLength(length) {
  historyLength = length;

  for (let i = history.children.length; i < historyLength; i++) history.appendChild(document.createElement('slice'));
  for (let i = history.children.length - 1; i >= historyLength; i--) history.children[i].remove();
}

let indicators = {mover: undefined, start: undefined, end: undefined};
function draw({analyser}) {
  updates.push(update);

  requestUpdateLoop();

  function update() {
    const now = new Date().getTime();

    analyser.getByteFrequencyData(data);

    if (now - accumulationStart > accumulationPeriod) {
      // add accumulator to history
      // const slice = document.createElement('slice');

      const slice = history.lastElementChild;

      for (let i = slice.children.length; i < data.length; i++) slice.appendChild(document.createElement('node'));
      for (let i = slice.children.length - 1; i >= data.length; i--) slice.children[i].remove();

      slice.approximateTime = now;

      for (let i = 0; i < accumulator.length; i++) {
        const node = slice.children[i];
        // const node = document.createElement('node');

        const averagedValue = Math.floor(accumulator[i] / accumulations);

        // node.style.backgroundColor = `rgba(${averagedValue}, ${averagedValue}, ${averagedValue}, 1)`;

        node.style.opacity = averagedValue / 255;

        slice.classList.remove('mover');
        slice.classList.remove('start');
        slice.classList.remove('end');
        slice.insertBefore(node, slice.firstChild);

        accumulator[i] = 0;
      }

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

      accumulations = 0;
      accumulationStart = now;
    }

    const vertical = nodes.className === 'vertical';

    let sum = 0;

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

window.cycleHistoryLength = backwards => {
  currentHistorySizeIndex = backwards ? (currentHistorySizeIndex > 0 ? currentHistorySizeIndex - 1 : historySizes.length - 1): (currentHistorySizeIndex + 1) % historySizes.length;
  setHistoryLength(historySizes[currentHistorySizeIndex]);
};

window.cycleAccumulationPeriod = () => {
  currentAccumulationPeriodIndex = (currentAccumulationPeriodIndex + 1) % accumulationPeriods.length;

  accumulationPeriod = accumulationPeriods[currentAccumulationPeriodIndex];
  return false;
};

window.wheel = event => {
  console.log('wheel', event);
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
  // requestAnimationFrame(updateLoop);

  function processUpdates(updates) {
    const newUpdates = updates.map(update => update());

    updates.splice(0);
    updates.push(...newUpdates.filter(e => typeof e === 'function')); // should be this, but don't want to call typeof every time
    // updates.push(...newUpdates);
  }
}

function refresh(error) {
  console.log(error); // should report these?
  if (confirm(`An error occurred! (${error.message} ${error.stack}) Reload?`)) {
    window.location.reload();
  }
}