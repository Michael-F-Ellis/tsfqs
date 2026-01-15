
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { LayoutEngine } from './layout.js';
import { Renderer } from './renderer.js';
import * as fs from 'fs';

function runTest(name: string, input: string) {
	console.log(`Running Layout Test: ${name}`);
	try {
		const lexer = new Lexer(input);
		const parser = new Parser(lexer.getAllTokens());
		const score = parser.parseScore();

		const layoutEngine = new LayoutEngine();
		const layout = layoutEngine.layoutScore(score);

		const renderer = new Renderer();
		const svgHtml = renderer.renderScore(layout);

		return `<h2>${name}</h2><pre>${input}</pre>${svgHtml}<hr/>`;
	} catch (e) {
		console.error(`Error in ${name}:`, e);
		return `<h2>${name}</h2><pre>${input}</pre><div style="color:red">Error: ${e}</div><hr/>`;
	}
}

const tests = [
	{
		name: "Test 1: Simple Scale",
		input: `Title: Simple Scale
        
        Do Re Mi Fa | So La Ti Do |
        [K0] c d e f | g a b c |`
	},
	{
		name: "Test 2: Chords & Shifts",
		input: `Title: Chords
        
        Chord | High |
        [K0] (ceg) | ^c |`
	},
	{
		name: "Test 3: Directives (Tempo, Key, Octave)",
		input: `Title: Directives
        
        [T120] Key Change | Octave Change |
        [K#1] f g | [O5] c d |`
	},
	{
		name: "Test 4: Layout Example 2 (Complex)",
		input: `Title: Solfege
        
        Do-Di Re.Ri- Mi.Fa.Fi | So.Si.La Li.Ti.Do ; |
        [K0] c#cd #def #f | g #g a #a b c |
        
        Do** La** | 2Se**Me** | Do ; ; |
        [K0] ^cb&b a&ag |  &gfe &ed&d | c |`
	},
	{
		name: "Test 5: Separators",
		input: `Title: Separators
        
        Dot (Space): Hap.py | Comma (Connect): Hap,py |
        [K0] c c | c c |`
	},
	{
		name: "Test 6: Key Color",
		input: `Title: Key Color
        
        Fa |
        [K#1] f |`
	},
	{
		name: "Test 7: Pickup Count",
		input: `Title: Pickup
        
        [N3] Hap | py - |
        [K0] c | c - |`
	}
];

let fullHtml = `<html><body style="font-family: sans-serif; padding: 20px;"><h1>Layout Verification</h1>`;

tests.forEach(t => {
	fullHtml += runTest(t.name, t.input);
});

fullHtml += '</body></html>';

fs.writeFileSync('layout_verify.html', fullHtml);
console.log("Written layout_verify.html");
