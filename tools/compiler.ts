import * as ts from "typescript";
import * as fs from "fs";

function Flat<T>(arr: Array<Array<T>>): Array<T> {
	const results = new Array<T>();
	arr.forEach((subArr) => subArr.forEach(value => results.push(value)));
	return results;
};

interface DocumentedDesctiption {
	documentation: string;
}

interface HasDocumentation {
	getDocumentationComment(typeChecker: ts.TypeChecker | undefined): ts.SymbolDisplayPart[];
}

class DocumentedDesctiption implements DocumentedDesctiption {
	public documentation: string
	public constructor(symbol: HasDocumentation, checker: ts.TypeChecker) {
		this.documentation = ts.displayPartsToString(symbol.getDocumentationComment(checker));
	}
}

class NamedSymbolDesctiption extends DocumentedDesctiption {
	public name: string
	public constructor(symbol: ts.Symbol, checker: ts.TypeChecker) {
		super(symbol, checker);
		this.name = symbol.getName();
	}
}

class SignatureDescription extends DocumentedDesctiption {
	parameters: FieldDescription[];
	returnType: string;
	public constructor(signature: ts.Signature, checker: ts.TypeChecker) {
		super(signature, checker)
		this.parameters = signature.parameters.map(p => new FieldDescription(p, checker));
		this.returnType = checker.typeToString(signature.getReturnType());
	}
}

class FunctionDescription extends SignatureDescription {
	public constructor(symbol: ts.Symbol, signature: ts.Signature, checker: ts.TypeChecker) {
		super(signature, checker)
		this.name = symbol.getName();
	}
	name: string
}

function typenameOfSymbol(symbol: ts.Symbol, checker: ts.TypeChecker): string {
	return checker.typeToString(checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration!));
}

class FieldDescription extends NamedSymbolDesctiption {
	public constructor(symbol: ts.Symbol, checker: ts.TypeChecker) {
		super(symbol, checker)
		this.type = typenameOfSymbol(symbol, checker);
	}
	type: string;
}

class InterfaceDescription extends NamedSymbolDesctiption {
	public constructor(symbol: ts.Symbol, checker: ts.TypeChecker) {
		super(symbol, checker)
		this.methods = []
		this.fields = []
		const type = checker.getDeclaredTypeOfSymbol(symbol);
		if (!type.isClassOrInterface()) {
			throw new Error(`${this.name} is not a interface!`);
		}

		const prototypeType = checker.getBaseTypes(type);
		this.extends = prototypeType.map(x => x.symbol.name);

		symbol.members?.forEach((value, name) => {
			const flags = value.getFlags();
			if (!(flags & ts.SymbolFlags.ClassMember)) {
				return
			}
			const node = value.valueDeclaration;
			if (node.modifiers?.find(x => x.kind == ts.SyntaxKind.ProtectedKeyword || x.kind == ts.SyntaxKind.PrivateKeyword))
				return;
			if (flags & ts.SymbolFlags.Method) {
				this.methods.push(...checker.getTypeOfSymbolAtLocation(value, node).getCallSignatures()
					.map(signature => new FunctionDescription(value, signature, checker)))
				return;
			}
			this.fields.push(new FieldDescription(value, checker))
		})
	}
	fields: FieldDescription[];
	methods: FunctionDescription[];
	extends: string[];
}

class ClassDescription extends InterfaceDescription {
	public constructor(symbol: ts.Symbol, checker: ts.TypeChecker) {
		super(symbol, checker)

		const type = checker.getDeclaredTypeOfSymbol(symbol);
		if (!type.isClass()) {
			throw new Error(`${this.name} is not a class!`);
		}
		this.consturctors = checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration)
			.getConstructSignatures().map(s => new SignatureDescription(s, checker));
	}
	consturctors: SignatureDescription[];
}

type TypesDescriptions = {
	classes: ClassDescription[];
	interfaces: InterfaceDescription[];
};

/** Generate documentation for all classes in a set of .ts files */
function generateDocumentation(
	fileNames: string[],
	options: ts.CompilerOptions
): TypesDescriptions {
	// Build a program using the set of root file names in fileNames
	let program = ts.createProgram(fileNames, options);

	// Get the checker, we will use it to find more about classes
	let checker = program.getTypeChecker();
	let classes: ClassDescription[] = [];
	let interfaces: InterfaceDescription[] = [];

	// Visit every sourceFile in the program
	for (const sourceFile of program.getSourceFiles()) {
		if (!sourceFile.isDeclarationFile) {
			// Walk the tree to search for classes
			ts.forEachChild(sourceFile, visit);
		}
	}

	return { classes, interfaces };

	/** visit nodes finding exported classes */
	function visit(node: ts.Node) {
		// Only consider exported nodes
		if (!isNodeExported(node)) {
			return;
		}

		if (ts.isClassDeclaration(node) && node.name) {
			// This is a top level class, get its symbol
			let symbol = checker.getSymbolAtLocation(node.name);
			if (symbol) {
				const clazz = new ClassDescription(symbol, checker);
				classes.push(clazz);
			}
			// No need to walk any further, class expressions/inner declarations
			// cannot be exported
		} else if (ts.isModuleDeclaration(node)) {
			// This is a namespace, visit its children
			ts.forEachChild(node, visit);
		} else if (ts.isInterfaceDeclaration(node) && node.name) {
			let symbol = checker.getSymbolAtLocation(node.name);
			if (symbol) {
				const inter = new InterfaceDescription(symbol, checker);
				interfaces.push(inter)
			}
		}
	}

	/** True if this is visible outside this file, false otherwise */
	function isNodeExported(node: ts.Node): boolean {
		return (
			(ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Export) !== 0 ||
			(!!node.parent && node.parent.kind === ts.SyntaxKind.SourceFile)
		);
	}
}

export function readTypesFromTo(inputFile: string, outputFile: string, minify: boolean) {
	const startTime = new Date().getTime();
	const res = readTypesFrom(inputFile);
	fs.writeFileSync(outputFile, JSON.stringify(res, undefined, minify ? undefined : "\t"));
	console.log(`Time: ${new Date().getTime() - startTime}ms`);
	console.log(`Classes: ${res.classes.length}`)
	console.log(`Interfaces: ${res.interfaces.length}`)
	console.log(`Reflection json written in ${outputFile}!`);
	console.log();
}

const formatHost: ts.FormatDiagnosticsHost = {
	getCanonicalFileName: (path) => path,
	getCurrentDirectory: ts.sys.getCurrentDirectory,
	getNewLine: () => ts.sys.newLine,
}

class BadTSConfig extends Error {
	constructor(readonly tsconfig: string, diagnostics: ts.Diagnostic[]) {
		super(`Can't read config file ${tsconfig}: ${ts.formatDiagnostics(diagnostics, formatHost)}`)
	}
}

export function readTypesFrom(inputFile: string): TypesDescriptions {
	const workdir = cutLast(inputFile);
	const configFile = ts.findConfigFile(workdir, ts.sys.fileExists)
	if (!configFile)
		throw Error("tsconfig not found!");
	const config = ts.readConfigFile(configFile, ts.sys.readFile);
	if (config.error) {
		throw new BadTSConfig(configFile, [config.error])
	}
	const c = ts.convertCompilerOptionsFromJson(config.config.compilerOptions, workdir)
	if (c.errors.length)
		throw new BadTSConfig(configFile, c.errors)
	return generateDocumentation([inputFile], c.options)
}


const args = process.argv.slice(2);
const inputFile = args[0];
const outputFile = args[1];
const minify = args[2];
readTypesFromTo(inputFile, outputFile, minify === "true")

function cutLast(path: string): string {
	let p = path.split("/");
	p.pop();
	return p.join("/");
}