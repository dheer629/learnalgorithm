"use client";

import type { editor as MonacoEditor } from "monaco-editor";
import { useEffect, useRef, useState } from "react";

export function CodeEditor({
  value,
  onChange,
  fontSize = 14,
  height = 560,
  label = "Python code editor"
}: {
  value: string;
  onChange: (value: string) => void;
  fontSize?: number;
  height?: number;
  label?: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const initialValueRef = useRef(value);
  const initialFontSizeRef = useRef(fontSize);
  const onChangeRef = useRef(onChange);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let disposed = false;

    async function loadEditor() {
      try {
        const monaco = await import("monaco-editor");
        if (!hostRef.current || disposed) return;
        editorRef.current = monaco.editor.create(hostRef.current, {
          value: initialValueRef.current,
          language: "python",
          minimap: { enabled: false },
          automaticLayout: true,
          fontSize: initialFontSizeRef.current,
          lineNumbersMinChars: 3,
          scrollBeyondLastLine: false,
          tabSize: 4,
          theme: document.documentElement.dataset.theme?.includes("graphite") ? "vs-dark" : "vs",
          wordWrap: "on"
        });
        editorRef.current.onDidChangeModelContent(() => onChangeRef.current(editorRef.current?.getValue() ?? ""));
        setReady(true);
      } catch {
        setFailed(true);
      }
    }

    loadEditor();
    return () => {
      disposed = true;
      editorRef.current?.dispose();
      editorRef.current = null;
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.getValue() !== value) {
      editor.setValue(value);
    }
  }, [value]);

  useEffect(() => {
    editorRef.current?.updateOptions({ fontSize });
  }, [fontSize]);

  if (failed) {
    return (
      <textarea
        aria-label={label}
        className="w-full resize-none border border-border bg-background p-4 font-mono leading-6 outline-none"
        spellCheck={false}
        style={{ fontSize, height }}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <div className="relative border border-border bg-background" style={{ height }}>
      {!ready && (
        <textarea
          aria-label={label}
          className="absolute inset-0 h-full w-full resize-none bg-background p-4 font-mono leading-6 outline-none"
          spellCheck={false}
          style={{ fontSize }}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      <div ref={hostRef} className="h-full w-full" aria-label={label} />
    </div>
  );
}
