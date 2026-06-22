import { MonitorIcon, MoonIcon, SunIcon } from "../icons";
import { useTheme } from "../../hooks/useTheme";
import type { ThemeMode } from "../../lib/theme";

const OPTIONS: Array<{ mode: ThemeMode; label: string; Icon: typeof SunIcon }> = [
  { mode: "light", label: "Light theme", Icon: SunIcon },
  { mode: "dark", label: "Dark theme", Icon: MoonIcon },
  { mode: "system", label: "System theme", Icon: MonitorIcon },
];

export default function ThemeToggle() {
  const { mode, setMode } = useTheme();

  return (
    <div className="theme-toggle" role="group" aria-label="Color theme">
      {OPTIONS.map(({ mode: optionMode, label, Icon }) => (
        <button
          key={optionMode}
          type="button"
          className={`theme-toggle-btn ${mode === optionMode ? "theme-toggle-btn-active" : ""}`}
          onClick={() => setMode(optionMode)}
          aria-label={label}
          aria-pressed={mode === optionMode}
          title={label}
        >
          <Icon size="sm" />
        </button>
      ))}
    </div>
  );
}
