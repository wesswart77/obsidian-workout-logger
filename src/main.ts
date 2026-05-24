import {
	App,
	ItemView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	WorkspaceLeaf,
	normalizePath,
} from "obsidian";

// ─── Types ───────────────────────────────────────────────────────────────────

type ExerciseCategory = "strength" | "cardio" | "mobility" | "sport";

interface WorkoutSettings {
	workoutsFolder: string;
	exercisesFolder: string;
	metricsNotePath: string;
}

const DEFAULT_SETTINGS: WorkoutSettings = {
	workoutsFolder: "Workouts/Sessions",
	exercisesFolder: "Workouts/Exercises",
	metricsNotePath: "Workouts/Body Metrics.md",
};

const WL_VIEW_TYPE = "wl-workout-view";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function today(): string {
	return new Date().toISOString().split("T")[0];
}

async function ensureFolder(app: App, folderPath: string): Promise<void> {
	const parts = normalizePath(folderPath).split("/");
	let current = "";
	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		if (!app.vault.getAbstractFileByPath(current)) {
			await app.vault.createFolder(current);
		}
	}
}

async function ensureNote(
	app: App,
	path: string,
	initialContent: string
): Promise<TFile> {
	const norm = normalizePath(path);
	const existing = app.vault.getAbstractFileByPath(norm);
	if (existing instanceof TFile) return existing;
	const parentFolder = norm.split("/").slice(0, -1).join("/");
	if (parentFolder) await ensureFolder(app, parentFolder);
	return app.vault.create(norm, initialContent);
}

function formatDate(dateStr: string): string {
	const d = new Date(dateStr);
	if (isNaN(d.getTime())) return dateStr;
	return d.toLocaleDateString(undefined, {
		weekday: "short",
		month: "short",
		day: "numeric",
	});
}

// ─── New Exercise Modal ───────────────────────────────────────────────────────

class NewExerciseModal extends Modal {
	private plugin: WorkoutLoggerPlugin;

	constructor(app: App, plugin: WorkoutLoggerPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "New Exercise" });

		let name = "";
		let category: ExerciseCategory = "strength";
		let muscleGroups = "";
		let notes = "";

		new Setting(contentEl).setName("Exercise Name").addText((t) => {
			t.setPlaceholder("e.g. Barbell Back Squat").onChange(
				(v) => (name = v)
			);
		});

		new Setting(contentEl).setName("Category").addDropdown((d) => {
			d.addOption("strength", "Strength");
			d.addOption("cardio", "Cardio");
			d.addOption("mobility", "Mobility");
			d.addOption("sport", "Sport");
			d.setValue("strength");
			d.onChange((v) => (category = v as ExerciseCategory));
		});

		new Setting(contentEl)
			.setName("Muscle Groups")
			.addText((t) =>
				t
					.setPlaceholder("e.g. quads, glutes, hamstrings")
					.onChange((v) => (muscleGroups = v))
			);

		new Setting(contentEl)
			.setName("Notes")
			.addTextArea((t) =>
				t
					.setPlaceholder("Cues, technique notes…")
					.onChange((v) => (notes = v))
			);

		new Setting(contentEl).addButton((btn) => {
			btn
				.setButtonText("Create Exercise")
				.setCta()
				.onClick(async () => {
					if (!name.trim()) {
						new Notice("Exercise name is required.");
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

	async createExercise(
		name: string,
		category: ExerciseCategory,
		muscleGroups: string,
		notes: string
	) {
		const folder = this.plugin.settings.exercisesFolder;
		await ensureFolder(this.app, folder);
		const safeName = name.replace(/[\\/:*?"<>|]/g, "-");
		const filePath = normalizePath(`${folder}/${safeName}.md`);
		if (this.app.vault.getAbstractFileByPath(filePath)) {
			new Notice(`Exercise "${name}" already exists.`);
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
- **Muscle Groups:** ${muscleGroups || "_—_"}

## Notes

${notes || "_No notes._"}

## Personal Records

| Date | Sets | Reps | Weight (kg) | RPE |
|------|------|------|-------------|-----|
`;
		await this.app.vault.create(filePath, content);
		new Notice(`Exercise "${name}" created.`);
	}

	onClose() {
		this.contentEl.empty();
	}
}

// ─── Log Workout Modal ────────────────────────────────────────────────────────

class LogWorkoutModal extends Modal {
	private plugin: WorkoutLoggerPlugin;

	constructor(app: App, plugin: WorkoutLoggerPlugin) {
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

		new Setting(contentEl).setName("Date").addText((t) => {
			t.setValue(today()).onChange((v) => (date = v));
		});

		new Setting(contentEl)
			.setName("Workout Name / Type")
			.addText((t) =>
				t
					.setPlaceholder("e.g. Upper Body Push, Leg Day")
					.onChange((v) => (workoutName = v))
			);

		new Setting(contentEl)
			.setName("Notes")
			.addTextArea((t) =>
				t.setPlaceholder("How did you feel? Any context?").onChange(
					(v) => (notes = v)
				)
			);

		new Setting(contentEl).addButton((btn) => {
			btn
				.setButtonText("Create Session")
				.setCta()
				.onClick(async () => {
					if (!workoutName.trim()) {
						new Notice("Workout name is required.");
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

	async createWorkoutSession(
		date: string,
		workoutName: string,
		notes: string
	) {
		const folder = this.plugin.settings.workoutsFolder;
		await ensureFolder(this.app, folder);
		const safeName = `${date}-${workoutName.replace(/[\\/:*?"<>|]/g, "-")}`;
		const filePath = normalizePath(`${folder}/${safeName}.md`);
		if (this.app.vault.getAbstractFileByPath(filePath)) {
			new Notice(`Workout session for "${workoutName}" on ${date} already exists.`);
			await this.app.workspace.openLinkText(filePath, "", false);
			this.plugin.refreshView();
			return;
		}
		const content = `---
date: ${date}
workoutName: "${workoutName}"
type: workout-session
---

# ${workoutName} — ${formatDate(date)}

## Notes

${notes || "_No notes._"}

## Sets

| Exercise | Sets | Reps | Weight (kg) | RPE |
|----------|------|------|-------------|-----|
`;
		await this.app.vault.create(filePath, content);
		new Notice(`Workout session "${workoutName}" created.`);
		await this.app.workspace.openLinkText(filePath, "", false);
		this.plugin.refreshView();
	}

	onClose() {
		this.contentEl.empty();
	}
}

// ─── Add Set Modal ────────────────────────────────────────────────────────────

class AddSetModal extends Modal {
	private plugin: WorkoutLoggerPlugin;

	constructor(app: App, plugin: WorkoutLoggerPlugin) {
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

		new Setting(contentEl).setName("Exercise Name").addText((t) => {
			t.setPlaceholder("e.g. Barbell Back Squat").onChange(
				(v) => (exerciseName = v)
			);
		});

		new Setting(contentEl)
			.setName("Sets")
			.addText((t) =>
				t
					.setValue("1")
					.onChange((v) => (sets = parseInt(v, 10) || 1))
			);

		new Setting(contentEl)
			.setName("Reps")
			.addText((t) =>
				t
					.setValue("1")
					.onChange((v) => (reps = parseInt(v, 10) || 1))
			);

		new Setting(contentEl)
			.setName("Weight (kg)")
			.addText((t) =>
				t
					.setValue("0")
					.onChange((v) => (weight = parseFloat(v) || 0))
			);

		const rpeDisplay = contentEl.createEl("span", {
			text: "RPE: 7",
			cls: "wl-rpe-display",
		});

		new Setting(contentEl).setName("RPE (1–10)").addSlider((s) => {
			s.setLimits(1, 10, 1)
				.setValue(7)
				.setDynamicTooltip()
				.onChange((v) => {
					rpe = v;
					rpeDisplay.setText(`RPE: ${v}`);
				});
		});

		new Setting(contentEl).addButton((btn) => {
			btn
				.setButtonText("Add Set")
				.setCta()
				.onClick(async () => {
					if (!exerciseName.trim()) {
						new Notice("Exercise name is required.");
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

	async addSet(
		exerciseName: string,
		sets: number,
		reps: number,
		weight: number,
		rpe: number
	) {
		// Find the most recently opened/modified workout session note
		const folder = this.plugin.settings.workoutsFolder;
		const workoutFiles = this.app.vault
			.getMarkdownFiles()
			.filter((f) => f.path.startsWith(normalizePath(folder) + "/"))
			.sort((a, b) => b.stat.mtime - a.stat.mtime);

		if (workoutFiles.length === 0) {
			new Notice(
				"No workout session found. Please log a workout first."
			);
			return;
		}

		const sessionFile = workoutFiles[0];
		const content = await this.app.vault.read(sessionFile);

		// Append row to the Sets table
		const tableRow = `| ${exerciseName} | ${sets} | ${reps} | ${weight} | ${rpe} |\n`;
		let updated: string;
		if (content.includes("| Exercise | Sets | Reps | Weight (kg) | RPE |")) {
			// Insert after the last table row or the header divider
			updated = content.replace(
				/(^\| Exercise \| Sets \| Reps \| Weight \(kg\) \| RPE \|\n\|[-| ]+\|\n)/m,
				`$1${tableRow}`
			);
			if (updated === content) {
				// Table rows already exist — append at end of file table
				updated = content + tableRow;
			}
		} else {
			updated =
				content +
				`\n## Sets\n\n| Exercise | Sets | Reps | Weight (kg) | RPE |\n|----------|------|------|-------------|-----|\n${tableRow}`;
		}

		await this.app.vault.modify(sessionFile, updated);

		// Check for PR across all workout sessions
		let allTimeBest = 0;
		const allWorkouts = this.app.vault
			.getMarkdownFiles()
			.filter((f) =>
				f.path.startsWith(normalizePath(folder) + "/")
			);
		for (const wf of allWorkouts) {
			const wc = await this.app.vault.read(wf);
			const lines = wc.split("\n");
			for (const line of lines) {
				if (line.startsWith("| " + exerciseName + " |")) {
					const cols = line.split("|").map((s) => s.trim());
					// cols: ["", exercise, sets, reps, weight, rpe, ""]
					const w = parseFloat(cols[4] || "0");
					if (!isNaN(w) && w > allTimeBest) {
						allTimeBest = w;
					}
				}
			}
		}

		// Include the current set in the PR check
		const isPR = weight > 0 && weight >= allTimeBest;

		new Notice(
			`Set added to "${sessionFile.basename}".${isPR ? ` New PR for ${exerciseName}: ${weight} kg!` : ""}`
		);

		this.plugin.refreshView();
	}

	onClose() {
		this.contentEl.empty();
	}
}

// ─── Body Metrics Modal ───────────────────────────────────────────────────────

class BodyMetricsModal extends Modal {
	private plugin: WorkoutLoggerPlugin;

	constructor(app: App, plugin: WorkoutLoggerPlugin) {
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

		new Setting(contentEl).setName("Date").addText((t) => {
			t.setValue(today()).onChange((v) => (date = v));
		});

		new Setting(contentEl)
			.setName("Body Weight (kg)")
			.addText((t) =>
				t.setPlaceholder("e.g. 80.5").onChange((v) => (weightKg = v))
			);

		new Setting(contentEl)
			.setName("Body Fat % (optional)")
			.addText((t) =>
				t.setPlaceholder("e.g. 18").onChange((v) => (bodyFat = v))
			);

		new Setting(contentEl)
			.setName("Notes")
			.addTextArea((t) =>
				t.setPlaceholder("e.g. post-workout, morning weight").onChange(
					(v) => (notes = v)
				)
			);

		new Setting(contentEl).addButton((btn) => {
			btn
				.setButtonText("Log Metrics")
				.setCta()
				.onClick(async () => {
					if (!weightKg.trim()) {
						new Notice("Body weight is required.");
						return;
					}
					await this.logMetrics(date, weightKg, bodyFat, notes);
					this.close();
				});
		});
	}

	async logMetrics(
		date: string,
		weightKg: string,
		bodyFat: string,
		notes: string
	) {
		const metricsPath = this.plugin.settings.metricsNotePath;
		const file = await ensureNote(
			this.app,
			metricsPath,
			`# Body Metrics Log\n\n| Date | Weight (kg) | Body Fat % | Notes |\n|------|-------------|------------|-------|\n`
		);
		const content = await this.app.vault.read(file);
		const row = `| ${date} | ${weightKg} | ${bodyFat || "—"} | ${notes || "—"} |\n`;
		await this.app.vault.modify(file, content + row);
		new Notice(`Body metrics logged for ${date}.`);
	}

	onClose() {
		this.contentEl.empty();
	}
}

// ─── Workout Sidebar View ─────────────────────────────────────────────────────

interface WorkoutEntry {
	date: string;
	name: string;
	file: TFile;
}

interface PREntry {
	exercise: string;
	bestWeight: number;
}

class WorkoutSidebarView extends ItemView {
	private plugin: WorkoutLoggerPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: WorkoutLoggerPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return WL_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Workout Logger";
	}

	getIcon(): string {
		return "dumbbell";
	}

	async onOpen() {
		await this.render();
	}

	async onClose() {}

	async render() {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("wl-view");

		const header = container.createEl("div", { cls: "wl-header" });
		header.createEl("h4", { text: "Workout Logger" });
		const btnRow = header.createEl("div", { cls: "wl-btn-row" });

		const logBtn = btnRow.createEl("button", {
			text: "Log",
			cls: "wl-btn",
		});
		logBtn.onclick = () =>
			new LogWorkoutModal(this.plugin.app, this.plugin).open();
		const setBtn = btnRow.createEl("button", {
			text: "Set",
			cls: "wl-btn",
		});
		setBtn.onclick = () =>
			new AddSetModal(this.plugin.app, this.plugin).open();

		const { workouts, prs, streak } = await this.loadData();

		// Streak
		const streakEl = container.createEl("div", { cls: "wl-streak" });
		streakEl.createEl("span", { text: `Streak: ${streak} day${streak !== 1 ? "s" : ""}`, cls: "wl-streak-text" });

		// Last 7 workouts
		container.createEl("h5", { text: "Recent Workouts", cls: "wl-section-title" });
		if (workouts.length === 0) {
			container.createEl("p", { text: "No workouts yet.", cls: "wl-empty" });
		} else {
			const list = container.createEl("div", { cls: "wl-workout-list" });
			for (const w of workouts) {
				const item = list.createEl("div", { cls: "wl-workout-item" });
				item.createEl("span", {
					text: formatDate(w.date),
					cls: "wl-workout-date",
				});
				item.createEl("span", { text: w.name, cls: "wl-workout-name" });
				item.onclick = () =>
					this.app.workspace.openLinkText(w.file.path, "", false);
			}
		}

		// PRs
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
					cls: "wl-pr-weight",
				});
			}
		}
	}

	async loadData(): Promise<{
		workouts: WorkoutEntry[];
		prs: PREntry[];
		streak: number;
	}> {
		const folder = normalizePath(this.plugin.settings.workoutsFolder);
		const files = this.app.vault
			.getMarkdownFiles()
			.filter((f) => f.path.startsWith(folder + "/"))
			.sort((a, b) => b.stat.mtime - a.stat.mtime);

		// Parse workout entries
		const allWorkouts: WorkoutEntry[] = [];
		const exerciseBest: Record<string, number> = {};

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
						name = line
							.slice(12)
							.trim()
							.replace(/^"|"$/g, "");
				}
			}

			// Extract date from filename if not in frontmatter
			if (!date) {
				const match = file.name.match(/^(\d{4}-\d{2}-\d{2})/);
				if (match) date = match[1];
			}

			if (date) {
				allWorkouts.push({ date, name, file });
			}

			// Scan set rows for PRs
			const lines = content.split("\n");
			for (const line of lines) {
				if (!line.startsWith("| ") || line.startsWith("| Exercise ") || line.startsWith("|---") || line.startsWith("| ---")) continue;
				const cols = line.split("|").map((s) => s.trim()).filter((s) => s.length > 0);
				if (cols.length < 4) continue;
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

		// Build PRs list
		const prs: PREntry[] = Object.entries(exerciseBest)
			.map(([exercise, bestWeight]) => ({ exercise, bestWeight }))
			.sort((a, b) => a.exercise.localeCompare(b.exercise));

		// Calculate streak (consecutive days with a workout)
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
				// Allow today to be missing (streak still alive)
				if (streak === 0 && dateStr === todayStr) {
					checkDate.setDate(checkDate.getDate() - 1);
					const yesterday = checkDate.toISOString().split("T")[0];
					if (workoutDates.has(yesterday)) {
						// start counting from yesterday
						continue;
					}
				}
				break;
			}
		}

		return { workouts: recentWorkouts, prs, streak };
	}
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

class WorkoutLoggerSettingTab extends PluginSettingTab {
	private plugin: WorkoutLoggerPlugin;

	constructor(app: App, plugin: WorkoutLoggerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Workout Logger Settings" });

		new Setting(containerEl)
			.setName("Workouts Folder")
			.setDesc("Folder for workout session notes.")
			.addText((t) => {
				t.setValue(this.plugin.settings.workoutsFolder).onChange(
					async (v) => {
						this.plugin.settings.workoutsFolder = v;
						await this.plugin.saveSettings();
					}
				);
			});

		new Setting(containerEl)
			.setName("Exercises Folder")
			.setDesc("Folder for exercise library notes.")
			.addText((t) => {
				t.setValue(this.plugin.settings.exercisesFolder).onChange(
					async (v) => {
						this.plugin.settings.exercisesFolder = v;
						await this.plugin.saveSettings();
					}
				);
			});

		new Setting(containerEl)
			.setName("Metrics Note Path")
			.setDesc("Path to the body metrics log note.")
			.addText((t) => {
				t.setValue(this.plugin.settings.metricsNotePath).onChange(
					async (v) => {
						this.plugin.settings.metricsNotePath = v;
						await this.plugin.saveSettings();
					}
				);
			});
	}
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default class WorkoutLoggerPlugin extends Plugin {
	settings: WorkoutSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		this.registerView(
			WL_VIEW_TYPE,
			(leaf) => new WorkoutSidebarView(leaf, this)
		);

		this.addCommand({
			id: "open-workout-logger",
			name: "Open Workout Logger Sidebar",
			callback: () => this.activateView(),
		});

		this.addCommand({
			id: "new-exercise",
			name: "New Exercise",
			callback: () => new NewExerciseModal(this.app, this).open(),
		});

		this.addCommand({
			id: "log-workout",
			name: "Log Workout",
			callback: () => new LogWorkoutModal(this.app, this).open(),
		});

		this.addCommand({
			id: "add-set",
			name: "Add Set",
			callback: () => new AddSetModal(this.app, this).open(),
		});

		this.addCommand({
			id: "body-metrics",
			name: "Log Body Metrics",
			callback: () => new BodyMetricsModal(this.app, this).open(),
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
}
