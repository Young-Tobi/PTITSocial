import Editor, { loader } from '@monaco-editor/react';
loader.config({ paths: { vs: '/monaco/vs' } });
export default function CodeEditor({ value, onChange, readOnly = false, language = 'cpp' }) {
  return (
    <Editor
      height="430px"
      language={language}
      theme="vs-light"
      value={value}
      onChange={(text) => onChange?.(text || '')}
      loading="Đang tải trình soạn thảo..."
      options={{
        fontSize: 14,
        fontFamily: 'Consolas, monospace',
        minimap: { enabled: false },
        automaticLayout: true,
        scrollBeyondLastLine: false,
        tabSize: 4,
        readOnly,
        wordWrap: 'on',
        // Monaco 0.52 can reject its delayed word highlighting when changing problems.
        occurrencesHighlight: 'off',
      }}
    />
  );
}
