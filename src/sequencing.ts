import * as AST from './ast';

// --- Key Sig ---

export class KeySignatureState {
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

// --- Pitch State ---

export interface PitchDefinition {
	note: string;
	octave: number;
	accidental: string;
}

export class PitchState {
	private prevPitch: { letter: string, octave: number } = { letter: 'c', octave: 4 };
	private referenceOctave: number = 4;

	constructor() { }

	setReferenceOctave(oct: number) {
		this.referenceOctave = oct;
	}

	getReferenceOctave(): number {
		return this.referenceOctave;
	}

	/**
	 * Calculates the absolute pitch (note + octave) based on the "LilyPond Rule".
	 * Updates internal state (prevPitch).
	 */
	calculatePitch(note: string, octaveShift: number): { note: string, octave: number } {
		const prevIdx = this.pitchIndex(this.prevPitch.letter);
		const currIdx = this.pitchIndex(note);
		let oct = this.prevPitch.octave;

		const diff = currIdx - prevIdx;
		if (diff > 3) oct--;
		else if (diff < -3) oct++;

		oct += octaveShift;

		// Update state
		this.prevPitch = { letter: note, octave: oct };

		return { note, octave: oct };
	}

	/**
	 * For chords, we need to calculate potential pitch without updating global history yet,
	 * or handle the specific chord logic (strictly ascending).
	 */
	calculateChordPitches(chord: AST.Chord): { note: string, octave: number, accidental: string | null }[] {
		const results: { note: string, octave: number, accidental: string | null }[] = [];

		// First note is relative to PREVIOUS global pitch
		// We do NOT update global prevPitch until the end of the chord (or do we?)
		// Spec: "sixth pitch, a, has no octave shift, so it is placed relative the last note of the chord."
		// So we traverse and update a LOCAL state, then update global state at end.

		let localPrev = { ...this.prevPitch };

		chord.pitches.forEach((p, index) => {
			const letter = p.note;

			// First note uses standard relative rule against localPrev (which is global prev at start)
			// Subsequent notes use ascending rule? 
			// Spec: "Chord pitches are determined by finding the closest instance of the pitch class that is strictly higher than the previous chord pitch"

			let oct = localPrev.octave;

			if (index === 0) {
				// Standard Relative Rule
				const prevIdx = this.pitchIndex(localPrev.letter);
				const currIdx = this.pitchIndex(letter);

				const diff = currIdx - prevIdx;
				if (diff > 3) oct--;
				else if (diff < -3) oct++;

				oct += p.octaveShift; // '/' valid on first pitch
			} else {
				// Strictly Higher Rule
				// We want the smallest interval that is > 0.
				// Start with matching octave
				// If pitch <= prev, bump octave

				// Compare (oct, letter) > (localPrev.oct, localPrev.letter)
				// Actually, finding closest instance strictly higher.
				// Check current octave. If letter is "below" or equal to prev letter, must be next octave.
				// If letter is "above" prev letter, same octave.

				const prevIdx = this.pitchIndex(localPrev.letter);
				const currIdx = this.pitchIndex(letter);

				// If curr is technically "lower" index (e.g. A vs C), it implies higher octave? 
				// Wait.
				// Examples: C4 -> E? E4. 
				// G4 -> F? F5.
				// G4 -> G? G5.

				if (currIdx <= prevIdx) {
					oct = localPrev.octave + 1;
				} else {
					oct = localPrev.octave;
				}

				oct += p.octaveShift; // ^ allowed
			}

			results.push({ note: letter, octave: oct, accidental: p.accidental });
			localPrev = { letter, octave: oct };
		});

		// Update global state to the last note of the chord
		this.prevPitch = localPrev;

		return results;
	}

	private pitchIndex(letter: string): number {
		const order = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];
		return order.indexOf(letter);
	}
}

// --- Flattening Helpers ---

export type LyricItem =
	| { kind: 'Beat', beat: AST.Beat }
	| { kind: 'Barline', measureIndex: number };

export function flattenLyrics(block: AST.MusicBlock): LyricItem[] {
	const items: LyricItem[] = [];
	block.lyricLines.forEach(line => {
		line.measures.forEach((meas, mIdx) => {
			meas.beats.forEach(beat => items.push({ kind: 'Beat', beat }));
			if (meas.barline) items.push({ kind: 'Barline', measureIndex: mIdx });
		});
	});
	return items;
}

export type PitchQueueItem = AST.Pitch | AST.Chord | AST.Directive | 'Barline';

export function flattenPitches(block: AST.MusicBlock): PitchQueueItem[] {
	const queue: PitchQueueItem[] = [];
	block.pitchLines.forEach(pLine => {
		pLine.measures.forEach(meas => {
			meas.elements.forEach(el => queue.push(el));
			if (meas.barline) queue.push('Barline');
		});
	});
	return queue;
}
