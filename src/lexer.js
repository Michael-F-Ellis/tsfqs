"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Lexer = void 0;
const token_js_1 = require("./token.js");
class Lexer {
    input;
    pos = 0;
    line = 1;
    col = 1;
    constructor(input) {
        this.input = input.replace(/\r\n/g, '\n'); // Normalize newlines
    }
    peek() {
        return this.pos < this.input.length ? this.input[this.pos] : null;
    }
    peekNext() {
        return this.pos + 1 < this.input.length ? this.input[this.pos + 1] : null;
    }
    advance() {
        const char = this.input[this.pos++];
        if (char === '\n') {
            this.line++;
            this.col = 1;
        }
        else {
            this.col++;
        }
        return char;
    }
    getAllTokens() {
        const tokens = [];
        let token = this.nextToken();
        while (token.type !== token_js_1.TokenType.EOF) {
            tokens.push(token);
            token = this.nextToken();
        }
        tokens.push(token); // Push EOF
        return tokens;
    }
    nextToken() {
        this.skipWhitespace();
        const char = this.peek();
        const startLine = this.line;
        const startCol = this.col;
        if (char === null) {
            return { type: token_js_1.TokenType.EOF, value: '', line: startLine, col: startCol, endCol: startCol };
        }
        // Newline
        if (char === '\n') {
            this.advance();
            return { type: token_js_1.TokenType.Newline, value: '\n', line: startLine, col: startCol, endCol: startCol + 1 };
        }
        // Symbols
        switch (char) {
            case '|':
                this.advance();
                return { type: token_js_1.TokenType.Barline, value: '|', line: startLine, col: startCol, endCol: startCol + 1 };
            case '[':
                this.advance();
                return { type: token_js_1.TokenType.LBrak, value: '[', line: startLine, col: startCol, endCol: startCol + 1 };
            case ']':
                this.advance();
                return { type: token_js_1.TokenType.RBrak, value: ']', line: startLine, col: startCol, endCol: startCol + 1 };
            case '(':
                this.advance();
                return { type: token_js_1.TokenType.LParen, value: '(', line: startLine, col: startCol, endCol: startCol + 1 };
            case ')':
                this.advance();
                return { type: token_js_1.TokenType.RParen, value: ')', line: startLine, col: startCol, endCol: startCol + 1 };
            case '.':
                this.advance();
                return { type: token_js_1.TokenType.Dot, value: '.', line: startLine, col: startCol, endCol: startCol + 1 };
            case '-':
                this.advance();
                return { type: token_js_1.TokenType.Hyphen, value: '-', line: startLine, col: startCol, endCol: startCol + 1 };
            case '_':
                this.advance();
                return { type: token_js_1.TokenType.Underscore, value: '_', line: startLine, col: startCol, endCol: startCol + 1 };
            case '*':
                this.advance();
                return { type: token_js_1.TokenType.Asterisk, value: '*', line: startLine, col: startCol, endCol: startCol + 1 };
            case '^':
                this.advance();
                return { type: token_js_1.TokenType.Caret, value: '^', line: startLine, col: startCol, endCol: startCol + 1 };
            case '/':
                this.advance();
                return { type: token_js_1.TokenType.Slash, value: '/', line: startLine, col: startCol, endCol: startCol + 1 };
            case ';':
                this.advance();
                return { type: token_js_1.TokenType.Semicolon, value: ';', line: startLine, col: startCol, endCol: startCol + 1 };
            case '=':
                this.advance();
                return { type: token_js_1.TokenType.Equals, value: '=', line: startLine, col: startCol, endCol: startCol + 1 };
            case ':':
                this.advance();
                return { type: token_js_1.TokenType.Colon, value: ':', line: startLine, col: startCol, endCol: startCol + 1 };
            case '%':
                this.advance();
                return { type: token_js_1.TokenType.Accidental, value: '%', line: startLine, col: startCol, endCol: startCol + 1 };
            // Accidentals that can be double (#, ##, &, &&)
            case '#': {
                this.advance();
                if (this.peek() === '#') {
                    this.advance();
                    return { type: token_js_1.TokenType.Accidental, value: '##', line: startLine, col: startCol, endCol: startCol + 2 };
                }
                return { type: token_js_1.TokenType.Accidental, value: '#', line: startLine, col: startCol, endCol: startCol + 1 };
            }
            case '&': {
                this.advance();
                if (this.peek() === '&') {
                    this.advance();
                    return { type: token_js_1.TokenType.Accidental, value: '&&', line: startLine, col: startCol, endCol: startCol + 2 };
                }
                return { type: token_js_1.TokenType.Accidental, value: '&', line: startLine, col: startCol, endCol: startCol + 1 };
            }
        }
        // Numbers
        if (/[0-9]/.test(char)) {
            let value = '';
            while (this.peek() !== null && /[0-9]/.test(this.peek())) {
                value += this.advance();
            }
            return { type: token_js_1.TokenType.Number, value, line: startLine, col: startCol, endCol: this.col };
        }
        // Identifiers: Consume anything that is NOT a symbol, digit, or whitespace.
        let value = '';
        while (this.peek() !== null) {
            const c = this.peek();
            if (/[0-9 \t\r\n]/.test(c))
                break; // Digit or whitespace
            if (/[|\[\]().\-_*^/;=:%#&]/.test(c))
                break; // Symbol
            if (c === ':')
                break; // Colon
            value += this.advance();
        }
        if (value.length > 0) {
            return { type: token_js_1.TokenType.Identifier, value, line: startLine, col: startCol, endCol: this.col };
        }
        throw new Error(`Unexpected parser state at line ${startLine} col ${startCol}: char '${this.peek()}'`);
    }
    skipWhitespace() {
        while (this.peek() === ' ' || this.peek() === '\t' || this.peek() === '\r') {
            this.advance();
        }
    }
}
exports.Lexer = Lexer;
