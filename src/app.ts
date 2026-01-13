
import { Lexer } from './lexer';
import { Parser } from './parser';
import { LayoutEngine } from './layout';
import { Renderer } from './renderer';
import { AudioGenerator } from './audio';
import { Score, MusicBlock } from './ast';
import { ScoreLayout, BlockLayout } from './layout-types';
// @ts-ignore
import MidiPlayer from 'midi-player-js';
// @ts-ignore
import Soundfont from 'soundfont-player';

// --- Types ---

interface BlockState {
	id: string;
	content: string; // The raw source text
	isEditing: boolean;
	// We will associate render result dynamically based on index for now
}

// --- State ---

const EXAMPLE_SCORE = `Example Score

[T120 B4] Happy Birthday to You |
[K&1 O4] cc d c f | e |

[T120] Happy Birthday to You |
[K&1] cc d c g | f |`;

let blocks: BlockState[] = [];
let audioContext: AudioContext | null = null;
let midiPlayer: any = null;
let soundfontPlayer: any = null;
let isPlaying = false;

// We store the full parse result to render each block
let currentLayout: ScoreLayout | null = null;
let parsedScore: Score | null = null;

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
}

// --- Audio ---

async function initAudioContext() {
	if (!audioContext) {
		audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
		await audioContext.resume();
		soundfontPlayer = await Soundfont.instrument(audioContext, 'acoustic_grand_piano');
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

			if (!midiPlayer) {
				midiPlayer = new MidiPlayer.Player((event: any) => {
					if (event.name === 'Note on' && event.velocity > 0) {
						soundfontPlayer.play(event.noteName, audioContext!.currentTime, { gain: event.velocity / 100 });
					}
				});
			}

			midiPlayer.loadArrayBuffer(midiBytes.buffer);
			midiPlayer.play();
			isPlaying = true;
			renderControls();

			midiPlayer.on('endOfFile', () => {
				isPlaying = false;
				renderControls();
			});

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
			div.onclick = () => startEditing(index);

			// What to render?
			// If currentLayout is valid:
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

	renderControls();
}

function renderControls() {
	const playBtn = document.getElementById('play-btn');
	if (playBtn) {
		playBtn.textContent = isPlaying ? '◼' : '▶';
		playBtn.onclick = handlePlay;
	}
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

// Listeners
document.getElementById('append-block-btn')?.addEventListener('click', () => {
	addBlock(blocks.length);
});

document.getElementById('download-btn')?.addEventListener('click', () => {
	if (!parsedScore) return;
	try {
		const gen = new AudioGenerator();
		const bytes = gen.generateMidi(parsedScore);
		const blob = new Blob([bytes], { type: 'audio/midi' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'score.mid';
		a.click();
		URL.revokeObjectURL(url);
	} catch (e) {
		alert("Error: " + e);
	}
});

// Start
init();
