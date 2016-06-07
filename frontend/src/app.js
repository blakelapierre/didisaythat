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
  .then(draw)
  .catch(refresh);

function getUserMedia(options) {
  return new Promise((resolve, reject) => navigator.getUserMedia(options, resolve, reject));
}

function attachRecorder(stream) {
  const recorder = new MediaRecorder(stream),
        data = [];

  let dataSize = 0;

  recorder.ondataavailable = addData;

  recorder.start();

  updates.push(updateSize);

  return {stream};

  function addData(event) {
    data.push(event.data);
    dataSize += event.data.size;
  }

  function updateSize() {
    size.innerHTML = dataSize;

    return updateSize;
  }
}

const sizes = [32, 64, 128, 256];
let nextSize = 1;

function attachAnalyser({stream}) {
  const source = audioContext.createMediaStreamSource(stream),
        analyser = audioContext.createAnalyser(),
        rate = audioContext.sampleRate;

  analyser.smoothingTimeConstant = 0.66;
  setAnalyserSize(analyser, sizes[0], nodes);

  source.connect(analyser);

  nodes.cycleFFTSize = () => {
    setAnalyserSize(analyser, sizes[nextSize++], nodes);

    nextSize = nextSize % sizes.length;

    return false;
  };

  return {stream, analyser};
}

const accumulationPeriods = [1000, 1000 / 2, 1000 / 4, 1000 / 8, 1000 / 16, 1000 / 32];
let currentAccumulationPeriodIndex = 0,
    accumulationPeriod = accumulationPeriods[currentAccumulationPeriodIndex];

const historySizes = [10, 25, 50, 100, 175, 300];
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
  history.appendChild(document.createElement('slice'));
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

window.cycleHistoryLength = () => {
  currentHistorySizeIndex = (currentHistorySizeIndex + 1) % historySizes.length;
  setHistoryLength(historySizes[currentHistorySizeIndex]);
};

window.cycleAccumulationPeriod = () => {
  currentAccumulationPeriodIndex = (currentAccumulationPeriodIndex + 1) % accumulationPeriods.length;

  accumulationPeriod = accumulationPeriods[currentAccumulationPeriodIndex];
  return false;
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
    updates.push(...newUpdates);
  }
}

function refresh(error) {
  console.log(error); // should report these?
  if (confirm(`An error occurred! (${JSON.stringify(error)}) Reload?`)) {
    window.location.reload();
  }
}