"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parser = void 0;
const token_js_1 = require("./token.js");
class Parser {
    tokens;
    pos = 0;
    constructor(tokens) {
        this.tokens = tokens;
    }
    // --- Helper Methods ---
    peek() {
        if (this.pos >= this.tokens.length)
            return this.tokens[this.tokens.length - 1];
        return this.tokens[this.pos];
    }
    peekNext() {
        if (this.pos + 1 >= this.tokens.length)
            return this.tokens[this.tokens.length - 1]; // EOF
        return this.tokens[this.pos + 1];
    }
    advance() {
        if (!this.isAtEnd()) {
            this.pos++;
        }
        return this.previous();
    }
    previous() {
        return this.tokens[this.pos - 1];
    }
    isAtEnd() {
        return this.peek().type === token_js_1.TokenType.EOF;
    }
    check(type) {
        if (this.isAtEnd())
            return false;
        return this.peek().type === type;
    }
    match(...types) {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }
    consume(type, message) {
        if (this.check(type))
            return this.advance();
        throw this.error(this.peek(), message);
    }
    error(token, message) {
        return new Error(`[Line ${token.line} Col ${token.col}] Error at '${token.value}': ${message}`);
    }
    skipNewlines() {
        while (this.match(token_js_1.TokenType.Newline))
            ;
    }
    // --- Parsing Rules ---
    parseScore() {
        const title = [];
        const blocks = [];
        while (!this.isAtEnd()) {
            if (this.check(token_js_1.TokenType.Newline)) {
                this.advance();
                if (title.length > 0 && this.check(token_js_1.TokenType.Newline)) {
                    // Double newline after title logic? Revisit title logic.
                }
                continue;
            }
            if (blocks.length === 0 && title.length === 0) {
                this.parseTitleParagraph(title);
                this.skipNewlines();
            }
            else {
                blocks.push(this.parseMusicBlock());
                this.skipNewlines();
            }
        }
        return { title, blocks };
    }
    parseTitleParagraph(titleList) {
        while (!this.isAtEnd()) {
            if (this.check(token_js_1.TokenType.Newline)) {
                if (this.peekNext().type === token_js_1.TokenType.Newline) {
                    this.advance();
                    return;
                }
                this.advance();
                continue;
            }
            let lineText = "";
            let startLine = this.peek().line;
            // Consume tokens line by line
            while (!this.check(token_js_1.TokenType.Newline) && !this.isAtEnd()) {
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
    parseMusicBlock() {
        const lyricLinesArr = [];
        const lyricDirectives = [];
        const lyricMeasures = [];
        let lyricSectionDone = false;
        // 1. Lyric Section
        while (!this.isAtEnd() && !lyricSectionDone) {
            if (this.check(token_js_1.TokenType.Newline)) {
                if (this.peekNext().type === token_js_1.TokenType.Newline)
                    break;
                this.skipNewlines();
                continue;
            }
            const physicalLine = this.parsePhysicalLyricLine();
            lyricMeasures.push(...physicalLine.measures);
            lyricDirectives.push(...physicalLine.directives);
            if (physicalLine.endedWithBarline) {
                lyricSectionDone = true;
            }
            if (this.check(token_js_1.TokenType.Newline))
                this.advance();
        }
        const lyricLine = {
            directives: lyricDirectives,
            measures: lyricMeasures,
            location: { line: lyricMeasures[0]?.location.line || 0, col: 0 }
        };
        // 2. Pitch Section
        const pitchMeasures = [];
        const pitchDirectives = [];
        while (!this.isAtEnd()) {
            if (this.check(token_js_1.TokenType.Newline)) {
                if (this.peekNext().type === token_js_1.TokenType.Newline)
                    break;
                this.advance();
                continue;
            }
            const pLine = this.parsePhysicalPitchLine();
            pitchMeasures.push(...pLine.measures);
            pitchDirectives.push(...pLine.directives);
            if (this.check(token_js_1.TokenType.Newline))
                this.advance();
        }
        const pitchLine = {
            directives: pitchDirectives,
            measures: pitchMeasures,
            location: { line: pitchMeasures[0]?.location.line || 0, col: 0 }
        };
        return { kind: 'MusicBlock', lyricLines: [lyricLine], pitchLines: [pitchLine] };
    }
    parsePhysicalLyricLine() {
        const directives = [];
        const measures = [];
        let currentBeats = [];
        let currentSubdivisions = [];
        let endedWithBarline = false;
        let prevEndCol = -1;
        const flushBeat = (locLine, locCol) => {
            if (currentSubdivisions.length > 0) {
                currentBeats.push({ elements: [...currentSubdivisions], location: { line: locLine, col: locCol } });
                currentSubdivisions = [];
            }
        };
        const flushMeasure = (hasBarline, locLine, locCol) => {
            flushBeat(locLine, locCol);
            if (currentBeats.length > 0 || hasBarline) {
                measures.push({ beats: [...currentBeats], barline: hasBarline, location: { line: locLine, col: locCol } });
                currentBeats = [];
            }
        };
        while (!this.check(token_js_1.TokenType.Newline) && !this.isAtEnd()) {
            const token = this.peek();
            // Check for new beat (whitespace)
            if (prevEndCol !== -1 && token.col > prevEndCol) {
                flushBeat(token.line, prevEndCol); // Use prev end as beat location? or current token start?
                // Current token starts new beat.
                // Flush previous beat.
            }
            if (token.type === token_js_1.TokenType.Barline) {
                this.advance();
                flushMeasure(true, token.line, token.col);
                endedWithBarline = true;
                prevEndCol = token.endCol;
                continue;
            }
            endedWithBarline = false; // Reset if we see content
            if (token.type === token_js_1.TokenType.LBrak) {
                const dirs = this.parseDirectives();
                if (measures.length === 0 && currentBeats.length === 0 && currentSubdivisions.length === 0) {
                    directives.push(...dirs);
                }
                else {
                    currentSubdivisions.push(...dirs);
                }
                prevEndCol = this.previous().endCol; // parseDirectives consumes ']'
                continue;
            }
            if (token.type === token_js_1.TokenType.Dot) {
                this.advance();
                prevEndCol = token.endCol;
                continue; // Just a separator
            }
            // Subdivisions
            const loc = { line: token.line, col: token.col };
            if (token.type === token_js_1.TokenType.Number) {
                // Number at start of beat? Tuple?
                // Or part of syllable text that Lexer didn't merge?
                // For now treat as text.
                const val = this.advance().value;
                currentSubdivisions.push({ type: 'Syllable', text: val, location: loc });
            }
            else if (token.type === token_js_1.TokenType.Identifier) {
                const val = this.advance().value;
                currentSubdivisions.push({ type: 'Syllable', text: val, location: loc });
            }
            else if (token.type === token_js_1.TokenType.Underscore) {
                this.advance();
                currentSubdivisions.push({ type: 'Rest', text: '_', location: loc }); // Using Rest type for now as 'Partial' is vague? 
                // AST has 'Rest' and 'Partial'?
                // LANGUAGE.md: _ is Silent Subdivision. ; is Rest.
                // Let's map _ to 'Space' or 'Partial' (Silent)? 
                // AST `SubdivisionType` had 'Partial'. I'll use that.
                // Wait, AST says `type: SubdivisionType`.
                // Let's use `text: '_'` and `type: 'Partial'`.
            }
            else if (token.type === token_js_1.TokenType.Hyphen) {
                this.advance();
                currentSubdivisions.push({ type: 'Hyphen', text: '-', location: loc });
            }
            else if (token.type === token_js_1.TokenType.Asterisk) {
                this.advance();
                currentSubdivisions.push({ type: 'Melisma', text: '*', location: loc });
            }
            else if (token.type === token_js_1.TokenType.Semicolon) {
                this.advance();
                currentSubdivisions.push({ type: 'Rest', text: ';', location: loc });
            }
            else if (token.type === token_js_1.TokenType.Equals) {
                this.advance();
                // = is shorthand for -- (2 subdivisions).
                // AST Should emit 2 Hyphens? Or one Equal?
                // LANGUAGE.md: "Shorthand for --. (therefore 2 subdivisions)".
                // Parser can expand it.
                currentSubdivisions.push({ type: 'Hyphen', text: '-', location: loc });
                currentSubdivisions.push({ type: 'Hyphen', text: '-', location: loc });
            }
            else {
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
    parsePhysicalPitchLine() {
        const directives = [];
        const measures = [];
        let currentElements = [];
        const flushMeasure = (hasBarline, line, col) => {
            if (currentElements.length > 0 || hasBarline) {
                measures.push({ elements: [...currentElements], barline: hasBarline, location: { line, col } });
                currentElements = [];
            }
        };
        while (!this.check(token_js_1.TokenType.Newline) && !this.isAtEnd()) {
            const token = this.peek();
            if (token.type === token_js_1.TokenType.Barline) {
                this.advance();
                flushMeasure(true, token.line, token.col);
                continue;
            }
            if (token.type === token_js_1.TokenType.LBrak) {
                const dirs = this.parseDirectives();
                if (measures.length === 0 && currentElements.length === 0) {
                    directives.push(...dirs);
                }
                else {
                    currentElements.push(...dirs);
                }
                continue;
            }
            // Pitch Elements: Pitch or Chord
            if (token.type === token_js_1.TokenType.LParen) {
                // Chord
                this.advance(); // (
                const chordPitches = [];
                const startLoc = { line: token.line, col: token.col };
                while (!this.check(token_js_1.TokenType.RParen) && !this.isAtEnd()) {
                    // Expect Pitch
                    const p = this.parsePitch();
                    if (p)
                        chordPitches.push(p);
                    else {
                        // Maybe space?
                        // If we skip unknown tokens strictly?
                        // or error?
                        // Assuming valid input for now.
                        this.advance();
                    }
                }
                this.consume(token_js_1.TokenType.RParen, "Expected ')'");
                currentElements.push({ kind: 'Chord', pitches: chordPitches, location: startLoc });
            }
            else {
                // Try Parse Pitch
                const p = this.parsePitch();
                if (p) {
                    currentElements.push(p);
                }
                else {
                    // Unknown? Skip to avoid infinite loop
                    this.advance();
                }
            }
        }
        flushMeasure(false, 0, 0);
        return { directives, measures };
    }
    parsePitch() {
        // OctaveShift* Accidental? Note
        let octaveShift = 0;
        let accidental = null;
        const startLoc = { line: this.peek().line, col: this.peek().col };
        // Consume Shifts
        while (this.check(token_js_1.TokenType.Caret) || this.check(token_js_1.TokenType.Slash)) {
            if (this.match(token_js_1.TokenType.Caret))
                octaveShift++;
            else if (this.match(token_js_1.TokenType.Slash))
                octaveShift--;
        }
        // Consume Accidental
        if (this.check(token_js_1.TokenType.Accidental)) {
            accidental = this.advance().value;
        }
        // Check Note
        if (this.check(token_js_1.TokenType.Identifier)) {
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
    parseDirectives() {
        this.consume(token_js_1.TokenType.LBrak, "Expected '['");
        const dirs = [];
        while (!this.check(token_js_1.TokenType.RBrak) && !this.isAtEnd()) {
            const loc = { line: this.peek().line, col: this.peek().col };
            if (this.check(token_js_1.TokenType.Identifier)) {
                const name = this.advance().value;
                if (name === 'N') {
                    const count = parseInt(this.consume(token_js_1.TokenType.Number, "Expected number for N").value);
                    dirs.push({ type: 'N', count, location: loc });
                }
                else if (name === 'B') {
                    let dur = this.consume(token_js_1.TokenType.Number, "Expected number for B").value;
                    if (this.match(token_js_1.TokenType.Dot))
                        dur += '.';
                    dirs.push({ type: 'B', duration: dur, location: loc });
                }
                else if (name === 'K') {
                    let acc = null;
                    if (this.check(token_js_1.TokenType.Accidental))
                        acc = this.advance().value;
                    const count = parseInt(this.consume(token_js_1.TokenType.Number, "Expected count for K").value);
                    dirs.push({ type: 'K', accidental: acc, count, location: loc });
                }
                else if (name === 'T') {
                    const bpm = parseInt(this.consume(token_js_1.TokenType.Number, "Expected bpm").value);
                    dirs.push({ type: 'T', bpm, location: loc });
                }
                else if (name === 'O') {
                    const oct = parseInt(this.consume(token_js_1.TokenType.Number, "Expected octave").value);
                    dirs.push({ type: 'O', octave: oct, location: loc });
                }
                else if (name === 'I') {
                    const inst = parseInt(this.consume(token_js_1.TokenType.Number, "Expected inst").value);
                    dirs.push({ type: 'I', instrument: inst, location: loc });
                }
                else if (name === 'V') {
                    const vol = parseInt(this.consume(token_js_1.TokenType.Number, "Expected vol").value);
                    dirs.push({ type: 'V', level: vol, location: loc });
                }
            }
            else {
                // Skip unknown in brackets
                this.advance();
            }
        }
        this.consume(token_js_1.TokenType.RBrak, "Expected ']'");
        return dirs;
    }
}
exports.Parser = Parser;
