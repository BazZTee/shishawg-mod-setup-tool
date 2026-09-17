const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '../..');
const output = process.argv[2];
if (!output || !path.isAbsolute(output)) throw new Error('Pass an absolute QA output directory.');
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const result = spawnSync(require('electron'), [path.join(__dirname, 'window.cjs'), output, process.argv[3] || root], { cwd: root, env, stdio: 'inherit', windowsHide: true, timeout: env.SWG_QA_MOTION_VIDEO === '1' ? 150000 : 90000 });
if (result.error) throw result.error;
if (result.status===0) {
  const fs=require('fs');const report=JSON.parse(fs.readFileSync(path.join(output,'qa-report.json'),'utf8'));
  console.log(JSON.stringify({passed:report.checks.length,errors:report.errors.length,screenshots:fs.readdirSync(output).filter(f=>f.endsWith('.png')).length}));
} else {
  const fs=require('fs'),file=path.join(output,'qa-failure.json');
  if(fs.existsSync(file)) console.error(JSON.parse(fs.readFileSync(file,'utf8')).error);
}
process.exit(result.status ?? 1);
