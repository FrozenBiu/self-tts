/**
 * audioGain.ts
 * Quản lý phát âm thanh với Web Audio API GainNode.
 * Cho phép tăng âm lượng (Gain) thực tế vượt ngưỡng 100% của HTMLAudioElement (VD: 150%, 200%, 300%).
 */

class WebAudioGainManager {
  private ctx: AudioContext | null = null;
  private attachedElements = new WeakMap<
    HTMLAudioElement,
    { sourceNode: MediaElementAudioSourceNode; gainNode: GainNode }
  >();

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Áp dụng hệ số âm lượng (volume: 0.1 -> 5.0) cho audio element.
   * - volume = 1.0 (100% gốc)
   * - volume = 1.5 (+3.5 dB)
   * - volume = 2.0 (+6.0 dB, nghe to gấp đôi)
   * - volume = 3.0 (+9.5 dB)
   */
  applyVolume(audio: HTMLAudioElement, volume: number = 1.0) {
    const ctx = this.getContext();
    if (!ctx) {
      // Fallback nếu trình duyệt không hỗ trợ Web Audio API
      audio.volume = Math.max(0, Math.min(1.0, volume));
      return;
    }

    let nodes = this.attachedElements.get(audio);
    if (!nodes) {
      try {
        audio.crossOrigin = "anonymous";
        const sourceNode = ctx.createMediaElementSource(audio);
        const gainNode = ctx.createGain();
        sourceNode.connect(gainNode);
        gainNode.connect(ctx.destination);
        nodes = { sourceNode, gainNode };
        this.attachedElements.set(audio, nodes);
      } catch (err) {
        console.warn("Lỗi gắn Web Audio GainNode:", err);
        audio.volume = Math.max(0, Math.min(1.0, volume));
        return;
      }
    }

    if (nodes) {
      // Giữ audio.volume ở 1.0 và điều khiển âm lượng thực qua GainNode
      audio.volume = 1.0;
      nodes.gainNode.gain.value = Math.max(0, volume);
    }
  }
}

export const globalAudioGain = new WebAudioGainManager();
