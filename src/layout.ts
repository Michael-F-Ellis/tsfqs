import * as AST from './ast.js';
import { BlockLayout, CommandType, RenderCommand, ScoreLayout } from './layout-types.js';
import { KeySignatureState, PitchState, flattenLyrics, flattenPitches, LyricItem, PitchQueueItem } from './sequencing.js';
import { BEAT_MULTIPLIERS, LAYOUT_CONSTANTS } from './constants.js';

// --- Pitch Helpers ---

// Vertical Offsets for specific Pitch/Accidental combos (From FQS Pitch.js / layout.js)
const V_OFFSETS: Record<string, number> = {
	"𝄪a": 1, "♮b": 1, "♭c": 13,
	"♯a": 2, "♭b": 2, "𝄫c": 14,
	"𝄪g": 3, "♮a": 3, "𝄫b": 3,
	"♯g": 4, "♭a": 4,
	"𝄪f": 5.8, "♮g": 5, "𝄫a": 5,
	"𝄪e": 6, "♯f": 6.8, "♭g": 6,
	"♯e": 7, "♮f": 7.8, "𝄫g": 7,
	"𝄪d": 8, "♮e": 8, "♭f": 8.8,
	"♯d": 9, "♭e": 9, "𝄫f": 9.8,
	"𝄪c": 10, "♮d": 10, "𝄫e": 10,
	"𝄪b": -1, "♯c": 11, "♭d": 11,
	"♯b": 0, "♮c": 12, "𝄫d": 12,
};

const ACCIDENTAL_SYMBOLS: Record<string, string> = {
	'#': '♯',
	'&': '♭',
	'%': '♮',
	'##': '𝄪',
	'&&': '𝄫'
};

// function getPitchY(centerLineY: number, octave: number, note: string, accidental: string): number {
// UPDATE: Accept referenceOctave to handle [O] directive shifting the staff context.
function getPitchY(centerLineY: number, octave: number, note: string, accidental: string, referenceOctave: number = 4): number {
	const symbol = ACCIDENTAL_SYMBOLS[accidental] || '♮';
	const key = symbol + note;
	const vOffset = V_OFFSETS[key];

	if (vOffset === undefined) {
		console.warn(`Missing V_OFFSET for ${key}`);
		return centerLineY;
	}

	const octaveDiff = octave - referenceOctave;
	const octaveShift = octaveDiff * LAYOUT_CONSTANTS.STAFF_LINE_SPACING;

	// Formula adjusted for G-alignment
	// We want 'g' (vOffset=5) to be at Y=0 relative to centerLine.
	// vOffset mapping: Higher val = Lower Y (Positive screen coord).
	// offset = (vOffset - 5) * StepSize.

	const stepSize = LAYOUT_CONSTANTS.STAFF_LINE_SPACING / 12;
	let yPos = centerLineY - octaveShift;
	yPos += (vOffset - 5) * stepSize;

	return yPos;
}

// --- Layout Engine ---

export class LayoutEngine {

	public layoutScore(score: AST.Score): ScoreLayout {
		const titleCmds: RenderCommand[] = [];
		if (score.title.length > 0) {
			score.title.forEach((line, i) => {
				titleCmds.push({
					type: 'text',
					x: 400, // Centered placeholder
					y: 50 + (i * 30),
					text: line,
					font: 'bold 24px monospace',
					color: 'black',
					anchor: 'middle'
				});
			});
		}

		const blocks: BlockLayout[] = score.blocks.map(b => this.layoutBlock(b));

		return { title: titleCmds, blocks };
	}

	private layoutBlock(block: AST.MusicBlock): BlockLayout {
		const cmds: RenderCommand[] = [];
		const fh = LAYOUT_CONSTANTS.FONT_HEIGHT;
		const fw = LAYOUT_CONSTANTS.FONT_WIDTH;

		let cursorX = LAYOUT_CONSTANTS.BASE_MARGIN;

		// Rows Y positions
		const startY = 10;
		const staffTopY = startY;
		const centerLineY = staffTopY + LAYOUT_CONSTANTS.STAFF_LINE_SPACING; // G4 (Octave 0)

		const lyricY = centerLineY + LAYOUT_CONSTANTS.STAFF_LINE_SPACING + 30; // Below staff
		const counterY = lyricY + 20;

		// Draw Reference Lines
		[-1, 0, 1].forEach(oct => {
			const y = centerLineY - (oct * LAYOUT_CONSTANTS.STAFF_LINE_SPACING);
			cmds.push({ type: 'line', x: cursorX, y: y, x2: cursorX, y2: y, stroke: '#e0e0e0', strokeWidth: 1 });
			// x2 will be updated at end
		});

		// 1. Flatten Lyrics
		const lyricItems = flattenLyrics(block);

		// 2. Flatten Pitches
		const pitchQueue = flattenPitches(block);

		// State
		const keySig = new KeySignatureState();
		const pitchState = new PitchState();
		let pitchIdx = 0;
		// Default Start: Reference G4 (O4).
		// User Spec: "reference prior pitch to C4".
		let referenceOctave = 4;

		let counter = 1;

		// Process Lyric Items
		lyricItems.forEach(item => {
			if (item.kind === 'Barline') {
				// Render Barline
				cmds.push({ type: 'line', x: cursorX + (fw / 2), y: staffTopY - 20, x2: cursorX + (fw / 2), y2: counterY + 5, stroke: '#aaa' });
				cursorX += fw + 5;

				// Consume Pitch Barline if present
				// Strict Sync: Flush pitch queue until we find a Barline or run out
				while (pitchIdx < pitchQueue.length) {
					const pItem = pitchQueue[pitchIdx];
					pitchIdx++;
					if (pItem === 'Barline') {
						break; // Found the matching barline, stop flushing
					}
					// Implicitly discarding unused pitches
				}

				// Reset State
				counter = 1;
				keySig.resetMeasure();
				return;
			}

			if (item.kind === 'Directive') {
				const el = item.directive;
				if (el.type === 'T') {
					cmds.push({ type: 'text', x: cursorX, y: staffTopY - 30, text: `T${el.bpm}`, font: '12px sans-serif' });
				} else if (el.type === 'N') {
					counter = el.count;
				}
				return;
			}

			// Process Beat
			const beat = item.beat;
			// Determine durations and prefixes
			const subDivs = beat.elements.filter(e => 'type' in e && e.type !== 'N' && e.type !== 'B' && e.type !== 'T') as AST.Subdivision[];

			let currentDuration = 1;

			// Check directives (always process)
			beat.elements.forEach(el => {
				if ('type' in el && (el.type === 'N' || el.type === 'B' || el.type === 'T')) {
					if (el.type === 'T') {
						cmds.push({ type: 'text', x: cursorX, y: staffTopY - 30, text: `T${el.bpm}`, font: '12px sans-serif' });
					} else if (el.type === 'N') {
						counter = el.count;
					}
					// B could be handled here for state
				}
			});

			if (subDivs.length === 0) {
				// Standalone directive beat? Don't render counter or advance invalidly
				return;
			}

			// Prefix Check 
			if (subDivs.length > 0 && subDivs[0].type === 'Syllable') {
				const match = subDivs[0].text.match(/^(\d+)(.*)/);
				if (match) {
					currentDuration = parseInt(match[1]);
					// Strip prefix for rendering? Or stick to text. User example had "2Se".
				}
			}

			// Calculate X positions for subdivisions
			let localX = cursorX;

			subDivs.forEach((sub, sIdx) => {
				let text = sub.text;
				if (sub.type === 'Rest' && text === '_') text = ""; // Partial silent?
				if (sub.type === 'Rest' && text === ';') text = ";"; // Rest

				// Render Lyric
				const subWidth = text.length * fw;

				cmds.push({ type: 'text', x: localX, y: lyricY, text: text, font: '16px monospace', color: 'black' });

				// Pitch Match
				const isAttack = sub.type === 'Syllable' || sub.type === 'Melisma';

				if (isAttack) {
					// Metadata processing
					while (pitchIdx < pitchQueue.length) {
						const qItem = pitchQueue[pitchIdx];
						if (qItem === 'Barline') break; // Should be handled by barline loop logic, but safeguard
						if ((qItem as AST.Pitch | AST.Chord).kind) break; // It's Pitch/Chord

						// Directive
						const dir = qItem as AST.Directive;
						if (dir.type === 'K') {
							keySig.setKey(dir.accidental, dir.count);
						} else if (dir.type === 'O') {
							referenceOctave = dir.octave;
							pitchState.setReferenceOctave(dir.octave);

							// Visual Marker for Octave Change
							cmds.push({
								type: 'text',
								x: localX - 15,
								y: centerLineY + 5,
								text: `G${dir.octave}`,
								font: 'italic bold 14px serif',
								color: '#888'
							});
						}
						pitchIdx++;
					}

					// Consume Pitch/Chord
					const pEl = pitchQueue[pitchIdx];
					if (pEl && pEl !== 'Barline' && (pEl as any).kind) {
						const element = pEl as (AST.Pitch | AST.Chord);

						const renderNoteHelper = (note: string, oct: number, accStr: string | null, xOffset: number) => {
							const acc = keySig.getAccidental(note, oct, accStr);
							let color = 'black';
							if (acc === '#' || acc === '##') color = '#d00';
							if (acc === '&' || acc === '&&') color = '#00d';

							const y = getPitchY(centerLineY, oct, note, acc, referenceOctave);
							cmds.push({ type: 'text', x: localX + xOffset, y: y, text: note, color, font: 'bold 16px sans-serif' });
						};

						if (element.kind === 'Chord') {
							const chordPitches = pitchState.calculateChordPitches(element);
							chordPitches.forEach((p, i) => {
								const offset = (i % 2 === 0) ? 4 : -4;
								renderNoteHelper(p.note, p.octave, p.accidental, offset);
							});
						} else {
							// Single Pitch
							const p = element as AST.Pitch;
							const { note, octave } = pitchState.calculatePitch(p.note, p.octaveShift);
							renderNoteHelper(note, octave, p.accidental, 0);
						}

						pitchIdx++;
					}
				}

				localX += subWidth;

				// Separator Spacing
				if (sub.separator === '.') {
					// Render Period
					cmds.push({ type: 'text', x: localX, y: lyricY, text: '.', font: '16px monospace', color: 'black' });
					localX += fw;
				}
			});

			// Render Counter
			cmds.push({ type: 'text', x: cursorX + (fw / 2), y: counterY, text: counter.toString(), color: '#888', font: '10px sans-serif' });

			counter += currentDuration;
			cursorX = localX + 10;
		});

		// Update Line Lengths
		cmds.forEach(c => {
			if (c.type === 'line' && c.stroke === '#e0e0e0') {
				c.x2 = cursorX;
			}
		});

		return {
			commands: cmds,
			width: cursorX,
			height: counterY + 15
		};
	}

}
