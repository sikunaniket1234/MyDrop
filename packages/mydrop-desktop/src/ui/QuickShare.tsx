import { useCallback, useEffect, useRef, useState } from "react";

export interface QuickShareItem {
  fileName: string;
  fileSize: number;
  mimeType: string | null;
  dataUrl: string;
}

interface QuickSharePopupProps {
  onShareText: (text: string) => void;
  onShareFile: (file: QuickShareItem) => void;
  onClose: () => void;
}

const style: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  popup: {
    background: "#1a1d27",
    border: "1px solid #2a2e3a",
    borderRadius: 12,
    padding: 24,
    width: 420,
    maxWidth: "90vw",
    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
  },
  title: {
    color: "#e8ecf5",
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 16,
  },
  textarea: {
    width: "100%",
    minHeight: 80,
    background: "#0d0f14",
    border: "1px solid #2a2e3a",
    borderRadius: 8,
    color: "#e8ecf5",
    padding: 10,
    fontSize: 13,
    resize: "vertical" as const,
    marginBottom: 12,
    boxSizing: "border-box" as const,
    fontFamily: "inherit",
  },
  actions: {
    display: "flex",
    gap: 8,
    justifyContent: "flex-end",
  },
  fileBtn: {
    padding: "8px 16px",
    borderRadius: 6,
    border: "1px solid #2a2e3a",
    background: "#0d0f14",
    color: "#a0a6b5",
    fontSize: 12,
    cursor: "pointer",
  },
  primaryBtn: {
    padding: "8px 16px",
    borderRadius: 6,
    border: "1px solid #4a7cdf",
    background: "#4a7cdf",
    color: "#fff",
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 500,
  },
  cancelBtn: {
    padding: "8px 16px",
    borderRadius: 6,
    border: "none",
    background: "transparent",
    color: "#a0a6b5",
    fontSize: 12,
    cursor: "pointer",
  },
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") { resolve(reader.result); return; }
      reject(new Error("FileReader did not return a data URL."));
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("File read failed.")));
    reader.readAsDataURL(file);
  });
}

export function QuickSharePopup(props: QuickSharePopupProps): React.ReactElement {
  const [text, setText] = useState("");
  const [file, setFile] = useState<QuickShareItem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleShareFile = useCallback(async (raw: File) => {
    const dataUrl = await readFileAsDataUrl(raw);
    setFile({
      fileName: raw.name,
      fileSize: raw.size,
      mimeType: raw.type || null,
      dataUrl,
    });
  }, []);

  const handleSubmit = useCallback(() => {
    if (file) {
      props.onShareFile(file);
    } else if (text.trim()) {
      props.onShareText(text);
    }
    props.onClose();
  }, [file, text, props]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") props.onClose();
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
  }, [handleSubmit, props]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [props]);

  return (
    <div style={style.overlay} onClick={props.onClose} onKeyDown={handleKey}>
      <div style={style.popup} onClick={e => e.stopPropagation()} onKeyDown={handleKey}>
        <div style={style.title}>
          {file ? `Share file: ${file.fileName}` : "Quick Share"}
        </div>

        <textarea
          style={style.textarea}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste text or drop a file..."
          disabled={!!file}
        />

        <input
          ref={inputRef}
          type="file"
          style={{ display: "none" }}
          onChange={e => {
            const raw = e.target.files?.[0];
            if (raw) void handleShareFile(raw);
            e.currentTarget.value = "";
          }}
        />

        {file && (
          <div style={{ color: "#a0a6b5", fontSize: 12, marginBottom: 12 }}>
            {(file.fileSize / 1024).toFixed(1)} KB · {file.mimeType ?? "unknown"}
          </div>
        )}

        <div style={style.actions}>
          {!file && (
            <button
              type="button"
              style={style.fileBtn}
              onClick={() => inputRef.current?.click()}
            >
              Choose file
            </button>
          )}
          {file && (
            <button
              type="button"
              style={style.cancelBtn}
              onClick={() => setFile(null)}
            >
              Remove
            </button>
          )}
          <button
            type="button"
            style={style.cancelBtn}
            onClick={props.onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            style={style.primaryBtn}
            onClick={handleSubmit}
            disabled={!text.trim() && !file}
          >
            {file ? "Share file" : "Share text"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useQuickShare(
  onShareText: (text: string) => void,
  onShareFile: (file: QuickShareItem) => void,
): { show: () => void; popup: React.ReactElement | null } {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.shiftKey && e.ctrlKey && e.key === "M") {
        e.preventDefault();
        setVisible(v => !v);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const popup = visible ? (
    <QuickSharePopup
      onShareText={onShareText}
      onShareFile={onShareFile}
      onClose={() => setVisible(false)}
    />
  ) : null;

  return { show: () => setVisible(true), popup };
}
