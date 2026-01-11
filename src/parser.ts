import { Token, TokenType } from './token.js';
import * as AST from './ast.js';

export class Parser {
	private tokens: Token[];
	private pos: number = 0;

	constructor(tokens: Token[]) {
		this.tokens = tokens;
	}

	// --- Helper Methods ---

	private peek(): Token {
		if (this.pos >= this.tokens.length) return this.tokens[this.tokens.length - 1];
		return this.tokens[this.pos];
	}

	private peekNext(): Token {
		if (this.pos + 1 >= this.tokens.length) return this.tokens[this.tokens.length - 1]; // EOF
		return this.tokens[this.pos + 1];
	}

	private advance(): Token {
		if (!this.isAtEnd()) {
			this.pos++;
		}
		return this.previous();
	}

	private previous(): Token {
		return this.tokens[this.pos - 1];
	}

	private isAtEnd(): boolean {
		return this.peek().type === TokenType.EOF;
	}

	private check(type: TokenType): boolean {
		if (this.isAtEnd()) return false;
		return this.peek().type === type;
	}

	private match(...types: TokenType[]): boolean {
		for (const type of types) {
			if (this.check(type)) {
				this.advance();
				return true;
			}
		}
		return false;
	}

	private consume(type: TokenType, message: string): Token {
		if (this.check(type)) return this.advance();
		throw this.error(this.peek(), message);
	}

	private error(token: Token, message: string): Error {
		return new Error(`[Line ${token.line} Col ${token.col}] Error at '${token.value}': ${message}`);
	}

	private skipNewlines() {
		while (this.match(TokenType.Newline));
	}

	// --- Parsing Rules ---

	public parseScore(): AST.Score {
		const title: string[] = [];
		const blocks: AST.MusicBlock[] = [];

		while (!this.isAtEnd()) {
			if (this.check(TokenType.Newline)) {
				this.advance();
				if (title.length > 0 && this.check(TokenType.Newline)) {
					// Double newline after title logic? Revisit title logic.
				}
				continue;
			}

			if (blocks.length === 0 && title.length === 0) {
				this.parseTitleParagraph(title);
				this.skipNewlines();
			} else {
				blocks.push(this.parseMusicBlock());
				this.skipNewlines();
			}
		}

		return { title, blocks };
	}

	private parseTitleParagraph(titleList: string[]) {
		while (!this.isAtEnd()) {
			if (this.check(TokenType.Newline)) {
				if (this.peekNext().type === TokenType.Newline) {
					this.advance();
					return;
				}
				this.advance();
				continue;
			}
			let lineText = "";
			let startLine = this.peek().line;
			// Consume tokens line by line
			while (!this.check(TokenType.Newline) && !this.isAtEnd()) {
				const tok = this.advance();
				// Add spacing? Tokens lose whitespace?
				// Minimal title reconstruction: just join values.
				// Or use `tok.col` to add spaces?
				// For simplicity: add space if tok.col > prev.endCol?
				// We'll just join with space for now or empty string.
				if (lineText.length > 0 && tok.col > (this.tokens[this.pos - 2].endCol)) {
					// prev token is at pos-2 because we advanced.
					lineText += " ";
				}
				lineText += tok.value;
			}
			titleList.push(lineText);
		}
	}

	private parseMusicBlock(): AST.MusicBlock {
		const lyricLinesArr: AST.LyricLine[] = [];
		const lyricDirectives: AST.Directive[] = [];
		const lyricMeasures: AST.LyricMeasure[] = [];

		let lyricSectionDone = false;

		// 1. Lyric Section
		while (!this.isAtEnd() && !lyricSectionDone) {
			if (this.check(TokenType.Newline)) {
				if (this.peekNext().type === TokenType.Newline) break;
				this.skipNewlines();
				continue;
			}

			const physicalLine = this.parsePhysicalLyricLine();
			lyricMeasures.push(...physicalLine.measures);
			lyricDirectives.push(...physicalLine.directives);

			if (physicalLine.endedWithBarline) {
				lyricSectionDone = true;
			}

			if (this.check(TokenType.Newline)) this.advance();
		}

		const lyricLine: AST.LyricLine = {
			directives: lyricDirectives,
			measures: lyricMeasures,
			location: { line: lyricMeasures[0]?.location.line || 0, col: 0 }
		};

		// 2. Pitch Section
		const pitchMeasures: AST.PitchMeasure[] = [];
		const pitchDirectives: AST.Directive[] = [];

		while (!this.isAtEnd()) {
			if (this.check(TokenType.Newline)) {
				if (this.peekNext().type === TokenType.Newline) break;
				this.advance();
				continue;
			}

			const pLine = this.parsePhysicalPitchLine();
			pitchMeasures.push(...pLine.measures);
			pitchDirectives.push(...pLine.directives);

			if (this.check(TokenType.Newline)) this.advance();
		}

		const pitchLine: AST.PitchLine = {
			directives: pitchDirectives,
			measures: pitchMeasures,
			location: { line: pitchMeasures[0]?.location.line || 0, col: 0 }
		};

		return { kind: 'MusicBlock', lyricLines: [lyricLine], pitchLines: [pitchLine] };
	}

	private parsePhysicalLyricLine(): { directives: AST.Directive[], measures: AST.LyricMeasure[], endedWithBarline: boolean } {
		const directives: AST.Directive[] = [];
		const measures: AST.LyricMeasure[] = [];
		let currentBeats: AST.Beat[] = [];
		let currentSubdivisions: (AST.Subdivision | AST.Directive)[] = [];
		let endedWithBarline = false;
		let prevEndCol = -1;

		const flushBeat = (locLine: number, locCol: number) => {
			if (currentSubdivisions.length > 0) {
				currentBeats.push({ elements: [...currentSubdivisions], location: { line: locLine, col: locCol } });
				currentSubdivisions = [];
			}
		};

		const flushMeasure = (hasBarline: boolean, locLine: number, locCol: number) => {
			flushBeat(locLine, locCol);
			if (currentBeats.length > 0 || hasBarline) {
				measures.push({ beats: [...currentBeats], barline: hasBarline, location: { line: locLine, col: locCol } });
				currentBeats = [];
			}
		};

		while (!this.check(TokenType.Newline) && !this.isAtEnd()) {
			const token = this.peek();

			// Check for new beat (whitespace)
			if (prevEndCol !== -1 && token.col > prevEndCol) {
				flushBeat(token.line, prevEndCol); // Use prev end as beat location? or current token start?
				// Current token starts new beat.
				// Flush previous beat.
			}

			if (token.type === TokenType.Barline) {
				this.advance();
				flushMeasure(true, token.line, token.col);
				endedWithBarline = true;
				prevEndCol = token.endCol;
				continue;
			}

			endedWithBarline = false; // Reset if we see content

			if (token.type === TokenType.LBrak) {
				const dirs = this.parseDirectives();
				if (measures.length === 0 && currentBeats.length === 0 && currentSubdivisions.length === 0) {
					directives.push(...dirs);
				} else {
					currentSubdivisions.push(...dirs);
				}
				prevEndCol = this.previous().endCol; // parseDirectives consumes ']'
				continue;
			}

			if (token.type === TokenType.Dot) {
				this.advance();
				prevEndCol = token.endCol;
				continue; // Just a separator
			}

			// Subdivisions
			const loc = { line: token.line, col: token.col };

			if (token.type === TokenType.Number) {
				// Number at start of beat? Tuple?
				// Or part of syllable text that Lexer didn't merge?
				// For now treat as text.
				const val = this.advance().value;
				currentSubdivisions.push({ type: 'Syllable', text: val, location: loc });
			} else if (token.type === TokenType.Identifier) {
				const val = this.advance().value;
				currentSubdivisions.push({ type: 'Syllable', text: val, location: loc });
			} else if (token.type === TokenType.Underscore) {
				this.advance();
				currentSubdivisions.push({ type: 'Rest', text: '_', location: loc }); // Using Rest type for now as 'Partial' is vague? 
				// AST has 'Rest' and 'Partial'?
				// LANGUAGE.md: _ is Silent Subdivision. ; is Rest.
				// Let's map _ to 'Space' or 'Partial' (Silent)? 
				// AST `SubdivisionType` had 'Partial'. I'll use that.
				// Wait, AST says `type: SubdivisionType`.
				// Let's use `text: '_'` and `type: 'Partial'`.
			} else if (token.type === TokenType.Hyphen) {
				this.advance();
				currentSubdivisions.push({ type: 'Hyphen', text: '-', location: loc });
			} else if (token.type === TokenType.Asterisk) {
				this.advance();
				currentSubdivisions.push({ type: 'Melisma', text: '*', location: loc });
			} else if (token.type === TokenType.Semicolon) {
				this.advance();
				currentSubdivisions.push({ type: 'Rest', text: ';', location: loc });
			} else if (token.type === TokenType.Equals) {
				this.advance();
				// = is shorthand for -- (2 subdivisions).
				// AST Should emit 2 Hyphens? Or one Equal?
				// LANGUAGE.md: "Shorthand for --. (therefore 2 subdivisions)".
				// Parser can expand it.
				currentSubdivisions.push({ type: 'Hyphen', text: '-', location: loc });
				currentSubdivisions.push({ type: 'Hyphen', text: '-', location: loc });
			} else {
				// Fallback for symbols not handled? e.g. unknown char
				const val = this.advance().value;
				currentSubdivisions.push({ type: 'Syllable', text: val, location: loc });
			}

			prevEndCol = this.previous().endCol;
		}

		// End of line. Flush.
		flushMeasure(false, 0, 0); // No barline
		return { directives, measures, endedWithBarline };
	}

	private parsePhysicalPitchLine(): { directives: AST.Directive[], measures: AST.PitchMeasure[] } {
		const directives: AST.Directive[] = [];
		const measures: AST.PitchMeasure[] = [];
		let currentElements: (AST.Pitch | AST.Chord | AST.Directive)[] = [];

		const flushMeasure = (hasBarline: boolean, line: number, col: number) => {
			if (currentElements.length > 0 || hasBarline) {
				measures.push({ elements: [...currentElements], barline: hasBarline, location: { line, col } });
				currentElements = [];
			}
		};

		while (!this.check(TokenType.Newline) && !this.isAtEnd()) {
			const token = this.peek();

			if (token.type === TokenType.Barline) {
				this.advance();
				flushMeasure(true, token.line, token.col);
				continue;
			}

			if (token.type === TokenType.LBrak) {
				const dirs = this.parseDirectives();
				if (measures.length === 0 && currentElements.length === 0) {
					directives.push(...dirs);
				} else {
					currentElements.push(...dirs);
				}
				continue;
			}

			// Pitch Elements: Pitch or Chord
			if (token.type === TokenType.LParen) {
				// Chord
				this.advance(); // (
				const chordPitches: AST.Pitch[] = [];
				const startLoc = { line: token.line, col: token.col };
				while (!this.check(TokenType.RParen) && !this.isAtEnd()) {
					// Expect Pitch
					const p = this.parsePitch();
					if (p) chordPitches.push(p);
					else {
						// Maybe space?
						// If we skip unknown tokens strictly?
						// or error?
						// Assuming valid input for now.
						this.advance();
					}
				}
				this.consume(TokenType.RParen, "Expected ')'");
				currentElements.push({ kind: 'Chord', pitches: chordPitches, location: startLoc });
			} else {
				// Try Parse Pitch
				const p = this.parsePitch();
				if (p) {
					currentElements.push(p);
				} else {
					// Unknown? Skip to avoid infinite loop
					this.advance();
				}
			}
		}

		flushMeasure(false, 0, 0);
		return { directives, measures };
	}

	private parsePitch(): AST.Pitch | null {
		// OctaveShift* Accidental? Note
		let octaveShift = 0;
		let accidental: string | null = null;
		const startLoc = { line: this.peek().line, col: this.peek().col };

		// Consume Shifts
		while (this.check(TokenType.Caret) || this.check(TokenType.Slash)) {
			if (this.match(TokenType.Caret)) octaveShift++;
			else if (this.match(TokenType.Slash)) octaveShift--;
		}

		// Consume Accidental
		if (this.check(TokenType.Accidental)) {
			accidental = this.advance().value;
		}

		// Check Note
		if (this.check(TokenType.Identifier)) {
			const val = this.peek().value;
			if (/^[a-g]$/.test(val)) {
				this.advance();
				return { kind: 'Pitch', note: val, accidental, octaveShift, location: startLoc };
			}
		}

		// If we consumed shifts/accidental but no note? Error?
		if (octaveShift !== 0 || accidental) {
			throw this.error(this.peek(), "Expected note name (a-g) after modifiers");
		}

		return null;
	}

	private parseDirectives(): AST.Directive[] {
		this.consume(TokenType.LBrak, "Expected '['");
		const dirs: AST.Directive[] = [];

		while (!this.check(TokenType.RBrak) && !this.isAtEnd()) {
			const loc = { line: this.peek().line, col: this.peek().col };

			if (this.check(TokenType.Identifier)) {
				const name = this.advance().value;

				if (name === 'N') {
					const count = parseInt(this.consume(TokenType.Number, "Expected number for N").value);
					dirs.push({ type: 'N', count, location: loc });
				} else if (name === 'B') {
					let dur = this.consume(TokenType.Number, "Expected number for B").value;
					if (this.match(TokenType.Dot)) dur += '.';
					dirs.push({ type: 'B', duration: dur, location: loc });
				} else if (name === 'K') {
					let acc: string | null = null;
					if (this.check(TokenType.Accidental)) acc = this.advance().value;
					const count = parseInt(this.consume(TokenType.Number, "Expected count for K").value);
					dirs.push({ type: 'K', accidental: acc, count, location: loc });
				} else if (name === 'T') {
					const bpm = parseInt(this.consume(TokenType.Number, "Expected bpm").value);
					dirs.push({ type: 'T', bpm, location: loc });
				} else if (name === 'O') {
					const oct = parseInt(this.consume(TokenType.Number, "Expected octave").value);
					dirs.push({ type: 'O', octave: oct, location: loc });
				} else if (name === 'I') {
					const inst = parseInt(this.consume(TokenType.Number, "Expected inst").value);
					dirs.push({ type: 'I', instrument: inst, location: loc });
				} else if (name === 'V') {
					const vol = parseInt(this.consume(TokenType.Number, "Expected vol").value);
					dirs.push({ type: 'V', level: vol, location: loc });
				}
			} else {
				// Skip unknown in brackets
				this.advance();
			}
		}
		this.consume(TokenType.RBrak, "Expected ']'");
		return dirs;
	}
}
