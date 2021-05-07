# @tingxin_cy/web-audio-player

- Web 端音频播放器库，相比于原生 Audio 类支持更多高级能力，例如定点播放、区间播放、循环播放、音量控制、速率控制等。
- 为了实现高级播放器功能，内部基于的 WebAudioApi 进行实现，所以播放器需要基于 AudioBuffer 进行初始化而非 url。
- 播放器内置 AudioBuffer 加载工具，支持基于 url 加载和基于本地文件进行加载。

```js
import WebAudioPlayer, { loadAudioFromUrl, TPlayerState } from '@tingxin_cy/web-audio-player';

const loader = loadAudioFromUrl({
  url,
  onloadstart: () => {
    console.log(`loadPercent: 0`);
  },
  onprogress: (data) => {
    console.log(`loadPercent: ${data.loaded / data.total}`);
  },
});

loader.then((audioBuffer) => {
  // 创建播放器实例
  this.player = new WebAudioPlayer();
  this.player.audioBuffer = audioBuffer;
  this.player.onStateChange = (state: TPlayerState) => {
    console.log(state);
  };

  // 循环播放，从10s处开始播放，当播放至25s之后便进入15s-25s循环播放
  this.player.setConfig({
    loop: true,
    startOffset: 10,
    loopStart: 15,
    loopEnd: 25,
  });

  // 非循环播放，从10s处开始播放，播放至20s处结束
  this.player.setConfig({
    loop: false,
    startOffset: 10,
    endOffset: 20,
  });

  // 开始播放
  this.player.play();
});
```

## 属性

- `audioBuffer` (AudioBuffer) (read & write): 音频资源
- `currentTime` (Number) (read-only): 当前播放时间
- `duration` (Number) (read-only): 当前音频总时长
- `state` (TPlayerState) (read-only): 当前播放器状态
  - stop: 播放器初始状态，播放器处于起点状态。
  - running: 播放中
  - paused: 暂停中
  - ended: 非循环模式下，播放至结尾结束播放，可针对该状态实现特殊业务逻辑
- `config` (playerConfig)(read): 播放器配置
  - loop?:boolean; 循环播放
  - rateValue?:number; 播放速率
  - gainValue?:number; 音量增益
  - startOffset?:number; 起始播放偏移量，可以理解为播放起点时间，在循环播放模式下，startOffset 必须小于 loopEnd，单位秒。
  - endOffset?: number; 终点播放偏移量，可以理解为播放终点时间，仅适用于非循环播放模式下，endOffset 必须大于 startOffset
  - loopStart?:number; 循环区间起点，单位秒。
  - loopEnd?:number; 循环区间终点，loopEnd 必须大于 loopStart，单位秒

## 方法

- `play()`: 开始播放
- `pause()`: 暂停播放
- `stop()`: 停止播放，播放进度重置回起点（startOffset）
- `destroy()`: 销毁播放器，释放资源占用

## 音频加载方法

- `loadAudioFromUrl(options: IAudioLoaderOptions)`：
  通过 Url 加载音频资源，加载进度实时监听，返回 AudioBuffer，资源地址需要支持跨域访问。
- `loadAudioFromFile(file: File)`：
  通过本地文件加载音频资源，加载进度实时监听，返回 AudioBuffer。
