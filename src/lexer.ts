import { Token, TokenType } from './token.js';

export class Lexer {
	private input: string;
	private pos: number = 0;
	private line: number = 1;
	private col: number = 1;

	constructor(input: string) {
		this.input = input.replace(/\r\n/g, '\n'); // Normalize newlines
	}

	private peek(): string | null {
		return this.pos < this.input.length ? this.input[this.pos] : null;
	}

	private peekNext(): string | null {
		return this.pos + 1 < this.input.length ? this.input[this.pos + 1] : null;
	}

	private advance(): string {
		const char = this.input[this.pos++];
		if (char === '\n') {
			this.line++;
			this.col = 1;
		} else {
			this.col++;
		}
		return char;
	}

	public getAllTokens(): Token[] {
		const tokens: Token[] = [];
		let token = this.nextToken();
		while (token.type !== TokenType.EOF) {
			tokens.push(token);
			token = this.nextToken();
		}
		tokens.push(token); // Push EOF
		return tokens;
	}

	public nextToken(): Token {
		this.skipWhitespace();

		const char = this.peek();
		const startLine = this.line;
		const startCol = this.col;

		if (char === null) {
			return { type: TokenType.EOF, value: '', line: startLine, col: startCol, endCol: startCol };
		}

		// Newline
		if (char === '\n') {
			this.advance();
			return { type: TokenType.Newline, value: '\n', line: startLine, col: startCol, endCol: startCol + 1 };
		}

		// Symbols
		switch (char) {
			case '|': this.advance(); return { type: TokenType.Barline, value: '|', line: startLine, col: startCol, endCol: startCol + 1 };
			case '[': this.advance(); return { type: TokenType.LBrak, value: '[', line: startLine, col: startCol, endCol: startCol + 1 };
			case ']': this.advance(); return { type: TokenType.RBrak, value: ']', line: startLine, col: startCol, endCol: startCol + 1 };
			case '(': this.advance(); return { type: TokenType.LParen, value: '(', line: startLine, col: startCol, endCol: startCol + 1 };
			case ')': this.advance(); return { type: TokenType.RParen, value: ')', line: startLine, col: startCol, endCol: startCol + 1 };
			case '.': this.advance(); return { type: TokenType.Dot, value: '.', line: startLine, col: startCol, endCol: startCol + 1 };
			case '-': this.advance(); return { type: TokenType.Hyphen, value: '-', line: startLine, col: startCol, endCol: startCol + 1 };
			case '_': this.advance(); return { type: TokenType.Underscore, value: '_', line: startLine, col: startCol, endCol: startCol + 1 };
			case '*': this.advance(); return { type: TokenType.Asterisk, value: '*', line: startLine, col: startCol, endCol: startCol + 1 };
			case '^': this.advance(); return { type: TokenType.Caret, value: '^', line: startLine, col: startCol, endCol: startCol + 1 };
			case '/': this.advance(); return { type: TokenType.Slash, value: '/', line: startLine, col: startCol, endCol: startCol + 1 };
			case ';': this.advance(); return { type: TokenType.Semicolon, value: ';', line: startLine, col: startCol, endCol: startCol + 1 };
			case '=': this.advance(); return { type: TokenType.Equals, value: '=', line: startLine, col: startCol, endCol: startCol + 1 };
			case ':': this.advance(); return { type: TokenType.Colon, value: ':', line: startLine, col: startCol, endCol: startCol + 1 };
			case '%': this.advance(); return { type: TokenType.Accidental, value: '%', line: startLine, col: startCol, endCol: startCol + 1 };

			// Accidentals that can be double (#, ##, &, &&)
			case '#': {
				this.advance();
				if (this.peek() === '#') {
					this.advance();
					return { type: TokenType.Accidental, value: '##', line: startLine, col: startCol, endCol: startCol + 2 };
				}
				return { type: TokenType.Accidental, value: '#', line: startLine, col: startCol, endCol: startCol + 1 };
			}
			case '&': {
				this.advance();
				if (this.peek() === '&') {
					this.advance();
					return { type: TokenType.Accidental, value: '&&', line: startLine, col: startCol, endCol: startCol + 2 };
				}
				return { type: TokenType.Accidental, value: '&', line: startLine, col: startCol, endCol: startCol + 1 };
			}
		}

		// Numbers
		if (/[0-9]/.test(char)) {
			let value = '';
			while (this.peek() !== null && /[0-9]/.test(this.peek()!)) {
				value += this.advance();
			}
			return { type: TokenType.Number, value, line: startLine, col: startCol, endCol: this.col };
		}

		// Identifiers: Consume anything that is NOT a symbol, digit, or whitespace.
		let value = '';
		while (this.peek() !== null) {
			const c = this.peek()!;
			if (/[0-9 \t\r\n]/.test(c)) break; // Digit or whitespace
			if (/[|\[\]().\-_*^/;=:%#&]/.test(c)) break; // Symbol
			if (c === ':') break; // Colon

			value += this.advance();
		}

		if (value.length > 0) {
			return { type: TokenType.Identifier, value, line: startLine, col: startCol, endCol: this.col };
		}

		throw new Error(`Unexpected parser state at line ${startLine} col ${startCol}: char '${this.peek()}'`);
	}

	private skipWhitespace() {
		while (this.peek() === ' ' || this.peek() === '\t' || this.peek() === '\r') {
			this.advance();
		}
	}
}
