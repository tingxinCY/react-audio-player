/**
 * 通过本地文件加载音频资源
 *
 * @param {File} file
 * @returns {Promise<AudioBuffer>}
 */
function loadAudioFromFile(file: File): Promise<AudioBuffer> {
  const fileReader = new FileReader();
  fileReader.readAsArrayBuffer(file);
  return new Promise((resolve) => {
    fileReader.onloadend = () => {
      const arrayBuffer = fileReader.result;
      if (arrayBuffer && typeof arrayBuffer !== 'string') {
        const ctx = new AudioContext();
        ctx.decodeAudioData(arrayBuffer, (audioBuffer: AudioBuffer) => {
          resolve(audioBuffer);
        });
      }
    };
  });
}
export default loadAudioFromFile;
