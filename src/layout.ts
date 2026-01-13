import * as AST from './ast.js';
import { BlockLayout, CommandType, LAYOUT_CONSTANTS, RenderCommand, ScoreLayout } from './layout-types.js';

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

	const gOffset = 7;
	// Octave Shift relative to Reference Octave
	// If Reference is G4 (O4), and Note is O4, shift is 0.
	// If Note is O5, shift is 1 * Height.
	// Legacy: "octaveHeight" was ~70 (20 * 3.5).
	// Spec: "Staff lines spaced one octave apart."
	// LAYOUT_CONSTANTS.STAFF_LINE_SPACING = 35. 
	// Wait, in legacy code used "octaveHeight: 20 * 3.5". Here we use 35.
	// Let's stick to STAFF_LINE_SPACING.

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

// --- Key Sig ---

class KeySignatureState {
	private currentKey: { accidental: string | null, count: number } = { accidental: null, count: 0 };
	private measureAccidentals: Record<string, string> = {}; // key: "note+octave" -> acc

	constructor() { }

	setKey(acc: string | null, count: number) {
		this.currentKey = { accidental: acc, count };
	}

	resetMeasure() {
		this.measureAccidentals = {};
	}

	getAccidental(note: string, octave: number, explicit: string | null): string {
		const id = `${note}${octave}`;
		if (explicit) {
			this.measureAccidentals[id] = explicit;
			return explicit;
		}
		if (this.measureAccidentals[id]) return this.measureAccidentals[id];

		// Key Sig fallback
		// Sharps: F C G D A E B
		const sharps = ['f', 'c', 'g', 'd', 'a', 'e', 'b'];
		const flats = ['b', 'e', 'a', 'd', 'g', 'c', 'f'];

		if (this.currentKey.accidental === '#') {
			const affected = sharps.slice(0, this.currentKey.count);
			if (affected.indexOf(note) !== -1) return '#';
		} else if (this.currentKey.accidental === '&') {
			const affected = flats.slice(0, this.currentKey.count);
			if (affected.indexOf(note) !== -1) return '&';
		}

		return '%'; // Natural
	}
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
					color: 'black'
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
		const startY = 50;
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
		const lyricItems: ({ kind: 'Beat', beat: AST.Beat } | { kind: 'Barline', measureIndex: number })[] = [];

		block.lyricLines.forEach(line => {
			line.measures.forEach((meas, mIdx) => {
				meas.beats.forEach(beat => lyricItems.push({ kind: 'Beat', beat }));
				if (meas.barline) lyricItems.push({ kind: 'Barline', measureIndex: mIdx });
			});
		});

		// 2. Flatten Pitches
		const pitchQueue: (AST.Pitch | AST.Chord | AST.Directive | 'Barline')[] = [];
		block.pitchLines.forEach(pLine => {
			pLine.measures.forEach(meas => {
				meas.elements.forEach(el => pitchQueue.push(el));
				if (meas.barline) pitchQueue.push('Barline');
			});
		});

		// State
		const keySig = new KeySignatureState();
		let pitchIdx = 0;
		// Default Start: Reference G4 (O4).
		// User Spec: "reference prior pitch to C4".
		let prevPitch = { letter: 'c', octave: 4 };
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

			// Process Beat
			const beat = item.beat;
			// Determine durations and prefixes
			const subDivs = beat.elements.filter(e => 'type' in e && e.type !== 'N' && e.type !== 'B' && e.type !== 'T') as AST.Subdivision[];

			let currentDuration = 1;

			// Check directives 
			beat.elements.forEach(el => {
				if ('type' in el && (el.type === 'N' || el.type === 'B' || el.type === 'T')) {
					if (el.type === 'T') {
						cmds.push({ type: 'text', x: cursorX, y: staffTopY - 30, text: `T${el.bpm}`, font: '12px sans-serif' });
					}
					// N and B could be handled here for state
				}
			});

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
							// Update Reference only (Visual Change)
							// Spec: "reference prior pitch to C<n>" -> REMOVED per user feedback
							referenceOctave = dir.octave;
							// prevPitch = { letter: 'c', octave: dir.octave }; // REMOVED

							// Visual Marker for Octave Change

							// Visual Marker for Octave Change
							// User requested "G<n>" style
							cmds.push({
								type: 'text',
								x: localX - 15, // Draw slightly left of the note
								y: centerLineY + 5, // Align with Center Line (Visual G)
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

						const renderPitch = (p: AST.Pitch, xOffset: number = 0) => {
							const letter = p.note;
							const prevIdx = this.pitchIndex(prevPitch.letter);
							const currIdx = this.pitchIndex(letter);
							let oct = prevPitch.octave;

							const diff = currIdx - prevIdx;
							if (diff > 3) oct--;
							else if (diff < -3) oct++;

							oct += p.octaveShift;

							prevPitch = { letter, octave: oct };

							const acc = keySig.getAccidental(letter, oct, p.accidental);
							let color = 'black';

							// Red for sharps, Blue for flats. 
							if (acc === '#' || acc === '##') color = '#d00';
							if (acc === '&' || acc === '&&') color = '#00d';

							const y = getPitchY(centerLineY, oct, letter, acc, referenceOctave);

							cmds.push({ type: 'text', x: localX + xOffset, y: y, text: letter, color, font: 'bold 16px sans-serif' });
						};

						if (element.kind === 'Chord') {
							element.pitches.forEach((p, i) => {
								// Staggered Chord Rendering
								// Even index: Right (+4)
								// Odd index: Left (-4)
								const offset = (i % 2 === 0) ? 4 : -4;
								renderPitch(p, offset);
							});
						} else {
							renderPitch(element);
						}

						pitchIdx++;
					}
				}

				localX += subWidth;
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
			height: counterY + 50
		};
	}

	private pitchIndex(letter: string): number {
		const order = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];
		return order.indexOf(letter);
	}
}
