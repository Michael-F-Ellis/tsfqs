
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { LayoutEngine } from './layout.js';
import { Renderer } from './renderer.js';
import { AudioGenerator } from './audio.js';
import { Score, MusicBlock } from './ast.js';
import { ScoreLayout, BlockLayout } from './layout-types.js';
// @ts-ignore
import MidiPlayer from 'midi-player-js';
// @ts-ignore
import Soundfont from 'soundfont-player';
import { GM_INSTRUMENTS } from './constants.js';

// --- Types ---

interface BlockState {
	id: string;
	content: string; // The raw source text
	isEditing: boolean;
	// We will associate render result dynamically based on index for now
}

// --- State ---

const EXAMPLE_SCORE = `Example Score

[N3 T120 B4] Hap,py | Birth day to | You - Hap,py | Birth day to | You - Hap,py |
[K&1 O4] cc | d c f | e cc | d c ^g| f  cc |

Birth day dear | some one Hap,py | Birth day to | You - - |
[K&1] ^c a f | e d ^bb |a f g | f |`;


let blocks: BlockState[] = [];
let audioContext: AudioContext | null = null;
let midiPlayer: any = null;
let instrumentPlayerMap = new Map<number, any>();
let currentInstrumentProgram = 0;
let isPlaying = false;

// We store the full parse result to render each block
let currentLayout: ScoreLayout | null = null;
let parsedScore: Score | null = null;
let beatTimingMap: Map<string, number> | null = null;
let totalTicks = 0;

// Selection State
let loopPoints = new Set<string>(); // "blockIdx:beatIdx"
let isLoopEnabled = false;

// Helpers to get ticks
function getTicksForPoint(point: string): number {
	return beatTimingMap?.get(point) || 0;
}

function getSortedPoints(): number[] {
	if (!beatTimingMap) return [];
	const ticks = Array.from(loopPoints).map(p => beatTimingMap!.get(p)!);
	return ticks.sort((a, b) => a - b);
}

// --- Init ---

function init() {
	const chunks = EXAMPLE_SCORE.split(/\n\s*\n/);

	blocks = chunks.map(c => ({
		id: crypto.randomUUID(),
		content: c.trim(),
		isEditing: false
	}));

	updateGlobalLayout();
	renderUI();
	setupAudio();
	setupListeners();
	console.log("miniFQS Initialized");
}

// --- Audio ---

async function initAudioContext() {
	if (!audioContext) {
		audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
		await audioContext.resume();
	}

	if (!parsedScore) return;

	// Scan for instruments
	const generator = new AudioGenerator();
	const events = generator.generateEvents(parsedScore);
	const usedPrograms = new Set<number>();
	usedPrograms.add(0); // Always ensure Piano is available as fallback

	for (const evt of events) {
		if (evt.type === 'programChange' && evt.param1 !== undefined) {
			usedPrograms.add(evt.param1);
		}
	}

	// Load missing instruments
	const loadPromises: Promise<void>[] = [];
	for (const prog of usedPrograms) {
		if (!instrumentPlayerMap.has(prog)) {
			const name = GM_INSTRUMENTS[prog];
			if (name) {
				console.log(`Loading Instrument: ${name} (${prog})`);
				loadPromises.push(
					Soundfont.instrument(audioContext, name as any).then((player: any) => {
						instrumentPlayerMap.set(prog, player);
					}).catch((e: any) => console.error(`Failed to load ${name}`, e))
				);
			}
		}
	}

	if (loadPromises.length > 0) {
		await Promise.all(loadPromises);
	}
}

async function setupAudio() {
	// No-op until user plays
}

// --- Logic ---

function updateGlobalLayout() {
	// 1. Join all block content
	// We insert double newlines to emulate block separation
	const fullSource = blocks.map(b => b.content).join('\n\n');

	const lexer = new Lexer(fullSource);
	const tokens = lexer.getAllTokens();
	const parser = new Parser(tokens);

	try {
		parsedScore = parser.parseScore();
		const layoutEngine = new LayoutEngine();
		currentLayout = layoutEngine.layoutScore(parsedScore);

		// Generate Timing Map
		const audioGen = new AudioGenerator();
		const mapRes = audioGen.getBeatTimingMap(parsedScore);
		beatTimingMap = mapRes.map;
		totalTicks = mapRes.totalTicks;

	} catch (e) {
		console.error("Parse Error:", e);
		// We might want to show error in UI globally?
		// Or store error state.
		// For MVP, if parse fails, we might just keep old layout or show error text.
		// Let's set layout to null implies error.
		currentLayout = null;
	}
}

function handlePlay() {
	if (isPlaying) {
		midiPlayer.stop();
		isPlaying = false;
		renderControls();
		return;
	}

	initAudioContext().then(() => {
		if (!parsedScore) return; // Can't play broken score

		try {
			const generator = new AudioGenerator();
			// We assume full Score is valid
			const midiBytes = generator.generateMidi(parsedScore);

			// Calculate Total Ticks directly from map for manual EOF check
			let totalTicks = 0;
			if (beatTimingMap) {
				let max = 0;
				for (const t of beatTimingMap.values()) {
					if (t > max) max = t;
				}
				totalTicks = max + 480; // Add one beat duration (assuming 4kb ticks/beat standard or from generator)
			}

			if (!midiPlayer) {
				midiPlayer = new MidiPlayer.Player((event: any) => {
					if (event.name === 'Program Change') {
						currentInstrumentProgram = event.value;
					}
					else if (event.name === 'Note on' && event.velocity > 0) {
						const player = instrumentPlayerMap.get(currentInstrumentProgram) || instrumentPlayerMap.get(0);
						if (player) {
							player.play(event.noteName, audioContext!.currentTime, { gain: event.velocity / 100 });
						}
					}
				});

				// Attach Event Listeners ONCE
				midiPlayer.on('playing', (evt: any) => {
					const tick = evt.tick;
					highlightActiveBeat(tick);

					if (loopPoints.size >= 2) {
						const p = Array.from(loopPoints);
						const startTick = beatTimingMap?.get(p[0]);
						const endTick = beatTimingMap?.get(p[1]);

						if (startTick === undefined || endTick === undefined) {
							return;
						}

						if (startTick < endTick) {
							// Normal Range
							if (tick >= endTick) {
								if (isLoopEnabled) {
									midiPlayer.skipToTick(startTick);
									midiPlayer.play();
								} else {
									midiPlayer.stop();
									isPlaying = false;
									renderControls();
								}
							}
						} else {
							// Wrap Range
							if (tick >= endTick && tick < startTick) {
								if (isLoopEnabled) {
									midiPlayer.skipToTick(startTick);
									midiPlayer.play();
								} else {
									midiPlayer.stop();
									isPlaying = false;
									renderControls();
								}
							}
						}

						// Manual EOF Check (Fail-safe)
						if (totalTicks > 0 && tick >= totalTicks) {
							midiPlayer.emitEvent('endOfFile');
						}
					}
				});

				midiPlayer.on('endOfFile', () => {
					if (loopPoints.size >= 2) {
						const p = Array.from(loopPoints);
						const startTick = beatTimingMap?.get(p[0]) || 0;
						const endTick = beatTimingMap?.get(p[1]) || 0;

						if (startTick > endTick) { // Wrap Mode
							if (isLoopEnabled) {
								setTimeout(() => {
									midiPlayer.stop(); // Reset
									midiPlayer.skipToTick(0);
									midiPlayer.play();
								}, 50);
								return;
							} else {
								setTimeout(() => {
									midiPlayer.stop(); // Reset
									midiPlayer.skipToTick(0);
									midiPlayer.play();
								}, 50);
								return;
							}
						} else if (isLoopEnabled) {
							setTimeout(() => {
								midiPlayer.stop(); // Reset
								midiPlayer.skipToTick(startTick);
								midiPlayer.play();
							}, 50);
							return;
						}
					}

					isPlaying = false;
					renderControls();
				});
			}

			midiPlayer.loadArrayBuffer(midiBytes.buffer);

			// Handle Start Position
			const points = Array.from(loopPoints);
			if (points.length > 0) {
				// Start at first selected point?
				const startTick = beatTimingMap?.get(points[0]) || 0;
				midiPlayer.skipToTick(startTick);
			}

			midiPlayer.play();
			isPlaying = true;
			renderControls();


		} catch (e) {
			alert("Error generating audio: " + (e as Error).message);
		}
	});
}

// --- Rendering UI ---

function renderUI() {
	const list = document.getElementById('score-container');
	if (!list) return;
	list.innerHTML = '';

	// We need to map UI Blocks to Layout Blocks
	// Problem: blocks[] contains Title chunk? 
	// parser.parseScore() separates Title logic.
	// score.blocks only contains MusicBlocks.
	// user said: "Let's treat first chunk as Header".
	// If blocks[0] is title text, parsedScore.title will be populated.
	// parsedScore.blocks will correspond to blocks[1..N].

	// Heuristic Mapping:
	// If parsedScore has title, layout.title has commands. 
	// We can render title SVG in the first UI block if it seems to be the title?
	// Or just strictly map by index of MusicBlocks?

	// If blocks[0] is "Title", it generates score.title.
	// blocks[1] is Music, generates score.blocks[0].

	// Let's try to render what we can.

	let musicBlockIndex = 0;

	blocks.forEach((block, index) => {
		const div = document.createElement('div');
		div.className = `music-block ${block.isEditing ? 'editing' : ''}`;

		if (block.isEditing) {
			// EDITOR
			const textarea = document.createElement('textarea');
			textarea.className = 'block-editor';
			textarea.value = block.content;

			setTimeout(() => {
				textarea.style.height = 'auto';
				textarea.style.height = textarea.scrollHeight + 'px';
				textarea.focus();
			}, 0);

			const saveBtn = document.createElement('button');
			saveBtn.textContent = 'Done';
			saveBtn.style.marginTop = '5px';
			saveBtn.onclick = (e) => {
				e.stopPropagation();
				saveBlock(index, textarea.value);
			};

			div.appendChild(textarea);
			div.appendChild(saveBtn);
		} else {
			// VIEWER
			// Render Content First
			if (currentLayout) {
				const renderer = new Renderer();

				// If this is the FIRST block, check if we have a title to render
				if (index === 0 && currentLayout.title.length > 0) {
					// This block apparently generated the Title.
					// Render Title SVG.
					// (Hack: Renderer expects ScoreLayout to render title. We can just pass title commands only?)
					// or create a temp layout.
					// Renderer doesn't expose renderSVG public? It's private.
					// We need to stick to public API or modify Renderer.
					// Renderer.renderScore() renders EVERYTHING.
					// We want to render PARTS.

					// Actually, if we map everything 1:1, maybe we just want to look at the text?
					// If text has `[` or `|`, it's likely a Music Block.
					// If it doesn't, it's likely Title.

					const isMusic = block.content.includes('[') || block.content.includes('|');

					if (!isMusic) {
						// Likely Title. Render Title SVG from layout if available.
						// We can create a "Fake" ScoreLayout with only title.
						const titleLayout = { title: currentLayout.title, blocks: [] };
						div.innerHTML = renderer.renderScore(titleLayout);
					} else {
						// Music Block.
						if (musicBlockIndex < currentLayout.blocks.length) {
							const blk = currentLayout.blocks[musicBlockIndex];
							musicBlockIndex++;
							// Render just this block.
							// Renderer has private renderBlock.
							// We can construct a ScoreLayout with NO title and THIS block.
							const blkLayout = { title: [], blocks: [blk] };
							div.innerHTML = renderer.renderScore(blkLayout);
						} else {
							div.textContent = "(No render output)";
						}
					}
				} else {
					// Subsequent blocks (or first block if looked like music)
					const isMusic = block.content.includes('[') || block.content.includes('|');
					if (isMusic) {
						if (musicBlockIndex < currentLayout.blocks.length) {
							const blk = currentLayout.blocks[musicBlockIndex];
							musicBlockIndex++;
							const blkLayout = { title: [], blocks: [blk] };
							div.innerHTML = renderer.renderScore(blkLayout);
						} else {
							div.textContent = "(No render output - Mismatch?)";
						}
					} else {
						// Text block but not music?
						// Maybe additional text paragraph?
						div.textContent = block.content;
					}
				}
			} else {
				div.textContent = "(Parse Error)";
			}

			// Append Edit Overlay button AFTER rendering content
			const editBtn = document.createElement('div');
			editBtn.className = 'edit-btn-overlay';
			editBtn.textContent = '✏️ Edit';
			editBtn.onclick = (e) => {
				e.stopPropagation();
				startEditing(index);
			}
			div.appendChild(editBtn);

			// div.onclick = () => startEditing(index); // REMOVED implicit click
		}

		list.appendChild(div);

		// Spacer
		const spacer = document.createElement('div');
		spacer.style.height = '20px';
		spacer.style.cursor = 'pointer';
		spacer.onclick = (e) => {
			e.stopPropagation();
			addBlock(index + 1);
		};
		list.appendChild(spacer);
	});

	// Add Global Listener for Beat Clicks
	list.onclick = (e) => {
		const target = e.target as HTMLElement;
		// Check if SVG Element or Text
		// ClassName on SVGElement is an SVGAnimatedString usually?
		let className = "";
		if (target.getAttribute) className = target.getAttribute('class') || "";

		// If target is SVGAnimatedString, it doesn't have .includes method properly sometimes on older browsers?
		// But getAttribute('class') returns string. Safe.

		if (className.includes('beat-counter')) {
			e.stopPropagation(); // Stop bubbling?
			const bIdx = target.getAttribute('data-block-idx');
			const btIdx = target.getAttribute('data-beat-idx');
			if (bIdx && btIdx) {
				handleBeatClick(bIdx, btIdx);
			}
		}
	};

	// Visual Update Persistence
	updateBeatVisuals();

	renderControls();
}

function renderControls() {
	const playBtn = document.getElementById('play-btn');
	if (playBtn) {
		playBtn.textContent = isPlaying ? '◼' : '▶';
		playBtn.onclick = handlePlay;
	}

	// Loop Button
	let loopBtn = document.getElementById('loop-btn');
	if (!loopBtn) {
		// Create it if not exists (Hack inject)
		const spacer = document.createElement('div');
		spacer.style.width = '10px';
		playBtn?.parentNode?.appendChild(spacer);

		loopBtn = document.createElement('button');
		loopBtn.id = 'loop-btn';
		loopBtn.className = 'icon-btn';
		loopBtn.textContent = '🔁';
		loopBtn.onclick = toggleLoop;
		playBtn?.parentNode?.appendChild(loopBtn);
	}
	loopBtn.style.opacity = isLoopEnabled ? '1' : '0.5';
	// console.log("RenderControls. LoopEnabled:", isLoopEnabled);
}

// --- Actions ---

function startEditing(index: number) {
	blocks.forEach(b => b.isEditing = false);
	blocks[index].isEditing = true;
	renderUI();
}

function saveBlock(index: number, newContent: string) {
	const trimmed = newContent.trim();
	if (trimmed.length === 0) {
		blocks.splice(index, 1);
	} else {
		blocks[index].content = trimmed;
		blocks[index].isEditing = false;
	}
	// Update Global Layout
	updateGlobalLayout();
	renderUI();
}

function addBlock(index: number) {
	blocks.splice(index, 0, {
		id: crypto.randomUUID(),
		content: "[N0] New Block |",
		isEditing: true
	});
	updateGlobalLayout();
	renderUI();
}

// --- Action Bar Handlers ---

function handleLoad() {
	const input = document.getElementById('file-input') as HTMLInputElement;
	input.click();

	input.onchange = (e) => {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			const content = e.target?.result as string;
			if (content) {
				// Naive split by double newline
				const chunks = content.split(/\n\s*\n/);
				blocks = chunks.map(c => ({
					id: crypto.randomUUID(),
					content: c.trim(),
					isEditing: false
				}));
				updateGlobalLayout();
				renderUI();
			}
		};
		reader.readAsText(file);
	};
}

async function handleSave() {
	const fullSource = blocks.map(b => b.content).join('\n\n');

	// Modern API (Desktop Chrome/Edge, etc.)
	if ('showSaveFilePicker' in window) {
		try {
			const handle = await (window as any).showSaveFilePicker({
				suggestedName: 'score.fqs',
				types: [{
					description: 'miniFQS Score',
					accept: { 'text/plain': ['.fqs'] },
				}],
			});
			const writable = await handle.createWritable();
			await writable.write(fullSource);
			await writable.close();
			return; // Success
		} catch (err: any) {
			if (err.name === 'AbortError') return; // User cancelled
			console.warn("File System Access API failed, falling back to download", err);
			// Fall through to fallback
		}
	}

	// Fallback (Mobile, Firefox, Safari)
	const filename = prompt("Save Score As:", "score.fqs");
	if (!filename) return; // User cancelled

	const blob = new Blob([fullSource], { type: 'text/plain' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

function handlePrint() {
	window.print();
}

function handleClear() {
	if (confirm("Are you sure you want to clear the score?")) {
		blocks = [{
			id: crypto.randomUUID(),
			content: "New Score",
			isEditing: true
		}];
		updateGlobalLayout();
		renderUI();
	}
}

// Listeners
async function handleDownloadMidi() {
	if (!parsedScore) return;
	try {
		const gen = new AudioGenerator();
		const bytes = gen.generateMidi(parsedScore);

		// Modern API
		if ('showSaveFilePicker' in window) {
			try {
				const handle = await (window as any).showSaveFilePicker({
					suggestedName: 'score.mid',
					types: [{
						description: 'MIDI File',
						accept: { 'audio/midi': ['.mid'] },
					}],
				});
				const writable = await handle.createWritable();
				await writable.write(bytes);
				await writable.close();
				return;
			} catch (err: any) {
				if (err.name === 'AbortError') return;
				console.warn("FS API failed", err);
			}
		}

		// Fallback
		const filename = prompt("Save MIDI As:", "score.mid");
		if (!filename) return;

		const blob = new Blob([bytes as any], { type: 'audio/midi' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);

	} catch (e) {
		alert("Error: " + e);
	}
}

function setupListeners() {
	document.getElementById('append-block-btn')?.addEventListener('click', () => {
		addBlock(blocks.length);
	});

	document.getElementById('load-btn')?.addEventListener('click', handleLoad);
	document.getElementById('save-btn')?.addEventListener('click', handleSave);
	document.getElementById('print-btn')?.addEventListener('click', handlePrint);
	document.getElementById('clear-btn')?.addEventListener('click', handleClear);
	document.getElementById('download-btn')?.addEventListener('click', handleDownloadMidi);
}


function toggleLoop() {
	isLoopEnabled = !isLoopEnabled;
	console.log("Loop Toggled. New State:", isLoopEnabled);
	renderControls();
}

function handleBeatClick(bIdx: string, btIdx: string) {
	const key = `${bIdx}:${btIdx}`;

	// Logic: 
	// If ALREADY selected: remove it.
	// If NOT selected:
	//   If < 2 points: add it.
	//   If 2 points: Remove oldest (first in iterator) and add new? 
	//   OR User said "Toggle". 

	if (loopPoints.has(key)) {
		loopPoints.delete(key);
	} else {
		if (loopPoints.size >= 2) {
			// Remove first inserted
			const first = loopPoints.values().next().value as string;
			loopPoints.delete(first);
		}
		loopPoints.add(key);
	}

	// Visual Update
	updateBeatVisuals();
}

function updateBeatVisuals() {
	// Clear all
	document.querySelectorAll('.beat-counter, .beat-circle').forEach(el => {
		el.classList.remove('selected', 'start', 'end', 'active');
	});

	const p = Array.from(loopPoints);
	p.forEach((key, i) => {
		const [b, bt] = key.split(':');
		const counterEl = document.querySelector(`.beat-counter[data-block-idx="${b}"][data-beat-idx="${bt}"]`);
		const circleEl = document.querySelector(`.beat-circle[data-block-idx="${b}"][data-beat-idx="${bt}"]`);

		if (counterEl) {
			counterEl.classList.add('selected');
			if (p.length === 2) {
				if (i === 0) counterEl.classList.add('start');
				else counterEl.classList.add('end');
			}
		}
		if (circleEl) {
			circleEl.classList.add('selected');
			if (p.length === 2) {
				if (i === 0) circleEl.classList.add('start');
				else circleEl.classList.add('end');
			}
		}
	});
}

function highlightActiveBeat(tick: number) {
	// Find the closest beat that started <= tick.
	// This requires efficient search or just iterating map? score is small?
	// Map is string keys. We need sorted entries.

	// Optimization: Cache sorted entries?
	// For MVP: Iteration
	// Find max startTick <= tick

	if (!beatTimingMap) return;

	// Only highlight ONE active beat
	document.querySelectorAll('.beat-counter.active').forEach(el => el.classList.remove('active'));

	// Naive search
	let bestKey = null;
	let maxTick = -1;

	for (const [key, t] of beatTimingMap.entries()) {
		if (t <= tick && t > maxTick) {
			maxTick = t;
			bestKey = key;
		}
	}

	if (bestKey) {
		const [b, bt] = bestKey.split(':');
		const el = document.querySelector(`.beat-counter[data-block-idx="${b}"][data-beat-idx="${bt}"]`);
		el?.classList.add('active');
	}
}

// Start
init();
