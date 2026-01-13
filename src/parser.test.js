"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lexer_js_1 = require("./lexer.js");
const parser_js_1 = require("./parser.js");
function runParserTests() {
    console.log("Running Parser Tests...");
    // Test 1: Basic Structure
    const input1 = `Title Line
  
  [N3] Hap.py |
  [K0] c ^c |`;
    const lexer1 = new lexer_js_1.Lexer(input1);
    const parser1 = new parser_js_1.Parser(lexer1.getAllTokens());
    const score1 = parser1.parseScore();
    if (score1.title[0] !== 'Title Line')
        console.error('Test 1 Failed: Title mismatch');
    if (score1.blocks.length !== 1)
        console.error('Test 1 Failed: Block count mismatch');
    const block1 = score1.blocks[0];
    const lLine = block1.lyricLines[0];
    const pLine = block1.pitchLines[0];
    if (lLine.directives.length !== 1 || lLine.directives[0].type !== 'N' || lLine.directives[0].count !== 3) {
        console.error('Test 1 Failed: Lyric Directives mismatch');
    }
    if (lLine.measures.length !== 1)
        console.error('Test 1 Failed: Measure count mismatch');
    const beat1 = lLine.measures[0].beats[0];
    if (beat1.elements.length !== 2) {
        console.error(`Test 1 Failed: Beat element count mismatch. Got ${beat1.elements.length}`);
    }
    if (beat1.elements[0].text !== 'Hap')
        console.error('Test 1 Failed: Syllable 1 mismatch');
    if (pLine.directives.length !== 1)
        console.error('Test 1 Failed: Pitch Directive count mismatch');
    if (pLine.directives[0].type !== 'K')
        console.error('Test 1 Failed: Pitch Directive type mismatch');
    const pMeas = pLine.measures[0];
    if (pMeas.elements.length !== 2)
        console.error('Test 1 Failed: Pitch Elements count mismatch');
    const p1 = pMeas.elements[0];
    const p2 = pMeas.elements[1];
    if (p1.note !== 'c')
        console.error('Test 1 Failed: Pitch 1 note mismatch');
    if (p2.note !== 'c' || p2.octaveShift !== 1)
        console.error('Test 1 Failed: Pitch 2 mismatch');
    console.log("Test 1 Completed");
    // Test 2: Multi-line Lyrics
    const input2 = `Title
  
  Line 1
  Line 2 |
  [K0] c d |
  e f |
  `;
    const parser2 = new parser_js_1.Parser(new lexer_js_1.Lexer(input2).getAllTokens());
    const score2 = parser2.parseScore();
    const blk = score2.blocks[0];
    if (blk.lyricLines.length !== 1)
        console.error('Test 2 Failed: Lyric Lines count');
    if (blk.lyricLines[0].measures.length !== 2)
        console.error(`Test 2 Failed: Lyric Measure count. Got ${blk.lyricLines[0].measures.length}`);
    if (blk.pitchLines[0].measures.length !== 2)
        console.error('Test 2 Failed: Pitch Measure count');
    console.log("Test 2 Completed");
}
runParserTests();
// Test 3: Invalid Directives
console.log("Test 3: Invalid Directives (expecting error)");
const input3 = `Title
  
  [K0] Line 1 |
  `;
const parser3 = new parser_js_1.Parser(new lexer_js_1.Lexer(input3).getAllTokens());
try {
    parser3.parseScore();
    console.error("Test 3 Failed: Expected error for K in lyric line");
}
catch (e) {
    if (e.message.includes("Directive 'K' is not allowed")) {
        console.log("Test 3 Passed: Caught expected error for K in lyric line");
    }
    else {
        console.error(`Test 3 Failed: Unexpected error message: ${e.message}`);
    }
}
const input4 = `Title
  
  valid lyrics |
  [N3] c d |
  `;
const parser4 = new parser_js_1.Parser(new lexer_js_1.Lexer(input4).getAllTokens());
try {
    parser4.parseScore();
    console.error("Test 3 Failed: Expected error for N in pitch line");
}
catch (e) {
    if (e.message.includes("Directive 'N' is not allowed")) {
        console.log("Test 3 Passed: Caught expected error for N in pitch line");
    }
    else {
        console.error(`Test 3 Failed: Unexpected error message: ${e.message}`);
    }
}
