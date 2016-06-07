navigator.getUserMedia = (navigator.getUserMedia ||
                          navigator.webkitGetUserMedia ||
                          navigator.mozGetUserMedia ||
                          navigator.msGetUserMedia);

const AudioContext = (window.AudioContext || webkitAudioContext);

if (!navigator.getUserMedia) alert('No getUserMedia!');
if (!AudioContext) alert('No AudioContext!');
if (!MediaRecorder) alert('No MediaRecorder!');

const audioContext = new AudioContext();

const nodes = document.getElementById('nodes');

getUserMedia({audio: true})
  .then(attachRecorder)
  .then(attachAnalyser)
  .then(draw)
  .then(requestUpdateLoop)
  .catch(error => alert(error));

function getUserMedia(options) {
  return new Promise((resolve, reject) => navigator.getUserMedia(options, resolve, reject));
}

function attachRecorder(stream) {
  const recorder = new MediaRecorder(stream),
        data = [];

  let size = 0;

  recorder.ondataavailable = addData;

  recorder.start();

  return {stream};

  function addData(event) {
    data.push(event.data);
    size += event.data.size;
  }
}

const sizes = [32, 64, 128];
let nextSize = 1;

function attachAnalyser({stream}) {
  const source = audioContext.createMediaStreamSource(stream),
        analyser = audioContext.createAnalyser(),
        rate = audioContext.sampleRate;

  analyser.smoothingTimeConstant = 0.66;
  setAnalyserSize(analyser, 32, nodes);

  source.connect(analyser);

  nodes.cycleFFTSize = () => {
    setAnalyserSize(analyser, sizes[nextSize++], nodes);

    nextSize = nextSize % sizes.length;

    return false;
  };

  return {stream, analyser};
}

let data;

function setAnalyserSize(analyser, size, nodes) {
  analyser.fftSize = size;

  const bins = analyser.frequencyBinCount,
        count = bins / 2;

  data = new Uint8Array(count);

  for (let i = nodes.children.length; i < count; i++) nodes.appendChild(document.createElement('div'));
  for (let i = nodes.children.length - 1; i >= count; i--) nodes.children[i].remove();
}

function draw({analyser}) {
  updates.push(update);

  function update() {
    analyser.getByteFrequencyData(data);

    const vertical = nodes.className === 'vertical';

    let sum = 0;

    for (let i= 0; i < nodes.children.length; i++) {
      const  child = nodes.children[i];

      const value = data[i];

      sum += value;

      child.style.backgroundColor = `rgba(${value}, ${value}, ${value}, 1)`;

      const width = vertical ? `${value / 255 * 100}%` : 'auto',
            height = vertical ? 'auto' : `${value / 255 * 100}%`;

      child.style.width = width;
      child.style.height = height;
    }

    const total = sum / nodes.children.length;

    nodes.style.backgroundColor = `rgba(${total}, ${total}, ${total}, 1)`;

    return update;
    // requestAnimationFrame(update);
  }
}

window.requestFullScreen = () => {
  if (document.body.requestFullScreen) document.body.requestFullScreen();
  else if (document.body.webkitRequestFullScreen) document.body.webkitRequestFullScreen();
  else if (document.body.mozRequestFullScreen) document.body.mozRequestFullScreen();
  else if (document.body.msRequestFullScreen) document.body.msRequestFullScreen();
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