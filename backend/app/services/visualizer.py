import asyncio
import json
import sys
import tempfile
import time

from app.core.config import get_settings
from app.schemas.algorithm import VisualizeRequest, VisualizeResponse
from app.services.executor import _platform_resource_kwargs, validate_code

JSON_END = "__ALGOLEARN_VISUAL_TRACE_END__"
JSON_START = "__ALGOLEARN_VISUAL_TRACE_START__"

VISUALIZER_SCRIPT = rf"""
import contextlib
import inspect
import io
import json
import math
import sys
import traceback
import types

JSON_END = "{JSON_END}"
JSON_START = "{JSON_START}"
FILENAME = "<algorithm_visualizer>"
MAX_PREVIEW = 180
MAX_ITEMS = 14
MAX_NUMERIC_ITEMS = 24


class TraceLimitReached(Exception):
    pass


class CappedStringIO(io.StringIO):
    def __init__(self, limit):
        super().__init__()
        self.limit = limit
        self.truncated = False

    def write(self, text):
        remaining = self.limit - len(self.getvalue())
        if remaining <= 0:
            self.truncated = True
            return len(text)
        if len(text) > remaining:
            self.truncated = True
            super().write(text[:remaining])
            return len(text)
        return super().write(text)


def safe_repr(value):
    try:
        text = repr(value)
    except Exception:
        text = f"<unrepresentable {{type(value).__name__}}>"
    if len(text) > MAX_PREVIEW:
        return text[: MAX_PREVIEW - 1] + "..."
    return text


def is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(float(value))


def primitive_summary(value, name):
    if value is None:
        return {{
            "name": name,
            "kind": "none",
            "preview": "None",
            "size": None,
            "items": [],
            "numeric_items": [],
        }}
    if isinstance(value, bool):
        return {{
            "name": name,
            "kind": "boolean",
            "preview": str(value),
            "size": None,
            "items": [],
            "numeric_items": [],
        }}
    if is_number(value):
        return {{
            "name": name,
            "kind": "number",
            "preview": safe_repr(value),
            "size": None,
            "items": [],
            "numeric_items": [float(value)],
        }}
    if isinstance(value, str):
        return {{
            "name": name,
            "kind": "string",
            "preview": safe_repr(value),
            "size": len(value),
            "items": [],
            "numeric_items": [],
        }}
    return None


def summarize(value, name="", depth=0, seen=None):
    primitive = primitive_summary(value, name)
    if primitive is not None:
        return primitive

    seen = seen or set()
    object_id = id(value)
    if object_id in seen:
        return {{
            "name": name,
            "kind": "circular",
            "preview": "<circular reference>",
            "size": None,
            "items": [],
            "numeric_items": [],
        }}
    next_seen = seen | {{object_id}}

    if isinstance(value, (list, tuple)):
        limited = list(value[:MAX_ITEMS])
        numeric_items = [float(item) for item in value[:MAX_NUMERIC_ITEMS] if is_number(item)]
        return {{
            "name": name,
            "kind": "array" if isinstance(value, list) else "tuple",
            "preview": safe_repr(value),
            "size": len(value),
            "items": [summarize(item, str(index), depth + 1, next_seen) for index, item in enumerate(limited)]
            if depth < 2
            else [],
            "numeric_items": numeric_items,
        }}

    if isinstance(value, (set, frozenset)):
        limited = sorted(list(value), key=safe_repr)[:MAX_ITEMS]
        numeric_items = [float(item) for item in limited[:MAX_NUMERIC_ITEMS] if is_number(item)]
        return {{
            "name": name,
            "kind": "set",
            "preview": safe_repr(value),
            "size": len(value),
            "items": [summarize(item, str(index), depth + 1, next_seen) for index, item in enumerate(limited)]
            if depth < 2
            else [],
            "numeric_items": numeric_items,
        }}

    if isinstance(value, dict):
        entries = list(value.items())[:MAX_ITEMS]
        return {{
            "name": name,
            "kind": "dict",
            "preview": safe_repr(value),
            "size": len(value),
            "items": [
                {{"key": safe_repr(key), "value": summarize(item_value, safe_repr(key), depth + 1, next_seen)}}
                for key, item_value in entries
            ]
            if depth < 2
            else [],
            "numeric_items": [],
        }}

    if hasattr(value, "__dict__") and depth < 1:
        attrs = list(vars(value).items())[:MAX_ITEMS]
        return {{
            "name": name,
            "kind": type(value).__name__,
            "preview": safe_repr(value),
            "size": len(attrs),
            "items": [
                {{"key": attr_name, "value": summarize(attr_value, attr_name, depth + 1, next_seen)}}
                for attr_name, attr_value in attrs
                if not attr_name.startswith("__")
            ],
            "numeric_items": [],
        }}

    return {{
        "name": name,
        "kind": type(value).__name__,
        "preview": safe_repr(value),
        "size": None,
        "items": [],
        "numeric_items": [],
    }}


def should_skip_local(name, value):
    if name.startswith("__") or name in {{"annotations"}}:
        return True
    if isinstance(value, types.ModuleType):
        return True
    if inspect.isfunction(value) or inspect.isclass(value) or inspect.ismethod(value):
        return True
    return False


def snapshot_locals(frame):
    values = []
    for name in sorted(frame.f_locals):
        value = frame.f_locals[name]
        if should_skip_local(name, value):
            continue
        values.append(summarize(value, name))
        if len(values) >= MAX_ITEMS:
            break
    return values


def narrate(event, line_no, line_text, function_name, locals_count):
    cleaned = line_text.strip()
    if event == "line":
        return f"Line {{line_no}} in {{function_name}} executes {{cleaned!r}} with {{locals_count}} visible value(s)."
    if event == "return":
        return f"{{function_name}} returns after line {{line_no}}; the latest local values are now captured."
    if event == "exception":
        return f"An exception moved through {{function_name}} near line {{line_no}}."
    return f"{{event}} event captured at line {{line_no}}."


def main():
    payload = json.loads(sys.stdin.read())
    code = payload.get("code", "")
    stdin_text = payload.get("stdin", "")
    args = payload.get("args", [])
    max_steps = int(payload.get("max_steps", 120))
    max_output = int(payload.get("max_output", 200000))
    source_lines = code.splitlines()
    steps = []
    stdout_capture = CappedStringIO(max_output)
    stderr_capture = CappedStringIO(max_output)
    logs = [
        "Visualizer request accepted by Algorithm Learn API.",
        "Runner selected: local Python trace runtime.",
        f"Python version: {{sys.version.split()[0]}}",
    ]

    def tracer(frame, event, arg):
        if frame.f_code.co_filename != FILENAME:
            return None
        if event not in {{"line", "return", "exception"}}:
            return tracer
        if len(steps) >= max_steps:
            raise TraceLimitReached()
        line_no = frame.f_lineno
        line_text = source_lines[line_no - 1] if 0 < line_no <= len(source_lines) else ""
        locals_snapshot = snapshot_locals(frame)
        steps.append(
            {{
                "index": len(steps) + 1,
                "event": event,
                "line_no": line_no,
                "line_text": line_text,
                "function": frame.f_code.co_name,
                "locals": locals_snapshot,
                "stdout": stdout_capture.getvalue()[-2000:],
                "stderr": stderr_capture.getvalue()[-2000:],
                "narration": narrate(event, line_no, line_text, frame.f_code.co_name, len(locals_snapshot)),
            }}
        )
        return tracer

    status = "completed"
    exit_code = 0
    user_globals = {{"__name__": "__main__", "__file__": "algorithm_visualizer.py"}}
    sys.argv = ["algorithm_visualizer.py", *args]
    sys.stdin = io.StringIO(stdin_text)
    try:
        compiled = compile(code, FILENAME, "exec")
        with contextlib.redirect_stdout(stdout_capture), contextlib.redirect_stderr(stderr_capture):
            sys.settrace(tracer)
            try:
                exec(compiled, user_globals, user_globals)
            finally:
                sys.settrace(None)
    except TraceLimitReached:
        status = "truncated"
        logs.append(f"Trace stopped after {{max_steps}} steps so the browser stays responsive.")
    except Exception:
        status = "failed"
        exit_code = 1
        traceback.print_exc(file=stderr_capture)
        logs.append("Python raised an exception while the visualizer was tracing the algorithm.")

    stdout_text = stdout_capture.getvalue()
    stderr_text = stderr_capture.getvalue()
    if stdout_text:
        logs.append(f"stdout captured: {{len(stdout_text)}} characters.")
    if stderr_text:
        logs.append(f"stderr captured: {{len(stderr_text)}} characters.")
    if stdout_capture.truncated or stderr_capture.truncated:
        logs.append(f"Output was truncated to {{max_output}} characters per stream.")
    logs.append(f"Trace frames captured: {{len(steps)}}.")
    response = {{
        "status": status,
        "runner": "local-python-trace",
        "python_version": sys.version.split()[0],
        "exit_code": exit_code,
        "stdout": stdout_text,
        "stderr": stderr_text,
        "output": stdout_text + stderr_text,
        "steps": steps,
        "logs": logs,
    }}
    sys.__stdout__.write(JSON_START + "\n" + json.dumps(response) + "\n" + JSON_END + "\n")


main()
"""


async def visualize_python(payload: VisualizeRequest) -> VisualizeResponse:
    validate_code(payload.code)
    settings = get_settings()
    started = time.perf_counter()
    logs = [
        "Visualization request accepted by Algorithm Learn API.",
        "Preparing an isolated Python process with line-level tracing.",
        f"Max trace steps: {payload.max_steps}.",
    ]
    request = json.dumps(
        {
            "code": payload.code,
            "stdin": payload.stdin,
            "args": payload.args,
            "max_steps": payload.max_steps,
            "max_output": settings.execution_output_limit_bytes,
        }
    )
    with tempfile.TemporaryDirectory(prefix="algolearn-visual-") as temp_dir:
        process = await asyncio.create_subprocess_exec(
            sys.executable,
            "-I",
            "-c",
            VISUALIZER_SCRIPT,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=temp_dir,
            env={"PYTHONIOENCODING": "utf-8"},
            **_platform_resource_kwargs(settings.local_memory_limit_mb),
        )
        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(request.encode()),
                timeout=settings.execution_timeout_seconds + 2,
            )
        except TimeoutError:
            process.kill()
            await process.wait()
            elapsed = int((time.perf_counter() - started) * 1000)
            logs.append(f"Visualization exceeded timeout of {settings.execution_timeout_seconds + 2} seconds.")
            return VisualizeResponse(
                status="timeout",
                runner="local-python-trace",
                python_version=sys.version.split()[0],
                exit_code=None,
                execution_time_ms=elapsed,
                stderr=f"Visualization timed out after {settings.execution_timeout_seconds + 2} seconds.",
                output=f"Visualization timed out after {settings.execution_timeout_seconds + 2} seconds.",
                logs=logs,
            )

    elapsed = int((time.perf_counter() - started) * 1000)
    stdout_text = stdout.decode(errors="replace")
    stderr_text, stderr_truncated = _truncate(stderr.decode(errors="replace"), settings.execution_output_limit_bytes)
    parsed = _extract_visualizer_json(stdout_text)
    if parsed is None:
        logs.append("Visualizer did not return a valid trace payload.")
        if stderr_text:
            logs.append("The trace process wrote to stderr before a payload could be decoded.")
        return VisualizeResponse(
            status="failed",
            runner="local-python-trace",
            python_version=sys.version.split()[0],
            exit_code=process.returncode,
            execution_time_ms=elapsed,
            stdout=stdout_text,
            stderr=stderr_text,
            output=stdout_text + stderr_text,
            logs=logs,
        )

    parsed["execution_time_ms"] = elapsed
    parsed["logs"] = logs + parsed.get("logs", [])
    if stderr_text:
        parsed["stderr"] = parsed.get("stderr", "") + stderr_text
        parsed["output"] = parsed.get("stdout", "") + parsed["stderr"]
        parsed["logs"].append("Trace process emitted diagnostic stderr.")
    if stderr_truncated:
        parsed["logs"].append(f"Trace stderr was truncated to {settings.execution_output_limit_bytes} bytes.")
    if len(json.dumps(parsed).encode("utf-8")) > settings.visualization_response_limit_bytes:
        parsed["status"] = "truncated"
        parsed["steps"] = parsed.get("steps", [])[: max(1, len(parsed.get("steps", [])) // 2)]
        parsed["logs"].append("Trace response was reduced to stay within the configured response limit.")
    return VisualizeResponse.model_validate(parsed)


def _extract_visualizer_json(stdout_text: str) -> dict | None:
    start = stdout_text.find(JSON_START)
    end = stdout_text.find(JSON_END)
    if start == -1 or end == -1 or end <= start:
        return None
    payload_text = stdout_text[start + len(JSON_START) : end].strip()
    try:
        payload = json.loads(payload_text)
    except json.JSONDecodeError:
        return None
    return payload if isinstance(payload, dict) else None


def _truncate(value: str, limit: int) -> tuple[str, bool]:
    encoded = value.encode("utf-8", errors="replace")
    if len(encoded) <= limit:
        return value, False
    return encoded[:limit].decode("utf-8", errors="replace") + "\n[truncated]\n", True
