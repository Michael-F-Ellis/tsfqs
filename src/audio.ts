import * as AST from './ast.js';
import { PitchState, KeySignatureState, flattenLyrics, flattenPitches, LyricItem, PitchQueueItem } from './sequencing.js';
import { writeMidiFile, MidiTrack, MidiEvent } from './midi-writer.js';

import { BEAT_MULTIPLIERS } from './constants.js';

const PPQ = 480;

export class AudioGenerator {

	public generateMidi(score: AST.Score): Uint8Array {
		const events = this.generateEvents(score);
		return writeMidiFile([{ events }]);
	}

	public getBeatTimingMap(score: AST.Score): { map: Map<string, number>, totalTicks: number } {
		const map = new Map<string, number>();
		let currentTime = 0;
		let currentTempo = 120;
		let currentBeatDuration = "4";
		const PPQ = 480;

		score.blocks.forEach((block, blockIndex) => {
			const lyricItems = flattenLyrics(block);
			let beatIndex = 0;

			lyricItems.forEach(item => {
				if (item.kind === 'Barline') {
					return;
				}

				if (item.kind === 'Directive') {
					const el = item.directive;
					if (el.type === 'T') {
						currentTempo = el.bpm;
					} else if (el.type === 'B') {
						currentBeatDuration = el.duration;
					}
					return;
				}

				const beat = item.beat;
				// Directives in Beat
				beat.elements.forEach(el => {
					if ('type' in el) {
						const dir = el as AST.Directive;
						if (dir.type === 'T') currentTempo = dir.bpm;
						else if (dir.type === 'B') currentBeatDuration = dir.duration;
					}
				});

				const subDivs = beat.elements.filter(e => 'type' in e && e.type !== 'N' && e.type !== 'B' && e.type !== 'T') as AST.Subdivision[];

				// Beat Duration
				let beatScale = 1;
				if (subDivs.length > 0 && subDivs[0].type === 'Syllable') {
					const match = subDivs[0].text.match(/^(\d+)(.*)/);
					if (match) {
						beatScale = parseInt(match[1]);
					}
				}

				const beatMult = BEAT_MULTIPLIERS[currentBeatDuration] || 1.0;
				const beatTotalTicks = beatMult * PPQ * beatScale;

				// Record beat start
				if (subDivs.length > 0) {
					// Layout only increments beatIndex for actual beats
					map.set(`${blockIndex}:${beatIndex}`, currentTime);
					beatIndex++;
					currentTime += beatTotalTicks;
				}
			});
		});

		return { map, totalTicks: currentTime };
	}

	public generateEvents(score: AST.Score): MidiEvent[] {
		const events: MidiEvent[] = [];

		// State
		let currentTime = 0; // Absolute ticks
		let lastEventTime = 0; // For delta calculation

		let currentTempo = 120; // BPM
		let currentBeatDuration = "4"; // Quarter Note
		let currentVelocity = 70; // 0-100
		let currentInstrument = 0; // 0
		let lastEmittedMpqn: number | null = null;

		const keySig = new KeySignatureState();
		const pitchState = new PitchState();
		let referenceOctave = 4;

		// Active Notes: Set of MIDI Note Numbers currently ON
		const activeNotes = new Set<number>();

		// Initial Setup
		// Tempo 120, Time Sig 4/4 (Default)
		// We write initial Tempo
		{
			const mpqn = Math.round(60000000 / 120);
			events.push({
				deltaTime: 0,
				type: 'meta',
				metaType: 0x51, // Set Tempo
				metaData: this.numberToBytes(mpqn, 3)
			});

			// Program Change? Default Piano (0)
			events.push({
				deltaTime: 0,
				type: 'programChange',
				channel: 0,
				param1: 0 // Piano
			});
		}

		// Helper to add event
		const addEvent = (evt: Omit<MidiEvent, 'deltaTime'>) => {
			const delta = currentTime - lastEventTime;
			events.push({ ...evt, deltaTime: delta });
			lastEventTime = currentTime;
		};

		const noteOffAll = () => {
			activeNotes.forEach(note => {
				addEvent({
					type: 'noteOn', // Use NoteOn with Vel 0 for Running Status optimization
					channel: 0,
					param1: note,
					param2: 0
				});
			});
			activeNotes.clear();
		};

		const updateTempo = () => {
			// Calculate effective MIDI BPM (Quarter Notes per Minute)
			const mult = BEAT_MULTIPLIERS[currentBeatDuration] || 1.0;
			const qnBpm = currentTempo * mult;
			const mpqn = Math.round(60000000 / qnBpm);

			// Dedup Tempo: Only emit if mpqn has changed
			if (mpqn !== lastEmittedMpqn) {
				// console.log(`UpdateTempo: T=${currentTempo} B=${currentBeatDuration} Mult=${mult} QN_BPM=${qnBpm} MPqn=${mpqn}`); // Removed as per diff comment

				addEvent({
					type: 'meta',
					metaType: 0x51,
					metaData: this.numberToBytes(mpqn, 3)
				});
				lastEmittedMpqn = mpqn;
			}
		};

		// Iterate Blocks
		score.blocks.forEach(block => {
			const lyricItems = flattenLyrics(block);
			const pitchQueue = flattenPitches(block);
			let pitchIdx = 0;

			keySig.resetMeasure();
			// pitchState persists across blocks? AST says O<number> defaults to O4 if not specified?
			// Spec: "O<number> Placement: Valid only at the beginning of a line. Scope: Persists until changed (sets the default reference for line start)."
			// Implies state does NOT persist across blocks for O directive context?
			// Actually, Layout resets: `let referenceOctave = 4`.
			// Let's reset purely block-scoped state, but PitchState prevPitch usually persists or resets?
			// `PitchState` doesn't have reset. I'll just create new one or add reset? 
			// Layout creates new `PitchState` per block. Let's do that.
			// Wait, if I create new PitchState per block, I lose continuity if blocks are meant to be continuous?
			// "Each music block represents a line of music... Blocks are separated by one or more empty lines."
			// Layout treats them independently. I will too.

			// Re-instantiate locally for the block loop is fine if we want independent behavior.
			// But for MIDI continuity, `activeNotes` must be handled globally (we want to cut off notes from prev block? Yes).

			// NOTE: Layout uses `new PitchState()` per block. I will do same.

			lyricItems.forEach(item => {
				if (item.kind === 'Barline') {
					// Consume Pitch Barline
					while (pitchIdx < pitchQueue.length) {
						const qItem = pitchQueue[pitchIdx];
						pitchIdx++;
						if (qItem === 'Barline') break;
					}
					keySig.resetMeasure();
					return;
				}

				if (item.kind === 'Directive') {
					// Handle T directives if they appear here?
					const el = item.directive;
					if (el.type === 'T') {
						currentTempo = el.bpm;
						updateTempo();
					} else if (el.type === 'B') {
						currentBeatDuration = el.duration;
						updateTempo();
					}
					return;
				}

				const beat = item.beat;
				// Directives in Beat (T, B)
				// Filter out Subdivisions
				const subDivs = beat.elements.filter(e => 'type' in e && e.type !== 'N' && e.type !== 'B' && e.type !== 'T') as AST.Subdivision[];

				// Process T/B directives (Before beat?)
				// Spec: "T Valid anywhere... B Valid only at beginning of measure."
				// In AST, they are in `beat.elements`.

				beat.elements.forEach(el => {
					if ('type' in el) {
						const dir = el as AST.Directive;
						if (dir.type === 'T') {
							currentTempo = dir.bpm;
							updateTempo();
						} else if (dir.type === 'B') {
							currentBeatDuration = dir.duration;
							// Spec says T is BPM based on B. 
							// So if B changes, Tempo definition changes?
							// "T directive specifies beats per minute for the current value of the 'B' directive."
							// Yes.
							updateTempo();
						}
					}
				});

				// Beat Duration calculation
				// Check prefix
				let beatScale = 1;
				if (subDivs.length > 0 && subDivs[0].type === 'Syllable') {
					const match = subDivs[0].text.match(/^(\d+)(.*)/);
					if (match) {
						beatScale = parseInt(match[1]);
					}
				}

				// Calculate Subdivisions
				const beatMult = BEAT_MULTIPLIERS[currentBeatDuration] || 1.0;
				const beatTotalTicks = beatMult * PPQ * beatScale;

				const subdivisionCount = subDivs.length;

				if (subdivisionCount === 0) {
					// Empty beat? Should advance time?
					// If no subdivisions, it's duration 0? Or 1 beat rest?
					// AST Logic: if no subdivisions, it iterates 0 times.
					// But we must account for empty measures if they exist?
					// Layout treats this as empty.
					return;
				}

				const ticksPerSubdivision = beatTotalTicks / subdivisionCount;

				subDivs.forEach(sub => {
					const isAttack = sub.type === 'Syllable' || sub.type === 'Melisma';
					const isRest = sub.type === 'Rest'; // ; or _ (Partial handled same as rest for audio cut)

					if (isAttack) {
						// Consuming Pitch
						while (pitchIdx < pitchQueue.length) {
							const qItem = pitchQueue[pitchIdx];
							if (qItem === 'Barline') break;
							if ((qItem as any).kind) break; // Pitch/Chord

							// Directives
							const dir = qItem as AST.Directive;
							if (dir.type === 'K') keySig.setKey(dir.accidental, dir.count);
							else if (dir.type === 'O') pitchState.setReferenceOctave(dir.octave);
							else if (dir.type === 'I') {
								currentInstrument = dir.instrument - 1;
								currentInstrument = Math.max(0, Math.min(127, currentInstrument));
								addEvent({
									type: 'programChange',
									channel: 0,
									param1: currentInstrument
								});
							}
							else if (dir.type === 'V') {
								const val = dir.level;
								currentVelocity = Math.min(100, Math.max(0, val));
							}

							pitchIdx++;
						}

						// Cutoff previous
						noteOffAll();

						const pEl = pitchQueue[pitchIdx];
						if (pEl && pEl !== 'Barline' && (pEl as any).kind) {
							const element = pEl as (AST.Pitch | AST.Chord);

							const playNote = (n: string, o: number, acc: string | null) => {
								const finalAcc = keySig.getAccidental(n, o, acc);
								const midiNote = this.getMidiNote(n, o, finalAcc);
								const velocity = Math.floor(currentVelocity * 1.27);

								addEvent({
									type: 'noteOn',
									channel: 0,
									param1: midiNote,
									param2: velocity
								});
								activeNotes.add(midiNote);
							};

							if (element.kind === 'Chord') {
								const pitches = pitchState.calculateChordPitches(element);
								pitches.forEach(p => playNote(p.note, p.octave, p.accidental));
							} else {
								const p = element as AST.Pitch;
								const { note, octave } = pitchState.calculatePitch(p.note, p.octaveShift);
								playNote(note, octave, p.accidental);
							}
							pitchIdx++;
						}
					} else if (isRest) {
						noteOffAll();
					}

					// Advance Time
					currentTime += ticksPerSubdivision;
				});
			});
		});

		// Finalize
		noteOffAll();

		return events;
	}

	private numberToBytes(val: number, bytes: number): number[] {
		const res: number[] = [];
		for (let i = bytes - 1; i >= 0; i--) {
			res.push((val >> (8 * i)) & 0xFF);
		}
		return res;
	}

	private getMidiNote(note: string, octave: number, accidental: string): number {
		// C4 = 60.
		// Octave 4: C=0.
		// Base Offsets from C:
		const baseOffsets: Record<string, number> = {
			'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11
		};

		// Accidental
		let accValue = 0;
		if (accidental === '#' || accidental === '♯') accValue = 1;
		if (accidental === '##' || accidental === '𝄪') accValue = 2;
		if (accidental === '&' || accidental === '♭') accValue = -1;
		if (accidental === '&&' || accidental === '𝄫') accValue = -2;

		// Formula: (Octave + 1) * 12 + Base + Acc
		// Helper Octave is Standard Scientific?
		// miniFQS: O4 is Middle C (60).
		// Standard MIDI: C4 = 60.
		// Formula = (4 + 1)*12 + 0 = 60. match.

		return (octave + 1) * 12 + baseOffsets[note] + accValue;
	}
}
