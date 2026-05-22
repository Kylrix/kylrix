const fs = require('fs');
let content = fs.readFileSync('lib/actions/secure-ops.ts', 'utf8');

// We need to replace positional tables.* and databases.* calls with object syntax.
// Since AST rewriting is complex, I will write a simple parser.

function replaceCalls(methodName, newMethodName, paramsOrder) {
  const regex = new RegExp(`(?:databases|tables)\\.${methodName}\\s*\\(`, 'g');
  let match;
  let offset = 0;
  
  while ((match = regex.exec(content)) !== null) {
    let start = match.index;
    let end = start + match[0].length;
    let openParens = 1;
    let currentArg = '';
    let args = [];
    
    for (let i = end; i < content.length; i++) {
      let char = content[i];
      if (char === '(' || char === '{' || char === '[') openParens++;
      if (char === ')' || char === '}' || char === ']') openParens--;
      
      if (char === ',' && openParens === 1) {
        args.push(currentArg.trim());
        currentArg = '';
      } else if (openParens === 0) {
        if (currentArg.trim()) args.push(currentArg.trim());
        end = i;
        break;
      } else {
        currentArg += char;
      }
    }
    
    // If the first argument is already an object, skip
    if (args.length === 1 && args[0].startsWith('{')) continue;
    
    let objectStr = '{';
    for (let j = 0; j < args.length; j++) {
      if (args[j]) {
        objectStr += `\n      ${paramsOrder[j]}: ${args[j]},`;
      }
    }
    objectStr += '\n    }';
    
    const replacement = `tables.${newMethodName}(${objectStr})`;
    content = content.substring(0, start) + replacement + content.substring(end + 1);
    
    // Reset regex index because we modified the string
    regex.lastIndex = 0;
  }
}

// 1. replace databases.createDocument and tables.createRow
replaceCalls('createDocument', 'createRow', ['databaseId', 'tableId', 'rowId', 'data', 'permissions']);
replaceCalls('createRow', 'createRow', ['databaseId', 'tableId', 'rowId', 'data', 'permissions']);

// 2. updateDocument / updateRow
replaceCalls('updateDocument', 'updateRow', ['databaseId', 'tableId', 'rowId', 'data', 'permissions']);
replaceCalls('updateRow', 'updateRow', ['databaseId', 'tableId', 'rowId', 'data', 'permissions']);

// 3. deleteDocument / deleteRow
replaceCalls('deleteDocument', 'deleteRow', ['databaseId', 'tableId', 'rowId']);
replaceCalls('deleteRow', 'deleteRow', ['databaseId', 'tableId', 'rowId']);

// 4. listDocuments / listRows
replaceCalls('listDocuments', 'listRows', ['databaseId', 'tableId', 'queries']);
replaceCalls('listRows', 'listRows', ['databaseId', 'tableId', 'queries']);

// 5. getDocument / getRow
replaceCalls('getDocument', 'getRow', ['databaseId', 'tableId', 'rowId', 'queries']);
replaceCalls('getRow', 'getRow', ['databaseId', 'tableId', 'rowId', 'queries']);

// Now we need to manually fix any cases where "const { databases } = createSystemClient();" is used to define "databases".
// It is better to just keep it but redefine it if necessary, or let "tables" be defined.
content = content.replace(/const \{ databases \} = createSystemClient\(\);/g, `const tables = createSystemTablesDB();\n  const { databases } = createSystemClient();`);

// The script might introduce duplicate `const tables = createSystemTablesDB();`. 
// We can just leave them if they don't break scope (they are usually at block scope start). But "const tables" redeclaration is a syntax error in the same block.
// Let's do a smart replace.
content = content.replace(/const tables = createSystemTablesDB\(\);\s*const tables = createSystemTablesDB\(\);/g, 'const tables = createSystemTablesDB();');

// But actually, verifyResourcePermissionSecure uses getRow. Let's make sure tables is available.
// In verifyResourcePermissionSecure:
// const tables = createSystemTablesDB();
// doc = await tables.getRow(databaseId, collectionId, documentId);

fs.writeFileSync('lib/actions/secure-ops.ts.fixed', content);
