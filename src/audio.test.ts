
import { AudioGenerator } from './audio.js';
import * as AST from './ast.js';
import { MidiEvent } from './midi-writer.js';

// Helper to create AST manually (since we don't assume parser available here for minimal test,
// although we could copy parser but that adds deps. Let's construct a simple AST.)

function createTestScore(): AST.Score {
	/*
	[T120 B4] * ; * ; |  * - - -  |
	[K0 O4] c  d  |  c  |
	*/

	const block: AST.MusicBlock = {
		kind: 'MusicBlock',
		lyricLines: [{
			location: { line: 1, col: 1 },
			directives: [],
			measures: [
				{ // Measure 1: "* ; * ; |"
					location: { line: 1, col: 1 },
					beats: [
						{ // Beat 1: "*"
							location: { line: 1, col: 1 },
							elements: [
								{ type: 'T', bpm: 120, location: { line: 0, col: 0 } } as AST.TempoDirective,
								{ type: 'B', duration: '4', location: { line: 0, col: 0 } } as AST.BeatDurationDirective,
								{ type: 'Melisma', text: '*', location: { line: 0, col: 0 } } as AST.Subdivision,
							]
						},
						{ // Beat 2: ";"
							location: { line: 1, col: 1 },
							elements: [
								{ type: 'Rest', text: ';', location: { line: 0, col: 0 } } as AST.Subdivision,
							]
						},
						{ // Beat 3: "*"
							location: { line: 1, col: 1 },
							elements: [
								{ type: 'Melisma', text: '*', location: { line: 0, col: 0 } } as AST.Subdivision,
							]
						},
						{ // Beat 4: ";"
							location: { line: 1, col: 1 },
							elements: [
								{ type: 'Rest', text: ';', location: { line: 0, col: 0 } } as AST.Subdivision,
							]
						}
					],
					barline: true
				},
				{ // Measure 2: "* - - -" (4 Beats)
					location: { line: 1, col: 1 },
					beats: [
						{ // Beat 1: "*"
							location: { line: 1, col: 1 },
							elements: [{ type: 'Melisma', text: '*', location: { line: 0, col: 0 } } as AST.Subdivision]
						},
						{ // Beat 2: "-"
							location: { line: 1, col: 1 },
							elements: [{ type: 'Hyphen', text: '-', location: { line: 0, col: 0 } } as AST.Subdivision]
						},
						{ // Beat 3: "-"
							location: { line: 1, col: 1 },
							elements: [{ type: 'Hyphen', text: '-', location: { line: 0, col: 0 } } as AST.Subdivision]
						},
						{ // Beat 4: "-"
							location: { line: 1, col: 1 },
							elements: [{ type: 'Hyphen', text: '-', location: { line: 0, col: 0 } } as AST.Subdivision]
						}
					],
					barline: true
				}
			]
		}],
		pitchLines: [{
			location: { line: 2, col: 1 },
			directives: [
				{ type: 'K', accidental: null, count: 0, location: { line: 0, col: 0 } } as AST.KeySigDirective,
				{ type: 'O', octave: 4, location: { line: 0, col: 0 } } as AST.PriorOctaveDirective
			],
			measures: [
				{
					location: { line: 2, col: 1 },
					elements: [
						{ kind: 'Pitch', note: 'c', accidental: null, octaveShift: 0, location: { line: 0, col: 0 } } as AST.Pitch,
						{ kind: 'Pitch', note: 'd', accidental: null, octaveShift: 0, location: { line: 0, col: 0 } } as AST.Pitch
					],
					barline: true
				},
				{
					location: { line: 2, col: 1 },
					elements: [
						{ kind: 'Pitch', note: 'c', accidental: null, octaveShift: 0, location: { line: 0, col: 0 } } as AST.Pitch
					],
					barline: true
				}
			]
		}]
	};

	return {
		title: [],
		blocks: [block]
	};
}

// Run Test
const generator = new AudioGenerator();
const score = createTestScore();
const events = generator.generateEvents(score);

// Verification Logic
console.log("=== Generated MIDI Events ===");

// 0. Meta Tempo & Program Change
// 1. Note ON C4 (60)
// 2. Note OFF C4
// 3. Note ON D4 (62)
// 4. Note OFF D4
// 5. Note ON C4 (60)
// ...

function checkEvent(index: number, evt: MidiEvent, expected: Partial<MidiEvent>) {
	let failed = false;
	if (expected.type && evt.type !== expected.type) failed = true;
	if (expected.deltaTime !== undefined && Math.abs(evt.deltaTime - expected.deltaTime) > 1) failed = true; // Allow small rounding diff?
	if (expected.param1 !== undefined && evt.param1 !== expected.param1) failed = true;

	if (failed) {
		console.error(`Event ${index} FAIL:`, evt, "Expected:", expected);
	} else {
		console.log(`Event ${index} PASS: ${evt.type} dt=${evt.deltaTime} p1=${evt.param1}`);
	}
}

// Check sequence
let i = 0;
// i=0: Tempo (deltaTime 0)
checkEvent(i++, events[0], { type: 'meta', deltaTime: 0 }); // 0x51
// i=1: Program Change (deltaTime 0)
checkEvent(i++, events[1], { type: 'programChange', deltaTime: 0 });
// i=2: Tempo Update (Redundant T120? Or B4?)
// Logic processes directives *before* beat. 
// T120 update -> Meta
// B4 update -> Meta (maybe)
// The loop calls `updateTempo` for T and B.
// So we expect 2 meta events?
// Or maybe less if we optimized.
// Let's iterate and just look for Note ON/OFF.

let noteEvents: MidiEvent[] = events.filter(e => e.type === 'noteOn' || e.type === 'noteOff');

console.log(`\nFound ${noteEvents.length} Note Events.`);
noteEvents.forEach((e, idx) => {
	console.log(`Note Event ${idx}: ${e.type} dt=${e.deltaTime} note=${e.param1} vel=${e.param2}`);
});

import { writeFileSync } from 'node:fs';
const bytes = generator.generateMidi(score);
writeFileSync('test.mid', bytes);
console.log('Wrote test.mid');


// So:
// T=0: Note ON C4.
// T=240: Note OFF C4.
// T=480: Note ON D4. (Start of Beat 2)
// T=720: Note OFF D4.
// T=960: Note ON C4 (Start of Measure 2)
// Measure 2: "* - - -" (1 Beat, 4 Subdiv? No. 4 Subdivs, but Total Duration?)
// Wait, my manual AST creation for Measure 2 beat 1 has 4 Subdivisions (* - - -).
// Beat Multiplier 1 (B4). 480 Ticks total for beat?
// NO. AST Prefix?
// If no prefix, it's 1 beat.
// 4 subdivisions -> each is 1/4 beat.
// 1/4 beat = 120 ticks.
// So Note ON C4. Duration 480 ticks?
// Wait, the user test case: "* - - -" for Measure 2.
// User said: "MIDI 60 for 2 seconds." (Full measure? Wait).
// User text: `* - - -`.
// If `B4` (1 beat = 1 QN).
// Is `* - - -` 1 Beat or 4 Beats?
// User said: `[T120 B4] ... | * - - - |`
// If `* - - -` is inside ONE beat (no whitespace), it is 1 beat subdivided by 4.
// IF `* - - -` are separate beats (separated by whitespace), they are 4 beats.
// User wrote `* - - -`. Spaces usually imply beats.
// My parser AST construction for Measure 2 put them all in ONE beat.
// "Example 2: ... * * * |"
// "Beat Separators: whitespace separates beats."
// So `* - - -` with spaces means:
// Beat 1: `*`
// Beat 2: `-`
// Beat 3: `-`
// Beat 4: `-`
// Ah! My AST mock is WRONG. I put them in one beat.
// I should structure Measure 2 as 4 Beats.

// Correction for AST Mock Measure 2:
/*
measures: [{
	beats: [
		{ elements: [{type:'Melisma', text:'*', ...}] }, // Beat 1
		{ elements: [{type:'Hyphen', text:'-', ...}] },  // Beat 2
		{ elements: [{type:'Hyphen', text:'-', ...}] },  // Beat 3
		{ elements: [{type:'Hyphen', text:'-', ...}] },  // Beat 4
	]
}]
*/
// Then Ticks:
// Beat 1: Note ON. Duration 480.
// Beat 2: Hyphen -> No Pitch Consume. No Note Off (Extension). Duration 480.
// Beat 3: Hyphen. Duration 480.
// Beat 4: Hyphen. Duration 480.
// Total Duration = 4 * 480 = 1920 Ticks. (4 beats).
// At 120 BPM, 1 QN = 0.5s. 4 QN = 2.0s. Matches user expectation.

// Correcting AST Mock in this file before saving...

// (I will write the corrected AST in the tool call)

