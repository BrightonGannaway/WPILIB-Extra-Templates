
const vscode = require('vscode');
const path = require('path')

const { MOTORS, MOTOR_IMPORTS } = require ('./constants.js');


// creates a staged change since we want to be customizable in our changes 
function Change(position, text) {
	this.position = position;
	this.text = text;
}


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "wpilib-templates" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand("wpilib-templates.Wpilib_Test", function () {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage("Hello World from WPILIB templates!");
	});

	const motorCreate1 = vscode.commands.registerCommand("wpilib-templates.Instantiate_Motor", async function () {

		const motor = await getSelection(Object.values(MOTORS), "Please choose a motor type")
		
		let motorImport
		
		switch (motor) {
			case MOTORS.TALONFX:
				motorImport = MOTOR_IMPORTS.TALONFX_STANDARD;
				break;
			case MOTORS.SPARKMAX:
				motorImport = MOTOR_IMPORTS.SPARKMAX_STANDARD;
				break;
			default:
				break;
		}

		const changes = []

		changes.push(addImport(motor, motorImport));
		changes.push(addDefinition(motor, motor + "1"));
		changes.push(addInstantiation(motor, motor + "1", 3));
		applyChanges(changes);

	});

	context.subscriptions.push(disposable, motorCreate1);
}
exports.activate = activate;

// This method is called when your extension is deactivated
function deactivate() {}

//-----------------------//
//---support functions---//
//-----------------------//

function getEditor() {
	return vscode.window.activeTextEditor;
}

function verifyEditor(editor) {
	if(!editor) {
		vscode.window.showWarningMessage('No active editor found.');
		return false;
	}
	return true;
}

// changes are applied in a bottom top order to avoid line offset issues
async function applyChanges(changes) {

	const sortedChanges = changes.sort((a, b) => b.position.compareTo(a.position));
	const editor = getEditor();
	if (verifyEditor(editor) == false) {
		vscode.window.showErrorMessage("Could not create template because something was wrong with the VScode editor");
		return 
	} 

	editor.edit(editBuilder => {
		for (let i = 0; i < sortedChanges.length; i++) {
			editBuilder.insert(sortedChanges[i].position, sortedChanges[i].text);
		}
	}).then(success => {
		if(success) {
			vscode.window.showInformationMessage("All edits applied successfully")
		}
	})

	return 
}

/**
 * 
 * @param {vscode.TextEditor} editor 
 * @param  {boolean} args true to keep filetype and false to remove it. Useful for grabbing the class name of a file
 */
function getFileName(editor, keepFileType) {
	const fullPath = editor.document.uri.fsPath;
	let fileName = path.basename(fullPath);

	if (keepFileType == false) {
		const fileStructure = fileName.match(/^(.+?)(?:\.[^.]*$|$)/);
		if (fileStructure.length === 2) {
			fileName = fileStructure[1];
		}
	}

	return fileName;
}


async function getSelection(constantsObject, text) {
	const selectionArray = Array.from(Object.values(constantsObject)); 
	const selection = await vscode.window.showQuickPick(selectionArray, {
		placeholder: text,
		canPickMany: false
	});

	vscode.window.showInformationMessage(`You selected: ${selection}`);
	return selection;
} 

function getPositionBelowString(editor, targetString) {
	const document = editor.document;
	const documentText = document.getText();
	
	try {
		const index = documentText.indexOf(targetString);
		const position = document.positionAt(index);
		let returnPosition = position.translate(1,0);
		returnPosition = new vscode.Position(returnPosition.line, 0);
		return returnPosition;
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to get position below string "${targetString}" because an error occurred: ${error}`)
		return null
	}
}

//-----------------------------//
//--Code Overwriting commands--//
//-----------------------------//

function addImport(item, importText) {
	const editor = getEditor();
	if (verifyEditor(editor) == false) {
		return false
	} 
	const document = editor.document;
	const documentText = document.getText();

	if (documentText.includes(importText)) {
		console.log(`import for ${item} already exists`);
		return null;
	}

	if(documentText.includes("package")) {
		const pos = getPositionBelowString(editor, "package");
		return new Change(pos, "\n" + importText);
	}

	const pos = new vscode.Position(0,0)
	return new Change(pos, "\n" + importText);

}

function addDefinition(datatype, nameOfObject) {
	const editor = getEditor();
	if (verifyEditor(editor) == false) {
		return false
	} 
	const document = editor.document;
	const documentText = document.getText();

	const definitionString = datatype + " " + nameOfObject + ";\n"
	
	if (documentText.includes(" " + datatype + " ") && documentText.includes("class " + getFileName(editor, false))) {
		const pos = getPositionBelowString(editor, datatype + " ");
		return new Change(pos, definitionString);
	}

	if(documentText.includes("class " + getFileName(editor, false))) {
		const pos = getPositionBelowString(editor, "class " + getFileName(editor, false));
		return new Change(pos, definitionString);
	}

	vscode.window.showErrorMessage(`Failed to add a definition of ${datatype} as there is no available class structure to support definitions`);
	return null;

}

function addInstantiation(datatype, nameOfObject, ...args) {
	const editor = getEditor();
	if (verifyEditor(editor) == false) {
		return false
	} 
	const document = editor.document;
	const documentText = document.getText();

	let instantiationString = nameOfObject + " new " + datatype;

	if (args.length != 0) {
		instantiationString += "(";
		for (let i = 0; i < args.length - 1; i++) {
			instantiationString += args[i] + ", ";
		}
		instantiationString += args[args.length - 1] + ");"
	} else {
		instantiationString += "();";
	}

	const constructorHeader = "public " + getFileName(editor, false) + "(";
	//"(" is open ended because first constructor may not always be empty; it should but you never know
	if (documentText.includes(constructorHeader)) {
		const pos = getPositionBelowString(editor, constructorHeader);
		return new Change(pos, instantiationString + "\n");
	} else {
		vscode.window.showErrorMessage(`Failed to add a instantiation of ${datatype} as there is no available constructors to support instantiation`)
		return null;
	}
}

function methodParser(methodFilePath, methodName, ...variables) {
	
}



module.exports = {
	activate,
	deactivate
}
