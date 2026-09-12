export interface ZoomEffect {
  id: string;
  start: number;             // Giây bắt đầu zoom
  duration: number;          // Thời gian duy trì (kéo dài/ngắn trên timeline)
  scale: number;             // Tỉ lệ zoom: 1.2x, 1.5x, 2.0x, 2.5x...
  originX: number;           // 0% - 100% (tọa độ ngang điểm focus)
  originY: number;           // 0% - 100% (tọa độ dọc điểm focus)
  transitionDuration: number;// Thời gian chuyển cảnh zoom in / zoom out (0.2s - 2.0s)
  label?: string;
}

export interface HighlightEffect {
  id: string;
  start: number;
  duration: number;
  type: "spotlight" | "neon_border" | "pulse_box";
  x: number;                // 0% - 100%
  y: number;                // 0% - 100%
  width: number;            // 0% - 100%
  height: number;           // 0% - 100%
  color: string;
  animation: "pulse" | "glow" | "solid";
  layerOrder: number;       // Thứ tự lớp (layer Z-Index)
  label?: string;
}

export interface StickerOverlay {
  id: string;
  start: number;
  duration: number;
  type: "arrow" | "pointer" | "click" | "badge" | "star" | "alert";
  text?: string;
  x: number;                // 0% - 100%
  y: number;                // 0% - 100%
  rotation: number;         // 0 - 360 deg
  scale: number;            // 0.5 - 2.0
  animation: "bounce" | "fade" | "pop" | "pulse";
  layerOrder: number;       // Thứ tự lớp (layer Z-Index)
  label?: string;
}

export interface AudioClip {
  id: string;
  name: string;
  url: string;
  start: number;             // Giây bắt đầu trên dòng thời gian Timeline
  duration: number;          // Thời lượng hiển thị trên Timeline
  sourceStart: number;       // Mốc bắt đầu tương đối trong file âm thanh gốc
  text?: string;             // Câu từ thoại tương ứng cho đoạn clip này
  originalText?: string;     // Toàn bộ câu thoại gốc trước khi chia cắt
}

export interface VideoClip {
  id: string;
  name: string;
  start: number;
  duration: number;
  sourceStart: number;
}

export type TrackElementType = "zoom" | "highlight" | "sticker" | "audio" | "video" | "caption";

export interface SelectedElement {
  id: string;
  type: TrackElementType;
}
