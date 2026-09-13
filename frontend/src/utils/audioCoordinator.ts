/**
 * audioCoordinator.ts
 * Điều phối phát âm thanh toàn cục (Single Audio Player Coordinator).
 * Đảm bảo tại một thời điểm chỉ có DUY NHẤT 1 nguồn âm thanh được phát:
 * - Master Audio (Player chính)
 * - Segment Preview (Nghe thử từng phân đoạn câu)
 * - Voice Sample Preview (Nghe thử mẫu giọng)
 * Khi bất kỳ audio nào phát, các audio khác sẽ lập tức bị pause và reset trạng thái UI.
 */

type StopListener = () => void;

class AudioCoordinator {
  private currentAudio: HTMLAudioElement | null = null;
  private currentOnStop: StopListener | null = null;

  /**
   * Đăng ký và phát một audio element.
   * Dừng ngay lập tức audio đang phát trước đó và gọi callback dừng UI.
   */
  play(audio: HTMLAudioElement, onStop?: StopListener) {
    if (this.currentAudio && this.currentAudio !== audio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (err) {
        console.warn("Lỗi khi pause audio trước đó:", err);
      }
      if (this.currentOnStop) {
        try {
          this.currentOnStop();
        } catch {}
      }
    }

    // Dừng các thẻ audio khác có sẵn trong DOM (ví dụ Master Audio Player)
    document.querySelectorAll("audio").forEach((el) => {
      if (el !== audio && !el.paused) {
        try {
          el.pause();
        } catch {}
      }
    });

    this.currentAudio = audio;
    this.currentOnStop = onStop || null;
  }

  /**
   * Dừng toàn bộ âm thanh đang phát trong hệ thống.
   */
  stopAll() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {}
      if (this.currentOnStop) {
        try {
          this.currentOnStop();
        } catch {}
      }
      this.currentAudio = null;
      this.currentOnStop = null;
    }

    document.querySelectorAll("audio").forEach((el) => {
      try {
        el.pause();
      } catch {}
    });
  }
}

export const globalAudio = new AudioCoordinator();
