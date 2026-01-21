
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { LayoutEngine } from './layout.js';
import { Renderer } from './renderer.js';
import { AudioGenerator } from './audio.js';
import { Score } from './ast.js';
// @ts-ignore
import MidiPlayer from 'midi-player-js';
// @ts-ignore
import Soundfont from 'soundfont-player';
import { GM_INSTRUMENTS } from './constants.js';

interface Example {
	id: string;
	title: string;
	explanation: string;
	code: string;
}

let audioContext: AudioContext | null = null;
let midiPlayer: any = null;
let instrumentPlayerMap = new Map<number, any>();
let activeAudioNodes = new Map<string, any>();
let currentInstrumentProgram = 0;

async function init() {
	try {
		const response = await fetch('examples.json');
		const examples: Example[] = await response.json();
		const container = document.getElementById('examples-container');
		if (!container) return;

		examples.forEach(ex => {
			const el = createExampleElement(ex);
			container.appendChild(el);
		});
	} catch (e) {
		console.error("Failed to load examples", e);
	}
}

function createExampleElement(ex: Example): HTMLElement {
	const wrapper = document.createElement('div');
	wrapper.style.marginBottom = '30px';
	wrapper.style.border = '1px solid #ddd';
	wrapper.style.borderRadius = '8px';
	wrapper.style.overflow = 'hidden';
	wrapper.style.background = '#fff';

	// Header
	const header = document.createElement('div');
	header.style.padding = '10px 15px';
	header.style.background = '#f8f9fa';
	header.style.borderBottom = '1px solid #eee';
	header.style.display = 'flex';
	header.style.justifyContent = 'space-between';
	header.style.alignItems = 'center';

	const title = document.createElement('h3');
	title.textContent = ex.title;
	title.style.margin = '0';
	title.style.fontSize = '16px';
	title.style.color = '#333';

	const playBtn = document.createElement('button');
	playBtn.textContent = '▶ Play';
	playBtn.style.background = '#007bff';
	playBtn.style.color = 'white';
	playBtn.style.border = 'none';
	playBtn.style.borderRadius = '4px';
	playBtn.style.padding = '4px 10px';
	playBtn.style.cursor = 'pointer';
	playBtn.style.fontSize = '14px';
	playBtn.onclick = () => playExample(ex.code, playBtn, wrapper);

	header.appendChild(title);
	header.appendChild(playBtn);
	wrapper.appendChild(header);

	// Render Area
	const renderArea = document.createElement('div');
	renderArea.style.padding = '10px';
	renderArea.style.textAlign = 'center'; // Center SVG

	// Render the SVG
	try {
		// Prepend Dummy Title to satisfy Parser
		const fullSource = "Example Title\n\n" + ex.code;

		const lexer = new Lexer(fullSource);
		const tokens = lexer.getAllTokens();
		const parser = new Parser(tokens);
		const score = parser.parseScore();
		// Force single block layout? Example code usually meant for one block logic but parser creates MusicBlocks
		const layoutEngine = new LayoutEngine();
		const layout = layoutEngine.layoutScore(score);

		// Filter out the title from layout rendering
		const layoutForExample = {
			title: [], // Hide the dummy title
			blocks: layout.blocks
		};

		const renderer = new Renderer();
		renderArea.innerHTML = renderer.renderScore(layoutForExample);
	} catch (e) {
		renderArea.textContent = "Error rendering example: " + e;
	}
	wrapper.appendChild(renderArea);

	// Details (Explanation + Code)
	const details = document.createElement('details');
	details.style.borderTop = '1px solid #eee';

	const summary = document.createElement('summary');
	summary.textContent = "Show Details & Code";
	summary.style.padding = '10px';
	summary.style.cursor = 'pointer';
	summary.style.color = '#666';
	summary.style.fontSize = '13px';
	details.appendChild(summary);

	const content = document.createElement('div');
	content.style.padding = '10px 15px';
	content.style.background = '#fafafa';

	const p = document.createElement('p');
	p.textContent = ex.explanation;
	p.style.marginTop = '0';
	content.appendChild(p);

	const pre = document.createElement('pre');
	pre.textContent = ex.code;
	pre.style.background = '#eee';
	pre.style.padding = '10px';
	pre.style.borderRadius = '4px';
	pre.style.margin = '10px 0 0 0';
	pre.style.overflowX = 'auto';
	content.appendChild(pre);

	details.appendChild(content);
	wrapper.appendChild(details);

	return wrapper;
}

// --- Audio Logic (Miniaturized from app.ts) ---

async function initAudioContext() {
	if (!audioContext) {
		audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
		await audioContext.resume();
	}
}

function stopAllNotes() {
	activeAudioNodes.forEach(node => {
		try { node.stop(); } catch (e) { }
	});
	activeAudioNodes.clear();
}

// Global visual update reference to clear old highlights
let clearVisualsCallback: (() => void) | null = null;

async function playExample(code: string, btn: HTMLButtonElement, wrapper: HTMLElement) {
	if (btn.textContent === '◼ Stop') {
		midiPlayer?.stop();
		stopAllNotes();
		btn.textContent = '▶ Play';
		if (clearVisualsCallback) clearVisualsCallback();
		return;
	}

	// Reset others
	document.querySelectorAll('button').forEach(b => {
		if (b.textContent === '◼ Stop') b.textContent = '▶ Play';
	});
	// Clear old visuals
	if (clearVisualsCallback) clearVisualsCallback();

	midiPlayer?.stop();
	stopAllNotes();

	btn.textContent = '...';

	await initAudioContext();

	try {
		const fullSource = "Example Title\n\n" + code;
		const lexer = new Lexer(fullSource);
		const tokens = lexer.getAllTokens();
		const parser = new Parser(tokens);
		const score = parser.parseScore();

		const generator = new AudioGenerator();
		const output = generator.generateMidi(score); // Returns Unit8Array

		// Timing Map
		const { map: beatTimingMap, totalTicks } = generator.getBeatTimingMap(score);

		// Flatten Timing Map for Lookup
		// We want: [{tick, blockIdx, beatIdx}] sorted by tick
		const beatPoints: { tick: number, b: string, bt: string }[] = [];
		beatTimingMap.forEach((tick, key) => {
			const [b, bt] = key.split(':');
			beatPoints.push({ tick, b, bt });
		});
		beatPoints.sort((a, b) => a.tick - b.tick);

		// Define Clear Visuals
		clearVisualsCallback = () => {
			wrapper.querySelectorAll('.beat-counter, .beat-circle').forEach(el => {
				el.classList.remove('active');
			});
		};

		// Scan for instruments
		const usedPrograms = new Set<number>();
		usedPrograms.add(0);

		const events = generator.generateEvents(score);
		events.forEach(evt => {
			if (evt.type === 'programChange' && evt.param1 !== undefined) {
				usedPrograms.add(evt.param1);
			}
		});

		const loadPromises: Promise<void>[] = [];
		for (const prog of usedPrograms) {
			if (!instrumentPlayerMap.has(prog)) {
				const name = GM_INSTRUMENTS[prog];
				if (name && audioContext) {
					loadPromises.push(
						Soundfont.instrument(audioContext, name as any).then((player: any) => {
							instrumentPlayerMap.set(prog, player);
						}).catch((e: any) => console.error(e))
					);
				}
			}
		}
		if (loadPromises.length > 0) await Promise.all(loadPromises);

		// Setup Player
		if (!midiPlayer) {
			midiPlayer = new MidiPlayer.Player((event: any) => {
				// Note Event Handling
				if (event.name === 'Program Change') {
					currentInstrumentProgram = event.value;
				} else if (event.name === 'Note on') {
					if (event.velocity > 0) {
						const player = instrumentPlayerMap.get(currentInstrumentProgram) || instrumentPlayerMap.get(0);
						if (player) {
							const node = player.play(event.noteName, audioContext!.currentTime, { gain: event.velocity / 100 });
							activeAudioNodes.set(event.noteName, node);
						}
					} else {
						const node = activeAudioNodes.get(event.noteName);
						if (node) {
							try { node.stop(); } catch (e) { }
							activeAudioNodes.delete(event.noteName);
						}
					}
				} else if (event.name === 'Note off') {
					const node = activeAudioNodes.get(event.noteName);
					if (node) {
						try { node.stop(); } catch (e) { }
						activeAudioNodes.delete(event.noteName);
					}
				}
			});

			// NOTE: We attach 'playing' listener globally to the instance, 
			// but we need to replace it per example or check context.
			// Since we re-use the player instance, we should remove old listeners or 
			// assign a single listener that delegates to a current callback variable.
		}

		// Hack: Overwrite event listeners/handlers logic?
		// MidiPlayer-JS uses 'on' which adds listeners.
		// We should clear listeners? Or just use a mutable current handler.

		// Remove old 'playing' and 'endOfFile' listeners if possible?
		// MidiPlayer doesn't expose easy remove.
		// Let's destroy and recreate player? Lightweight enough?
		// Or reuse instance and use global variables for callbacks.

		// Better:
		// Assign a global 'onTick' function.
		// Assign a global 'onEnd' function.

		setupPlayerCallback((tick: number) => {
			// Highlight Logic
			// Find active beat
			let activePoint = null;
			// Iterate reverse to find latest point <= tick
			for (let i = beatPoints.length - 1; i >= 0; i--) {
				if (beatPoints[i].tick <= tick) {
					activePoint = beatPoints[i];
					break;
				}
			}

			if (activePoint) {
				clearVisualsCallback!(); // Clear all in wrapper
				// Highlight specific
				const cSelectors = `.beat-counter[data-block-idx="${activePoint.b}"][data-beat-idx="${activePoint.bt}"]`;
				const circSelectors = `.beat-circle[data-block-idx="${activePoint.b}"][data-beat-idx="${activePoint.bt}"]`;

				wrapper.querySelectorAll(cSelectors).forEach(el => el.classList.add('active'));
				wrapper.querySelectorAll(circSelectors).forEach(el => el.classList.add('active'));
			}
		}, () => {
			// End
			btn.textContent = '▶ Play';
			stopAllNotes();
			if (clearVisualsCallback) clearVisualsCallback();
		});


		midiPlayer.loadArrayBuffer(output.buffer);
		midiPlayer.play();
		btn.textContent = '◼ Stop';

	} catch (e) {
		console.error("Play error", e);
		btn.textContent = 'Error';
	}
}


let onTickGlobal: ((tick: number) => void) | null = null;
let onEndGlobal: (() => void) | null = null;
let playerInitialized = false;

function setupPlayerCallback(onTick: (tick: number) => void, onEnd: () => void) {
	onTickGlobal = onTick;
	onEndGlobal = onEnd;

	if (!playerInitialized && midiPlayer) {
		midiPlayer.on('playing', (evt: any) => {
			if (onTickGlobal) onTickGlobal(evt.tick);
		});
		midiPlayer.on('endOfFile', () => {
			if (onEndGlobal) onEndGlobal();
		});
		playerInitialized = true;
	}
}

init();
