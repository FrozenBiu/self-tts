import { useParams, Link } from "react-router-dom";
import { useTTSStore } from "../store/useTTSStore";
import { AudioRecordItem } from "./Library";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { projects, history, removeHistory } = useTTSStore();

  const project = projects.find((p) => p.id === id);
  const projectAudios = history.filter((h) => h.projectId === id);

  if (!project) {
    return (
      <div className="w-full max-w-4xl mx-auto p-12 text-center glass-card rounded-2xl border border-white/5">
        <h2 className="font-display text-2xl text-on-surface mb-4">Không tìm thấy dự án</h2>
        <Link
          to="/projects"
          className="inline-flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-lg font-label-caps text-sm hover:shadow-lg transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl w-full max-w-4xl p-6 md:p-8 flex flex-col gap-8 shadow-2xl animate-in fade-in duration-500 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-bl-[100px] blur-[60px] pointer-events-none"></div>
      
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <Link
            to="/projects"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-variant hover:bg-white/10 hover:text-primary transition-colors text-on-surface-variant"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div className="flex flex-col">
            <h1 className="font-display text-display md:text-display text-headline-lg-mobile text-on-surface">
              {project.name}
            </h1>
            <div className="flex items-center gap-3 text-xs font-mono-data text-on-surface-variant/70 mt-1">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                {new Date(project.createdAt).toLocaleDateString("vi-VN")}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">audio_file</span>
                {projectAudios.length} files
              </span>
            </div>
          </div>
        </div>
        {project.description && (
          <p className="font-body-md text-on-surface-variant bg-surface-dim p-4 rounded-lg border border-white/5">
            {project.description}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-6">
        {projectAudios.length === 0 ? (
          <div className="p-12 text-center text-on-surface-variant font-mono-data text-mono-data border border-dashed border-white/10 rounded-lg bg-surface-dim">
            Dự án này chưa có file audio nào. Bạn có thể chọn dự án này khi tạo audio mới trong Phòng thu, hoặc gán audio từ Thư viện vào đây.
          </div>
        ) : (
          <div className="divide-y divide-white/5 border border-white/5 rounded-lg bg-surface-dim overflow-hidden">
            {projectAudios.map((record) => (
              <AudioRecordItem key={record.id} record={record} removeHistory={removeHistory} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
