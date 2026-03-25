import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
COURSE_PATH = ROOT / "course.json"
MODULES_DIR = ROOT / "modules"
EXPORT_PATH = ROOT / "exports" / "learning-manifest.json"
NOTEBOOK_EXPORTS_DIR = ROOT / "exports" / "notebooks"
NOTEBOOK_THEME_BOOTSTRAP = """
<script>
(function () {
  var params = new URLSearchParams(window.location.search);
  var theme = params.get("theme");
  if (theme !== "light" && theme !== "dark") {
    try {
      var stored = window.localStorage.getItem("fsbd-preview-theme");
      if (stored === "light" || stored === "dark") {
        theme = stored;
      }
    } catch (error) {}
  }
  if (theme !== "light" && theme !== "dark") {
    theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  document.documentElement.setAttribute("data-notebook-theme", theme);
})();
</script>
<style id="battery-genome-notebook-theme">
:root {
  color-scheme: light dark;
}
html[data-notebook-theme="light"] {
  --nb-bg: #f7f9fb;
  --nb-panel: #ffffff;
  --nb-ink: #18232c;
  --nb-muted: #5f6f79;
  --nb-border: #d7e0e6;
  --nb-link: #245e70;
  --nb-code: #f3f6f8;
  --jp-layout-color0: var(--nb-bg);
  --jp-layout-color1: var(--nb-panel);
  --jp-layout-color2: var(--nb-code);
  --jp-layout-color3: #e8eef2;
  --jp-border-color2: var(--nb-border);
  --jp-border-color3: var(--nb-border);
  --jp-content-font-color0: var(--nb-ink);
  --jp-content-font-color1: var(--nb-ink);
  --jp-content-font-color2: var(--nb-muted);
  --jp-cell-editor-background: var(--nb-code);
  --jp-cell-editor-active-background: #ffffff;
  --jp-cell-editor-border-color: var(--nb-border);
  --jp-mirror-editor-variable-color: var(--nb-ink);
  --jp-mirror-editor-comment-color: #728391;
  --jp-mirror-editor-keyword-color: #295970;
  --jp-mirror-editor-string-color: #8a5331;
  --jp-mirror-editor-number-color: #3e6f34;
}
html[data-notebook-theme="dark"] {
  --nb-bg: #0f1418;
  --nb-panel: #151b20;
  --nb-ink: #edf2f1;
  --nb-muted: #aab5b4;
  --nb-border: #27323b;
  --nb-link: #8fc0cd;
  --nb-code: #10171c;
  --jp-layout-color0: var(--nb-bg);
  --jp-layout-color1: var(--nb-panel);
  --jp-layout-color2: var(--nb-code);
  --jp-layout-color3: #1b242b;
  --jp-border-color2: var(--nb-border);
  --jp-border-color3: var(--nb-border);
  --jp-content-font-color0: var(--nb-ink);
  --jp-content-font-color1: var(--nb-ink);
  --jp-content-font-color2: var(--nb-muted);
  --jp-cell-editor-background: var(--nb-code);
  --jp-cell-editor-active-background: #151e25;
  --jp-cell-editor-border-color: var(--nb-border);
  --jp-mirror-editor-variable-color: var(--nb-ink);
  --jp-mirror-editor-comment-color: #8ea0ad;
  --jp-mirror-editor-keyword-color: #8fc0cd;
  --jp-mirror-editor-string-color: #d2a37a;
  --jp-mirror-editor-number-color: #95c28f;
}
body {
  background: var(--nb-bg) !important;
  color: var(--nb-ink) !important;
}
body,
.jp-Notebook,
.jp-Cell,
.cell,
.jp-RenderedHTMLCommon,
.output_subarea {
  color: var(--nb-ink) !important;
}
a {
  color: var(--nb-link) !important;
}
div.cell,
.jp-Cell {
  border-color: var(--nb-border) !important;
}
div.input_area,
.jp-InputArea-editor,
.highlight,
pre {
  background: var(--nb-code) !important;
  color: var(--nb-ink) !important;
  border-color: var(--nb-border) !important;
}
code {
  color: var(--nb-ink) !important;
}
table,
table.dataframe {
  background: var(--nb-panel) !important;
  color: var(--nb-ink) !important;
}
</style>
"""


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def export_notebook_html(notebook_relative_path: str) -> str:
    notebook_path = ROOT / notebook_relative_path
    output_path = NOTEBOOK_EXPORTS_DIR / Path(notebook_relative_path).with_suffix(".html")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    subprocess.run(
        [
            sys.executable,
            "-m",
            "nbconvert",
            "--to",
            "html",
            "--output",
            output_path.stem,
            "--output-dir",
            str(output_path.parent),
            str(notebook_path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )

    html = output_path.read_text(encoding="utf-8")
    html = html.replace("</head>", f"{NOTEBOOK_THEME_BOOTSTRAP}\n</head>")
    output_path.write_text(html, encoding="utf-8", newline="\n")

    return str(output_path.relative_to(ROOT)).replace("\\", "/")


def main() -> None:
    course = load_json(COURSE_PATH)

    modules_by_id = {}
    for module_path in sorted(MODULES_DIR.glob("*/module.json")):
        module = load_json(module_path)

        for lesson in module.get("lessons", []):
            for component in lesson.get("components", []):
                if component.get("kind") != "notebook":
                    continue

                notebook_path = component.get("content_path")
                if not notebook_path or not notebook_path.endswith(".ipynb"):
                    continue

                component["rendered_path"] = export_notebook_html(notebook_path)
                component["rendered_media_type"] = "text/html"
                component["renderer"] = "nbconvert-html"

        modules_by_id[module["id"]] = module

    ordered_modules = [modules_by_id[module_id] for module_id in course["module_order"]]

    export = {
        "schema_version": "battery-genome-learning-export/v1alpha1",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "generated_from": {
            "course": str(COURSE_PATH.relative_to(ROOT)).replace("\\", "/"),
            "modules_dir": str(MODULES_DIR.relative_to(ROOT)).replace("\\", "/")
        },
        "course": course,
        "modules": ordered_modules
    }

    EXPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with EXPORT_PATH.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(export, handle, indent=2)
        handle.write("\n")


if __name__ == "__main__":
    main()
