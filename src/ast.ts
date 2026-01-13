import { TokenType } from './token';

export interface SourceLocation {
	line: number;
	col: number;
}

export interface Score {
	title: string[];
	blocks: MusicBlock[];
}

export interface MusicBlock {
	kind: 'MusicBlock';
	lyricLines: LyricLine[];
	pitchLines: PitchLine[];
}

// --- Directives ---

export type Directive =
	| PickupDirective
	| BeatDurationDirective
	| TempoDirective
	| KeySigDirective
	| PriorOctaveDirective
	| InstDirective
	| VolumeDirective;

export interface BaseDirective {
	location: SourceLocation;
}

export interface PickupDirective extends BaseDirective {
	type: 'N';
	count: number;
}

export interface BeatDurationDirective extends BaseDirective {
	type: 'B';
	duration: string; // "4", "4.", "8", etc.
}

export interface TempoDirective extends BaseDirective {
	type: 'T';
	bpm: number;
}

export interface KeySigDirective extends BaseDirective {
	type: 'K';
	accidental: string | null; // '#', '&', or null
	count: number;
}

export interface PriorOctaveDirective extends BaseDirective {
	type: 'O';
	octave: number;
}

export interface InstDirective extends BaseDirective {
	type: 'I';
	instrument: number;
}

export interface VolumeDirective extends BaseDirective {
	type: 'V';
	level: number;
}

// --- Lyric Line ---

export interface LyricLine {
	location: SourceLocation;
	directives: Directive[]; // Restored to generic list to match Parser
	measures: LyricMeasure[];
}

export interface LyricMeasure {
	beats: Beat[];
	barline?: boolean; // true if ended with |
	location: SourceLocation;
}

export interface Beat {
	elements: (Subdivision | Directive)[];
	location: SourceLocation;
}

export type SubdivisionType = 'Syllable' | 'Melisma' | 'Hyphen' | 'Rest' | 'Partial' | 'Space' | 'Chord';
// Added 'Space' just in case, but unused as whitespace is used for beat delimiter.

export interface Subdivision {
	type: SubdivisionType;
	text: string; // The syllable text, or *, -, ;, _
	location: SourceLocation;
}

// --- Pitch Line ---

export interface PitchLine {
	directives: Directive[]; // [O]
	measures: PitchMeasure[];
	location: SourceLocation;
}

export interface PitchMeasure {
	elements: (Pitch | Chord | Directive)[];
	barline?: boolean;
	location: SourceLocation;
}

export interface Pitch {
	kind: 'Pitch';
	note: string; // 'c'
	accidental: string | null; // '#', '##', '&', etc.
	octaveShift: number; // +N for ^, -N for /
	location: SourceLocation;
}

export interface Chord {
	kind: 'Chord';
	pitches: Pitch[];
	location: SourceLocation;
}
