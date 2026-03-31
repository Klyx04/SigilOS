const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

function processFile(filePath) {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return;
    
    let originalConf = fs.readFileSync(filePath, 'utf8');
    let conf = originalConf;

    conf = conf.replace(/canViewArchis/g, "canViewOcre");
    conf = conf.replace(/canCreateServices/g, "canViewServices");
    conf = conf.replace(/canManagePolls/g, "isAdmin");
    conf = conf.replace(/MISSIONS_CREATE/g, "MISSIONS_MANAGE");
    conf = conf.replace(/ARCHIS_VIEW/g, "OCRE_VIEW");
    conf = conf.replace(/ADMIN_ACCESS/g, "ADMIN_FULL");
    conf = conf.replace(/POLLS_MANAGE/g, "ADMIN_FULL");

    if (filePath.includes('ladder-tabs.tsx')) {
        conf = conf.replace(/SetStateAction<LadderEntry\[\]>/g, "SetStateAction<LadderResponse | null>");
        conf = conf.replace(/never\[\] \| LadderResponse/g, "LadderResponse | null");
    }

    if (filePath.includes('page.tsx')) {
        // Fix for Type 'never[] | LadderResponse' is not assignable to type 'any[]'.
        // This is generic enough but maybe won't hit it right. Let's rely on standard search
        conf = conf.replace(/setLadderData\(\[\]\)/g, "setLadderData(null)");
    }

    if (conf !== originalConf) {
        fs.writeFileSync(filePath, conf, 'utf8');
        console.log("Updated: " + filePath);
    }
}

walkDir('src', processFile);
walkDir('tests', processFile);
