import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

export default function WindowControls() {
  return (
    <div className="window-controls">
      <button
        className="wc wc-close"
        title="Cerrar"
        onClick={() => appWindow.close()}
      >
        <svg viewBox="0 0 10 10" aria-hidden="true">
          <path
            d="M2 2 L8 8 M8 2 L2 8"
            stroke="#4d0000"
            strokeWidth="1.2"
            fill="none"
          />
        </svg>
      </button>
      <button
        className="wc wc-min"
        title="Minimizar"
        onClick={() => appWindow.minimize()}
      >
        <svg viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 5 H8" stroke="#5a3d00" strokeWidth="1.2" fill="none" />
        </svg>
      </button>
      <button
        className="wc wc-max"
        title="Maximizar"
        onClick={() => appWindow.toggleMaximize()}
      >
        <svg viewBox="0 0 10 10" aria-hidden="true">
          <path
            d="M4.2 5.8 L8 2 M8 2 H5.8 M8 2 V4.2"
            stroke="#0b3d00"
            strokeWidth="1.1"
            fill="none"
          />
          <path
            d="M5.8 4.2 L2 8 M2 8 H4.2 M2 8 V5.8"
            stroke="#0b3d00"
            strokeWidth="1.1"
            fill="none"
          />
        </svg>
      </button>
    </div>
  );
}
