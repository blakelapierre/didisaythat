navigator.getUserMedia = (navigator.getUserMedia ||
                          navigator.webkitGetUserMedia ||
                          navigator.mozGetUserMedia ||
                          navigator.msGetUserMedia);

const AudioContext = (window.AudioContext || webkitAudioContext);

if (!navigator.getUserMedia) alert('No getUserMedia!');
if (!AudioContext) alert('No AudioContext!');
if (!MediaRecorder) alert('No MediaRecorder!');

const audioContext = new AudioContext();

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

  return stream;

  function addData(event) {
    data.push(event.data);
    size += event.data.size;
  }
}

function attachAnalyser(stream) {
  const source = audioContext.createMediaStreamSource(stream),
        analyser = audioContext.createAnalyser();

  analyser.fftSize = 32;

  source.connect(analyser);

  return analyser;
}

function draw(analyser) {
  const bins = analyser.frequencyBinCount,
        data = new Uint8Array(bins);

  const nodes = document.getElementById('nodes');

  console.log({nodes});

  update();

  function update() {
    analyser.getByteFrequencyData(data);

    const vertical = nodes.className === 'vertical';

    console.log({vertical});

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