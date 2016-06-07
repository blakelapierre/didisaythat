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

function attachAnalyser({stream}) {
  const source = audioContext.createMediaStreamSource(stream),
        analyser = audioContext.createAnalyser(),
        rate = audioContext.sampleRate;

  analyser.fftSize = 32;

  source.connect(analyser);

  return {stream, analyser};
}

function draw({analyser}) {
  const bins = analyser.frequencyBinCount,
        data = new Uint8Array(bins);

  for (let i = 0; i < bins / 2; i++) {
    nodes.appendChild(document.createElement('div'));
  }

  update();

  function update() {
    analyser.getByteFrequencyData(data);

    const vertical = nodes.className === 'vertical';

    for (let i= 0; i < nodes.children.length; i++) {
      const  child = nodes.children[i];

      const value = data[i];

      child.style.backgroundColor = `rgba(${value}, ${value}, ${value}, 1)`;

      const width = vertical ? `${value / 255 * 100}%` : 'auto',
            height = vertical ? 'auto' : `${value / 255 * 100}%`;

      child.style.width = width;
      child.style.height = height;
    }

    requestAnimationFrame(update);
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

function updateLoop() {
  processUpdates(updates);
  requestAnimationFrame(updateLoop);

  function processUpdates(updates) {
    updates.forEach(update);

    updates.splice(0);
  }
}