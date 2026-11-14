import { safeUrl, type BuilderNode, type UiTree } from "./builder/tree";

export type ExportTarget = "web" | "app";
const webApp = `import React from 'react';
import tree from './tree.json';
import './style.css';
function renderNode(node) {
  const p = node.props;
  const style = { color: p.color, backgroundColor: p.background, fontSize: p.fontSize, padding: p.padding };
  if (node.type === 'container') return <div key={node.id} style={style}>{node.children.map(renderNode)}</div>;
  if (node.type === 'text') return <p key={node.id} style={style}>{p.text}</p>;
  if (node.type === 'image') return p.url ? <img key={node.id} src={p.url} alt={p.text} style={{...style, maxWidth:'100%', height:'auto'}} /> : null;
  if (node.type === 'button') return p.href ? <a key={node.id} href={p.href} style={style}>{p.text}</a> : <button key={node.id} type="button" style={style}>{p.text}</button>;
  return null;
}
export default function App() { return <main>{tree.nodes.map(renderNode)}</main>; }
`;
const nativeApp = `import React from 'react';
import { Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import tree from './tree.json';
function renderNode(node) {
  const p = node.props;
  const box = { backgroundColor: p.background, padding: p.padding };
  const text = { color: p.color, fontSize: p.fontSize };
  if (node.type === 'container') return <View key={node.id} style={box}>{node.children.map(renderNode)}</View>;
  if (node.type === 'text') return <Text key={node.id} style={[box, text]}>{p.text}</Text>;
  if (node.type === 'image') return p.url ? <Image key={node.id} source={{uri: p.url}} accessibilityLabel={p.text} style={{width:'100%', aspectRatio:16/9, resizeMode:'contain'}} /> : null;
  if (node.type === 'button') return <Pressable key={node.id} accessibilityRole="button" style={box} onPress={p.href ? () => { Linking.openURL(p.href).catch(() => {}); } : undefined}><Text style={text}>{p.text}</Text></Pressable>;
  return null;
}
export default function App() { return <ScrollView contentContainerStyle={{flexGrow:1}}>{tree.nodes.map(renderNode)}</ScrollView>; }
`;

export function exportToReact(tree: UiTree, target: ExportTarget, projectId: string, projectName: string): Record<string, string> {
  const source = JSON.stringify(tree, null, 2);
  if (target === "web") return {
    "package.json": JSON.stringify({ name: "studio-export-web", private: true, version: "1.0.0", type: "module", scripts: { dev: "vite", build: "vite build", preview: "vite preview" }, dependencies: { react: "19.2.9", "react-dom": "19.2.9" }, devDependencies: { "@vitejs/plugin-react": "6.3.0", vite: "8.3.8" } }, null, 2),
    "vite.config.js": "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins: [react()] });\n",
    "index.html": '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NPT Duy Studio</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>',
    "src/main.jsx": "import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\ncreateRoot(document.getElementById('root')).render(<App />);\n",
    "src/App.jsx": webApp, "src/tree.json": source,
    "src/style.css": "*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif}main{min-height:100vh}p{margin:0;white-space:pre-wrap}a{display:inline-block;text-decoration:none}button{cursor:pointer}\n",
    "README.md": "# Website xuất từ NPT Duy Studio\n\nChạy `npm install` rồi `npm run dev`; dùng `npm run build` để tạo bản web. Đường dẫn ảnh tương đối cần được bổ sung vào thư mục public.\n"
  };
  const invalid: string[] = [];
  const inspect = (nodes: BuilderNode[]) => nodes.forEach(node => {
    if (node.type === "image" && node.props.url && (!safeUrl(node.props.url, true) || node.props.url.startsWith("/"))) invalid.push("Ảnh trong app cần URL http hoặc https đầy đủ.");
    if (node.type === "button" && node.props.href && (node.props.href.startsWith("/") || node.props.href.startsWith("#"))) invalid.push("Liên kết nút trong app cần URL đầy đủ.");
    inspect(node.children);
  });
  inspect(tree.nodes);
  if (invalid.length) throw new Error(invalid[0]);
  const suffix = projectId.replace(/[^a-f0-9]/gi, "").slice(0, 24).toLowerCase();
  return {
    "package.json": JSON.stringify({ name: "studio-export-app", version: "1.0.0", private: true, main: "node_modules/expo/AppEntry.js", scripts: { start: "expo start", android: "expo run:android", ios: "expo run:ios" }, dependencies: { expo: "~58.0.25", react: "19.3.0", "react-native": "0.88.1" } }, null, 2),
    "app.json": JSON.stringify({ expo: { name: projectName, slug: `npt-${suffix}`, version: "1.0.0", orientation: "default", android: { package: `com.nptduystudio.app${suffix}` }, ios: { bundleIdentifier: `com.nptduystudio.app${suffix}`, supportsTablet: true } } }, null, 2),
    "eas.json": JSON.stringify({ cli: { version: ">= 27.10.0", appVersionSource: "remote" }, build: { preview: { android: { buildType: "apk" }, ios: { simulator: false } } } }, null, 2),
    "App.js": nativeApp, "tree.json": source,
    "README.md": "# Ứng dụng xuất từ NPT Duy Studio\n\nChạy `npm install` rồi `npx expo start`. Muốn tạo APK/IPA cần dự án Expo EAS và thông tin ký ứng dụng phù hợp.\n"
  };
}
