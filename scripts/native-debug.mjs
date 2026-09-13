// Development-only CDP diagnostics for the explicitly isolated local test profile.
import { writeFile } from 'node:fs/promises';
const targets = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const target = targets.find(t => t.url === 'app://obsidian.md/index.html' && t.title.includes('Atlas-test-vault'));
if (!target) throw new Error('Isolated Atlas-test-vault target not found');
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let id = 0; const pending = new Map();
socket.onmessage = message => { const data = JSON.parse(message.data); if (pending.has(data.id)) { pending.get(data.id)(data); pending.delete(data.id); } };
const command = (method, params) => new Promise(resolve => { const key = ++id; pending.set(key, resolve); socket.send(JSON.stringify({ id: key, method, params })); });
const mode = process.argv[2] ?? 'inspect';
let code = `JSON.stringify({ vault: app.vault.getName(), title: document.title, modals: [...document.querySelectorAll('[class*=modal]')].slice(0,15).map(e=>({class:e.className,text:e.textContent.slice(0,100)})), inputs: [...document.querySelectorAll('input')].map(e=>({class:e.className,placeholder:e.placeholder})), body: document.body.innerText.slice(-4000) })`;
if (mode === 'geometry') code = `(()=>{const v=app.workspace.getLeavesOfType('xingyu-note-atlas-view')[0].view;return JSON.stringify({root:v.contentEl.getBoundingClientRect().toJSON(),stage:v.stage.getBoundingClientRect().toJSON(),graphWidth:v.graph.width(),graphHeight:v.graph.height(),zoom:v.graph.zoom(),bbox:v.graph.getGraphBbox(),selected:v.selected,closed:v.closed,nodes:v.visible.map(n=>({id:n.id,x:n.x,y:n.y}))})})()`;
if (mode === 'rerun') code = `(async()=>{ if(app.vault.getName() !== 'Atlas-test-vault') throw Error('Wrong vault'); await app.plugins.disablePlugin('atlas-native-tests'); await app.plugins.disablePlugin('xingyu-note-atlas'); await app.plugins.enablePlugin('xingyu-note-atlas'); await app.plugins.enablePlugin('atlas-native-tests'); return 'Test plugins reloaded'; })()`;
if (mode === 'screenshot') {
  const result = await command('Page.captureScreenshot', { format: 'png' });
  if (result.error) throw new Error(JSON.stringify(result.error));
  await writeFile('.qa/native-screenshot.png', Buffer.from(result.result.data, 'base64'));
  console.log('.qa/native-screenshot.png');
} else {
  const result = await command('Runtime.evaluate', { expression: code, awaitPromise: true, returnByValue: true });
  console.log(JSON.stringify(result.result ?? result, null, 2));
}
socket.close();
