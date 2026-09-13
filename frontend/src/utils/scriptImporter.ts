import mammoth from "mammoth";

export interface ParsedScriptResult {
  text: string;
  wordCount: number;
  charCount: number;
  filename: string;
}

/**
 * Làm sạch văn bản kịch bản để tối ưu cho việc tổng hợp TTS
 */
function cleanScriptText(rawText: string): string {
  if (!rawText) return "";

  let cleaned = rawText
    // Chuẩn hóa ngắt dòng Windows \r\n -> \n
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Bỏ ký tự BOM nếu có
    .replace(/^\uFEFF/, "")
    // Bỏ các định dạng markdown phổ biến nếu có
    .replace(/^#{1,6}\s+/gm, "") // # Heading
    .replace(/\*\*(.*?)\*\*/g, "$1") // **bold**
    .replace(/\*(.*?)\*/g, "$1") // *italic*
    .replace(/__(.*?)__/g, "$1") // __bold__
    .replace(/\[(.*?)\]\(.*?\)/g, "$1") // [anchor](link)
    // Gộp nhiều dòng trống liên tiếp thành tối đa 2 dòng trống
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned;
}

/**
 * Đọc và trích xuất nội dung từ file kịch bản (.txt, .md, .docx)
 */
export async function parseScriptFile(file: File): Promise<ParsedScriptResult> {
  const filename = file.name;
  const ext = filename.toLowerCase().split(".").pop() || "";

  let rawText = "";

  if (ext === "txt" || ext === "md") {
    rawText = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string) || "");
      reader.onerror = () => reject(new Error("Không thể đọc file văn bản."));
      reader.readAsText(file, "UTF-8");
    });
  } else if (ext === "docx") {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      rawText = result.value || "";
    } catch (err: any) {
      throw new Error(`Lỗi khi đọc file Word .docx: ${err?.message || "File có thể bị hỏng hoặc có mật khẩu bảo vệ."}`);
    }
  } else {
    throw new Error(
      `Định dạng file ".${ext}" chưa được hỗ trợ. Vui lòng chọn file .txt, .docx hoặc .md.`
    );
  }

  const cleanedText = cleanScriptText(rawText);
  if (!cleanedText) {
    throw new Error("File kịch bản không chứa nội dung văn bản hợp lệ.");
  }

  // Tính số từ và số ký tự
  const words = cleanedText.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const charCount = cleanedText.length;

  return {
    text: cleanedText,
    wordCount,
    charCount,
    filename,
  };
}
