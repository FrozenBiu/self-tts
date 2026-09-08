import { toast } from "sonner";

export async function downloadAudioFile(rawUrl: string, customFilename?: string) {
  if (!rawUrl) return;

  const filename = customFilename || rawUrl.split("/").pop() || "audio.mp3";
  const toastId = toast.loading("Đang chuẩn bị file tải xuống...");

  try {
    // Chuẩn hóa hostname (nếu đang ở 127.0.0.1 thì dùng 127.0.0.1:8000, nếu localhost thì localhost:8000)
    let fetchUrl = rawUrl;
    const currentHost = window.location.hostname;
    if (currentHost === "127.0.0.1" && fetchUrl.includes("localhost:8000")) {
      fetchUrl = fetchUrl.replace("localhost:8000", "127.0.0.1:8000");
    } else if (currentHost === "localhost" && fetchUrl.includes("127.0.0.1:8000")) {
      fetchUrl = fetchUrl.replace("127.0.0.1:8000", "localhost:8000");
    }

    const res = await fetch(fetchUrl);
    if (!res.ok) {
      throw new Error(`Server phản hồi HTTP ${res.status}`);
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(blobUrl);
    document.body.removeChild(a);

    toast.success("Tải xuống thành công!", { id: toastId });
  } catch (err: any) {
    console.warn("Fetch blob thất bại, chuyển sang tải trực tiếp qua Backend endpoint:", err);
    try {
      const apiHost = window.location.hostname === "127.0.0.1" ? "127.0.0.1:8000" : "localhost:8000";
      const cleanFilename = rawUrl.split("/").pop() || filename;
      const directUrl = `http://${apiHost}/api/download/${cleanFilename}`;

      const a = document.createElement("a");
      a.style.display = "none";
      a.href = directUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast.success("Đang tải xuống...", { id: toastId });
    } catch (fallbackErr: any) {
      toast.error(`Lỗi khi tải xuống: ${err?.message || "Không thể tải file"}`, { id: toastId });
    }
  }
}
