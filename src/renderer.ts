import { ScoreLayout, BlockLayout, RenderCommand } from './layout-types.js';

export class Renderer {

	public renderScore(layout: ScoreLayout): string {
		let html = '<div class="fqs-score">';

		// Render Title
		// For simplicity, render title as a separate SVG or just a div?
		// Let's use an SVG for the title to verify coordinates working
		// Or render title commands inside the first block?
		// The layout engine returns title commands strictly?
		// "title: RenderCommand[]".
		// Let's make an SVG just for the title if it exists.
		if (layout.title.length > 0) {
			// Extract text from commands (assuming simple text commands for title)
			const titleLines = layout.title.filter(c => c.type === 'text').map(c => c.text);
			if (titleLines.length > 0) {
				html += `<div style="text-align: center; font-family: monospace; font-weight: bold; font-size: 24px; margin-bottom: 20px;">
					${titleLines.join('<br>')}
				</div>`;
			}
		}

		// Render Blocks
		layout.blocks.forEach(block => {
			// Wrap each block in a div/svg
			html += this.renderBlock(block);
		});

		html += '</div>';
		return html;
	}

	private renderBlock(block: BlockLayout): string {
		return this.renderSVG(block.commands, block.width, block.height);
	}

	private renderSVG(commands: RenderCommand[], width: number, height: number): string {
		// Add padding
		const w = Math.max(width, 100);
		const h = Math.max(height, 50);

		let svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" style="margin-bottom: 5px; display: block;">`;
		svg += '<style>text { font-family: monospace; }</style>'; // Ensure monospace fallback

		commands.forEach(cmd => {
			const attrString = cmd.attributes ? Object.entries(cmd.attributes).map(([k, v]) => `${k}="${v}"`).join(' ') : '';
			const attrPrefix = attrString ? ' ' + attrString : '';

			if (cmd.type === 'line') {
				svg += `<line x1="${cmd.x}" y1="${cmd.y}" x2="${cmd.x2}" y2="${cmd.y2}" stroke="${cmd.stroke || 'black'}" stroke-width="${cmd.strokeWidth || 1}"${attrPrefix} />`;
			} else if (cmd.type === 'text') {
				// Parse font string roughly "bold 16px sans-serif"
				// Extract size/weight
				let style = "";
				if (cmd.font) {
					style += `font: ${cmd.font};`;
				}

				svg += `<text x="${cmd.x}" y="${cmd.y}" fill="${cmd.color || 'black'}" style="${style}" text-anchor="${cmd.anchor || 'start'}"${attrPrefix}>${cmd.text}</text>`;
			} else if (cmd.type === 'rect') {
				svg += `<rect x="${cmd.x}" y="${cmd.y}" width="${cmd.width}" height="${cmd.height}" fill="${cmd.fill || 'none'}" stroke="black"${attrPrefix} />`;
			} else if (cmd.type === 'circle') {
				svg += `<circle cx="${cmd.x}" cy="${cmd.y}" r="${cmd.r}" fill="${cmd.fill || 'none'}" stroke="${cmd.stroke || 'none'}" stroke-width="${cmd.strokeWidth || 0}"${attrPrefix} />`;
			}
		});

		svg += '</svg>';
		return svg;
	}
}
