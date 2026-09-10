export interface WordTiming {
  word: string;
  start: number;
  end: number;
  probability?: number;
}

export interface CaptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words: WordTiming[];
  customPositionY?: number; // Vị trí dọc riêng cho đoạn này (10% - 90%)
}

export interface SilenceInterval {
  id: string;
  start: number;
  end: number;
  duration: number;
  segmentId: number;
  afterWordIndex: number;
  prevWordText: string;
  nextWordText: string;
}

/**
 * Quét danh sách segments để phát hiện các khoảng lặng âm thanh (Dead Air)
 * @param segments Danh sách câu thoại
 * @param threshold Ngưỡng khoảng lặng tối thiểu tính bằng giây (mặc định 0.5s)
 */
export function detectSilences(
  segments: CaptionSegment[],
  threshold: number = 0.5
): SilenceInterval[] {
  const silences: SilenceInterval[] = [];

  for (let sIdx = 0; sIdx < segments.length; sIdx++) {
    const seg = segments[sIdx];
    const words = seg.words || [];

    // 1. Quét khoảng lặng giữa các từ trong cùng một segment
    for (let wIdx = 0; wIdx < words.length - 1; wIdx++) {
      const cur = words[wIdx];
      const next = words[wIdx + 1];
      const gap = Number((next.start - cur.end).toFixed(2));

      if (gap >= threshold) {
        silences.push({
          id: `silence_${seg.id}_${wIdx}`,
          start: Number(cur.end.toFixed(2)),
          end: Number(next.start.toFixed(2)),
          duration: gap,
          segmentId: seg.id,
          afterWordIndex: wIdx,
          prevWordText: cur.word,
          nextWordText: next.word,
        });
      }
    }

    // 2. Quét khoảng lặng giữa segment hiện tại và segment kế tiếp
    if (sIdx < segments.length - 1) {
      const nextSeg = segments[sIdx + 1];
      const gap = Number((nextSeg.start - seg.end).toFixed(2));

      if (gap >= threshold) {
        silences.push({
          id: `silence_inter_${seg.id}_${nextSeg.id}`,
          start: Number(seg.end.toFixed(2)),
          end: Number(nextSeg.start.toFixed(2)),
          duration: gap,
          segmentId: seg.id,
          afterWordIndex: words.length - 1,
          prevWordText: words[words.length - 1]?.word || seg.text.slice(-10),
          nextWordText: nextSeg.words[0]?.word || nextSeg.text.slice(0, 10),
        });
      }
    }
  }

  return silences;
}

/**
 * Kiểm tra xem thời điểm hiện tại có đang rơi vào khoảng lặng hay không.
 * Nếu có, trả về mốc thời gian kết thúc khoảng lặng để playhead tự động nhảy cóc (Jump-Cut).
 * Tuyệt đối KHÔNG làm thay đổi timestamp của phụ đề gốc!
 */
export function findNextActiveTime(
  currentTime: number,
  silences: SilenceInterval[],
  buffer: number = 0.04
): number | null {
  for (const sil of silences) {
    // Nếu playhead vừa chạm vào khoảng lặng (trước khi tới mốc kết thúc)
    if (currentTime >= sil.start && currentTime < sil.end - buffer) {
      return sil.end;
    }
  }
  return null;
}

export interface KeepRange {
  start: number;
  end: number;
}

/**
 * Tính toán các khoảng thời gian cần giữ lại của video sau khi loại bỏ các khoảng lặng.
 * Chuẩn bị cho việc cắt video vật lý bằng FFmpeg.
 */
export function calculateKeepRanges(
  totalDuration: number,
  silences: SilenceInterval[]
): KeepRange[] {
  if (silences.length === 0) {
    return [{ start: 0, end: totalDuration }];
  }

  const sorted = [...silences].sort((a, b) => a.start - b.start);
  const keepRanges: KeepRange[] = [];
  let currentPos = 0;

  for (const sil of sorted) {
    if (sil.start > currentPos) {
      keepRanges.push({
        start: Number(currentPos.toFixed(3)),
        end: Number(sil.start.toFixed(3)),
      });
    }
    currentPos = Math.max(currentPos, sil.end);
  }

  if (currentPos < totalDuration) {
    keepRanges.push({
      start: Number(currentPos.toFixed(3)),
      end: Number(totalDuration.toFixed(3)),
    });
  }

  return keepRanges;
}

/**
 * Tái tính toán mốc thời gian phụ đề CHỈ KHI file video đã được cắt gọt vật lý bằng FFmpeg
 * @param segments Danh sách câu thoại gốc
 * @param silencesToCut Danh sách khoảng lặng đã cắt bỏ
 */
export function shiftSegmentsForTrimmedVideo(
  segments: CaptionSegment[],
  silencesToCut: SilenceInterval[]
): CaptionSegment[] {
  if (silencesToCut.length === 0) return segments;

  const sortedSilences = [...silencesToCut].sort((a, b) => a.start - b.start);

  return segments.map((seg) => {
    const newWords = (seg.words || []).map((w) => {
      let shift = 0;
      for (const sil of sortedSilences) {
        if (sil.end <= w.start) {
          shift += sil.duration;
        }
      }

      return {
        ...w,
        start: Number(Math.max(0, w.start - shift).toFixed(2)),
        end: Number(Math.max(0, w.end - shift).toFixed(2)),
      };
    });

    let segShift = 0;
    for (const sil of sortedSilences) {
      if (sil.end <= seg.start) {
        segShift += sil.duration;
      }
    }

    const newStart = newWords.length > 0 ? newWords[0].start : Number(Math.max(0, seg.start - segShift).toFixed(2));
    const newEnd = newWords.length > 0 ? newWords[newWords.length - 1].end : Number(Math.max(0, seg.end - segShift).toFixed(2));

    return {
      ...seg,
      start: newStart,
      end: newEnd,
      words: newWords,
    };
  });
}

// Giữ lại alias để tương thích ngược
export const removeSilencesFromSegments = shiftSegmentsForTrimmedVideo;

/**
 * Tìm kiếm và thay thế hàng loạt từ trong tất cả các câu thoại
 */
export function batchFindAndReplace(
  segments: CaptionSegment[],
  searchQuery: string,
  replaceWith: string,
  matchCase: boolean = false
): CaptionSegment[] {
  if (!searchQuery.trim()) return segments;

  const flags = matchCase ? "g" : "gi";
  const regex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);

  return segments.map((seg) => {
    const newText = seg.text.replace(regex, replaceWith);
    const newWords = (seg.words || []).map((w) => {
      if (matchCase ? w.word === searchQuery : w.word.toLowerCase() === searchQuery.toLowerCase()) {
        return { ...w, word: replaceWith };
      }
      return w;
    });

    return {
      ...seg,
      text: newText,
      words: newWords,
    };
  });
}
