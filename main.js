var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => WorkoutLoggerPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  workoutsFolder: "Workouts/Sessions",
  exercisesFolder: "Workouts/Exercises",
  metricsNotePath: "Workouts/Body Metrics.md"
};
var WL_VIEW_TYPE = "wl-workout-view";
function today() {
  return new Date().toISOString().split("T")[0];
}
async function ensureFolder(app, folderPath) {
  const parts = (0, import_obsidian.normalizePath)(folderPath).split("/");
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!app.vault.getAbstractFileByPath(current)) {
      await app.vault.createFolder(current);
    }
  }
}
async function ensureNote(app, path, initialContent) {
  const norm = (0, import_obsidian.normalizePath)(path);
  const existing = app.vault.getAbstractFileByPath(norm);
  if (existing instanceof import_obsidian.TFile)
    return existing;
  const parentFolder = norm.split("/").slice(0, -1).join("/");
  if (parentFolder)
    await ensureFolder(app, parentFolder);
  return app.vault.create(norm, initialContent);
}
function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime()))
    return dateStr;
  return d.toLocaleDateString(void 0, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}
var NewExerciseModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "New Exercise" });
    let name = "";
    let category = "strength";
    let muscleGroups = "";
    let notes = "";
    new import_obsidian.Setting(contentEl).setName("Exercise Name").addText((t) => {
      t.setPlaceholder("e.g. Barbell Back Squat").onChange(
        (v) => name = v
      );
    });
    new import_obsidian.Setting(contentEl).setName("Category").addDropdown((d) => {
      d.addOption("strength", "Strength");
      d.addOption("cardio", "Cardio");
      d.addOption("mobility", "Mobility");
      d.addOption("sport", "Sport");
      d.setValue("strength");
      d.onChange((v) => category = v);
    });
    new import_obsidian.Setting(contentEl).setName("Muscle Groups").addText(
      (t) => t.setPlaceholder("e.g. quads, glutes, hamstrings").onChange((v) => muscleGroups = v)
    );
    new import_obsidian.Setting(contentEl).setName("Notes").addTextArea(
      (t) => t.setPlaceholder("Cues, technique notes\u2026").onChange((v) => notes = v)
    );
    new import_obsidian.Setting(contentEl).addButton((btn) => {
      btn.setButtonText("Create Exercise").setCta().onClick(async () => {
        if (!name.trim()) {
          new import_obsidian.Notice("Exercise name is required.");
          return;
        }
        await this.createExercise(
          name.trim(),
          category,
          muscleGroups,
          notes
        );
        this.close();
      });
    });
  }
  async createExercise(name, category, muscleGroups, notes) {
    const folder = this.plugin.settings.exercisesFolder;
    await ensureFolder(this.app, folder);
    const safeName = name.replace(/[\\/:*?"<>|]/g, "-");
    const filePath = (0, import_obsidian.normalizePath)(`${folder}/${safeName}.md`);
    if (this.app.vault.getAbstractFileByPath(filePath)) {
      new import_obsidian.Notice(`Exercise "${name}" already exists.`);
      return;
    }
    const content = `---
name: "${name}"
category: ${category}
muscleGroups: "${muscleGroups}"
created: ${today()}
---

# ${name}

- **Category:** ${category}
- **Muscle Groups:** ${muscleGroups || "_\u2014_"}

## Notes

${notes || "_No notes._"}

## Personal Records

| Date | Sets | Reps | Weight (kg) | RPE |
|------|------|------|-------------|-----|
`;
    await this.app.vault.create(filePath, content);
    new import_obsidian.Notice(`Exercise "${name}" created.`);
  }
  onClose() {
    this.contentEl.empty();
  }
};
var LogWorkoutModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Log Workout" });
    let date = today();
    let workoutName = "";
    let notes = "";
    new import_obsidian.Setting(contentEl).setName("Date").addText((t) => {
      t.setValue(today()).onChange((v) => date = v);
    });
    new import_obsidian.Setting(contentEl).setName("Workout Name / Type").addText(
      (t) => t.setPlaceholder("e.g. Upper Body Push, Leg Day").onChange((v) => workoutName = v)
    );
    new import_obsidian.Setting(contentEl).setName("Notes").addTextArea(
      (t) => t.setPlaceholder("How did you feel? Any context?").onChange(
        (v) => notes = v
      )
    );
    new import_obsidian.Setting(contentEl).addButton((btn) => {
      btn.setButtonText("Create Session").setCta().onClick(async () => {
        if (!workoutName.trim()) {
          new import_obsidian.Notice("Workout name is required.");
          return;
        }
        await this.createWorkoutSession(
          date,
          workoutName.trim(),
          notes
        );
        this.close();
      });
    });
  }
  async createWorkoutSession(date, workoutName, notes) {
    const folder = this.plugin.settings.workoutsFolder;
    await ensureFolder(this.app, folder);
    const safeName = `${date}-${workoutName.replace(/[\\/:*?"<>|]/g, "-")}`;
    const filePath = (0, import_obsidian.normalizePath)(`${folder}/${safeName}.md`);
    if (this.app.vault.getAbstractFileByPath(filePath)) {
      new import_obsidian.Notice(`Workout session for "${workoutName}" on ${date} already exists.`);
      await this.app.workspace.openLinkText(filePath, "", false);
      this.plugin.refreshView();
      return;
    }
    const content = `---
date: ${date}
workoutName: "${workoutName}"
type: workout-session
---

# ${workoutName} \u2014 ${formatDate(date)}

## Notes

${notes || "_No notes._"}

## Sets

| Exercise | Sets | Reps | Weight (kg) | RPE |
|----------|------|------|-------------|-----|
`;
    await this.app.vault.create(filePath, content);
    new import_obsidian.Notice(`Workout session "${workoutName}" created.`);
    await this.app.workspace.openLinkText(filePath, "", false);
    this.plugin.refreshView();
  }
  onClose() {
    this.contentEl.empty();
  }
};
var AddSetModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Add Set" });
    let exerciseName = "";
    let sets = 1;
    let reps = 1;
    let weight = 0;
    let rpe = 7;
    new import_obsidian.Setting(contentEl).setName("Exercise Name").addText((t) => {
      t.setPlaceholder("e.g. Barbell Back Squat").onChange(
        (v) => exerciseName = v
      );
    });
    new import_obsidian.Setting(contentEl).setName("Sets").addText(
      (t) => t.setValue("1").onChange((v) => sets = parseInt(v, 10) || 1)
    );
    new import_obsidian.Setting(contentEl).setName("Reps").addText(
      (t) => t.setValue("1").onChange((v) => reps = parseInt(v, 10) || 1)
    );
    new import_obsidian.Setting(contentEl).setName("Weight (kg)").addText(
      (t) => t.setValue("0").onChange((v) => weight = parseFloat(v) || 0)
    );
    const rpeDisplay = contentEl.createEl("span", {
      text: "RPE: 7",
      cls: "wl-rpe-display"
    });
    new import_obsidian.Setting(contentEl).setName("RPE (1\u201310)").addSlider((s) => {
      s.setLimits(1, 10, 1).setValue(7).setDynamicTooltip().onChange((v) => {
        rpe = v;
        rpeDisplay.setText(`RPE: ${v}`);
      });
    });
    new import_obsidian.Setting(contentEl).addButton((btn) => {
      btn.setButtonText("Add Set").setCta().onClick(async () => {
        if (!exerciseName.trim()) {
          new import_obsidian.Notice("Exercise name is required.");
          return;
        }
        await this.addSet(
          exerciseName.trim(),
          sets,
          reps,
          weight,
          rpe
        );
        this.close();
      });
    });
  }
  async addSet(exerciseName, sets, reps, weight, rpe) {
    const folder = this.plugin.settings.workoutsFolder;
    const workoutFiles = this.app.vault.getMarkdownFiles().filter((f) => f.path.startsWith((0, import_obsidian.normalizePath)(folder) + "/")).sort((a, b) => b.stat.mtime - a.stat.mtime);
    if (workoutFiles.length === 0) {
      new import_obsidian.Notice(
        "No workout session found. Please log a workout first."
      );
      return;
    }
    const sessionFile = workoutFiles[0];
    const content = await this.app.vault.read(sessionFile);
    const tableRow = `| ${exerciseName} | ${sets} | ${reps} | ${weight} | ${rpe} |
`;
    let updated;
    if (content.includes("| Exercise | Sets | Reps | Weight (kg) | RPE |")) {
      updated = content.replace(
        /(^\| Exercise \| Sets \| Reps \| Weight \(kg\) \| RPE \|\n\|[-| ]+\|\n)/m,
        `$1${tableRow}`
      );
      if (updated === content) {
        updated = content + tableRow;
      }
    } else {
      updated = content + `
## Sets

| Exercise | Sets | Reps | Weight (kg) | RPE |
|----------|------|------|-------------|-----|
${tableRow}`;
    }
    await this.app.vault.modify(sessionFile, updated);
    let allTimeBest = 0;
    const allWorkouts = this.app.vault.getMarkdownFiles().filter(
      (f) => f.path.startsWith((0, import_obsidian.normalizePath)(folder) + "/")
    );
    for (const wf of allWorkouts) {
      const wc = await this.app.vault.read(wf);
      const lines = wc.split("\n");
      for (const line of lines) {
        if (line.startsWith("| " + exerciseName + " |")) {
          const cols = line.split("|").map((s) => s.trim());
          const w = parseFloat(cols[4] || "0");
          if (!isNaN(w) && w > allTimeBest) {
            allTimeBest = w;
          }
        }
      }
    }
    const isPR = weight > 0 && weight >= allTimeBest;
    new import_obsidian.Notice(
      `Set added to "${sessionFile.basename}".${isPR ? ` New PR for ${exerciseName}: ${weight} kg!` : ""}`
    );
    this.plugin.refreshView();
  }
  onClose() {
    this.contentEl.empty();
  }
};
var BodyMetricsModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Body Metrics" });
    let date = today();
    let weightKg = "";
    let bodyFat = "";
    let notes = "";
    new import_obsidian.Setting(contentEl).setName("Date").addText((t) => {
      t.setValue(today()).onChange((v) => date = v);
    });
    new import_obsidian.Setting(contentEl).setName("Body Weight (kg)").addText(
      (t) => t.setPlaceholder("e.g. 80.5").onChange((v) => weightKg = v)
    );
    new import_obsidian.Setting(contentEl).setName("Body Fat % (optional)").addText(
      (t) => t.setPlaceholder("e.g. 18").onChange((v) => bodyFat = v)
    );
    new import_obsidian.Setting(contentEl).setName("Notes").addTextArea(
      (t) => t.setPlaceholder("e.g. post-workout, morning weight").onChange(
        (v) => notes = v
      )
    );
    new import_obsidian.Setting(contentEl).addButton((btn) => {
      btn.setButtonText("Log Metrics").setCta().onClick(async () => {
        if (!weightKg.trim()) {
          new import_obsidian.Notice("Body weight is required.");
          return;
        }
        await this.logMetrics(date, weightKg, bodyFat, notes);
        this.close();
      });
    });
  }
  async logMetrics(date, weightKg, bodyFat, notes) {
    const metricsPath = this.plugin.settings.metricsNotePath;
    const file = await ensureNote(
      this.app,
      metricsPath,
      `# Body Metrics Log

| Date | Weight (kg) | Body Fat % | Notes |
|------|-------------|------------|-------|
`
    );
    const content = await this.app.vault.read(file);
    const row = `| ${date} | ${weightKg} | ${bodyFat || "\u2014"} | ${notes || "\u2014"} |
`;
    await this.app.vault.modify(file, content + row);
    new import_obsidian.Notice(`Body metrics logged for ${date}.`);
  }
  onClose() {
    this.contentEl.empty();
  }
};
var WorkoutSidebarView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return WL_VIEW_TYPE;
  }
  getDisplayText() {
    return "Workout Logger";
  }
  getIcon() {
    return "dumbbell";
  }
  async onOpen() {
    await this.render();
  }
  async onClose() {
  }
  async render() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("wl-view");
    const header = container.createEl("div", { cls: "wl-header" });
    header.createEl("h4", { text: "Workout Logger" });
    const btnRow = header.createEl("div", { cls: "wl-btn-row" });
    const logBtn = btnRow.createEl("button", {
      text: "Log",
      cls: "wl-btn"
    });
    logBtn.onclick = () => new LogWorkoutModal(this.plugin.app, this.plugin).open();
    const setBtn = btnRow.createEl("button", {
      text: "Set",
      cls: "wl-btn"
    });
    setBtn.onclick = () => new AddSetModal(this.plugin.app, this.plugin).open();
    const { workouts, prs, streak } = await this.loadData();
    const streakEl = container.createEl("div", { cls: "wl-streak" });
    streakEl.createEl("span", { text: `Streak: ${streak} day${streak !== 1 ? "s" : ""}`, cls: "wl-streak-text" });
    container.createEl("h5", { text: "Recent Workouts", cls: "wl-section-title" });
    if (workouts.length === 0) {
      container.createEl("p", { text: "No workouts yet.", cls: "wl-empty" });
    } else {
      const list = container.createEl("div", { cls: "wl-workout-list" });
      for (const w of workouts) {
        const item = list.createEl("div", { cls: "wl-workout-item" });
        item.createEl("span", {
          text: formatDate(w.date),
          cls: "wl-workout-date"
        });
        item.createEl("span", { text: w.name, cls: "wl-workout-name" });
        item.onclick = () => this.app.workspace.openLinkText(w.file.path, "", false);
      }
    }
    container.createEl("h5", { text: "Personal Records", cls: "wl-section-title" });
    if (prs.length === 0) {
      container.createEl("p", { text: "No records yet.", cls: "wl-empty" });
    } else {
      const prList = container.createEl("div", { cls: "wl-pr-list" });
      for (const pr of prs) {
        const item = prList.createEl("div", { cls: "wl-pr-item" });
        item.createEl("span", { text: pr.exercise, cls: "wl-pr-exercise" });
        item.createEl("span", {
          text: `${pr.bestWeight} kg`,
          cls: "wl-pr-weight"
        });
      }
    }
  }
  async loadData() {
    const folder = (0, import_obsidian.normalizePath)(this.plugin.settings.workoutsFolder);
    const files = this.app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(folder + "/")).sort((a, b) => b.stat.mtime - a.stat.mtime);
    const allWorkouts = [];
    const exerciseBest = {};
    for (const file of files) {
      const content = await this.app.vault.read(file);
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      let date = "";
      let name = file.basename;
      if (fmMatch) {
        for (const line of fmMatch[1].split("\n")) {
          if (line.startsWith("date:"))
            date = line.slice(5).trim();
          if (line.startsWith("workoutName:"))
            name = line.slice(12).trim().replace(/^"|"$/g, "");
        }
      }
      if (!date) {
        const match = file.name.match(/^(\d{4}-\d{2}-\d{2})/);
        if (match)
          date = match[1];
      }
      if (date) {
        allWorkouts.push({ date, name, file });
      }
      const lines = content.split("\n");
      for (const line of lines) {
        if (!line.startsWith("| ") || line.startsWith("| Exercise ") || line.startsWith("|---") || line.startsWith("| ---"))
          continue;
        const cols = line.split("|").map((s) => s.trim()).filter((s) => s.length > 0);
        if (cols.length < 4)
          continue;
        const exercise = cols[0];
        const w = parseFloat(cols[3]);
        if (exercise && !isNaN(w) && w > 0) {
          if (!exerciseBest[exercise] || w > exerciseBest[exercise]) {
            exerciseBest[exercise] = w;
          }
        }
      }
    }
    allWorkouts.sort((a, b) => b.date.localeCompare(a.date));
    const recentWorkouts = allWorkouts.slice(0, 7);
    const prs = Object.entries(exerciseBest).map(([exercise, bestWeight]) => ({ exercise, bestWeight })).sort((a, b) => a.exercise.localeCompare(b.exercise));
    const workoutDates = new Set(allWorkouts.map((w) => w.date));
    let streak = 0;
    const todayStr = today();
    let checkDate = new Date(todayStr);
    while (true) {
      const dateStr = checkDate.toISOString().split("T")[0];
      if (workoutDates.has(dateStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        if (streak === 0 && dateStr === todayStr) {
          checkDate.setDate(checkDate.getDate() - 1);
          const yesterday = checkDate.toISOString().split("T")[0];
          if (workoutDates.has(yesterday)) {
            continue;
          }
        }
        break;
      }
    }
    return { workouts: recentWorkouts, prs, streak };
  }
};
var WorkoutLoggerSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Workout Logger Settings" });
    new import_obsidian.Setting(containerEl).setName("Workouts Folder").setDesc("Folder for workout session notes.").addText((t) => {
      t.setValue(this.plugin.settings.workoutsFolder).onChange(
        async (v) => {
          this.plugin.settings.workoutsFolder = v;
          await this.plugin.saveSettings();
        }
      );
    });
    new import_obsidian.Setting(containerEl).setName("Exercises Folder").setDesc("Folder for exercise library notes.").addText((t) => {
      t.setValue(this.plugin.settings.exercisesFolder).onChange(
        async (v) => {
          this.plugin.settings.exercisesFolder = v;
          await this.plugin.saveSettings();
        }
      );
    });
    new import_obsidian.Setting(containerEl).setName("Metrics Note Path").setDesc("Path to the body metrics log note.").addText((t) => {
      t.setValue(this.plugin.settings.metricsNotePath).onChange(
        async (v) => {
          this.plugin.settings.metricsNotePath = v;
          await this.plugin.saveSettings();
        }
      );
    });
  }
};
var WorkoutLoggerPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
  }
  async onload() {
    await this.loadSettings();
    this.registerView(
      WL_VIEW_TYPE,
      (leaf) => new WorkoutSidebarView(leaf, this)
    );
    this.addCommand({
      id: "open-workout-logger",
      name: "Open Workout Logger Sidebar",
      callback: () => this.activateView()
    });
    this.addCommand({
      id: "new-exercise",
      name: "New Exercise",
      callback: () => new NewExerciseModal(this.app, this).open()
    });
    this.addCommand({
      id: "log-workout",
      name: "Log Workout",
      callback: () => new LogWorkoutModal(this.app, this).open()
    });
    this.addCommand({
      id: "add-set",
      name: "Add Set",
      callback: () => new AddSetModal(this.app, this).open()
    });
    this.addCommand({
      id: "body-metrics",
      name: "Log Body Metrics",
      callback: () => new BodyMetricsModal(this.app, this).open()
    });
    this.addSettingTab(new WorkoutLoggerSettingTab(this.app, this));
    this.app.workspace.onLayoutReady(() => this.activateView());
  }
  async onunload() {
    this.app.workspace.detachLeavesOfType(WL_VIEW_TYPE);
  }
  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData()
    );
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  async activateView() {
    const existing = this.app.workspace.getLeavesOfType(WL_VIEW_TYPE);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: WL_VIEW_TYPE, active: true });
      this.app.workspace.revealLeaf(leaf);
    }
  }
  refreshView() {
    const leaves = this.app.workspace.getLeavesOfType(WL_VIEW_TYPE);
    for (const leaf of leaves) {
      if (leaf.view instanceof WorkoutSidebarView) {
        leaf.view.render();
      }
    }
  }
};
