import Big from 'big.js';

/*
播放器状态
stop:停止播放，处于起点
running: 播放中
paused: 播放暂停中
ended: 播放结束，处于终点
*/
export type TPlayerState = 'stop' | 'running' | 'paused' | 'ended';

interface IPlayerConfig {
  loop?: boolean;
  startOffset?: number;
  endOffset?: number;
  loopStart?: number;
  loopEnd?: number;
  rateValue?: number;
  gainValue?: number;
}

type TOnStateChange = (state: TPlayerState) => void;

class WebAudioPlayer {
  /**
   * AudioContext
   *
   * @private
   * @type {AudioContext}
   * @memberof WebAudioPlayer
   */
  private _ctx: AudioContext = new window.AudioContext();

  /**
   * 开始播放时获取的ctx.currentTime，用来计算运行时间,
   * 原因是ctx.currentTime是随着ctx的生命周期中持续递增的，
   * 无法直接通过currentTime来表示真实的播放时间。
   *
   * @private
   * @type {number}
   * @memberof WebAudioPlayer
   */
  private _ctxStartTime = 0;

  /**
   * 停止、暂停或播放结束时的静态currentTime值
   *
   * @private
   * @type {number}
   * @memberof WebAudioPlayer
   */
  private _lastCurrentTime = 0;

  /**
   * 音频buffer数据
   *
   * @private
   * @type {AudioBuffer}
   * @memberof WebAudioPlayer
   */
  private _audioBuffer?: AudioBuffer;

  /**
   * 音频总时长
   *
   * @private
   * @memberof WebAudioPlayer
   */
  private _duration = 0;

  /**
   * 音频源节点
   *
   * @private
   * @type {AudioBufferSourceNode}
   * @memberof WebAudioPlayer
   */
  private _sourceNode?: AudioBufferSourceNode;

  /**
   * 播放器状态
   *
   * @private
   * @type {playerState}
   * @memberof WebAudioPlayer
   */
  private _state: TPlayerState = 'stop';

  /**
   * BaseAudioContent.onstatechange，状态通知回调
   *
   * @private
   * @memberof WebAudioPlayer
   */
  private _onStateChange: TOnStateChange | null = null;

  /**
   * 音量增益节点
   *
   * @private
   * @type {GainNode}
   * @memberof WebAudioPlayer
   */
  private _gainNode?: GainNode;

  /**
   * 音量增益值
   *
   * @private
   * @memberof WebAudioPlayer
   */
  private _gainValue = 1;

  /**
   * 是否循环播放
   *
   * @private
   * @memberof WebAudioPlayer
   */
  private _loop = false;

  /**
   * 播放起点偏移量（秒），可用于循环播放模式和非循环播放模式
   *
   * @private
   * @memberof WebAudioPlayer
   */
  private _startOffset = 0;

  /**
   * 播放终点偏移量（秒），仅用于非循环播放模式
   *
   * @private
   * @memberof WebAudioPlayer
   */
  private _endOffset = 0;

  /**
   * 循环播放区间起点时间（秒）
   *
   * @private
   * @memberof WebAudioPlayer
   */
  private _loopStart = 0;

  /**
   * 播放区间终点时间（秒）
   *
   * @private
   * @memberof WebAudioPlayer
   */
  private _loopEnd = 0;

  /**
   * 播放速率
   *
   * @private
   * @memberof WebAudioPlayer
   */
  private _rateValue = 1;

  constructor() {
    this._ctx = new window.AudioContext();
    if (this._ctx.state === 'suspended') {
      this._ctx.resume();
    }
  }

  /**
   * 执行音频播放的公共方法
   *
   * @private
   * @memberof WebAudioPlayer
   */
  public play() {
    if (!this._audioBuffer) {
      // eslint-disable-next-line no-console
      console.error('AudioBuffer cannot be empty.');
      return;
    }

    // 参数合法性校验
    if (this._loop) {
      if (this._startOffset > this._loopEnd) {
        // eslint-disable-next-line no-console
        console.error('"loopEnd" has to be greater than "startOffset"');
        return;
      } else if (this._loopStart > this._loopEnd) {
        // eslint-disable-next-line no-console
        console.error('"loopEnd" has to be greater than "loopStart"');
        return;
      }
    } else if (this._startOffset > this._endOffset) {
      // eslint-disable-next-line no-console
      console.error('"endOffset" has to be greater than "startOffset"');
      return;
    }

    // 当处于暂停中时，则恢复播放
    if (this._state === 'paused') {
      this._ctx.resume().then(() => {
        this._emitStateChange('running'); // 状态切换
      });
      return;
    }

    // 销毁旧sourceNode
    this._destroySourceNode();

    // 创建新sourceNode
    this._sourceNode = this._ctx.createBufferSource();
    this._sourceNode.buffer = this._audioBuffer;
    this._sourceNode.addEventListener('ended', this._onSourceNodeEnded, false);

    // 播放速率设置
    this._sourceNode.playbackRate.value = this._rateValue;

    // 初始化音频增益节点
    if (!this._gainNode) {
      this._gainNode = this._ctx.createGain();
      this._gainNode.gain.value = this._gainValue;
      this._gainNode.connect(this._ctx.destination);
    }

    // 链接音频增益节点
    this._sourceNode.connect(this._gainNode);

    // 记录起点播放时间，用于计算真实的currentTime值
    this._ctxStartTime = this._ctx.currentTime;

    if (this._loop) {
      this._sourceNode.loop = this._loop;
      this._sourceNode.loopStart = this._loopStart;
      this._sourceNode.loopEnd = this._loopEnd;
      this._sourceNode.start(0, this._startOffset);
    } else {
      const duration = parseFloat(Big(this._endOffset).minus(this._startOffset).valueOf());
      this._sourceNode.start(0, this._startOffset, duration);
    }

    this._emitStateChange('running'); // 状态切换
  }

  /**
   * 暂停播放
   *
   * @returns
   * @memberof WebAudioPlayer
   */
  public async pause() {
    if (this._state === 'running') {
      await this._ctx.suspend();
      this._lastCurrentTime = this.currentTime;
      this._emitStateChange('paused'); // 状态切换
    }
  }

  /**
   * 停止播放，播放器状态复位
   *
   * @memberof WebAudioPlayer
   */
  public stop() {
    if (this._sourceNode) {
      this._destroySourceNode();
      this._lastCurrentTime = this._startOffset;
      this._emitStateChange('stop');
    }
  }

  /**
   * 计算当前播放器的currentTime
   *
   * @readonly
   * @type {number}
   * @memberof WebAudioPlayer
   */
  public get currentTime(): number {
    if (this._state === 'running') {
      const { currentTime } = this._ctx;
      if (this._loop) {
        // 循环区间起点和播放起点的间距
        const startOffsetGap = parseFloat(Big(this._loopStart).minus(this._startOffset).valueOf());

        // 循环区间的间距
        const loopGap = parseFloat(Big(this._loopEnd).minus(this._loopStart).valueOf());

        return parseFloat(
          Big(currentTime)
            .minus(this._ctxStartTime)
            .times(this._rateValue)
            .minus(startOffsetGap)
            .mod(loopGap || 1)
            .plus(this._loopStart)
            .valueOf(),
        );
      } else {
        return parseFloat(
          Big(currentTime)
            .minus(this._ctxStartTime)
            .times(this._rateValue)
            .plus(this._startOffset)
            .valueOf(),
        );
      }
    } else {
      return this._lastCurrentTime;
    }
  }

  /**
   * 设置音频数据
   *
   * @param {AudioBuffer} audioBuffer
   * @memberof WebAudioPlayer
   */
  public set audioBuffer(v: AudioBuffer) {
    this._audioBuffer = v;
    this._duration = this._audioBuffer.duration;

    // 重置播放状态
    this._startOffset = 0;
    this._endOffset = this._duration;
    this._loopStart = 0;
    this._loopEnd = this._duration;
  }

  /**
   * 设置播放器参数
   * @param {playerConfig} v 参数对象
   * @memberof WebAudioPlayer
   */
  public setConfig(v: IPlayerConfig) {
    let needRestart = false; // 是否需要重启

    // 音频增益
    if (v.gainValue !== undefined && typeof v.gainValue === 'number') {
      this._gainValue = v.gainValue;
      this._gainNode && (this._gainNode.gain.value = v.gainValue);
    }

    // 播放速率
    if (v.rateValue !== undefined && typeof v.rateValue === 'number') {
      this._rateValue = v.rateValue;
      needRestart = true;
    }

    // 循环
    if (v.loop !== undefined && typeof v.loop === 'boolean') {
      this._loop = v.loop;
      needRestart = true;
    }

    // 播放起点偏移量
    if (v.startOffset !== undefined && typeof v.startOffset === 'number') {
      this._startOffset = v.startOffset;
      needRestart = true;
    }

    // 播放终点偏移量，仅在非循环播放模式下生效
    if (v.endOffset !== undefined && typeof v.endOffset === 'number') {
      this._endOffset = v.endOffset;
      if (!this._loop) {
        needRestart = true;
      }
    }

    // 循环播放区间设置
    if (v.loopStart !== undefined && typeof v.loopStart === 'number') {
      this._loopStart = v.loopStart;
      needRestart = true;
    }

    if (v.loopEnd !== undefined && typeof v.loopEnd === 'number') {
      this._loopEnd = v.loopEnd;
      needRestart = true;
    }

    if (needRestart) {
      // 缓存当前播放状态
      const currentState = this._state;

      // 由于修改的参数无法热生效，所以需要先停止播放
      this.stop();

      // 如果之前处于播放状态，则自动续播
      if (currentState === 'running') {
        this.play();
      }
    }
  }

  /**
   * 获取播放器配置
   *
   * @type {playerConfig}
   * @memberof WebAudioPlayer
   */
  public getConfig(): IPlayerConfig {
    return {
      loop: this._loop,
      gainValue: this._gainValue,
      rateValue: this._rateValue,
      startOffset: this._startOffset,
      endOffset: this._endOffset,
      loopStart: this._loopStart,
      loopEnd: this._loopEnd,
    };
  }

  /**
   * 返回音频时长
   *
   * @readonly
   * @type {number}
   * @memberof WebAudioPlayer
   */
  public get duration(): number {
    return this._duration;
  }

  /**
   * 返回播放器运行状态
   *
   * @readonly
   * @type {(AudioContextState)}
   * @memberof WebAudioPlayer
   */
  public get state(): TPlayerState {
    return this._state;
  }

  /**
   * 设置播放器状态切换回调函数
   *
   * @memberof WebAudioPlayer
   */
  public set onStateChange(v: TOnStateChange | null) {
    this._onStateChange = v;
  }

  /**
   * 销毁播放器，释放资源
   *
   * @memberof WebAudioPlayer
   */
  public async destroy() {
    // 销毁AudioNode
    this._destroySourceNode();

    // 销毁AudioContext
    this._ctx.close();
  }

  /**
   * 处理状态变更&调用状态变更回调
   *
   * @private
   * @param {TPlayerState} state
   * @memberof WebAudioPlayer
   */
  private _emitStateChange(state: TPlayerState) {
    this._state = state;
    this._onStateChange && this._onStateChange(this._state);
  }

  /**
   * 销毁AudioNode
   *
   * @private
   * @memberof WebAudioPlayer
   */
  private _destroySourceNode() {
    // 停止播放并销毁sourceNode
    if (this._sourceNode) {
      this._sourceNode.stop(); // 停止播放
      this._sourceNode.disconnect(); // 断开链接
      this._sourceNode.removeEventListener('ended', this._onSourceNodeEnded, false);
      this._sourceNode = undefined;
    }
  }

  /**
   * 非循环模式下，播放结束事件
   *
   * @private
   * @memberof WebAudioPlayer
   */
  private _onSourceNodeEnded = () => {
    if (this._state === 'running') {
      // 记录播放终点时间，由于自动获取的时间点与endOffset有差异，所以手动赋值，用于currentTime高精度计算
      this._lastCurrentTime = this._endOffset;
    }

    // 状态变更
    this._emitStateChange('ended');
  };
}

export default WebAudioPlayer;
