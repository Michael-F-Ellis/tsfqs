import { Lexer } from './lexer.js';
import { TokenType } from './token.js';

function runLexerTests() {
	console.log("Running Lexer Tests...");

	// Test 1: Basic Symbols
	const input1 = "[N3] Hap.py |";
	const lexer1 = new Lexer(input1);
	const tokens1 = lexer1.getAllTokens();

	const expectedTypes1 = [
		TokenType.LBrak, TokenType.Identifier, TokenType.Number, TokenType.RBrak,
		TokenType.Identifier, TokenType.Dot, TokenType.Identifier,
		TokenType.Barline, TokenType.EOF
	];

	if (tokens1.length !== expectedTypes1.length) {
		console.error(`Test 1 Failed: Expected ${expectedTypes1.length} tokens, got ${tokens1.length}`);
	} else {
		let pass = true;
		for (let i = 0; i < tokens1.length; i++) {
			if (tokens1[i].type !== expectedTypes1[i]) {
				console.error(`Test 1 Failed at index ${i}: Expected ${expectedTypes1[i]}, got ${tokens1[i].type}`);
				pass = false;
			}
		}
		if (pass) console.log("Test 1 Passed");
	}

	// Test 2: Pitch Line Symbols
	const input2 = "K&1 ^c /g #f";
	const lexer2 = new Lexer(input2);
	const tokens2 = lexer2.getAllTokens();

	const expectedTypes2 = [
		TokenType.Identifier, TokenType.Accidental, TokenType.Number,
		TokenType.Caret, TokenType.Identifier,
		TokenType.Slash, TokenType.Identifier,
		TokenType.Accidental, TokenType.Identifier,
		TokenType.EOF
	];

	if (tokens2.length !== expectedTypes2.length) {
		console.error(`Test 2 Failed: Expected ${expectedTypes2.length} tokens, got ${tokens2.length}`);
	} else {
		let pass = true;
		for (let i = 0; i < tokens2.length; i++) {
			if (tokens2[i].type !== expectedTypes2[i]) {
				console.error(`Test 2 Failed at index ${i}: Expected ${expectedTypes2[i]}, got ${tokens2[i].type}`);
				pass = false;
			}
		}
		if (pass) console.log("Test 2 Passed");
	}
}

runLexerTests();
