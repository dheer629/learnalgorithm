from __future__ import annotations

import ast
import re
from dataclasses import dataclass
from pathlib import Path

TIME_RE = re.compile(r"time complexity[:\s-]+(?P<value>O\([^)]+\)|[^\n#]+)", re.IGNORECASE)
SPACE_RE = re.compile(r"space complexity[:\s-]+(?P<value>O\([^)]+\)|[^\n#]+)", re.IGNORECASE)
DOCTEST_RE = re.compile(r"^\s*>>>\s+(.+)$", re.MULTILINE)


@dataclass(frozen=True)
class ParsedAlgorithm:
    name: str
    description: str | None
    functions: list[dict]
    imports: list[str]
    doctests: list[str]
    complexity: dict
    source_code: str


def title_from_path(path: Path) -> str:
    return path.stem.replace("_", " ").replace("-", " ").title()


def parse_python_file(path: Path) -> ParsedAlgorithm:
    source = path.read_text(encoding="utf-8", errors="replace")
    tree = ast.parse(source)
    module_doc = ast.get_docstring(tree)
    functions: list[dict] = []
    doc_pool = [module_doc or ""]

    for node in tree.body:
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
            doc = ast.get_docstring(node)
            doc_pool.append(doc or "")
            functions.append(
                {
                    "name": node.name,
                    "signature": _signature(node),
                    "docstring": doc,
                    "lineno": node.lineno,
                }
            )

    all_docs = "\n".join(doc_pool)
    return ParsedAlgorithm(
        name=title_from_path(path),
        description=_first_paragraph(module_doc) or _first_function_summary(functions),
        functions=functions,
        imports=_imports(tree),
        doctests=DOCTEST_RE.findall(all_docs),
        complexity={
            "time": _match_complexity(TIME_RE, source + "\n" + all_docs),
            "space": _match_complexity(SPACE_RE, source + "\n" + all_docs),
        },
        source_code=source,
    )


def _signature(node: ast.FunctionDef | ast.AsyncFunctionDef) -> str:
    args = [arg.arg for arg in node.args.posonlyargs + node.args.args]
    if node.args.vararg:
        args.append(f"*{node.args.vararg.arg}")
    args.extend(arg.arg for arg in node.args.kwonlyargs)
    if node.args.kwarg:
        args.append(f"**{node.args.kwarg.arg}")
    prefix = "async " if isinstance(node, ast.AsyncFunctionDef) else ""
    return f"{prefix}{node.name}({', '.join(args)})"


def _imports(tree: ast.AST) -> list[str]:
    imports: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imports.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imports.add(node.module.split(".")[0])
    return sorted(imports)


def _first_paragraph(doc: str | None) -> str | None:
    if not doc:
        return None
    paragraphs = [part.strip() for part in doc.strip().split("\n\n") if part.strip()]
    return paragraphs[0] if paragraphs else None


def _first_function_summary(functions: list[dict]) -> str | None:
    for function in functions:
        summary = _first_paragraph(function.get("docstring"))
        if summary:
            return summary
    return None


def _match_complexity(pattern: re.Pattern[str], text: str) -> str | None:
    match = pattern.search(text)
    return match.group("value").strip() if match else None
