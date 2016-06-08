navigator.getUserMedia = (navigator.getUserMedia ||
                          navigator.webkitGetUserMedia ||
                          navigator.mozGetUserMedia ||
                          navigator.msGetUserMedia);

const AudioContext = (window.AudioContext || webkitAudioContext);

if (!navigator.getUserMedia) alert('No getUserMedia!');
if (!AudioContext) alert('No AudioContext!');
if (!MediaRecorder) alert('No MediaRecorder!');

const audioContext = new AudioContext();

const nodes = document.getElementById('nodes'),
      history = document.getElementById('history'),
      size = document.getElementById('size');

getUserMedia({audio: true})
  .then(attachRecorder)
  .then(attachAnalyser)
  .then(attachPlaybackService)
  .then(draw)
  .catch(refresh);

const sizes = [32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768];
const accumulationPeriods = [1000, 1000 / 2, 1000 / 4, 1000 / 8, 1000 / 16, 1000 / 32];
const historySizes = [5,25, 50, 100, 175, 300, 500, 800, 1200];

const smoothingTimeConstant = 0.8;


function getUserMedia(options) {
  return new Promise((resolve, reject) => navigator.getUserMedia(options, resolve, reject));
}

function attachRecorder(stream) {
  const recorder = new MediaRecorder(stream),
        startTime = new Date().getTime(),
        data = [];

  let dataSize = 0;

  recorder.ondataavailable = addData;

  recorder.start();

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

let currentSize = 0;

function attachAnalyser({stream, data, startTime}) {
  const source = audioContext.createMediaStreamSource(stream),
        analyser = audioContext.createAnalyser(),
        rate = audioContext.sampleRate;

  analyser.smoothingTimeConstant = smoothingTimeConstant;
  setAnalyserSize(analyser, sizes[currentSize], nodes);

  source.connect(analyser);

  nodes.cycleFFTSize = backwards => {
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

  nodes.mouseDown = event => {
    console.log('showMenu', event);
    hasMenu = true;
    start.x = last.x = event.clientX;
    start.y = last.y = event.clientY;
  };

  nodes.mouseUp = event => {
    hasMenu = false;
  };

  nodes.mouseMove = event => {
    const total = {x: event.clientX - start.x, y: event.clientY - start.y};

    if (hasMenu) {
    console.log('mousemove', event, total);

    }
  };

  return {stream, data, startTime, analyser};
}


let playback;
function attachPlaybackService({stream, data, startTime, analyser}) {
  const audio = document.createElement('audio');

  playback = (time = startTime) => {
    const blob = new Blob(data);
    const delta = time - startTime;

console.log(time, startTime, delta);
    const url = window.URL.createObjectURL(blob);

    console.log(url);

    audio.src = url;

    console.log(audio);
    audio.currentTime = delta / 1000;
    audio.play();
  };


  return {stream, data, analyser, playback};
}

let currentAccumulationPeriodIndex = 0,
    accumulationPeriod = accumulationPeriods[currentAccumulationPeriodIndex];

let currentHistorySizeIndex = 0,
    historyLength = historySizes[currentHistorySizeIndex];

let data, accumulations = 0, accumulationStart = new Date().getTime();
const accumulator = [];

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

      slice.approximateTime = new Date().getTime();

      for (let i = 0; i < accumulator.length; i++) {
        const node = slice.children[i];
        // const node = document.createElement('node');

        const averagedValue = Math.floor(accumulator[i] / accumulations);

        node.style.backgroundColor = `rgba(${averagedValue}, ${averagedValue}, ${averagedValue}, 1)`;

        slice.insertBefore(node, slice.firstChild);

        accumulator[i] = 0;
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

window.playback = event => {
  console.log('playback', event);
  const slice = event.target.parentNode;
  playback(event.target.parentNode.approximateTime);
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
    // updates.push(...newUpdates.filter(e => typeof e === 'function')); // should be this, but don't want to call typeof every time
    updates.push(...newUpdates);
  }
}

function refresh(error) {
  console.log(error); // should report these?
  if (confirm(`An error occurred! (${error.message} ${error.stack}) Reload?`)) {
    window.location.reload();
  }
}