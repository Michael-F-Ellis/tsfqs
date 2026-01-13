export type CommandType = 'text' | 'line' | 'rect';

export interface RenderCommand {
	type: CommandType;
	x: number;
	y: number;
	color?: string;
	font?: string;
	text?: string;
	// For lines
	x2?: number;
	y2?: number;
	stroke?: string;
	strokeWidth?: number;
	// For rects (if needed for debug or boxes)
	width?: number;
	height?: number;
	fill?: string;
}

export interface BlockLayout {
	commands: RenderCommand[];
	width: number;
	height: number;
	// Debug info?
}

export interface ScoreLayout {
	title: RenderCommand[]; // Title commands
	blocks: BlockLayout[];
}

export const LAYOUT_CONSTANTS = {
	FONT_WIDTH: 12,
	FONT_HEIGHT: 20,
	STAFF_LINE_SPACING: 35, // Distance between octave lines (G to G)
	BASE_MARGIN: 50,
};
