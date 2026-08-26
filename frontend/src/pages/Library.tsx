import { useTTSStore } from "../store/useTTSStore";

export default function Library() {
  const { history, removeHistory } = useTTSStore();

  return (
    <div className="glass-card rounded-xl w-full max-w-4xl p-6 md:p-8 flex flex-col gap-8 shadow-2xl">
      {/* Card Header */}
      <div className="flex items-center gap-3 border-b border-white/5 pb-4">
        <span className="material-symbols-outlined text-primary text-3xl">
          folder_open
        </span>
        <h1 className="font-display text-display md:text-display text-headline-lg-mobile text-on-surface">
          Thư viện Audio
        </h1>
      </div>

      <div className="flex flex-col gap-4">
        {history.length === 0 ? (
          <div className="p-12 text-center text-on-surface-variant font-mono-data text-mono-data border border-dashed border-white/10 rounded-lg bg-surface-dim">
            Thư viện trống. Hãy tạo một đoạn âm thanh mới ở Phòng thu.
          </div>
        ) : (
          <div className="divide-y divide-white/5 border border-white/5 rounded-lg bg-surface-dim overflow-hidden">
            {history.map((record) => (
              <div
                key={record.id}
                className="p-6 hover:bg-surface-variant/40 transition-colors flex flex-col gap-4"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 flex flex-col gap-3">
                    <p
                      className="font-body-md text-on-surface leading-relaxed line-clamp-2"
                      title={record.text}
                    >
                      "{record.text}"
                    </p>
                    
                    {/* Tham số cấu hình */}
                    <div className="flex flex-wrap gap-2 items-center">
                      {record.voiceName && (
                        <span className="inline-flex items-center gap-1.5 rounded bg-primary/10 px-2 py-1 text-[11px] font-label-caps text-primary border border-primary/20">
                          <span className="material-symbols-outlined text-[14px]">record_voice_over</span>
                          {record.voiceName}
                        </span>
                      )}
                      {record.speed !== undefined && (
                        <span className="inline-flex items-center rounded bg-surface-variant px-2 py-1 text-[11px] font-mono-data text-on-surface-variant border border-white/5">
                          Speed: {record.speed.toFixed(2)}x
                        </span>
                      )}
                      {record.pitch !== undefined && (
                        <span className="inline-flex items-center rounded bg-surface-variant px-2 py-1 text-[11px] font-mono-data text-on-surface-variant border border-white/5">
                          Pitch: {record.pitch > 0 ? '+' : ''}{record.pitch.toFixed(1)}
                        </span>
                      )}
                      {record.seed !== undefined && (
                        <span className="inline-flex items-center rounded bg-surface-variant px-2 py-1 text-[11px] font-mono-data text-on-surface-variant border border-white/5">
                          Seed: {record.seed}
                        </span>
                      )}
                      {record.cfg_value !== undefined && (
                        <span className="inline-flex items-center rounded bg-surface-variant px-2 py-1 text-[11px] font-mono-data text-on-surface-variant border border-white/5">
                          CFG: {record.cfg_value}
                        </span>
                      )}
                    </div>

                    <p className="font-mono-data text-mono-data text-on-surface-variant/50 text-xs mt-1">
                      ID: {record.id.toUpperCase()} • {new Date(record.timestamp).toLocaleString("vi-VN")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={record.url}
                      download
                      className="w-10 h-10 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-white/10 hover:text-primary transition-colors"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        download
                      </span>
                    </a>
                    <button
                      className="w-10 h-10 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-error/20 hover:text-error transition-colors"
                      onClick={() => removeHistory(record.id)}
                      title="Xóa"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        delete
                      </span>
                    </button>
                  </div>
                </div>

                <audio
                  controls
                  src={record.url}
                  className="w-full h-10 rounded focus:outline-none"
                  style={{ colorScheme: 'dark' }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
