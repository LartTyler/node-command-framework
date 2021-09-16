import * as fs from 'fs';
import * as nodePath from 'path';

export class ArgInput {
	protected index = 0;

	public constructor(
		public readonly args: string[]
	) {
	}

	public get position() {
		return this.index;
	}

	public get length() {
		return this.args.length;
	}

	public get remaining() {
		return this.length - this.position;
	}

	public get current() {
		return this.args[this.index];
	}

	public next() {
		return this.args[this.index++];
	}

	public empty() {
		return this.remaining <= 0;
	}
}

export interface Command<TContext = never> {
	getKeywords(): string[];
	getUsage(): string[];
	getSummary(): string;
	getHelpText(): string;
	execute(args: ArgInput, context: TContext): Promise<void>;
}

export class CommandManager<TContext = never> {
	public readonly commands: Command<TContext>[] = [];
	protected keywords: { [key: string]: Command<TContext> } = {};
	protected helpCommand: Command<TContext> | null = null;

	public add(command: Command) {
		if (this.commands.indexOf(command) !== -1)
			return;

		this.commands.push(command);

		for (const keyword of command.getKeywords())
			this.keywords[keyword] = command;
	}

	public find(keyword: string) {
		return this.keywords[keyword] ?? null;
	}

	public getHelpCommand() {
		return this.helpCommand;
	}

	public setHelpCommand(command: Command<TContext>) {
		this.helpCommand = command;
	}

	public async execute(args: ArgInput, context: TContext) {
		const keyword = args.next();

		if (!keyword)
			return;

		const command = this.find(keyword);

		if (!command)
			throw new CommandNotFoundError(keyword);

		return command.execute(args, context);
	}

	public async loadDirectory(path: string) {
		for (const item of fs.readdirSync(path))
			await this.load(nodePath.join(path, item));
	}

	public async load(path: string) {
		const pathParts = nodePath.parse(path);
		const module: unknown = await import(pathParts.dir + '/' + pathParts.name);

		if (!isCommandModule(module))
			throw new Error('Could not find register() function in export from ' + path);

		module.register(this);
	}

	public static async create<TContext = never>(paths: string[]) {
		const instance = new CommandManager<TContext>();

		for (const path of paths)
			await instance.loadDirectory(path);

		return instance;
	}
}

export type CommandModule = {
	[key: string]: any;
	register: (manager: CommandManager) => void;
};

export function isCommandModule(value: any): value is CommandModule {
	return value && typeof value.register === 'function';
}

export class CommandNotFoundError extends Error {
	public constructor(
		public readonly keyword: string,
	) {
		super(`No command found for the keyword "${keyword}"`);
	}
}
