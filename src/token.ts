export enum TokenType {
	Identifier = 'Identifier',
	Number = 'Number',
	String = 'String',
	Barline = 'Barline',
	LBrak = 'LBrak',
	RBrak = 'RBrak',
	LParen = 'LParen',
	RParen = 'RParen',
	Dot = 'Dot',
	Comma = 'Comma',
	Hyphen = 'Hyphen',
	Underscore = 'Underscore',
	Asterisk = 'Asterisk',
	Caret = 'Caret',
	Slash = 'Slash',
	Accidental = 'Accidental',
	Colon = 'Colon',
	Semicolon = 'Semicolon',
	Equals = 'Equals',
	Newline = 'Newline',
	EOF = 'EOF'
}

export interface Token {
	type: TokenType;
	value: string;
	line: number;
	col: number; // Start col
	endCol: number; // End col (exclusive). Used to detect whitespace gaps.
}
