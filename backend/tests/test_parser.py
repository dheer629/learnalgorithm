from pathlib import Path

from app.services.parser import parse_python_file


def test_parse_python_file_extracts_docstrings_and_doctests(tmp_path: Path) -> None:
    sample = tmp_path / "binary_search.py"
    sample.write_text(
        '"""Binary search.\n\nTime Complexity: O(log n)\n\n>>> binary_search([1, 2], 2)\n1\n"""\n'
        "def binary_search(values, target):\n"
        '    """Find target."""\n'
        "    return values.index(target)\n",
        encoding="utf-8",
    )

    parsed = parse_python_file(sample)

    assert parsed.name == "Binary Search"
    assert parsed.description == "Binary search."
    assert parsed.doctests == ["binary_search([1, 2], 2)"]
    assert parsed.complexity["time"] == "O(log n)"
    assert parsed.functions[0]["signature"] == "binary_search(values, target)"

