const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    let list;
    try {
        list = fs.readdirSync(dir);
    } catch(e) {
        return results;
    }
    list.forEach(function(file) {
        if (file === 'node_modules' || file === '.next' || file === '.git' || file === '.agents' || file.startsWith('.antigravity')) return;
        file = path.join(dir, file);
        let stat;
        try {
            stat = fs.statSync(file);
        } catch(e) {
            return;
        }
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('.');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Remove and content = content.replace(/Permission\.(?:update|delete)\([^)]+\([^)]*\)\),?\s*/g, '');
    content = content.replace(/Permission\.(?:update|delete)\([^)]+\),?\s*/g, '');
    
    // Remove raw strings like content = content.replace(/[`'"]update\("user:[^"]+"\)[`'"],?\s*/g, '');
    content = content.replace(/[`'"]delete\("user:[^"]+"\)[`'"],?\s*/g, '');

    // Cleanup empty arrays that might be left behind, e.g. [ ] or trailing commas
    content = content.replace(/\[\s*,/g, '[');
    content = content.replace(/,\s*\]/g, ']');

    // Specific cleanup for note.ts checks:
    content = content.replace(/if\s*\([^)]*\$permissions\.includes\([^)]*(?:update|delete)[^)]*\)[^)]*\)\s*highestPermission\s*=\s*'[^']+';?\n?/g, '');
    content = content.replace(/else\s*if\s*\([^)]*\$permissions\.includes\([^)]*(?:update|delete)[^)]*\)[^)]*\)\s*highestPermission\s*=\s*'[^']+';?\n?/g, '');
    content = content.replace(/if\s*\([^)]*perms\.includes\([^)]*(?:update|delete)[^)]*\)[^)]*\)\s*sharePermission\s*=\s*'[^']+';?\n?/g, '');
    content = content.replace(/else\s*if\s*\([^)]*perms\.includes\([^)]*(?:update|delete)[^)]*\)[^)]*\)\s*sharePermission\s*=\s*'[^']+';?\n?/g, '');
    content = content.replace(/const isOwner = obj\.\$permissions\?\.some\(\(p: string\) => p\.includes\([^)]*(?:delete|update)[^)]*\)\);/g, 'const isOwner = false;');

    // Cleanup logic like && p !== `update...`
    content = content.replace(/&& p !== [`'"](?:update|delete)\("user:[^"]+"\)[`'"]/g, '');
    
    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Cleaned:', file);
    }
});