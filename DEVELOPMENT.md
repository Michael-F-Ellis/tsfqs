# Development Workflow

## Compilation
This project uses `tsgo` (TypeScript 7.0-dev, Go implementation) for compilation.
It is a drop-in replacement for `tsc`.

To compile the project:
```bash
tsgo
```

To compile specific files:
```bash
tsgo src/parser.test.ts
```

## Testing
We are currently running tests by compiling them and then running the output with Node.js.
Since the project is ESM (`"type": "module"` in package.json) and uses `.js` imports in TS files, we can run the output directly.

Example:
```bash
tsgo
node src/parser.test.js
```

## Running the Web App

To build and serve the web application locally (with caching disabled and auto-cleanup of previous servers):

```bash
./serve.sh
```

This will serve the app at `http://127.0.0.1:8081`.
