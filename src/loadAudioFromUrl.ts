interface IAudioLoaderOptions {
  url: string;
  sampleRate?: number;
  onloadstart?(): void;
  onprogress?(data: ProgressEvent): void;
}

/**
 * 通过Url加载音频资源，音频资源需要支持跨域访问
 *
 * @param {IAudioLoaderOptions} options
 * @returns {Promise<AudioBuffer>}
 */
function loadAudioFromUrl(options: IAudioLoaderOptions): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true;
    xhr.responseType = 'arraybuffer';

    xhr.onloadstart = () => {
      options.onloadstart && options.onloadstart();
    };

    xhr.onprogress = (data: ProgressEvent) => {
      options.onprogress && options.onprogress(data);
    };

    xhr.onload = () => {
      const arrayBuffer = xhr.response;
      const ctxOptions: AudioContextOptions = {};
      options.sampleRate && (ctxOptions.sampleRate = options.sampleRate);
      const ctx = new AudioContext(ctxOptions);
      ctx.decodeAudioData(arrayBuffer, (audioBuffer: AudioBuffer) => {
        resolve(audioBuffer);
      });
    };

    xhr.onerror = () => {
      reject();
    };

    xhr.open('get', options.url, true);
    xhr.send();
  });
}

export default loadAudioFromUrl;
