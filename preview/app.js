const MANIFEST_URL = "../exports/learning-manifest.json";
const THEME_STORAGE_KEY = "fsbd-preview-theme";

let manifestData = null;
let selectedLessonId = null;
let lessonOverviewCache = new Map();
let currentTheme = document.documentElement.dataset.theme || "dark";

async function bootstrap() {
  try {
    bindThemeControls();
    const response = await fetch(MANIFEST_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load manifest: ${response.status}`);
    }

    manifestData = await response.json();
    setHeaderLinks(manifestData.course, manifestData.modules);
    window.addEventListener("hashchange", render);
    render();
  } catch (error) {
    renderError(error instanceof Error ? error.message : String(error));
  }
}

function render() {
  if (!manifestData) return;

  const app = document.getElementById("app");
  const route = parseRoute();
  const { course, modules } = manifestData;

  if (route.kind === "resources") {
    app.innerHTML = renderResourcesView(course, modules);
    return;
  }

  if (route.moduleId) {
    const module = modules.find((item) => item.id === route.moduleId);
    if (!module) {
      renderError(`Module "${route.moduleId}" was not found.`);
      return;
    }

    if (!selectedLessonId || !module.lessons.some((lesson) => lesson.id === selectedLessonId)) {
      selectedLessonId = module.lessons[0]?.id ?? null;
    }

    const selectedLesson = module.lessons.find((lesson) => lesson.id === selectedLessonId) ?? module.lessons[0] ?? null;
    app.innerHTML = renderModuleView(course, module, modules, selectedLesson);
    bindModuleInteractions(module, selectedLesson);
    return;
  }

  selectedLessonId = null;
  app.innerHTML = renderCourseView(course, modules);
}

function parseRoute() {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash || hash === "course") {
    return { kind: "course", moduleId: null };
  }

  if (hash === "resources") {
    return { kind: "resources", moduleId: null };
  }

  const parts = hash.split("/");
  if (parts[0] === "module" && parts[1]) {
    return { kind: "module", moduleId: decodeURIComponent(parts[1]) };
  }

  return { kind: "course", moduleId: null };
}

function renderCourseView(course, modules) {
  const lessonCount = modules.reduce((total, module) => total + module.lessons.length, 0);
  const componentCount = modules.reduce(
    (total, module) => total + module.lessons.reduce((sum, lesson) => sum + (lesson.components || []).length, 0),
    0
  );

  return `
    <section class="hero-grid fade-up">
      <article class="glass-panel hero-panel">
        <p class="field-label">Course</p>
        <h2>${escapeHtml(course.title)}</h2>
        <div class="hero-copy">${renderCourseSummary(course.summary)}</div>
        <div class="hero-support">
          <p class="field-label">What you will do</p>
          <p class="hero-support-copy">
            Learn the full path from publishable battery files to semantically rich, graph-ready data through one guided sequence of videos,
            notes, notebooks, and self-checks that build on each other from lesson to lesson.
          </p>
          <ul class="hero-support-points">
            <li class="hero-point">Work through one continuous learning path instead of disconnected reference material.</li>
            <li class="hero-point">Turn FAIR data, ontology, and linked-data ideas into concrete battery-data practice.</li>
          </ul>
        </div>
        <div class="chip-row">
          ${renderMetaPills([course.status, course.level, course.duration, course.provider])}
        </div>
        <div class="tag-row">
          ${course.tags.slice(0, 4).map((tag) => `<span class="status-chip">${escapeHtml(tag)}</span>`).join("")}
        </div>
      </article>

      <aside class="glass-panel stack-panel">
        <p class="field-label">At a glance</p>
        <h2>Clear course structure</h2>
        <p class="section-copy">
          This course is organized the way strong MOOC platforms do it: a concise overview, a readable syllabus,
          and focused lesson workspaces instead of pages full of competing panels.
        </p>
        <div class="source-list">
          <div class="list-item">
            <strong>${modules.length} modules</strong>
            ${lessonCount} lessons in sequence across the full course.
          </div>
          <div class="list-item">
            <strong>${componentCount} lesson components</strong>
            Video, notes, notebooks, assignments, and quizzes appear only where they are needed.
          </div>
          <div class="list-item">
            <strong>Course resources</strong>
            <a href="#resources">Browse all course files and lesson materials</a>
          </div>
        </div>
      </aside>
    </section>

    <section class="glass-panel content-panel fade-up">
      <p class="field-label">Syllabus</p>
      <h2 class="section-title">Course outline</h2>
      <p class="section-copy">
        Start at the top and move forward. Each module gives you a clear topic, a few lessons, and a direct path into the work.
      </p>
      <div class="syllabus-list">
        ${modules.map(renderSyllabusItem).join("")}
      </div>
    </section>
  `;
}

function renderResourcesView(course, modules) {
  const lessons = modules.flatMap((module) =>
    module.lessons.map((lesson) => ({
      moduleTitle: module.title,
      ...lesson
    }))
  );

  return `
    <section class="glass-panel hero-panel fade-up">
      <div class="breadcrumb-row">
        <a class="ghost-button" href="#course">Back to course</a>
      </div>
      <p class="field-label">Resources</p>
      <h2>Course materials</h2>
      <p class="hero-copy">
        This is the dedicated place for the full inventory of lesson materials and downloadable files.
        The learning pages only show resources relevant to the lesson you are currently working on.
      </p>
      <div class="chip-row">
        ${renderMetaPills([course.title, `${lessons.length} lessons`])}
      </div>
    </section>

    <section class="glass-panel content-panel fade-up">
      <p class="field-label">Lesson resources</p>
      <h2 class="section-title">All course files</h2>
      <div class="resource-groups">
        ${lessons
          .map((lesson) => {
            const resources = lesson.resources || [];
            return `
              <article class="panel-soft resource-group">
                <p class="field-label">${escapeHtml(lesson.moduleTitle)}</p>
                <h3 class="card-title">${escapeHtml(lesson.title)}</h3>
                ${
                  resources.length
                    ? `<div class="artifact-list">
                        ${resources
                          .map(
                            (resource) => `
                              <a class="list-item" href="../${escapeAttribute(resource.path)}" target="_blank" rel="noreferrer">
                                <strong>${escapeHtml(resource.title)}</strong>
                                <span>${escapeHtml(resource.path)}</span>
                              </a>
                            `
                          )
                          .join("")}
                      </div>`
                    : `<div class="list-item">No dedicated lesson files are registered for this lesson.</div>`
                }
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderSyllabusItem(module) {
  return `
    <article class="panel-soft syllabus-item">
      <div class="syllabus-title-row">
        <div>
          <p class="field-label">Module ${module.order}</p>
          <h3 class="card-title">${escapeHtml(module.title)}</h3>
        </div>
        <div class="syllabus-meta">
          ${renderMetaPills([module.duration, `${module.lessons.length} lessons`])}
        </div>
      </div>
      <p class="card-copy">${escapeHtml(module.summary)}</p>
      <div class="action-row">
        <a class="pill-action-primary" href="#module/${encodeURIComponent(module.id)}">Open module</a>
      </div>
    </article>
  `;
}

function renderModuleView(course, module, allModules, selectedLesson) {
  const moduleIndex = allModules.findIndex((item) => item.id === module.id);
  const previousModule = moduleIndex > 0 ? allModules[moduleIndex - 1] : null;
  const nextModule = moduleIndex >= 0 && moduleIndex < allModules.length - 1 ? allModules[moduleIndex + 1] : null;

  return `
    <section class="workspace-grid fade-up">
      <aside class="glass-panel sidebar-panel course-sidebar">
        <div class="breadcrumb-row">
          <a class="ghost-button" href="#course">Back to course</a>
        </div>
        <p class="field-label">Course outline</p>
        <div class="outline-list">
          ${allModules
            .map(
              (item) => `
                <a class="outline-link ${item.id === module.id ? "is-active" : ""}" href="#module/${encodeURIComponent(item.id)}">
                  <span>Module ${item.order}</span>
                  <strong>${escapeHtml(item.title)}</strong>
                </a>
              `
            )
            .join("")}
        </div>

        <div class="sidebar-divider"></div>

        <p class="field-label">Lessons in this module</p>
        <div class="lesson-nav-list">
          ${module.lessons
            .map(
              (lesson) => `
                <button
                  class="lesson-nav-button ${selectedLesson && selectedLesson.id === lesson.id ? "is-active" : ""}"
                  type="button"
                  data-lesson-id="${escapeAttribute(lesson.id)}"
                >
                  <span>Lesson ${lesson.order}</span>
                  <strong>${escapeHtml(lesson.title)}</strong>
                </button>
              `
            )
            .join("")}
        </div>

        <div class="sidebar-footer">
          ${
            previousModule
              ? `<a class="pill-action" href="#module/${encodeURIComponent(previousModule.id)}">Previous</a>`
              : `<span class="meta-pill">Start</span>`
          }
          ${
            nextModule
              ? `<a class="pill-action-primary" href="#module/${encodeURIComponent(nextModule.id)}">Next</a>`
              : `<span class="meta-pill">End</span>`
          }
        </div>
      </aside>

      <main class="content-workspace">
        <section class="glass-panel hero-panel">
          <p class="field-label">Module ${module.order}</p>
          <h2>${escapeHtml(module.title)}</h2>
          <p class="hero-copy">${escapeHtml(module.summary)}</p>
          <div class="chip-row">
            ${renderMetaPills([module.duration, `${module.lessons.length} lessons`])}
          </div>
        </section>

        <section class="glass-panel selected-lesson-panel">
          ${selectedLesson ? renderSelectedLesson(selectedLesson) : `<div class="viewer-empty">No lessons are configured for this module.</div>`}
        </section>
      </main>
    </section>
  `;
}

function renderSelectedLesson(lesson) {
  const videoComponent = getVideoComponent(lesson);
  const notesComponent = getLectureNotesComponent(lesson);
  const interactiveComponents = getInteractiveComponents(lesson);
  const initialComponent = getInitialComponent(lesson);

  return `
    <div>
      ${
        videoComponent
          ? `
            <div class="lesson-feature">
              ${renderLessonVideoHero(videoComponent)}
            </div>
          `
          : ""
      }
      ${
        videoComponent
          ? ""
          : `
            <p class="field-label">Lesson ${lesson.order}</p>
            <h2>${escapeHtml(lesson.title)}</h2>
            <p class="viewer-copy">${escapeHtml(lesson.summary || "")}</p>
          `
      }
      <div id="lesson-overview" class="lesson-overview">
        <div class="viewer-empty">Loading lesson content...</div>
      </div>
      ${
        interactiveComponents.length
          ? `
            <div class="component-toolbar">
              ${interactiveComponents
                .map(
                  (component) => `
                    <button
                      class="component-button ${initialComponent && initialComponent.id === component.id ? "is-active" : ""}"
                      type="button"
                      data-component-id="${escapeAttribute(component.id)}"
                    >
                      <span>${escapeHtml(component.title)}</span>
                      <small>${escapeHtml(component.kind)}</small>
                    </button>
                  `
                )
                .join("")}
            </div>
          `
          : ""
      }
      ${
        (lesson.resources || []).length
          ? `
            <div class="lesson-materials">
              <p class="field-label">Lesson materials</p>
              <div class="lesson-material-list">
                ${lesson.resources
                  .map(
                    (resource) => `
                      <a class="resource-pill" href="../${escapeAttribute(resource.path)}" target="_blank" rel="noreferrer">
                        ${escapeHtml(resource.title)}
                      </a>
                    `
                  )
                  .join("")}
              </div>
            </div>
          `
          : ""
      }
      ${
        interactiveComponents.length
          ? `
            <div id="component-viewer" class="component-viewer">
              <div class="viewer-empty">Loading lesson content...</div>
            </div>
          `
          : ""
      }
    </div>
  `;
}

function bindModuleInteractions(module, selectedLesson) {
  document.querySelectorAll(".lesson-nav-button").forEach((button) => {
    button.addEventListener("click", () => {
      selectedLessonId = button.getAttribute("data-lesson-id");
      render();
    });
  });

  if (selectedLesson) {
    loadLessonOverview(selectedLesson);
    const initialComponent = getInitialComponent(selectedLesson);
    if (initialComponent) {
      bindLessonComponentInteractions(selectedLesson);
      previewComponent(selectedLesson, initialComponent.id);
    } else if (document.getElementById("component-viewer")) {
      document.getElementById("component-viewer").innerHTML =
        `<div class="viewer-empty">This lesson has no previewable components yet.</div>`;
    }
  }
}

async function loadLessonOverview(lesson) {
  const container = document.getElementById("lesson-overview");
  if (!container) return;

  const contentSections = [];
  const notesComponent = getLectureNotesComponent(lesson);

  if (!notesComponent && lesson.overview_path) {
    try {
      const overviewHtml = await loadMarkdownHtml(lesson.overview_path);
      contentSections.push(`<div class="markdown">${overviewHtml}</div>`);
    } catch (error) {
      contentSections.push(`<div class="viewer-empty">Failed to load lesson overview.</div>`);
    }
  }

  if (notesComponent?.content_path) {
    try {
      const notesHtml = await loadMarkdownHtml(notesComponent.content_path);
      contentSections.push(`
        <section class="lesson-notes-shell">
          <p class="field-label">Course notes</p>
          <div class="markdown">${notesHtml}</div>
        </section>
      `);
    } catch (error) {
      contentSections.push(`<div class="viewer-empty">Failed to load lesson notes.</div>`);
    }
  }

  if (!contentSections.length) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = contentSections.join("");
}

function getInitialComponent(lesson) {
  return getInteractiveComponents(lesson).find((component) => component.content_path || component.href) || null;
}

function bindLessonComponentInteractions(lesson) {
  document.querySelectorAll(".component-button").forEach((button) => {
    button.addEventListener("click", async () => {
      const componentId = button.getAttribute("data-component-id");
      await previewComponent(lesson, componentId);
    });
  });
}

async function previewComponent(lesson, componentId) {
  const component = (lesson.components || []).find((item) => item.id === componentId);
  const componentViewer = document.getElementById("component-viewer");
  if (!component) {
    componentViewer.innerHTML = `<div class="viewer-empty">Component not found.</div>`;
    return;
  }

  document.querySelectorAll(".component-button").forEach((button) => {
    button.classList.toggle("is-active", button.getAttribute("data-component-id") === componentId);
  });

  componentViewer.innerHTML = `<div class="viewer-empty">Loading ${escapeHtml(component.title)}...</div>`;

  try {
    if (component.content_path?.endsWith(".md")) {
      const html = await loadMarkdownHtml(component.content_path);
      componentViewer.innerHTML = renderComponentViewer(component, html);
      return;
    }

    if (component.rendered_path?.endsWith(".html")) {
      componentViewer.innerHTML = renderComponentViewer(component, renderNotebookEmbed(component));
      return;
    }

    if (component.content_path?.endsWith(".ipynb")) {
      const notebook = await fetchJson(repoUrl(component.content_path));
      componentViewer.innerHTML = renderComponentViewer(component, renderNotebook(notebook, component.content_path));
      return;
    }

    if (component.href) {
      componentViewer.innerHTML = renderComponentViewer(
        component,
        `
          <div class="panel-soft component-callout">
            <strong>External component</strong>
            <p class="viewer-copy">${escapeHtml(component.summary || "This component opens outside the local preview.")}</p>
            <div class="action-row">
              <a class="pill-action-primary" href="${escapeAttribute(component.href)}" target="_blank" rel="noreferrer">
                Open external resource
              </a>
            </div>
          </div>
        `
      );
      return;
    }

    componentViewer.innerHTML = renderComponentViewer(component, `<p>This component is not previewable inline yet.</p>`);
  } catch (error) {
    componentViewer.innerHTML = `
      <div class="viewer-empty">
        Failed to preview ${escapeHtml(component.title)}.<br />
        ${escapeHtml(error instanceof Error ? error.message : String(error))}
      </div>
    `;
  }
}

function getVideoComponent(lesson) {
  return (lesson.components || []).find((component) => component.kind === "video" && component.href) || null;
}

function getLectureNotesComponent(lesson) {
  return (
    (lesson.components || []).find(
      (component) => component.kind === "lecture-notes" && component.content_path?.endsWith(".md")
    ) || null
  );
}

function getInteractiveComponents(lesson) {
  return (lesson.components || []).filter(
    (component) => component.kind !== "video" && component.kind !== "lecture-notes"
  );
}

function renderLessonVideoHero(component) {
  return `
    <div class="lesson-video-hero">
      <div class="viewer-header">
        <div>
          <p class="field-label">Lesson video</p>
          <h2>${escapeHtml(component.title)}</h2>
          <p class="viewer-copy">${escapeHtml(component.summary || "")}</p>
        </div>
        <div class="action-row">
          <a class="pill-action-primary" href="${escapeAttribute(component.href)}" target="_blank" rel="noreferrer">Open external</a>
        </div>
      </div>
      ${renderVideoEmbed(component.href)}
    </div>
  `;
}

function renderComponentViewer(component, innerHtml) {
  return `
    <div class="fade-up">
      <div class="viewer-header">
        <div>
          <p class="field-label">${escapeHtml(component.kind)}</p>
          <h2>${escapeHtml(component.title)}</h2>
          <p class="viewer-copy">${escapeHtml(component.summary || "")}</p>
        </div>
        <div class="action-row">
          ${
            component.rendered_path
              ? `<a class="pill-action-primary" data-rendered-notebook-link="true" data-base-href="${escapeAttribute(repoUrl(component.rendered_path))}" href="${escapeAttribute(renderNotebookUrl(component.rendered_path))}" target="_blank" rel="noreferrer">Open notebook view</a>`
              : ""
          }
          ${
            component.content_path
              ? `<a class="pill-action" href="${escapeAttribute(repoUrl(component.content_path))}" target="_blank" rel="noreferrer">Open file</a>`
              : ""
          }
          ${
            component.href
              ? `<a class="pill-action-primary" href="${escapeAttribute(component.href)}" target="_blank" rel="noreferrer">Open external</a>`
              : ""
          }
        </div>
      </div>
      <div class="markdown">${innerHtml}</div>
    </div>
  `;
}

function renderNotebookEmbed(component) {
  return `
    <div class="notebook-preview-wrap">
      <div class="panel-soft component-callout">
        <strong>Notebook render</strong>
        <p class="viewer-copy">This notebook is rendered from the source <code>.ipynb</code> using a static HTML export so code, markdown, and outputs stay intact.</p>
      </div>
      <div class="notebook-frame-wrap">
        <iframe
          src="${escapeAttribute(renderNotebookUrl(component.rendered_path))}"
          title="${escapeAttribute(component.title)}"
          loading="lazy"
        ></iframe>
      </div>
    </div>
  `;
}

function renderVideoEmbed(href) {
  const embedUrl = youtubeEmbedUrl(href);
  if (!embedUrl) {
    return `
      <div class="panel-soft component-callout">
        <strong>Video</strong>
        <div class="action-row">
          <a class="pill-action-primary" href="${escapeAttribute(href)}" target="_blank" rel="noreferrer">Open video</a>
        </div>
      </div>
    `;
  }

  return `
    <div class="video-frame-wrap">
      <iframe
        src="${escapeAttribute(embedUrl)}"
        title="Lesson video"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
      ></iframe>
    </div>
  `;
}

function youtubeEmbedUrl(href) {
  try {
    const url = new URL(href);
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.replace("/", "");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (url.hostname.includes("youtube.com")) {
      const id = url.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

function renderNotebook(notebook, basePath) {
  const markdownCells = (notebook.cells || []).filter((cell) => cell.cell_type === "markdown");
  const previewCells = markdownCells.slice(0, 4);

  if (!previewCells.length) {
    return `<p>This notebook does not contain markdown cells to preview.</p>`;
  }

  const cellHtml = previewCells
    .map((cell) => renderMarkdown((cell.source || []).join(""), basePath))
    .join("<hr />");

  return `
    <div class="panel-soft component-callout">
      <strong>Notebook preview</strong>
      <p class="viewer-copy">Showing the first markdown cells to keep the inline preview fast and readable.</p>
    </div>
    ${cellHtml}
  `;
}

function renderMarkdown(markdown, basePath) {
  const lines = markdown.replace(/\r/g, "").split("\n");
  let html = "";
  let paragraphBuffer = [];
  let listType = null;
  let codeBuffer = [];
  let inCode = false;

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    html += `<p>${renderInline(paragraphBuffer.join(" "), basePath)}</p>`;
    paragraphBuffer = [];
  };

  const flushList = () => {
    if (!listType) return;
    html += listType === "ol" ? "</ol>" : "</ul>";
    listType = null;
  };

  const flushCode = () => {
    if (!inCode) return;
    html += `<pre><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`;
    codeBuffer = [];
    inCode = false;
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      flushParagraph();
      flushList();
      if (inCode) {
        flushCode();
      } else {
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      html += `<h${level}>${renderInline(heading[2], basePath)}</h${level}>`;
      continue;
    }

    const ordered = line.match(/^\d+\.\s+(.*)$/);
    if (ordered) {
      flushParagraph();
      if (listType !== "ol") {
        flushList();
        html += "<ol>";
        listType = "ol";
      }
      html += `<li>${renderInline(ordered[1], basePath)}</li>`;
      continue;
    }

    const task = line.match(/^-\s+\[([ xX])\]\s+(.*)$/);
    if (task) {
      flushParagraph();
      if (listType !== "ul") {
        flushList();
        html += "<ul>";
        listType = "ul";
      }
      const marker = task[1].toLowerCase() === "x" ? "x" : "o";
      html += `<li class="task-item"><span class="task-marker">${marker}</span>${renderInline(task[2], basePath)}</li>`;
      continue;
    }

    const bullet = line.match(/^-\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      if (listType !== "ul") {
        flushList();
        html += "<ul>";
        listType = "ul";
      }
      html += `<li>${renderInline(bullet[1], basePath)}</li>`;
      continue;
    }

    flushList();
    paragraphBuffer.push(line.trim());
  }

  flushParagraph();
  flushList();
  flushCode();

  return html || "<p>No previewable markdown content was found.</p>";
}

function renderInline(text, basePath) {
  let rendered = escapeHtml(text);

  rendered = rendered.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_, alt, target) => `<img src="${escapeAttribute(resolveContentUrl(basePath, target))}" alt="${escapeAttribute(alt)}" />`
  );

  rendered = rendered.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_, label, target) => `<a href="${escapeAttribute(resolveContentUrl(basePath, target))}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`
  );

  rendered = rendered.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  rendered = rendered.replace(/`([^`]+)`/g, "<code>$1</code>");

  return rendered;
}

function resolveContentUrl(basePath, target) {
  if (/^(https?:)?\/\//i.test(target)) {
    return target;
  }

  const baseParts = basePath.split("/").slice(0, -1);
  const targetParts = target.split("/");
  const resolved = [...baseParts];

  for (const part of targetParts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }

  return repoUrl(resolved.join("/"));
}

function repoUrl(path) {
  return `../${path}`;
}

async function fetchText(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load ${url}`);
  return response.text();
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load ${url}`);
  return response.json();
}

async function loadMarkdownHtml(path) {
  if (lessonOverviewCache.has(path)) {
    return lessonOverviewCache.get(path);
  }

  const markdown = await fetchText(repoUrl(path));
  const html = renderMarkdown(markdown, path);
  lessonOverviewCache.set(path, html);
  return html;
}

function renderMetaPills(items) {
  return items
    .filter(Boolean)
    .map((item) => `<span class="meta-pill">${escapeHtml(String(item))}</span>`)
    .join("");
}

function bindThemeControls() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-theme-choice]");
    if (!button) return;

    const theme = button.getAttribute("data-theme-choice");
    if (!theme || theme === currentTheme) return;
    applyTheme(theme, { persist: true });
  });

  applyTheme(currentTheme, { persist: false });
}

function applyTheme(theme, { persist } = { persist: true }) {
  if (theme !== "light" && theme !== "dark") return;

  currentTheme = theme;
  document.documentElement.dataset.theme = theme;
  if (document.body) {
    document.body.dataset.theme = theme;
  }

  if (persist) {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }

  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    const isActive = button.getAttribute("data-theme-choice") === theme;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  syncNotebookTheme();
}

function syncNotebookTheme() {
  document.querySelectorAll(".notebook-frame-wrap iframe").forEach((iframe) => {
    const currentSrc = iframe.getAttribute("src");
    if (!currentSrc) return;

    const nextSrc = withThemeQuery(currentSrc);
    if (nextSrc !== currentSrc) {
      iframe.setAttribute("src", nextSrc);
    }
  });

  document.querySelectorAll("[data-rendered-notebook-link='true']").forEach((link) => {
    const baseHref = link.getAttribute("data-base-href");
    if (!baseHref) return;
    link.setAttribute("href", withThemeQuery(baseHref));
  });
}

function renderNotebookUrl(path) {
  return withThemeQuery(repoUrl(path));
}

function withThemeQuery(target) {
  const url = new URL(target, window.location.href);
  url.searchParams.set("theme", currentTheme);
  return url.toString();
}

function renderCourseSummary(summary) {
  if (!summary) return "";

  const firstSentenceMatch = summary.match(/^(.+?\.)\s*(.*)$/);
  if (!firstSentenceMatch) {
    return `<p><strong>${escapeHtml(summary)}</strong></p>`;
  }

  const [, lead, rest] = firstSentenceMatch;
  return `
    <p><strong>${escapeHtml(lead)}</strong>${rest ? ` ${escapeHtml(rest)}` : ""}</p>
  `;
}

function setHeaderLinks(course, modules) {
  const githubLink = document.getElementById("header-github-link");
  const startLink = document.getElementById("header-start-link");

  if (startLink) {
    const firstModule = Array.isArray(modules) && modules.length ? modules[0] : null;
    startLink.href = firstModule ? `#module/${encodeURIComponent(firstModule.id)}` : "#course";
  }

  if (!githubLink) return;

  if (course?.source_repository) {
    githubLink.href = course.source_repository;
    githubLink.classList.remove("is-hidden");
  } else {
    githubLink.classList.add("is-hidden");
  }
}

function renderError(message) {
  const app = document.getElementById("app");
  app.innerHTML = `
    <section class="glass-panel loading-state">
      <p class="field-label">Preview error</p>
      <h2>Could not render the Battery Genome-style preview</h2>
      <p class="section-copy">${escapeHtml(message)}</p>
      <div class="action-row">
        <a class="pill-action-primary" href="../exports/learning-manifest.json" target="_blank" rel="noreferrer">
          Inspect manifest
        </a>
      </div>
    </section>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

bootstrap();
