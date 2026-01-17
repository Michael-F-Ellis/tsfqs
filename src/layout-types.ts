export type CommandType = 'text' | 'line' | 'rect' | 'circle';

export interface RenderCommand {
	type: CommandType;
	x: number;
	y: number;
	color?: string;
	font?: string;
	text?: string;
	anchor?: string; // 'start', 'middle', 'end'
	// For lines
	x2?: number;
	y2?: number;
	stroke?: string;
	strokeWidth?: number;
	// For rects (if needed for debug or boxes)
	width?: number;
	height?: number;
	fill?: string;
	// For circles
	r?: number;
	attributes?: Record<string, string>;
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


