
// Minimal MIDI Writer (Type 2 / Type 0/1 support)
// "Small is beautiful"

export interface MidiEvent {
	deltaTime: number; // Ticks
	type: 'noteOn' | 'noteOff' | 'meta' | 'controller' | 'programChange';
	channel?: number;
	param1?: number; // Note, Controller Number
	param2?: number; // Velocity, Value
	metaType?: number;
	metaData?: number[];
}

export interface MidiTrack {
	events: MidiEvent[];
}

export function writeMidiFile(tracks: MidiTrack[], ppq: number = 480): Uint8Array {
	const parts: number[] = [];

	// Header Chunk
	// MThd
	writeString(parts, 'MThd');
	writeU32(parts, 6); // Length
	const format = tracks.length > 1 ? 1 : 0;
	writeU16(parts, format);
	writeU16(parts, tracks.length);
	writeU16(parts, ppq);

	// Track Chunks
	tracks.forEach(track => {
		writeTrack(parts, track);
	});

	return new Uint8Array(parts);
}

function writeTrack(parts: number[], track: MidiTrack) {
	writeString(parts, 'MTrk');

	// Placeholder for length
	const lengthPos = parts.length;
	writeU32(parts, 0);
	const startPos = parts.length;

	let runningStatus: number | null = null;

	track.events.forEach(event => {
		writeVarInt(parts, event.deltaTime);

		if (event.type === 'meta') {
			runningStatus = null; // Meta events reset running status
			parts.push(0xFF);
			parts.push(event.metaType!);
			writeVarInt(parts, event.metaData!.length);
			parts.push(...event.metaData!);
		} else {
			// Channel Voice Messages
			let status = 0;
			if (event.type === 'noteOff') status = 0x80;
			else if (event.type === 'noteOn') status = 0x90;
			else if (event.type === 'controller') status = 0xB0;
			else if (event.type === 'programChange') status = 0xC0;

			status |= (event.channel || 0);

			if (status !== runningStatus) {
				parts.push(status);
				runningStatus = status;
			}

			if (event.param1 !== undefined) parts.push(event.param1);
			if (event.param2 !== undefined) parts.push(event.param2);
		}
	});

	// End of Track Meta Event
	writeVarInt(parts, 0); // Delta 0
	parts.push(0xFF, 0x2F, 0x00);

	// Patch Length
	const endPos = parts.length;
	const length = endPos - startPos;

	// Rewind and write length
	// (Simulated by modifying array indices - helper needed?)
	// Javascript arrays are mutable.

	parts[lengthPos] = (length >> 24) & 0xFF;
	parts[lengthPos + 1] = (length >> 16) & 0xFF;
	parts[lengthPos + 2] = (length >> 8) & 0xFF;
	parts[lengthPos + 3] = length & 0xFF;
}

// Helpers

function writeString(parts: number[], str: string) {
	for (let i = 0; i < str.length; i++) {
		parts.push(str.charCodeAt(i));
	}
}

function writeU32(parts: number[], val: number) {
	parts.push((val >> 24) & 0xFF);
	parts.push((val >> 16) & 0xFF);
	parts.push((val >> 8) & 0xFF);
	parts.push(val & 0xFF);
}

function writeU16(parts: number[], val: number) {
	parts.push((val >> 8) & 0xFF);
	parts.push(val & 0xFF);
}

function writeVarInt(parts: number[], val: number) {
	let buffer = val & 0x7F;
	while ((val >>= 7)) {
		buffer <<= 8;
		buffer |= ((val & 0x7F) | 0x80);
	}

	while (true) {
		parts.push(buffer & 0xFF);
		if (buffer & 0x80) buffer >>= 8;
		else break;
	}
}
