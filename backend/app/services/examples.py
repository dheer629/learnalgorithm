from __future__ import annotations

import re
from dataclasses import dataclass

from app.schemas.algorithm import AlgorithmExampleOut, ExecuteRequest
from app.services.executor import UnsafeCodeError, execute_python_local

MAX_EXAMPLES_PER_ALGORITHM = 8
PROMPT_RE = re.compile(r"^\s*>>>\s+(.+)$")
CONTINUATION_RE = re.compile(r"^\s*\.\.\.\s+")
STOP_RE = re.compile(r"^\s*(>>>|\.\.\.)\s+")


@dataclass(frozen=True)
class ParsedExample:
    command: str
    expected_output: str


async def build_validated_examples(source_code: str) -> list[AlgorithmExampleOut]:
    examples = parse_doctest_examples(source_code)[:MAX_EXAMPLES_PER_ALGORITHM]
    validated: list[AlgorithmExampleOut] = []
    for index, example in enumerate(examples, start=1):
        code = build_runnable_code(source_code, example.command)
        try:
            result = await execute_python_local(ExecuteRequest(code=code))
            actual = result.output or result.stdout or result.stderr
            matched = _normalize(actual) == _normalize(example.expected_output) if example.expected_output else None
            status = "matched" if matched else "not-matched" if matched is False else "ran"
            error = None
        except UnsafeCodeError as exc:
            actual = ""
            matched = None
            status = "blocked"
            error = str(exc)
            result = None
        except Exception as exc:
            actual = ""
            matched = False
            status = "failed"
            error = str(exc)
            result = None

        validated.append(
            AlgorithmExampleOut(
                title=f"Example {index}",
                command=example.command,
                runnable_code=code,
                stdin="",
                expected_output=example.expected_output,
                actual_output=actual,
                matched=matched,
                status=status,
                validation_error=error,
                execution_time_ms=result.execution_time_ms if result else None,
                runner=result.runner if result else None,
                python_version=result.python_version if result else None,
                exit_code=result.exit_code if result else None,
                logs=result.logs if result else ([error] if error else []),
            )
        )
    return validated


def parse_doctest_examples(source_code: str) -> list[ParsedExample]:
    lines = source_code.splitlines()
    examples: list[ParsedExample] = []
    index = 0
    while index < len(lines):
        match = PROMPT_RE.match(lines[index])
        if not match:
            index += 1
            continue

        command_lines = [match.group(1).strip()]
        index += 1
        while index < len(lines) and CONTINUATION_RE.match(lines[index]):
            command_lines.append(CONTINUATION_RE.sub("", lines[index]).rstrip())
            index += 1

        expected: list[str] = []
        while index < len(lines):
            line = lines[index]
            if STOP_RE.match(line) or _is_docstring_boundary(line):
                break
            if line.strip():
                expected.append(line.strip())
            index += 1

        examples.append(ParsedExample(command="\n".join(command_lines), expected_output="\n".join(expected).strip()))
    return examples


def build_runnable_code(source_code: str, command: str) -> str:
    command = command.strip()
    runnable_command = command if _is_statement(command) else f"print({command})"
    indented = "\n".join(f"    {line}" if line.strip() else line for line in runnable_command.splitlines())
    return f"{source_code.rstrip()}\n\nif __name__ == \"__main__\":\n{indented}\n"


def _is_statement(command: str) -> bool:
    starts = ("print(", "assert ", "for ", "while ", "if ", "try:", "with ", "def ", "class ")
    return command.startswith(starts) or "=" in command


def _is_docstring_boundary(line: str) -> bool:
    stripped = line.strip()
    return stripped in {'"""', "'''"} or stripped.endswith('"""') or stripped.endswith("'''")


def _normalize(value: str) -> str:
    return value.replace("\r", "").strip()
