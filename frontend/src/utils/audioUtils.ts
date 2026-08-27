export const convertToWav = async (file: Blob | File): Promise<Blob> => {
  const arrayBuffer = await file.arrayBuffer();
  // Khởi tạo AudioContext với sampleRate 16000 (chuẩn của mô hình)
  const audioContext = new (
    window.AudioContext || (window as any).webkitAudioContext
  )({ sampleRate: 16000 });
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  return audioBufferToWav(audioBuffer);
};

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = 1; // Mono channel
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArr = new ArrayBuffer(length);
  const view = new DataView(bufferArr);
  const sampleRate = buffer.sampleRate;

  let offset = 0;
  let pos = 0;

  function setUint16(data: number) {
    view.setUint16(offset, data, true);
    offset += 2;
  }

  function setUint32(data: number) {
    view.setUint32(offset, data, true);
    offset += 4;
  }

  // RIFF chunk descriptor
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  // fmt sub-chunk
  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit (hardcoded in this demo)

  // data sub-chunk
  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // Write interleaved data (mix down to mono if multiple channels)
  const channelData = [];
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channelData.push(buffer.getChannelData(i));
  }

  while (pos < buffer.length) {
    let sample = 0;
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      sample += channelData[i][pos];
    }
    sample = sample / buffer.numberOfChannels; // average channels for mono

    // Clamp to -1..1
    sample = Math.max(-1, Math.min(1, sample));

    // Convert to 16-bit PCM
    sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
    view.setInt16(offset, sample, true);
    offset += 2;
    pos++;
  }

  return new Blob([bufferArr], { type: "audio/wav" });
}
